use serde::{Deserialize, Serialize};
use std::io::{BufRead, BufReader, Write};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use std::thread;
use tauri::{AppHandle, Emitter};
use tracing::{info, warn};

#[cfg(windows)]
use std::os::windows::process::CommandExt;

const EMBEDDED_HOST_EXE: &[u8] = include_bytes!("../../data/patcher/ltk_patcher_host.exe");
const EMBEDDED_HOOK_DLL: &[u8] = include_bytes!("../../data/patcher/ltk_patcher_dll.dll");

/// Hook flag bits forwarded to the host via `config flags <N>`
pub mod hook_flags {
    pub const DISABLE_VERIFY: u32 = 1;
    pub const DISABLE_FILE: u32 = 2;
    pub const OPT_OUT_AH_V1: u32 = 4;
    pub const FULL_WAD_SCAN: u32 = 8;
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum PatcherStatus {
    Stopped,
    Starting,
    Scanning,
    Injected,
    Waiting,
    Exited,
    Failed,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PatcherStatePayload {
    pub status: PatcherStatus,
    pub message: String,
    pub game_pid: Option<u32>,
}

impl Default for PatcherStatePayload {
    fn default() -> Self {
        Self {
            status: PatcherStatus::Stopped,
            message: "Patcher chưa được khởi chạy.".to_string(),
            game_pid: None,
        }
    }
}

struct ActivePatcherSession {
    child: Child,
    _stdin: Arc<Mutex<std::process::ChildStdin>>,
    status: Arc<Mutex<PatcherStatePayload>>,
}

#[derive(Clone, Default)]
pub struct PatcherManager {
    session: Arc<Mutex<Option<ActivePatcherSession>>>,
    last_status: Arc<Mutex<PatcherStatePayload>>,
}

impl PatcherManager {
    pub fn new() -> Self {
        Self {
            session: Arc::new(Mutex::new(None)),
            last_status: Arc::new(Mutex::new(PatcherStatePayload {
                status: PatcherStatus::Stopped,
                message: "Patcher chưa được khởi chạy.".to_string(),
                game_pid: None,
            })),
        }
    }

    /// Returns current state of the patcher.
    pub fn get_status(&self) -> PatcherStatePayload {
        let lock = self.last_status.lock().unwrap();
        lock.clone()
    }

    /// Verifies that patcher host and hook DLL exist in the portable patcher directory.
    /// If missing, smaller, or outdated compared to the embedded binaries,
    /// automatically extracts the new embedded binaries or falls back to remote download.
    pub fn verify_binaries(patcher_dir: &Path) -> Result<(PathBuf, PathBuf), String> {
        let _ = std::fs::create_dir_all(patcher_dir);
        let host_exe = patcher_dir.join("ltk_patcher_host.exe");
        let hook_dll = patcher_dir.join("ltk_patcher_dll.dll");

        // 1. Check host_exe: auto-extract if missing or different size from embedded binary
        let host_needs_extract = !host_exe.exists()
            || std::fs::metadata(&host_exe)
                .map(|m| m.len() != EMBEDDED_HOST_EXE.len() as u64)
                .unwrap_or(true);
        if host_needs_extract {
            info!("Auto-extracting embedded ltk_patcher_host.exe ({} bytes) into {:?}", EMBEDDED_HOST_EXE.len(), host_exe);
            if let Err(e) = std::fs::write(&host_exe, EMBEDDED_HOST_EXE) {
                warn!("Failed writing embedded host.exe: {}", e);
            }
        }

        // 2. Check hook_dll: auto-extract if missing or content differs from embedded binary
        let dll_needs_extract = !hook_dll.exists()
            || std::fs::read(&hook_dll)
                .map(|bytes| bytes != EMBEDDED_HOOK_DLL)
                .unwrap_or(true);
        if dll_needs_extract {
            info!("Auto-extracting patched embedded ltk_patcher_dll.dll ({} bytes) into {:?}", EMBEDDED_HOOK_DLL.len(), hook_dll);
            if let Err(e) = std::fs::write(&hook_dll, EMBEDDED_HOOK_DLL) {
                warn!("Failed writing embedded hook.dll: {}", e);
            }
        }

        // Also ensure any LTK Manager patcher cache uses our patched DLL
        if let Ok(appdata) = std::env::var("APPDATA") {
            let ltk_patcher_root = PathBuf::from(appdata).join("dev.leaguetoolkit.manager").join("patcher");
            if ltk_patcher_root.exists() {
                if let Ok(entries) = std::fs::read_dir(&ltk_patcher_root) {
                    for entry in entries.flatten() {
                        let path = entry.path();
                        if path.is_dir() {
                            let candidate_dll = path.join("ltk_patcher_dll.dll");
                            if candidate_dll.exists() {
                                let _ = std::fs::write(&candidate_dll, EMBEDDED_HOOK_DLL);
                            }
                        }
                    }
                }
            }
        }

        if !host_exe.exists() {
            return Err(format!(
                "Thiếu file thực thi patcher: {:?}. Vui lòng đảm bảo ltk_patcher_host.exe nằm trong data/patcher/.",
                host_exe
            ));
        }

        if !hook_dll.exists() {
            return Err(format!(
                "Thiếu thư viện hook: {:?}. Vui lòng đảm bảo ltk_patcher_dll.dll nằm trong data/patcher/.",
                hook_dll
            ));
        }

        Ok((host_exe, hook_dll))
    }

    /// Asynchronous verification that also supports downloading if embedded write fails.
    pub async fn ensure_binaries_online(patcher_dir: &Path) -> Result<(PathBuf, PathBuf), String> {
        let _ = std::fs::create_dir_all(patcher_dir);
        let host_exe = patcher_dir.join("ltk_patcher_host.exe");
        let hook_dll = patcher_dir.join("ltk_patcher_dll.dll");

        if !host_exe.exists() || std::fs::metadata(&host_exe).map(|m| m.len() != EMBEDDED_HOST_EXE.len() as u64).unwrap_or(true) {
            info!("Writing embedded ltk_patcher_host.exe...");
            if std::fs::write(&host_exe, EMBEDDED_HOST_EXE).is_err() {
                // Download fallback from official project repository releases
                info!("Downloading ltk_patcher_host.exe fallback...");
                if let Ok(client) = reqwest::Client::builder().timeout(std::time::Duration::from_secs(30)).build() {
                    let url = "https://raw.githubusercontent.com/rintarou07/rintaroucloset/main/releases/patcher/ltk_patcher_host.exe";
                    if let Ok(resp) = client.get(url).send().await {
                        if resp.status().is_success() {
                            if let Ok(bytes) = resp.bytes().await {
                                let _ = std::fs::write(&host_exe, bytes);
                            }
                        }
                    }
                }
            }
        }

        if !hook_dll.exists() || std::fs::read(&hook_dll).map(|b| b != EMBEDDED_HOOK_DLL).unwrap_or(true) {
            info!("Writing embedded ltk_patcher_dll.dll...");
            if std::fs::write(&hook_dll, EMBEDDED_HOOK_DLL).is_err() {
                // Download fallback from official project repository releases
                info!("Downloading ltk_patcher_dll.dll fallback...");
                if let Ok(client) = reqwest::Client::builder().timeout(std::time::Duration::from_secs(30)).build() {
                    let url = "https://raw.githubusercontent.com/rintarou07/rintaroucloset/main/releases/patcher/ltk_patcher_dll.dll";
                    if let Ok(resp) = client.get(url).send().await {
                        if resp.status().is_success() {
                            if let Ok(bytes) = resp.bytes().await {
                                let _ = std::fs::write(&hook_dll, bytes);
                            }
                        }
                    }
                }
            }
        }

        Self::verify_binaries(patcher_dir)
    }

    /// Starts `ltk_patcher_host.exe` and configures the overlay prefix to redirect file access.
    pub fn start(
        &self,
        patcher_dir: &Path,
        overlay_dir: &Path,
        app_handle: Option<AppHandle>,
    ) -> Result<PatcherStatePayload, String> {
        let mut session_guard = self.session.lock().unwrap();

        // If already running and process is still alive, return current status
        if let Some(ref mut sess) = *session_guard {
            if let Ok(None) = sess.child.try_wait() {
                let status = sess.status.lock().unwrap().clone();
                return Ok(status);
            }
        }

        let (host_exe, _) = Self::verify_binaries(patcher_dir)?;

        info!("Starting League patcher host: {:?}", host_exe);

        let mut cmd = Command::new(&host_exe);
        cmd.current_dir(patcher_dir)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        #[cfg(windows)]
        {
            const CREATE_NO_WINDOW: u32 = 0x08000000;
            cmd.creation_flags(CREATE_NO_WINDOW);
        }

        let mut child = cmd
            .spawn()
            .map_err(|e| format!("Không thể khởi chạy ltk_patcher_host.exe: {}", e))?;

        let stdin = child
            .stdin
            .take()
            .ok_or_else(|| "Failed to open stdin for patcher host".to_string())?;

        let stdout = child
            .stdout
            .take()
            .ok_or_else(|| "Failed to open stdout for patcher host".to_string())?;

        let stdin_arc = Arc::new(Mutex::new(stdin));

        // Format overlay prefix with trailing separator
        let mut prefix_str = overlay_dir.to_string_lossy().to_string();
        if !prefix_str.ends_with('\\') && !prefix_str.ends_with('/') {
            prefix_str.push('\\');
        }

        // Configure host session via stdin line protocol:
        // Set flags with DISABLE_VERIFY (1) | OPT_OUT_AH_V1 (4) | FULL_WAD_SCAN (8) = 13
        // - DISABLE_VERIFY (1): Bypasses host verification check [VRF00000008] allowing third-party client injection
        // - OPT_OUT_AH_V1 (4): Bypasses Anti-Skinhack v1 blocking for custom/remodel skins
        // - FULL_WAD_SCAN (8): Enables full scanning of WAD chunk files
        let flags = hook_flags::DISABLE_VERIFY | hook_flags::OPT_OUT_AH_V1 | hook_flags::FULL_WAD_SCAN;
        let config_lines = [
            "config loglevel 32".to_string(),
            format!("config flags {}", flags),
            format!("config prefix {}", prefix_str),
            "start scan".to_string(),
        ];

        let log_file_path = patcher_dir.parent().unwrap_or(patcher_dir).join("patcher.log");

        {
            let mut stdin_lock = stdin_arc.lock().unwrap();
            for line in &config_lines {
                writeln!(stdin_lock, "{}", line)
                    .map_err(|e| format!("Lỗi gửi cấu hình tới patcher host: {}", e))?;
            }
            stdin_lock
                .flush()
                .map_err(|e| format!("Lỗi flush stdin tới patcher host: {}", e))?;
        }

        // Keep stdin alive inside a background struct or let it close?
        // Note: ltk_patcher_host keeps running as long as stdin remains open or scanning
        let initial_status = PatcherStatePayload {
            status: PatcherStatus::Scanning,
            message: "Đang quét và đợi tiến trình Liên Minh Huyền Thoại (League of Legends.exe)...".to_string(),
            game_pid: None,
        };

        let status_arc = Arc::new(Mutex::new(initial_status.clone()));
        *self.last_status.lock().unwrap() = initial_status.clone();

        if let Some(ref handle) = app_handle {
            let _ = handle.emit("patcher-status", &initial_status);
        }

        // Spawn background reader thread to monitor patcher events
        let status_clone = Arc::clone(&status_arc);
        let last_status_clone = Arc::clone(&self.last_status);
        let handle_clone = app_handle.clone();
        let log_path = log_file_path.clone();
        let stdin_for_reader = Arc::clone(&stdin_arc);

        thread::spawn(move || {
            use std::fs::OpenOptions;

            let mut log_file = OpenOptions::new()
                .create(true)
                .append(true)
                .open(&log_path)
                .ok();

            let reader = BufReader::new(stdout);
            for line_res in reader.lines() {
                let line = match line_res {
                    Ok(l) => l,
                    Err(_) => break,
                };

                let trimmed = line.trim();
                if trimmed.is_empty() {
                    continue;
                }

                info!("[LTK_PATCHER_HOST] {}", trimmed);
                if let Some(ref mut f) = log_file {
                    let _ = writeln!(f, "{}", trimmed);
                    let _ = f.flush();
                }

                let mut updated_payload = None;

                if trimmed.starts_with("status") {
                    let parts: Vec<&str> = trimmed.split_whitespace().collect();
                    if parts.len() >= 3 {
                        let state_str = parts[2];
                        let message = if parts.len() > 3 {
                            parts[3..].join(" ")
                        } else {
                            String::new()
                        };

                        let (status, game_pid) = match state_str {
                            "injecting" => (
                                PatcherStatus::Scanning,
                                None,
                            ),
                            "injected" => {
                                // Extract PID if present
                                let pid = parts.iter().find_map(|p| p.parse::<u32>().ok());
                                (PatcherStatus::Injected, pid)
                            }
                            "waiting" => {
                                let cur_pid = status_clone.lock().unwrap().game_pid;
                                (PatcherStatus::Waiting, cur_pid)
                            }
                            "exited" => (PatcherStatus::Exited, None),
                            "failed" => {
                                if message.contains("SetWindowsHookEx failed")
                                    || message.contains("session already in progress")
                                    || message.contains("failed to load hook dll")
                                {
                                    warn!("Transient hook scan failure: {}. Scheduling auto-retry scan in 500ms...", message);
                                    let stdin_retry = Arc::clone(&stdin_for_reader);
                                    thread::spawn(move || {
                                        thread::sleep(std::time::Duration::from_millis(500));
                                        if let Ok(mut lock) = stdin_retry.lock() {
                                            let _ = writeln!(lock, "start scan");
                                            let _ = lock.flush();
                                            info!("Re-sent 'start scan' retry to patcher host");
                                        }
                                    });
                                    (PatcherStatus::Scanning, None)
                                } else {
                                    (PatcherStatus::Failed, None)
                                }
                            }
                            _ => (PatcherStatus::Scanning, None),
                        };

                        let user_message = match status {
                            PatcherStatus::Scanning => {
                                if message.contains("SetWindowsHookEx failed") {
                                    "Trận đấu đang khởi tạo, đang tự động kết nối lại patcher...".to_string()
                                } else {
                                    "Đang quét và đợi trận đấu Liên Minh...".to_string()
                                }
                            }
                            PatcherStatus::Injected => {
                                format!("Đã kết nối thành công vào trận Liên Minh (PID: {:?})! Skin mod đang hoạt động.", game_pid)
                            }
                            PatcherStatus::Waiting => {
                                "Skin mod đang hoạt động trong trận đấu. Đang chờ kết thúc trận...".to_string()
                            }
                            PatcherStatus::Exited => {
                                "Trận đấu đã kết thúc. Tiếp tục đợi trận mới...".to_string()
                            }
                            PatcherStatus::Failed => {
                                format!("Lỗi kết nối patcher: {}", message)
                            }
                            _ => message,
                        };

                        updated_payload = Some(PatcherStatePayload {
                            status,
                            message: user_message,
                            game_pid,
                        });
                    }
                } else if trimmed.contains("redirected wad:") {
                    // Log WAD redirection confirmation
                    info!("WAD redirected to overlay: {}", trimmed);
                    let cur_status = status_clone.lock().unwrap().status;
                    let cur_pid = status_clone.lock().unwrap().game_pid;
                    let wad_name = trimmed.rsplit("redirected wad:").next().unwrap_or("").trim();
                    updated_payload = Some(PatcherStatePayload {
                        status: if cur_status == PatcherStatus::Scanning { PatcherStatus::Injected } else { cur_status },
                        message: format!("Đã nạp file skin thành công: {}", wad_name),
                        game_pid: cur_pid,
                    });
                } else if trimmed.contains("overlay verification failed")
                    || trimmed.contains("refusing overlay")
                    || trimmed.contains("host verification failed")
                {
                    warn!("Overlay rejected by patcher DLL: {}", trimmed);
                    updated_payload = Some(PatcherStatePayload {
                        status: PatcherStatus::Failed,
                        message: format!("Patcher DLL từ chối WAD: {}", trimmed),
                        game_pid: None,
                    });
                } else if trimmed.contains("end of life reached") {
                    warn!("Overlay patcher rejected due to EOL: {}", trimmed);
                    updated_payload = Some(PatcherStatePayload {
                        status: PatcherStatus::Failed,
                        message: "Bản vá patcher đã hết hạn đối với phiên bản LMHT hiện tại! Vui lòng cập nhật bản mới từ app.".to_string(),
                        game_pid: None,
                    });
                }

                if let Some(payload) = updated_payload {
                    *status_clone.lock().unwrap() = payload.clone();
                    *last_status_clone.lock().unwrap() = payload.clone();

                    if let Some(ref handle) = handle_clone {
                        let _ = handle.emit("patcher-status", &payload);
                    }
                }
            }

            // If stdout ended, process exited
            let exited_payload = PatcherStatePayload {
                status: PatcherStatus::Stopped,
                message: "Patcher host đã dừng.".to_string(),
                game_pid: None,
            };
            *status_clone.lock().unwrap() = exited_payload.clone();
            *last_status_clone.lock().unwrap() = exited_payload.clone();
            if let Some(ref handle) = handle_clone {
                let _ = handle.emit("patcher-status", &exited_payload);
            }
        });

        // Store active session retaining stdin open
        *session_guard = Some(ActivePatcherSession {
            child,
            _stdin: stdin_arc,
            status: status_arc,
        });

        Ok(initial_status)
    }

    /// Stops the running patcher host process.
    pub fn stop(&self, app_handle: Option<AppHandle>) -> Result<PatcherStatePayload, String> {
        let mut session_guard = self.session.lock().unwrap();

        if let Some(mut sess) = session_guard.take() {
            info!("Stopping patcher host process...");
            let _ = sess.child.kill();
            let _ = sess.child.wait();
        }

        let stopped_payload = PatcherStatePayload {
            status: PatcherStatus::Stopped,
            message: "Patcher đã dừng. Mod skin sẽ không được nạp cho tới khi bạn bật lại.".to_string(),
            game_pid: None,
        };

        *self.last_status.lock().unwrap() = stopped_payload.clone();

        if let Some(ref handle) = app_handle {
            let _ = handle.emit("patcher-status", &stopped_payload);
        }

        Ok(stopped_payload)
    }
}
