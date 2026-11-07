use crate::portable::{ActiveSkinProfile, AppConfig, PortablePaths};
use camino::{Utf8Path, Utf8PathBuf};
use futures_util::StreamExt;
use ltk_fantome::{FantomeReader, WadExtractOptions};
use ltk_overlay::{EnabledMod, FantomeContent, OverlayBuilder, OverlayProgress, OverlayStage};
use serde::{Deserialize, Serialize};
use std::fs::{self, File};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::time::Instant;
use tauri::{AppHandle, Emitter};
use tracing::{info, warn};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApplySkinRequest {
    pub champion_id: u32,
    pub skin_id: u32,
    pub skin_name: String,
    pub is_chroma: bool,
    pub parent_skin_id: Option<u32>,
    pub fantome_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApplySkinResponse {
    pub success: bool,
    pub champion_id: u32,
    pub skin_id: u32,
    pub skin_name: String,
    pub fantome_cached: bool,
    pub wads_built: usize,
    pub wads_reused: usize,
    pub duration_ms: u128,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RemoveSkinResponse {
    pub success: bool,
    pub champion_id: u32,
    pub remaining_active_skins: usize,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OverlayBuildSummary {
    pub wads_built: usize,
    pub wads_reused: usize,
    pub duration_ms: u128,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadProgressPayload {
    pub skin_id: u32,
    pub downloaded_bytes: u64,
    pub total_bytes: u64,
    pub percentage: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OverlayProgressPayload {
    pub stage: String,
    pub current: u32,
    pub total: u32,
    pub message: String,
}

pub struct ModEngine;

impl ModEngine {
    /// Streams a .fantome file from GitHub or a direct mirror URL directly into the portable cache folder.
    /// Emits progress events over Tauri IPC and writes to a .part file before atomic finalization.
    pub async fn download_fantome(
        url: &str,
        dest_path: &Path,
        skin_id: u32,
        app_handle: Option<&AppHandle>,
    ) -> Result<u64, String> {
        info!("Starting download of .fantome for skin {} from {}", skin_id, url);

        let client = reqwest::Client::builder()
            .user_agent("HextechSkinClient/1.0.0 (Windows NT 10.0; Win64; x64)")
            .build()
            .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

        let res = client
            .get(url)
            .send()
            .await
            .map_err(|e| format!("Failed to connect to skin download server: {}", e))?;

        if !res.status().is_success() {
            return Err(format!(
                "Skin archive download failed with HTTP status: {}",
                res.status()
            ));
        }

        let total_bytes = res.content_length().unwrap_or(0);
        let part_path = dest_path.with_extension("fantome.part");

        if let Some(parent) = dest_path.parent() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create destination cache directory: {}", e))?;
        }

        let mut file = File::create(&part_path)
            .map_err(|e| format!("Failed to create temporary archive file {:?}: {}", part_path, e))?;

        let mut stream = res.bytes_stream();
        let mut downloaded_bytes: u64 = 0;
        let mut last_emitted_pct = -1.0;

        while let Some(chunk_result) = stream.next().await {
            let chunk = chunk_result.map_err(|e| format!("Error downloading chunk: {}", e))?;
            file.write_all(&chunk)
                .map_err(|e| format!("Failed to write chunk to disk: {}", e))?;

            downloaded_bytes += chunk.len() as u64;

            if total_bytes > 0 {
                let pct = ((downloaded_bytes as f64 / total_bytes as f64) * 100.0) as f32;
                if pct - last_emitted_pct >= 2.0 || downloaded_bytes == total_bytes {
                    last_emitted_pct = pct;
                    if let Some(handle) = app_handle {
                        let _ = handle.emit(
                            "download-progress",
                            DownloadProgressPayload {
                                skin_id,
                                downloaded_bytes,
                                total_bytes,
                                percentage: pct,
                            },
                        );
                    }
                }
            }
        }

        file.flush()
            .map_err(|e| format!("Failed to flush archive to disk: {}", e))?;
        drop(file);

        // Atomic replace into final target path
        if dest_path.exists() {
            let _ = fs::remove_file(dest_path);
        }
        fs::rename(&part_path, dest_path).map_err(|e| {
            format!(
                "Failed to finalize .fantome file from {:?} to {:?}: {}",
                part_path, dest_path, e
            )
        })?;

        info!(
            "Successfully downloaded .fantome for skin {} ({} bytes)",
            skin_id, downloaded_bytes
        );

        Ok(downloaded_bytes)
    }

    /// Downloads skin or chroma archive trying multiple fallback candidate URLs from Alban1911/LeagueSkins.
    pub async fn download_fantome_with_fallback(
        req: &ApplySkinRequest,
        dest_path: &Path,
        app_handle: Option<&AppHandle>,
    ) -> Result<u64, String> {
        let mut candidate_urls: Vec<String> = Vec::new();

        // 1. Matched URL if provided
        if let Some(ref url) = req.fantome_url {
            if !url.trim().is_empty() {
                candidate_urls.push(url.clone());
            }
        }

        // 2. If chroma with parent_skin_id:
        if let Some(parent_id) = req.parent_skin_id {
            candidate_urls.push(format!(
                "https://raw.githubusercontent.com/Alban1911/LeagueSkins/main/skins/{}/{}/{}/{}.fantome",
                req.champion_id, parent_id, req.skin_id, req.skin_id
            ));
            candidate_urls.push(format!(
                "https://raw.githubusercontent.com/Alban1911/LeagueSkins/main/skins/{}/{}/{}/{}.zip",
                req.champion_id, parent_id, req.skin_id, req.skin_id
            ));
        }

        // 3. ID-based structure (skins/{champ_id}/{skin_id}/{skin_id}.fantome & .zip)
        candidate_urls.push(format!(
            "https://raw.githubusercontent.com/Alban1911/LeagueSkins/main/skins/{}/{}/{}.fantome",
            req.champion_id, req.skin_id, req.skin_id
        ));
        candidate_urls.push(format!(
            "https://raw.githubusercontent.com/Alban1911/LeagueSkins/main/skins/{}/{}/{}.zip",
            req.champion_id, req.skin_id, req.skin_id
        ));

        // 4. Direct champion folder (skins/{champ_id}/{skin_id}.fantome & .zip)
        candidate_urls.push(format!(
            "https://raw.githubusercontent.com/Alban1911/LeagueSkins/main/skins/{}/{}.fantome",
            req.champion_id, req.skin_id
        ));
        candidate_urls.push(format!(
            "https://raw.githubusercontent.com/Alban1911/LeagueSkins/main/skins/{}/{}.zip",
            req.champion_id, req.skin_id
        ));

        // 5. Classic folder (classic/{champ_id}/{skin_id}/{skin_id}.fantome)
        candidate_urls.push(format!(
            "https://raw.githubusercontent.com/Alban1911/LeagueSkins/main/classic/{}/{}/{}.fantome",
            req.champion_id, req.skin_id, req.skin_id
        ));

        let mut last_err = String::new();
        for url in &candidate_urls {
            info!("Attempting download of skin {} from candidate: {}", req.skin_id, url);
            match Self::download_fantome(url, dest_path, req.skin_id, app_handle).await {
                Ok(bytes) => {
                    info!("Successfully downloaded skin {} from {}", req.skin_id, url);
                    return Ok(bytes);
                }
                Err(e) => {
                    last_err = e;
                }
            }
        }

        Err(format!(
            "Không thể tải tệp skin {} từ bất kỳ nguồn nào. Đã thử {} địa chỉ. Lỗi cuối: {}",
            req.skin_id,
            candidate_urls.len(),
            last_err
        ))
    }

    /// Extracts a downloaded .fantome zip archive into `./data/mods/{skin_id}/` using `ltk_fantome`.
    pub fn extract_fantome(fantome_path: &Path, mods_dir: &Path, skin_id: u32) -> Result<PathBuf, String> {
        let dest_dir = mods_dir.join(skin_id.to_string());
        if dest_dir.exists() {
            let _ = fs::remove_dir_all(&dest_dir);
        }
        fs::create_dir_all(&dest_dir)
            .map_err(|e| format!("Failed to create mod extraction folder {:?}: {}", dest_dir, e))?;

        let file = File::open(fantome_path)
            .map_err(|e| format!("Failed to open .fantome archive {:?}: {}", fantome_path, e))?;

        let mut reader = FantomeReader::new(file)
            .map_err(|e| format!("Invalid or corrupted .fantome archive {:?}: {}", fantome_path, e))?;

        let content_dir = Utf8Path::from_path(&dest_dir)
            .ok_or_else(|| "Failed to convert mod destination path to UTF-8".to_string())?;

        // Extract declared WAD directory files
        reader
            .extract_wads(content_dir, WadExtractOptions::default())
            .map_err(|e| format!("Failed extracting WAD components from archive: {}", e))?;

        // Extract RAW assets if present
        reader
            .extract_raw(content_dir, None)
            .map_err(|e| format!("Failed extracting RAW components from archive: {}", e))?;

        // Extract game data manifest if present
        let _ = reader.extract_game_data(content_dir);

        info!("Extracted mod package into {:?}", dest_dir);
        Ok(dest_dir)
    }

    /// Rebuilds the game overlay directory `./data/overlay/` using `ltk_overlay::OverlayBuilder`.
    pub fn build_overlay(
        paths: &PortablePaths,
        config: &AppConfig,
        app_handle: Option<&AppHandle>,
    ) -> Result<OverlayBuildSummary, String> {
        let start = Instant::now();

        let game_path_str = config
            .lol_game_path
            .as_deref()
            .ok_or_else(|| "Đường dẫn Liên Minh Huyền Thoại chưa được cấu hình.".to_string())?;

        let game_dir_buf = PortablePaths::resolve_game_dir(game_path_str).ok_or_else(|| {
            format!(
                "Không tìm thấy thư mục Game của Liên Minh Huyền Thoại tại: {}",
                game_path_str
            )
        })?;

        let game_dir = Utf8PathBuf::from_path_buf(game_dir_buf)
            .map_err(|p| format!("Invalid UTF-8 in game directory path: {:?}", p))?;
        let overlay_root = Utf8PathBuf::from_path_buf(paths.overlay_dir.clone())
            .map_err(|p| format!("Invalid UTF-8 in overlay directory path: {:?}", p))?;
        let state_dir = Utf8PathBuf::from_path_buf(paths.data_dir.clone())
            .map_err(|p| format!("Invalid UTF-8 in data state directory path: {:?}", p))?;

        // If no skins are active, wipe the overlay directory cleanly
        if config.active_skins.is_empty() {
            info!("No skins currently active. Clearing overlay WAD files...");
            Self::wipe_overlay_directory(&paths.overlay_dir)?;
            return Ok(OverlayBuildSummary {
                wads_built: 0,
                wads_reused: 0,
                duration_ms: start.elapsed().as_millis(),
            });
        }

        info!(
            "Mounting {} active skin mods into overlay builder...",
            config.active_skins.len()
        );

        let mut enabled_mods: Vec<EnabledMod> = Vec::new();

        for (champ_id, profile) in &config.active_skins {
            let fantome_file = paths.get_fantome_path(*champ_id, profile.skin_id);
            if !fantome_file.exists() {
                warn!(
                    "Active skin .fantome missing for champion {}: {:?}",
                    champ_id, fantome_file
                );
                continue;
            }

            let utf8_fantome_file = Utf8PathBuf::from_path_buf(fantome_file.clone())
                .map_err(|p| format!("Invalid UTF-8 in .fantome path: {:?}", p))?;

            let file = File::open(&fantome_file)
                .map_err(|e| format!("Failed to open .fantome archive {:?}: {}", fantome_file, e))?;

            let content_provider = FantomeContent::new(file)
                .map_err(|e| format!("Failed reading .fantome structure for {}: {}", profile.skin_name, e))?
                .with_archive_path(utf8_fantome_file);

            enabled_mods.push(EnabledMod {
                id: format!("mod_{}_{}", champ_id, profile.skin_id),
                content: Box::new(content_provider),
                enabled_layers: None,
            });
        }

        let mut builder = OverlayBuilder::new(game_dir, overlay_root, state_dir);
        builder.set_enabled_mods(enabled_mods);

        if let Some(handle) = app_handle {
            let handle_clone = handle.clone();
            builder = builder.with_progress(move |progress: OverlayProgress| {
                let stage_name = match progress.stage {
                    OverlayStage::Indexing => "Đang quét danh mục WAD game gốc...",
                    OverlayStage::IndexingObjects => "Đang quét objects liên kết...",
                    OverlayStage::CollectingOverrides => "Đang đọc các file đè dữ liệu skin...",
                    OverlayStage::PatchingWad => "Đang tạo các file WAD overlay...",
                    OverlayStage::ApplyingStringOverrides => "Đang áp dụng chuỗi ngôn ngữ...",
                    _ => "Đang xử lý WAD overlay...",
                };
                let _ = handle_clone.emit(
                    "overlay-progress",
                    OverlayProgressPayload {
                        stage: stage_name.to_string(),
                        current: progress.current,
                        total: progress.total,
                        message: format!("{} ({}/{})", stage_name, progress.current, progress.total),
                    },
                );
            });
        }

        let build_res = builder
            .build()
            .map_err(|e| format!("Overlay build failed: {}", e))?;

        let duration = start.elapsed().as_millis();
        info!(
            "Overlay build completed successfully in {} ms. Built: {} WADs, Reused: {} WADs.",
            duration,
            build_res.wads_built.len(),
            build_res.wads_reused.len()
        );

        Ok(OverlayBuildSummary {
            wads_built: build_res.wads_built.len(),
            wads_reused: build_res.wads_reused.len(),
            duration_ms: duration,
        })
    }

    /// Wipes all files and subfolders inside `./data/overlay/`.
    pub fn wipe_overlay_directory(overlay_dir: &Path) -> Result<(), String> {
        if !overlay_dir.exists() {
            return Ok(());
        }
        for entry in fs::read_dir(overlay_dir)
            .map_err(|e| format!("Failed to read overlay directory: {}", e))?
            .flatten()
        {
            let path = entry.path();
            if path.is_dir() {
                let _ = fs::remove_dir_all(&path);
            } else {
                let _ = fs::remove_file(&path);
            }
        }
        Ok(())
    }

    /// Full workflow to apply a custom skin:
    /// 1. Verifies/Downloads .fantome on demand.
    /// 2. Extracts into `./data/mods/{skin_id}/`.
    /// 3. Registers skin into active profile list in `./data/config.json`.
    /// 4. Generates the WAD overlay in `./data/overlay/`.
    pub async fn apply_skin(
        paths: &PortablePaths,
        config: &mut AppConfig,
        req: ApplySkinRequest,
        app_handle: Option<&AppHandle>,
    ) -> Result<ApplySkinResponse, String> {
        let fantome_file = paths.get_fantome_path(req.champion_id, req.skin_id);
        let mut was_cached = paths.is_fantome_cached(req.champion_id, req.skin_id);

        if !was_cached {
            ModEngine::download_fantome_with_fallback(&req, &fantome_file, app_handle).await?;
            was_cached = true;
        }

        // Extract mod package for record/tools
        let _ = ModEngine::extract_fantome(&fantome_file, &paths.mods_dir, req.skin_id);

        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0);

        // Update active skin profile for this champion (only 1 skin per champion at a time)
        let profile = ActiveSkinProfile {
            champion_id: req.champion_id,
            skin_id: req.skin_id,
            chroma_id: if req.is_chroma { Some(req.skin_id) } else { None },
            skin_name: req.skin_name.clone(),
            is_chroma: req.is_chroma,
            parent_skin_id: req.parent_skin_id,
            fantome_path: fantome_file.to_string_lossy().to_string(),
            applied_at: now,
        };

        config.active_skins.insert(req.champion_id, profile);
        paths.save_config(config)?;

        // Immediately build overlay so data/overlay/ is 100% ready for patcher injection
        let build_res = ModEngine::build_overlay(paths, config, app_handle)?;

        Ok(ApplySkinResponse {
            success: true,
            champion_id: req.champion_id,
            skin_id: req.skin_id,
            skin_name: req.skin_name,
            fantome_cached: was_cached,
            wads_built: build_res.wads_built,
            wads_reused: build_res.wads_reused,
            duration_ms: build_res.duration_ms,
            message: "Đã kích hoạt trang phục và tạo WAD overlay thành công!".to_string(),
        })
    }

    /// Removes an active skin for a champion.
    pub fn remove_skin(
        paths: &PortablePaths,
        config: &mut AppConfig,
        champion_id: u32,
        app_handle: Option<&AppHandle>,
    ) -> Result<RemoveSkinResponse, String> {
        let removed = config.active_skins.remove(&champion_id);
        if removed.is_none() {
            return Ok(RemoveSkinResponse {
                success: true,
                champion_id,
                remaining_active_skins: config.active_skins.len(),
                message: "Trang phục của tướng này hiện không được kích hoạt.".to_string(),
            });
        }

        paths.save_config(config)?;

        // Rebuild overlay to reflect removed skin
        let _ = ModEngine::build_overlay(paths, config, app_handle);

        Ok(RemoveSkinResponse {
            success: true,
            champion_id,
            remaining_active_skins: config.active_skins.len(),
            message: "Đã hủy kích hoạt trang phục.".to_string(),
        })
    }

    /// Clears all active skins and completely empties the WAD overlay directory.
    pub fn clear_overlay(paths: &PortablePaths, config: &mut AppConfig) -> Result<(), String> {
        config.active_skins.clear();
        paths.save_config(config)?;
        Self::wipe_overlay_directory(&paths.overlay_dir)?;

        // Also remove overlay state cache if present
        let state_file = paths.data_dir.join("overlay.json");
        if state_file.exists() {
            let _ = fs::remove_file(state_file);
        }

        info!("Completely cleared all overlay mods and cached state.");
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_wipe_overlay_directory() {
        let temp_dir = std::env::temp_dir().join("hextech_test_overlay_wipe");
        let _ = fs::create_dir_all(temp_dir.join("DATA/FINAL"));
        let test_file = temp_dir.join("DATA/FINAL/test.wad.client");
        let _ = fs::write(&test_file, b"test content");
        assert!(test_file.exists());

        let res = ModEngine::wipe_overlay_directory(&temp_dir);
        assert!(res.is_ok());
        assert!(!test_file.exists());
        let _ = fs::remove_dir_all(&temp_dir);
    }
}
