use crate::metadata::{MetadataManager, MetadataSyncResult};
use crate::mod_engine::{
    ApplySkinRequest, ApplySkinResponse, ModEngine, OverlayBuildSummary, RemoveSkinResponse,
};
use crate::patcher::PatcherStatePayload;
use crate::portable::{ActiveSkinProfile, AppConfig, PortablePaths};
use crate::AppState;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use tauri::{AppHandle, State};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InitEnvironmentResult {
    pub paths: PortablePaths,
    pub config: AppConfig,
    pub is_game_path_valid: bool,
    pub auto_detected: bool,
}

/// Merges active local skins with any active friend skins,
/// ensuring local user's selected skins take precedence on champ collision.
fn get_merged_config(state: &State<'_, AppState>) -> Result<AppConfig, String> {
    let mut config = state.paths.load_and_validate_config()?;
    if let Ok(friends) = state.friend_skins.lock() {
        for (champ_id, fs) in friends.iter() {
            config.active_skins.entry(*champ_id).or_insert_with(|| fs.clone());
        }
    }
    Ok(config)
}

/// Initializes portable directories, sets WebView2 environment, and validates/auto-detects LoL path.
#[tauri::command]
pub async fn init_portable_env(
    state: State<'_, AppState>,
) -> Result<InitEnvironmentResult, String> {
    // Ensure patcher binaries are auto-extracted from embedded bundle if missing
    let _ = crate::patcher::PatcherManager::verify_binaries(&state.paths.patcher_dir);

    let mut config = state.paths.load_and_validate_config()?;
    let is_valid = config
        .lol_game_path
        .as_ref()
        .map(|p| PortablePaths::validate_league_path(p))
        .unwrap_or(false);

    let mut auto_detected = false;
    if !is_valid {
        if let Some(detected) = PortablePaths::auto_detect_league_path() {
            config.lol_game_path = Some(detected);
            let _ = state.paths.save_config(&config);
            auto_detected = true;
        }
    }

    let is_final_valid = config
        .lol_game_path
        .as_ref()
        .map(|p| PortablePaths::validate_league_path(p))
        .unwrap_or(false);

    // Update state mutex
    if let Ok(mut cfg_guard) = state.config.lock() {
        *cfg_guard = config.clone();
    }

    Ok(InitEnvironmentResult {
        paths: state.paths.clone(),
        config,
        is_game_path_valid: is_final_valid,
        auto_detected,
    })
}

/// Synchronizes CDragon Vietnamese & English metadata with Alban1911/LeagueSkins tree cache.
#[tauri::command]
pub async fn sync_metadata(
    force_refresh: bool,
    state: State<'_, AppState>,
) -> Result<MetadataSyncResult, String> {
    MetadataManager::sync_metadata(&state.paths, force_refresh).await
}

/// Returns current portable configuration and game path status.
#[tauri::command]
pub async fn get_config(state: State<'_, AppState>) -> Result<AppConfig, String> {
    state.paths.load_and_validate_config()
}

/// Passively retrieves summoner profile from the local LCU client API without touching game memory.
#[tauri::command]
pub async fn get_current_summoner(
    state: State<'_, AppState>,
) -> Result<crate::portable::SummonerProfile, String> {
    let mut config = state.paths.load_and_validate_config()?;
    let profile = crate::portable::LcuSummonerReader::get_current_summoner(&state.paths, &mut config).await;
    if let Ok(mut cfg_guard) = state.config.lock() {
        *cfg_guard = config;
    }
    Ok(profile)
}

/// Retrieves the unified champion & skin catalog for the client view.
#[tauri::command]
pub async fn get_catalog(
    state: State<'_, AppState>,
) -> Result<Vec<crate::metadata::ChampionItem>, String> {
    MetadataManager::get_catalog(&state.paths).await
}

/// Returns all currently active champion skin profiles.
#[tauri::command]
pub async fn get_active_skins(
    state: State<'_, AppState>,
) -> Result<HashMap<u32, ActiveSkinProfile>, String> {
    let config = state.paths.load_and_validate_config()?;
    Ok(config.active_skins)
}

/// Checks if a .fantome archive is already downloaded and present in local cache.
#[tauri::command]
pub async fn is_fantome_cached(
    champion_id: u32,
    skin_id: u32,
    state: State<'_, AppState>,
) -> Result<bool, String> {
    Ok(state.paths.is_fantome_cached(champion_id, skin_id))
}

