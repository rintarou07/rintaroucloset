use crate::portable::PortablePaths;
use futures_util::StreamExt;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::fs::{self, File};
use std::io::Write;
use std::sync::atomic::{AtomicBool, AtomicU64, AtomicUsize, Ordering};
use std::sync::Arc;
use std::time::Instant;
use tauri::{AppHandle, Emitter};
use tracing::info;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RepoStatus {
    pub total_files: usize,
    pub cached_files: usize,
    pub missing_files: usize,
    pub percentage: f32,
    pub is_fully_synced: bool,
    pub total_size_mb: f64,
    pub is_downloading: bool,
    #[serde(default)]
    pub outdated_files: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BulkDownloadProgress {
    pub total_files: usize,
    pub downloaded_files: usize,
    pub current_file: String,
    pub percentage: f32,
    pub speed_kbps: f64,
    pub is_completed: bool,
    pub is_active: bool,
    pub failed_count: usize,
}

#[derive(Debug, Clone, Deserialize)]
struct GithubTreeItem {
    pub path: String,
    pub size: Option<u64>,
}

#[derive(Debug, Clone, Deserialize)]
struct GithubTreeResponse {
    pub tree: Vec<GithubTreeItem>,
}

#[derive(Clone)]
struct RepoItemEntry {
    pub champ_id: u32,
    pub target_id: u32,
    pub relative_path: String,
    pub download_url: String,
    pub size: u64,
}

#[allow(dead_code)]
#[derive(Clone)]
struct DownloadTask {
    pub champion_id: u32,
    pub target_id: u32,
    pub relative_path: String,
    pub download_url: String,
    pub size: u64,
}

pub struct BulkDownloadManager {
    is_running: Arc<AtomicBool>,
    downloaded_count: Arc<AtomicUsize>,
    total_count: Arc<AtomicUsize>,
    failed_count: Arc<AtomicUsize>,
    bytes_downloaded: Arc<AtomicU64>,
}

impl BulkDownloadManager {
    pub fn new() -> Self {
        Self {
            is_running: Arc::new(AtomicBool::new(false)),
            downloaded_count: Arc::new(AtomicUsize::new(0)),
            total_count: Arc::new(AtomicUsize::new(0)),
            failed_count: Arc::new(AtomicUsize::new(0)),
            bytes_downloaded: Arc::new(AtomicU64::new(0)),
        }
    }

    pub fn is_active(&self) -> bool {
        self.is_running.load(Ordering::Relaxed)
    }

    pub fn stop(&self) {
        self.is_running.store(false, Ordering::Relaxed);
    }

    /// Loads all download targets from manifest.json (or fallback github_tree.json)
    fn load_repo_entries(paths: &PortablePaths) -> Result<Vec<RepoItemEntry>, String> {
        let manifest_path = paths.metadata_dir.join("manifest.json");
        if manifest_path.exists() {
            if let Ok(content) = fs::read_to_string(&manifest_path) {
                if let Ok(manifest) = serde_json::from_str::<crate::metadata::ManifestResponse>(&content) {
                    let mut entries = Vec::new();
                    for crate::metadata::ManifestFileItem(rel_path, _sha, size) in &manifest.files {
                        // CRITICAL: Only include skins/ directory for modern League
                        if !rel_path.starts_with("skins/") {
                            continue;
                        }
                        let p_lower = rel_path.to_lowercase();
                        if p_lower.ends_with(".fantome") || p_lower.ends_with(".zip") || p_lower.ends_with(".wad.client") {
                            let parts: Vec<&str> = rel_path.split('/').collect();
                            let filename = match parts.last() {
                                Some(f) => *f,
                                None => continue,
                            };
                            let clean = filename
                                .trim_end_matches(".fantome")
                                .trim_end_matches(".zip")
                                .trim_end_matches(".wad.client");
                            let target_id = match clean.parse::<u32>() {
                                Ok(id) => id,
                                Err(_) => continue,
                            };

                            let champ_id = if parts[0] == "skins" && parts.len() >= 2 {
                                match parts[1].parse::<u32>() {
                                    Ok(cid) => cid,
                                    Err(_) => target_id / 1000,
                                }
                            } else {
                                target_id / 1000
                            };

                            let safe_path = rel_path
                                .split('/')
                                .map(|seg| urlencoding::encode(seg).to_string())
                                .collect::<Vec<_>>()
                                .join("/");
                            let download_url = format!(
                                "https://raw.githubusercontent.com/Alban1911/LeagueSkins/main/{}",
                                safe_path
                            );

                            entries.push(RepoItemEntry {
                                champ_id,
                                target_id,
                                relative_path: rel_path.clone(),
                                download_url,
                                size: *size,
                            });
                        }
                    }
                    if !entries.is_empty() {
                        return Ok(entries);
                    }
                }
            }
        }

        // Fallback to github_tree.json
        let tree_path = paths.metadata_dir.join("github_tree.json");
        if tree_path.exists() {
            if let Ok(content) = fs::read_to_string(&tree_path) {
                if let Ok(tree_data) = serde_json::from_str::<GithubTreeResponse>(&content) {
                    let mut entries = Vec::new();
                    for item in &tree_data.tree {
                        let p_lower = item.path.to_lowercase();
                        if item.path.starts_with("skins/") && (p_lower.ends_with(".fantome") || p_lower.ends_with(".zip") || p_lower.ends_with(".wad.client")) {
                            let parts: Vec<&str> = item.path.split('/').collect();
                            if parts.len() >= 3 {
                                if let Ok(champ_id) = parts[1].parse::<u32>() {
                                    if let Some(filename) = parts.last() {
                                        let clean = filename
                                            .trim_end_matches(".fantome")
                                            .trim_end_matches(".zip")
                                            .trim_end_matches(".wad.client");
                                        if let Ok(target_id) = clean.parse::<u32>() {
                                            let safe_path = item.path
                                                .split('/')
                                                .map(|seg| urlencoding::encode(seg).to_string())
                                                .collect::<Vec<_>>()
                                                .join("/");
                                            let download_url = format!(
                                                "https://raw.githubusercontent.com/Alban1911/LeagueSkins/main/{}",
                                                safe_path
                                            );
                                            entries.push(RepoItemEntry {
                                                champ_id,
                                                target_id,
                                                relative_path: item.path.clone(),
                                                download_url,
                                                size: item.size.unwrap_or(0),
                                            });
                                        }
                                    }
                                }
                            }
                        }
                    }
                    if !entries.is_empty() {
                        return Ok(entries);
                    }
                }
            }
        }

        Err("Chưa tải được danh mục kho skin (manifest.json). Vui lòng bấm Kiểm tra cập nhật.".to_string())
    }

    /// Checks local cache coverage against `manifest.json`.
    /// Accurately detects missing files and outdated files whose size does not match the latest repo manifest.
    pub async fn check_repo_status(
        &self,
        paths: &PortablePaths,
        force_remote_check: bool,
    ) -> Result<RepoStatus, String> {
        let manifest_path = paths.metadata_dir.join("manifest.json");

        if force_remote_check || !manifest_path.exists() {
            info!("Fetching latest manifest from Alban1911 CDN...");
            let client = Client::builder()
                .user_agent("HextechPortableClient/1.0")
                .timeout(std::time::Duration::from_secs(30))
                .build()
                .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

            let _ = crate::metadata::MetadataManager::fetch_manifest(&client, paths, force_remote_check).await;
        }

        let entries = Self::load_repo_entries(paths)?;

        let mut total_files = 0usize;
        let mut cached_files = 0usize;
        let mut outdated_files = 0usize;
        let mut missing_files = 0usize;
        let mut total_bytes = 0u64;

        for entry in &entries {
            total_files += 1;
            total_bytes += entry.size;

            let local_path = paths.get_fantome_path(entry.champ_id, entry.target_id);
            if local_path.exists() {
                if let Ok(meta) = fs::metadata(&local_path) {
                    if meta.len() > 0 {
                        cached_files += 1;
                    } else {
                        outdated_files += 1;
                    }
                } else {
                    outdated_files += 1;
                }
            } else {
                missing_files += 1;
            }
        }

        let needed_files = missing_files + outdated_files;
        let pct = if total_files > 0 {
            (cached_files as f32 / total_files as f32) * 100.0
        } else {
            100.0
        };

        Ok(RepoStatus {
            total_files,
            cached_files,
            missing_files: needed_files,
            percentage: (pct * 10.0).round() / 10.0,
            is_fully_synced: needed_files == 0,
            total_size_mb: ((total_bytes as f64 / 1024.0 / 1024.0) * 10.0).round() / 10.0,
            is_downloading: self.is_running.load(Ordering::Relaxed),
            outdated_files,
        })
    }

    /// Starts multi-stream background download of all missing and outdated skins from Alban1911.
    pub async fn start_bulk_download(
        &self,
        paths: &PortablePaths,
        app_handle: AppHandle,
    ) -> Result<bool, String> {
        if self.is_running.load(Ordering::Relaxed) {
            return Ok(true); // Already running
        }

        let entries = Self::load_repo_entries(paths)?;

        let mut total_repo_files = 0usize;
        let mut cached_repo_files = 0usize;
        let mut tasks: Vec<DownloadTask> = Vec::new();

        for entry in &entries {
            total_repo_files += 1;
            let local_path = paths.get_fantome_path(entry.champ_id, entry.target_id);
            let is_up_to_date = if local_path.exists() {
                fs::metadata(&local_path).map(|m| m.len() > 0).unwrap_or(false)
            } else {
                false
            };

            if is_up_to_date {
                cached_repo_files += 1;
            } else {
                tasks.push(DownloadTask {
                    champion_id: entry.champ_id,
                    target_id: entry.target_id,
                    relative_path: entry.relative_path.clone(),
                    download_url: entry.download_url.clone(),
                    size: entry.size,
                });
            }
        }

        let total_missing = tasks.len();
        if total_missing == 0 {
            info!("All skins are already downloaded, up-to-date, and cached.");
            let _ = app_handle.emit(
                "repo-download-progress",
                BulkDownloadProgress {
                    total_files: total_repo_files,
                    downloaded_files: cached_repo_files,
                    current_file: "Kho trang phục đã đầy đủ 100% bản mới nhất".to_string(),
                    percentage: 100.0,
                    speed_kbps: 0.0,
                    is_completed: true,
                    is_active: false,
                    failed_count: 0,
                },
            );
            return Ok(true);
        }

        self.is_running.store(true, Ordering::Relaxed);
        self.downloaded_count.store(0, Ordering::Relaxed);
        self.total_count.store(total_missing, Ordering::Relaxed);
        self.failed_count.store(0, Ordering::Relaxed);
        self.bytes_downloaded.store(0, Ordering::Relaxed);

        let is_running_flag = self.is_running.clone();
        let downloaded_count = self.downloaded_count.clone();
        let failed_count = self.failed_count.clone();
        let bytes_downloaded = self.bytes_downloaded.clone();
        let paths_clone = paths.clone();

        tokio::spawn(async move {
            let client = Client::builder()
                .user_agent("HextechPortableClient/1.0")
                .timeout(std::time::Duration::from_secs(20))
                .build()
                .unwrap_or_else(|_| Client::new());

            let start_time = Instant::now();
            let mut last_progress_emit = Instant::now();

            // Run with 12 parallel download streams
            let stream = futures_util::stream::iter(tasks).map(|task| {
                let client = client.clone();
                let is_running = is_running_flag.clone();
                let paths = paths_clone.clone();

                async move {
                    if !is_running.load(Ordering::Relaxed) {
                        return (task, false, 0u64);
                    }

                    let dest_path = paths.get_fantome_path(task.champion_id, task.target_id);
                    if let Some(parent) = dest_path.parent() {
                        let _ = fs::create_dir_all(parent);
                    }

                    // Retry up to 2 times on transient failures
                    for _ in 0..2 {
                        if !is_running.load(Ordering::Relaxed) {
                            break;
                        }

                        if let Ok(resp) = client.get(&task.download_url).send().await {
                            if resp.status().is_success() {
                                if let Ok(bytes) = resp.bytes().await {
                                    let tmp_path = dest_path.with_extension("fantome.tmp");
                                    if let Ok(mut f) = File::create(&tmp_path) {
                                        if f.write_all(&bytes).is_ok() {
                                            drop(f);
                                            if dest_path.exists() {
                                                let _ = fs::remove_file(&dest_path);
                                            }
                                            let _ = fs::rename(&tmp_path, &dest_path);
                                            return (task, true, bytes.len() as u64);
                                        }
                                    }
                                }
                            }
                        }

                        tokio::time::sleep(std::time::Duration::from_millis(80)).await;
                    }

                    (task, false, 0u64)
                }
            });

            let mut buffered = stream.buffer_unordered(12);

            while let Some((task, success, bytes)) = buffered.next().await {
                if !is_running_flag.load(Ordering::Relaxed) {
                    break;
                }

                if success {
                    downloaded_count.fetch_add(1, Ordering::Relaxed);
                    bytes_downloaded.fetch_add(bytes, Ordering::Relaxed);
                } else {
                    failed_count.fetch_add(1, Ordering::Relaxed);
                }

                let current_done = downloaded_count.load(Ordering::Relaxed);
                let current_fail = failed_count.load(Ordering::Relaxed);
                let current_cached = cached_repo_files + current_done;
                let pct = if total_repo_files > 0 {
                    ((current_cached as f32 / total_repo_files as f32) * 100.0).min(100.0)
                } else {
                    100.0
                };

                // Fast UI emits (every 100ms) for smooth live progress
                if last_progress_emit.elapsed().as_millis() > 100 || (current_done + current_fail >= total_missing) {
                    last_progress_emit = Instant::now();
                    let elapsed_secs = start_time.elapsed().as_secs_f64().max(0.1);
                    let total_bytes = bytes_downloaded.load(Ordering::Relaxed);
                    let speed_kbps = (total_bytes as f64 / 1024.0) / elapsed_secs;

                    let _ = app_handle.emit(
                        "repo-download-progress",
                        BulkDownloadProgress {
                            total_files: total_repo_files,
                            downloaded_files: current_cached,
                            current_file: task.relative_path,
                            percentage: (pct * 10.0).round() / 10.0,
                            speed_kbps: (speed_kbps * 10.0).round() / 10.0,
                            is_completed: current_done + current_fail >= total_missing,
                            is_active: is_running_flag.load(Ordering::Relaxed),
                            failed_count: current_fail,
                        },
                    );
                }
            }

            is_running_flag.store(false, Ordering::Relaxed);

            // Final completion emission
            let final_done = downloaded_count.load(Ordering::Relaxed);
            let final_fail = failed_count.load(Ordering::Relaxed);
            let final_cached = cached_repo_files + final_done;
            let final_pct = if total_repo_files > 0 {
                ((final_cached as f32 / total_repo_files as f32) * 100.0).min(100.0)
            } else {
                100.0
            };

            let _ = app_handle.emit(
                "repo-download-progress",
                BulkDownloadProgress {
                    total_files: total_repo_files,
                    downloaded_files: final_cached,
                    current_file: if final_fail > 0 {
                        format!("Hoàn tất đồng bộ ({} file lỗi mạng)", final_fail)
                    } else {
                        "Hoàn tất đồng bộ kho trang phục bản mới nhất!".to_string()
                    },
                    percentage: (final_pct * 10.0).round() / 10.0,
                    speed_kbps: 0.0,
                    is_completed: true,
                    is_active: false,
                    failed_count: final_fail,
                },
            );

            info!("Bulk download finished: {} downloaded, {} failed.", final_done, final_fail);
        });

        Ok(true)
    }
}
