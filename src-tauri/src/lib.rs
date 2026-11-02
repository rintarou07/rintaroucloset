pub mod bulk_downloader;
pub mod commands;
pub mod metadata;
pub mod mod_engine;
pub mod patcher;
pub mod portable;
pub mod updater;

use bulk_downloader::BulkDownloadManager;
use patcher::PatcherManager;
use portable::{ActiveSkinProfile, AppConfig, PortablePaths};
use std::collections::HashMap;
use std::sync::Mutex;
use tauri::Manager;

/// Application state managed across Tauri commands
pub struct AppState {
    pub paths: PortablePaths,
    pub config: Mutex<AppConfig>,
    pub patcher: PatcherManager,
    pub bulk_downloader: BulkDownloadManager,
    pub friend_skins: Mutex<HashMap<u32, ActiveSkinProfile>>,
}

pub fn run() {
    tracing_subscriber::fmt::init();

    // Initialize portable paths (creates ./data/* and sets WEBVIEW2_USER_DATA_FOLDER)
    let portable_paths = PortablePaths::new().expect("Failed to initialize portable paths");
    let initial_config = portable_paths
        .load_and_validate_config()
        .unwrap_or_default();

    let app_state = AppState {
        paths: portable_paths,
        config: Mutex::new(initial_config),
        patcher: PatcherManager::new(),
        bulk_downloader: BulkDownloadManager::new(),
        friend_skins: Mutex::new(HashMap::new()),
    };

    tauri::Builder::default()
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                // Ensure default 1280x720 16:9 ratio on startup and center on screen
                let _ = window.set_size(tauri::Size::Logical(tauri::LogicalSize {
                    width: 1280.0,
                    height: 720.0,
                }));
                let _ = window.center();

                if PortablePaths::is_test_mode() {
                    let _ = window.set_title("Rintarou Closet - [BẢN TEST: Faker #T1]");
                }

                // Listen for window state changes: when restored from fullscreen / maximize,
                // automatically reset window to exact 1280x720 resolution.
                let win_clone = window.clone();
                let was_maximized = std::sync::Arc::new(std::sync::atomic::AtomicBool::new(false));
                let was_fullscreen = std::sync::Arc::new(std::sync::atomic::AtomicBool::new(false));

                window.on_window_event(move |event| {
                    if let tauri::WindowEvent::Resized(_) = event {
                        let is_max = win_clone.is_maximized().unwrap_or(false);
                        let is_full = win_clone.is_fullscreen().unwrap_or(false);

                        let prev_max = was_maximized.swap(is_max, std::sync::atomic::Ordering::SeqCst);
                        let prev_full = was_fullscreen.swap(is_full, std::sync::atomic::Ordering::SeqCst);

                        // If user just restored (unmaximized or exited fullscreen) -> enforce 1280x720
                        if (prev_max && !is_max) || (prev_full && !is_full) {
                            let _ = win_clone.set_size(tauri::Size::Logical(tauri::LogicalSize {
                                width: 1280.0,
                                height: 720.0,
                            }));
                        }
                    }
                });
            }
            Ok(())
        })
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            commands::init_portable_env,
            commands::sync_metadata,
            commands::get_config,
            commands::get_current_summoner,
            commands::get_catalog,
            commands::get_active_skins,
            commands::is_fantome_cached,
            commands::ensure_skin_cached,
            commands::set_game_path,
            commands::apply_skin,
            commands::remove_skin,
            commands::clear_overlay,
            commands::rebuild_overlay,
            commands::rebuild_overlay_with_friends,
            commands::start_patcher,
            commands::stop_patcher,
            commands::get_patcher_status,
            commands::get_sync_config,
            commands::set_sync_config,
            commands::check_repo_status,
            commands::start_bulk_download,
            commands::stop_bulk_download,
            commands::get_bulk_download_status,
            commands::is_test_instance,
            commands::sync_local_peer,
            commands::record_local_conflict,
            commands::get_local_conflicts,
            commands::check_for_updates,
            commands::download_and_apply_update,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
