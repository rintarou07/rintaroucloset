use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use std::fs;
use std::io::Write;
use std::path::PathBuf;
use std::time::Duration;
use tauri::{AppHandle, Emitter};

pub const CURRENT_APP_VERSION: &str = "0.1.2";
pub const GITHUB_REPO_URL: &str = "https://github.com/rintarou07/rintaroucloset";
pub const UPDATE_MANIFEST_URL: &str =
    "https://raw.githubusercontent.com/rintarou07/rintaroucloset/main/version.json";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RemoteVersionManifest {
    pub version: String,
    pub release_date: Option<String>,
    pub min_required_version: Option<String>,
    pub title: Option<String>,
    pub changelog: Option<Vec<String>>,
    pub download_url: Option<String>,
    pub direct_exe_url: Option<String>,
    pub patcher_version: Option<String>,
    pub patcher_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateCheckResult {
    pub has_update: bool,
    pub current_version: String,
    pub latest_version: String,
    pub title: String,
    pub release_date: String,
    pub changelog: Vec<String>,
    pub download_url: String,
    pub github_repo_url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateProgressPayload {
    pub status: String,
    pub percentage: f32,
    pub downloaded_bytes: u64,
    pub total_bytes: u64,
    pub is_finished: bool,
    pub error: Option<String>,
}

/// Helper to compare semver-like strings (e.g., "0.1.1" > "0.1.0")
pub fn is_newer_version(remote: &str, current: &str) -> bool {
    let parse_parts = |v: &str| -> Vec<u32> {
        v.trim_start_matches('v')
            .split('.')
            .filter_map(|p| p.parse::<u32>().ok())
            .collect()
    };
    let r = parse_parts(remote);
    let c = parse_parts(current);
    r > c
}

pub struct UpdaterManager;

impl UpdaterManager {
    /// Checks the official GitHub repository for the latest version manifest
    pub async fn check_for_updates() -> Result<UpdateCheckResult, String> {
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(8))
            .user_agent("RintarouCloset-Updater")
            .build()
            .map_err(|e| format!("Lỗi khởi tạo HTTP client: {}", e))?;

        let response = client
            .get(UPDATE_MANIFEST_URL)
            .send()
            .await
            .map_err(|e| format!("Không thể kết nối tới máy chủ cập nhật GitHub: {}", e))?;

        if !response.status().is_success() {
            return Err(format!(
                "Máy chủ GitHub trả về mã lỗi: {}",
                response.status()
            ));
        }

        let manifest: RemoteVersionManifest = response
            .json()
            .await
            .map_err(|e| format!("Lỗi phân tích cú pháp thông tin phiên bản: {}", e))?;

        let has_update = is_newer_version(&manifest.version, CURRENT_APP_VERSION);
        let download_url = manifest
            .download_url
            .or(manifest.direct_exe_url)
            .unwrap_or_else(|| {
                format!("{}/releases/latest", GITHUB_REPO_URL)
            });

        Ok(UpdateCheckResult {
            has_update,
            current_version: CURRENT_APP_VERSION.to_string(),
            latest_version: manifest.version,
            title: manifest
                .title
                .unwrap_or_else(|| "Bản cập nhật Rintarou Closet mới".to_string()),
            release_date: manifest
                .release_date
                .unwrap_or_else(|| "Mới nhất".to_string()),
            changelog: manifest.changelog.unwrap_or_default(),
            download_url,
            github_repo_url: GITHUB_REPO_URL.to_string(),
        })
    }

    /// Downloads the updated executable and triggers safe Windows background replacement
    pub async fn download_and_apply_update(
        app_handle: AppHandle,
        download_url: String,
    ) -> Result<(), String> {
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(300))
            .user_agent("RintarouCloset-Updater")
            .build()
            .map_err(|e| format!("Lỗi HTTP client: {}", e))?;

        let response = client
            .get(&download_url)
            .send()
            .await
            .map_err(|e| format!("Không thể tải file cập nhật từ {}: {}", download_url, e))?;

        if !response.status().is_success() {
            return Err(format!(
                "Tải cập nhật thất bại với mã trạng thái: {}",
                response.status()
            ));
        }

        let total_size = response.content_length().unwrap_or(0);
        let current_exe = std::env::current_exe()
            .map_err(|e| format!("Lỗi xác định file exe: {}", e))?;
        let exe_dir = current_exe
            .parent()
            .unwrap_or(std::path::Path::new("."))
            .to_path_buf();

        let temp_path = exe_dir.join("update_new.exe");

        let mut file = fs::File::create(&temp_path)
            .map_err(|e| format!("Không thể tạo file tạm: {}", e))?;

        let mut downloaded: u64 = 0;
        let mut stream = response.bytes_stream();

        while let Some(chunk_result) = stream.next().await {
            let chunk = chunk_result.map_err(|e| format!("Lỗi khi nhận dữ liệu tải: {}", e))?;
            file.write_all(&chunk)
                .map_err(|e| format!("Lỗi ghi dữ liệu cập nhật: {}", e))?;

            downloaded += chunk.len() as u64;
            let percentage = if total_size > 0 {
                ((downloaded as f64 / total_size as f64) * 100.0) as f32
            } else {
                50.0
            };

            let _ = app_handle.emit(
                "update-progress",
                UpdateProgressPayload {
                    status: format!("Đang tải bản cập nhật... ({:.1}%)", percentage),
                    percentage,
                    downloaded_bytes: downloaded,
                    total_bytes: total_size,
                    is_finished: false,
                    error: None,
                },
            );
        }

        file.flush().map_err(|e| format!("Lỗi hoàn tất file: {}", e))?;
        drop(file);

        let _ = app_handle.emit(
            "update-progress",
            UpdateProgressPayload {
                status: "Đang cài đặt và khởi động lại ứng dụng...".to_string(),
                percentage: 100.0,
                downloaded_bytes: downloaded,
                total_bytes: total_size,
                is_finished: true,
                error: None,
            },
        );

        // Create detached Windows batch updater script with retry loop and unlock rename
        let batch_content = r#"@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo Dang cap nhat Rintarou Closet len phien ban moi nhat...

:: Wait for parent process to exit
timeout /t 1 /nobreak >nul

:: Terminate any hanging client processes or webview renderers
taskkill /F /IM "Rintarou Closet.exe" /T >nul 2>&1
taskkill /F /IM "hextech-skin-client.exe" /T >nul 2>&1

set ATTEMPTS=0

:retry_loop
set /a ATTEMPTS+=1

:: Rename existing exe if locked (Windows permits renaming locked running executables)
if exist "Rintarou Closet.exe" (
    move /y "Rintarou Closet.exe" "Rintarou Closet.exe.old" >nul 2>&1
)
if exist "hextech-skin-client.exe" (
    move /y "hextech-skin-client.exe" "hextech-skin-client.exe.old" >nul 2>&1
)

:: Copy update file over target files
copy /y "update_new.exe" "Rintarou Closet.exe" >nul 2>&1
set RES1=%ERRORLEVEL%
copy /y "update_new.exe" "hextech-skin-client.exe" >nul 2>&1
set RES2=%ERRORLEVEL%

if %RES1% neq 0 (
    if %ATTEMPTS% lss 25 (
        timeout /t 1 /nobreak >nul
        goto retry_loop
    )
)

:: Clean up temporary files
del /f /q "update_new.exe" >nul 2>&1
del /f /q "Rintarou Closet.exe.old" >nul 2>&1
del /f /q "hextech-skin-client.exe.old" >nul 2>&1

:: Start the newly updated executable
start "" "Rintarou Closet.exe"

:: Delete this batch script
(goto) 2>nul & del "%~f0"
"#;

        let script_path = exe_dir.join("apply_update.bat");
        fs::write(&script_path, batch_content)
            .map_err(|e| format!("Không thể tạo script cập nhật: {}", e))?;

        // Spawn batch script detached and terminate current process cleanly
        #[cfg(target_os = "windows")]
        {
            use std::os::windows::process::CommandExt;
            const CREATE_NO_WINDOW: u32 = 0x08000000;
            let _ = std::process::Command::new("cmd")
                .args(["/C", "apply_update.bat"])
                .current_dir(&exe_dir)
                .creation_flags(CREATE_NO_WINDOW)
                .spawn();
        }

        // Give batch script 200ms to spawn before exiting process
        tokio::time::sleep(Duration::from_millis(200)).await;
        std::process::exit(0);
    }
}