/// Ensures a skin's .fantome archive is downloaded in background cache without building overlay.
#[tauri::command]
pub async fn ensure_skin_cached(
    request: ApplySkinRequest,
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<bool, String> {
    if state.paths.is_fantome_cached_and_valid(request.champion_id, request.skin_id) {
        return Ok(true);
    }

    let fantome_file = state.paths.get_fantome_path(request.champion_id, request.skin_id);
    ModEngine::download_fantome_with_fallback(&request, &fantome_file, Some(&app_handle)).await?;
    Ok(true)
}

/// Manually updates and saves the League of Legends path.
#[tauri::command]
pub async fn set_game_path(path: String, state: State<'_, AppState>) -> Result<bool, String> {
    let is_valid = PortablePaths::validate_league_path(&path);
    if !is_valid {
        return Err("Đường dẫn Liên Minh Huyền Thoại không hợp lệ hoặc không tìm thấy file thực thi.".to_string());
    }

    let mut config = state.paths.load_and_validate_config()?;
    config.lol_game_path = Some(path);
    state.paths.save_config(&config)?;

    if let Ok(mut cfg_guard) = state.config.lock() {
        *cfg_guard = config;
    }

    Ok(true)
}

/// Downloads (if not cached), extracts via `ltk_fantome`, and applies skin to WAD overlay via `ltk_overlay`.
#[tauri::command]
pub async fn apply_skin(
    request: ApplySkinRequest,
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<ApplySkinResponse, String> {
    let mut config = state.paths.load_and_validate_config()?;
    let mut res = ModEngine::apply_skin(&state.paths, &mut config, request, Some(&app_handle)).await?;

    if let Ok(mut cfg_guard) = state.config.lock() {
        *cfg_guard = config;
    }

    // Always rebuild combined overlay (local + friend skins)
    if let Ok(merged_config) = get_merged_config(&state) {
        if let Ok(build_res) = ModEngine::build_overlay(&state.paths, &merged_config, Some(&app_handle)) {
            res.wads_built = build_res.wads_built;
            res.wads_reused = build_res.wads_reused;
            res.duration_ms = build_res.duration_ms;
        }
    }

    Ok(res)
}

/// Removes active skin mod for a champion and refreshes the WAD overlay.
#[tauri::command]
pub async fn remove_skin(
    champion_id: u32,
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<RemoveSkinResponse, String> {
    let mut config = state.paths.load_and_validate_config()?;
    let res = ModEngine::remove_skin(&state.paths, &mut config, champion_id, Some(&app_handle))?;

    if let Ok(mut cfg_guard) = state.config.lock() {
        *cfg_guard = config;
    }

    // Always rebuild combined overlay (remaining local + friend skins)
    if let Ok(merged_config) = get_merged_config(&state) {
        let _ = ModEngine::build_overlay(&state.paths, &merged_config, Some(&app_handle));
    }

    Ok(res)
}

/// Clears all active skins and completely purges the `./data/overlay/` directory.
#[tauri::command]
pub async fn clear_overlay(state: State<'_, AppState>) -> Result<bool, String> {
    let mut config = state.paths.load_and_validate_config()?;
    ModEngine::clear_overlay(&state.paths, &mut config)?;

    if let Ok(mut cfg_guard) = state.config.lock() {
        *cfg_guard = config;
    }

    Ok(true)
}

/// Triggers an on-demand rebuild of `./data/overlay/` from the current active skins.
#[tauri::command]
pub async fn rebuild_overlay(
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<OverlayBuildSummary, String> {
    let merged_config = get_merged_config(&state)?;
    ModEngine::build_overlay(&state.paths, &merged_config, Some(&app_handle))
}

/// Builds WAD overlay merging local active skins with verified friends' active skins.
#[tauri::command]
pub async fn rebuild_overlay_with_friends(
    friend_skins: Vec<ActiveSkinProfile>,
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<OverlayBuildSummary, String> {
    if let Ok(mut lock) = state.friend_skins.lock() {
        lock.clear();
        for fs in friend_skins {
            lock.insert(fs.champion_id, fs);
        }
    }
    let merged_config = get_merged_config(&state)?;
    ModEngine::build_overlay(&state.paths, &merged_config, Some(&app_handle))
}

/// Starts the League of Legends injection patcher host process.
#[tauri::command]
pub async fn start_patcher(
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<PatcherStatePayload, String> {
    // 1. Ensure patcher binaries exist (auto-extracts embedded or downloads)
    let _ = crate::patcher::PatcherManager::ensure_binaries_online(&state.paths.patcher_dir).await;

    // 2. Guarantee overlay is built for any currently active skins (local + friends)
    if let Ok(merged_config) = get_merged_config(&state) {
        if !merged_config.active_skins.is_empty() {
            let _ = ModEngine::build_overlay(&state.paths, &merged_config, Some(&app_handle));
        }
    }

    state
        .patcher
        .start(&state.paths.patcher_dir, &state.paths.overlay_dir, Some(app_handle))
}

/// Stops the running patcher host process.
#[tauri::command]
pub fn stop_patcher(
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<PatcherStatePayload, String> {
    state.patcher.stop(Some(app_handle))
}

/// Gets the current status of the patcher.
#[tauri::command]
pub fn get_patcher_status(state: State<'_, AppState>) -> Result<PatcherStatePayload, String> {
    Ok(state.patcher.get_status())
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncConfigPayload {
    pub is_sync_enabled: bool,
}

/// Retrieves the P2P lobby sync configuration from `./data/config.json`.
#[tauri::command]
pub fn get_sync_config(state: State<'_, AppState>) -> Result<SyncConfigPayload, String> {
    let config = state.paths.load_and_validate_config()?;
    Ok(SyncConfigPayload {
        is_sync_enabled: config.is_sync_enabled,
    })
}

/// Sets and saves the P2P lobby sync configuration into `./data/config.json`.
#[tauri::command]
pub fn set_sync_config(
    payload: SyncConfigPayload,
    state: State<'_, AppState>,
) -> Result<SyncConfigPayload, String> {
    let mut config = state.paths.load_and_validate_config()?;
    config.is_sync_enabled = payload.is_sync_enabled;
    state.paths.save_config(&config)?;

    if let Ok(mut cfg_guard) = state.config.lock() {
        *cfg_guard = config.clone();
    }

    Ok(SyncConfigPayload {
        is_sync_enabled: config.is_sync_enabled,
    })
}

/// Checks Alban1911 repository status and local cache coverage.
#[tauri::command]
pub async fn check_repo_status(
    force_remote_check: bool,
    state: State<'_, AppState>,
) -> Result<crate::bulk_downloader::RepoStatus, String> {
    state
        .bulk_downloader
        .check_repo_status(&state.paths, force_remote_check)
        .await
}

/// Starts downloading all missing skins from Alban1911 in the background.
#[tauri::command]
pub async fn start_bulk_download(
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<bool, String> {
    state
        .bulk_downloader
        .start_bulk_download(&state.paths, app_handle)
        .await
}

/// Stops / pauses the active bulk download.
#[tauri::command]
pub fn stop_bulk_download(state: State<'_, AppState>) -> Result<bool, String> {
    state.bulk_downloader.stop();
    Ok(true)
}

/// Gets whether bulk download is currently active.
#[tauri::command]
pub fn get_bulk_download_status(state: State<'_, AppState>) -> Result<bool, String> {
    Ok(state.bulk_downloader.is_active())
}

/// Checks if this instance is running in Test Mode (Mock Friend Desktop Client).
#[tauri::command]
pub fn is_test_instance(state: State<'_, AppState>) -> bool {
    state.paths.is_test
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LocalPeerPayload {
    pub room: String,
    pub summoner_name: String,
    pub summoner_icon_url: Option<String>,
    pub active_skins: HashMap<u32, ActiveSkinProfile>,
    pub is_injected: bool,
    #[serde(default)]
    pub last_seen: u64,
}

/// Synchronizes presence locally on disk between concurrent desktop instances.
/// Guarantees 0ms latency and 100% stable connection without internet drops.
#[tauri::command]
pub fn sync_local_peer(
    payload: LocalPeerPayload,
    state: State<'_, AppState>,
) -> Result<Vec<LocalPeerPayload>, String> {
    let name_trimmed = payload.summoner_name.trim();
    let name_lower = name_trimmed.to_lowercase();
    let is_dummy_user = name_trimmed.is_empty()
        || name_lower == "summoner"
        || name_lower == "summoner #offline"
        || name_lower == "test_probe"
        || name_lower.starts_with("chưa đăng nhập")
        || name_lower.starts_with("chua dang nhap");

    let clean_room = if payload.room.trim().is_empty() {
        "default"
    } else {
        payload.room.trim()
    };
    let room_dir = state.paths.sync_peers_dir.join(clean_room);
    let _ = fs::create_dir_all(&room_dir);

    let now_ms = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64;

    // Only write our presence to disk if we have a genuine summoner name
    if !is_dummy_user {
        let safe_name: String = payload
            .summoner_name
            .chars()
            .map(|c| if c.is_alphanumeric() { c } else { '_' })
            .collect();

        let my_file = room_dir.join(format!("{}.json", safe_name));
        let mut updated_payload = payload.clone();
        updated_payload.last_seen = now_ms;

        if let Ok(json_str) = serde_json::to_string(&updated_payload) {
            let _ = fs::write(&my_file, json_str);
        }
    }

    let mut peers = Vec::new();
    if let Ok(entries) = fs::read_dir(&room_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().map(|e| e == "json").unwrap_or(false) {
                // Delete any residual ghost Summoner files
                let stem = path.file_stem().unwrap_or_default().to_string_lossy().to_lowercase();
                if stem == "summoner" || stem == "summoner__offline" || stem == "test_probe" {
                    let _ = fs::remove_file(&path);
                    continue;
                }

                if let Ok(content) = fs::read_to_string(&path) {
                    if let Ok(peer) = serde_json::from_str::<LocalPeerPayload>(&content) {
                        let peer_name_lower = peer.summoner_name.trim().to_lowercase();
                        if peer_name_lower == "summoner"
                            || peer_name_lower == "summoner #offline"
                            || peer_name_lower == "test_probe"
                            || peer_name_lower.starts_with("chưa đăng nhập")
                            || peer_name_lower.is_empty()
                        {
                            let _ = fs::remove_file(&path);
                            continue;
                        }

                        if now_ms.saturating_sub(peer.last_seen) > 60000 {
                            let _ = fs::remove_file(&path);
                        } else if peer.summoner_name != payload.summoner_name {
                            peers.push(peer);
                        }
                    }
                }
            }
        }
    }

    Ok(peers)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LocalConflictPayload {
    pub room: String,
    pub champion_id: u32,
    pub from_summoner: String,
    pub target_summoner: String,
    pub action: String,
    #[serde(default)]
    pub timestamp: u64,
}

/// Records a conflict resolution decision locally on disk.
#[tauri::command]
pub fn record_local_conflict(
    payload: LocalConflictPayload,
    state: State<'_, AppState>,
) -> Result<bool, String> {
    let clean_room = if payload.room.trim().is_empty() {
        "default"
    } else {
        payload.room.trim()
    };
    let room_dir = state.paths.sync_conflicts_dir.join(clean_room);
    let _ = fs::create_dir_all(&room_dir);

    let conflict_file = room_dir.join(format!("{}.json", payload.champion_id));
    if let Ok(json_str) = serde_json::to_string(&payload) {
        let _ = fs::write(&conflict_file, json_str);
        return Ok(true);
    }
    Ok(false)
}

/// Reads all conflict resolution decisions for the current room.
#[tauri::command]
pub fn get_local_conflicts(
    room: String,
    state: State<'_, AppState>,
) -> Result<HashMap<u32, LocalConflictPayload>, String> {
    let clean_room = if room.trim().is_empty() {
        "default"
    } else {
        room.trim()
    };
    let room_dir = state.paths.sync_conflicts_dir.join(clean_room);
    let mut conflicts = HashMap::new();

    if let Ok(entries) = fs::read_dir(&room_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().map(|e| e == "json").unwrap_or(false) {
                if let Ok(content) = fs::read_to_string(&path) {
                    if let Ok(record) = serde_json::from_str::<LocalConflictPayload>(&content) {
                        conflicts.insert(record.champion_id, record);
                    }
                }
            }
        }
    }

    Ok(conflicts)
}

#[tauri::command]
pub async fn check_for_updates() -> Result<crate::updater::UpdateCheckResult, String> {
    crate::updater::UpdaterManager::check_for_updates().await
}

#[tauri::command]
pub async fn download_and_apply_update(
    app: AppHandle,
    download_url: String,
) -> Result<(), String> {
    crate::updater::UpdaterManager::download_and_apply_update(app, download_url).await
}
