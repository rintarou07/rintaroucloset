use camino::Utf8Path;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use tracing::{info, warn};

/// Cached Summoner Profile retrieved passively via local LCU client API.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct SummonerProfile {
    pub game_name: String,
    pub tag_line: String,
    pub summoner_id: Option<u64>,
    pub profile_icon_id: Option<i32>,
    pub profile_icon_url: String,
    pub is_online: bool,
}

impl Default for SummonerProfile {
    fn default() -> Self {
        Self {
            game_name: "".to_string(),
            tag_line: "".to_string(),
            summoner_id: None,
            profile_icon_id: Some(29),
            profile_icon_url: "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/profile-icons/29.jpg".to_string(),
            is_online: false,
        }
    }
}

/// Active skin applied to a champion
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ActiveSkinProfile {
    pub champion_id: u32,
    pub skin_id: u32,
    pub chroma_id: Option<u32>,
    pub skin_name: String,
    pub is_chroma: bool,
    pub parent_skin_id: Option<u32>,
    pub fantome_path: String,
    pub applied_at: u64,
}

/// Portable application configuration stored in `./data/config.json`.
/// Zero %APPDATA% or Windows Registry usage.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    #[serde(alias = "game_path")]
    pub lol_game_path: Option<String>,
    pub active_skins: HashMap<u32, ActiveSkinProfile>,
    pub last_summoner: Option<SummonerProfile>,
    pub auto_detect_on_startup: bool,
    pub locale: String,
    pub theme: String,
    pub last_synced_metadata: Option<u64>,
    #[serde(default)]
    pub is_sync_enabled: bool,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            lol_game_path: None,
            active_skins: HashMap::new(),
            last_summoner: None,
            auto_detect_on_startup: true,
            locale: "vi_VN".to_string(),
            theme: "hextech-dark".to_string(),
            last_synced_metadata: None,
            is_sync_enabled: false,
        }
    }
}

/// Strictly portable directory and file path manager.
/// Resolves all directories strictly relative to the executable location.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PortablePaths {
    pub base_dir: PathBuf,
    pub data_dir: PathBuf,
    pub config_file: PathBuf,
    pub metadata_dir: PathBuf,
    pub cache_dir: PathBuf,
    pub fantome_cache_dir: PathBuf,
    pub mods_dir: PathBuf,
    pub overlay_dir: PathBuf,
    pub webview_dir: PathBuf,
    pub patcher_dir: PathBuf,
    pub sync_peers_dir: PathBuf,
    pub sync_conflicts_dir: PathBuf,
    pub is_test: bool,
}

impl PortablePaths {
    /// Detects if this instance is running in Test Mode (Mock Friend Desktop Instance).
    pub fn is_test_mode() -> bool {
        std::env::var("HEXTECH_TEST_MODE").map(|v| v == "1").unwrap_or(false)
            || std::env::args().any(|arg| arg == "--test-mode" || arg == "--test")
    }

    /// Resolves the portable root directory relative to the executable.
    /// In development (`cargo run` or `cargo tauri dev`), walks up to the root project workspace.
    pub fn resolve_root() -> Result<PathBuf, String> {
        if let Ok(exe_path) = std::env::current_exe() {
            if let Some(parent) = exe_path.parent() {
                let parent_str = parent.to_string_lossy().to_lowercase();
                if parent_str.contains("target\\debug")
                    || parent_str.contains("target\\release")
                    || parent_str.contains("target/debug")
                    || parent_str.contains("target/release")
                {
                    let mut cur = parent.to_path_buf();
                    while let Some(p) = cur.parent() {
                        if cur.file_name().map(|n| n == "target").unwrap_or(false) {
                            return Ok(p.to_path_buf());
                        }
                        cur = p.to_path_buf();
                    }

                    if let Ok(cwd) = std::env::current_dir() {
                        if cwd.ends_with("src-tauri") {
                            if let Some(p) = cwd.parent() {
                                return Ok(p.to_path_buf());
                            }
                        }
                        return Ok(cwd);
                    }
                }
                return Ok(parent.to_path_buf());
            }
        }
        let cwd = std::env::current_dir().map_err(|e| format!("Failed to resolve current directory: {}", e))?;
        if cwd.ends_with("src-tauri") {
            if let Some(p) = cwd.parent() {
                return Ok(p.to_path_buf());
            }
        }
        Ok(cwd)
    }

    /// Initializes and creates the required portable directory structure.
    pub fn new() -> Result<Self, String> {
        let base_dir = Self::resolve_root()?;
        let is_test = Self::is_test_mode();

        let data_folder = if is_test { "data-test" } else { "data" };
        let data_dir = base_dir.join(data_folder);
        let config_file = data_dir.join("config.json");
        let webview_dir = data_dir.join("webview");
        let mods_dir = data_dir.join("mods");
        let overlay_dir = data_dir.join("overlay");
        let patcher_dir = data_dir.join("patcher");

        // Both main instance and test instance share the same metadata, downloaded cache, and sync channels
        let metadata_dir = base_dir.join("data").join("metadata");
        let cache_dir = base_dir.join("data").join("cache");
        let fantome_cache_dir = cache_dir.join("fantome");
        let sync_peers_dir = base_dir.join("data").join("sync_peers");
        let sync_conflicts_dir = base_dir.join("data").join("sync_conflicts");

        // Ensure directories exist
        fs::create_dir_all(&data_dir)
            .map_err(|e| format!("Không thể tạo thư mục data: {}", e))?;
        fs::create_dir_all(&metadata_dir)
            .map_err(|e| format!("Không thể tạo thư mục metadata: {}", e))?;
        fs::create_dir_all(&cache_dir)
            .map_err(|e| format!("Không thể tạo thư mục cache: {}", e))?;
        fs::create_dir_all(&fantome_cache_dir)
            .map_err(|e| format!("Không thể tạo thư mục fantome cache: {}", e))?;
        fs::create_dir_all(&mods_dir)
            .map_err(|e| format!("Không thể tạo thư mục mods: {}", e))?;
        fs::create_dir_all(&overlay_dir)
            .map_err(|e| format!("Không thể tạo thư mục overlay: {}", e))?;
        fs::create_dir_all(&webview_dir)
            .map_err(|e| format!("Không thể tạo thư mục webview: {}", e))?;
        fs::create_dir_all(&patcher_dir)
            .map_err(|e| format!("Không thể tạo thư mục patcher: {}", e))?;
        fs::create_dir_all(&sync_peers_dir)
            .map_err(|e| format!("Không thể tạo thư mục sync_peers: {}", e))?;
        fs::create_dir_all(&sync_conflicts_dir)
            .map_err(|e| format!("Không thể tạo thư mục sync_conflicts: {}", e))?;

        Ok(Self {
            base_dir,
            data_dir,
            config_file,
            metadata_dir,
            cache_dir,
            fantome_cache_dir,
            mods_dir,
            overlay_dir,
            webview_dir,
            patcher_dir,
            sync_peers_dir,
            sync_conflicts_dir,
            is_test,
        })
    }

    /// Returns path to cached .fantome archive: `./data/cache/fantome/{champion_id}/{skin_id}.fantome`
    pub fn get_fantome_path(&self, champion_id: u32, skin_id: u32) -> PathBuf {
        self.fantome_cache_dir
            .join(champion_id.to_string())
            .join(format!("{}.fantome", skin_id))
    }

    /// Checks if a .fantome file is already cached locally.
    pub fn is_fantome_cached(&self, champion_id: u32, skin_id: u32) -> bool {
        let p = self.get_fantome_path(champion_id, skin_id);
        p.exists() && fs::metadata(&p).map(|m| m.len() > 0).unwrap_or(false)
    }

    /// Automatically detects League of Legends installation path.
    /// Priority 1: `ltk_mod_core::auto_detect_league_path()`.
    /// Priority 2: Standard installation paths across all drives.
    pub fn auto_detect_league_path() -> Option<String> {
        // Priority 1: Official LeagueToolkit detection
        if let Some(path) = ltk_mod_core::auto_detect_league_path() {
            let p_str = path.to_string();
            if Path::new(&p_str).exists() {
                return Some(p_str);
            }
        }

        // Priority 2: Deep search across all standard drive letters
        let drives = ["C", "D", "E", "F", "G"];
        let candidates = [
            "Riot Games/League of Legends/Game/League of Legends.exe",
            "Riot Games/League of Legends/League of Legends.exe",
            "Adobe Valorant/Riot Games/League of Legends/Game/League of Legends.exe",
            "Garena/32787/Game/League of Legends.exe",
            "Garena/32787/League of Legends.exe",
            "Games/League of Legends/Game/League of Legends.exe",
        ];

        for drive in &drives {
            for sub in &candidates {
                let candidate = format!("{}:/{}", drive, sub);
                let p = Path::new(&candidate);
                if p.exists() {
                    return Some(candidate);
                }
            }
        }

        None
    }

    /// Validates whether a path points to a valid League of Legends installation.
    pub fn validate_league_path(path_str: &str) -> bool {
        let path = Path::new(path_str);
        if !path.exists() {
            return false;
        }

        if let Some(utf8_p) = Utf8Path::from_path(path) {
            if ltk_mod_core::is_valid_league_path(utf8_p) {
                return true;
            }
        }

        if path.is_file() {
            let filename = path.file_name().and_then(|f| f.to_str()).unwrap_or("");
            if filename.eq_ignore_ascii_case("League of Legends.exe") {
                return true;
            }
        }

        if path.is_dir() {
            let exe_direct = path.join("League of Legends.exe");
            if exe_direct.exists() {
                return true;
            }
            let exe_in_game = path.join("Game").join("League of Legends.exe");
            if exe_in_game.exists() {
                return true;
            }
            let final_wad_dir = path.join("DATA").join("FINAL");
            if final_wad_dir.exists() {
                return true;
            }
        }

        false
    }

    /// Resolves the actual `Game` folder containing `DATA/FINAL`.
    pub fn resolve_game_dir(path_str: &str) -> Option<PathBuf> {
        let p = Path::new(path_str);
        if !p.exists() {
            return None;
        }

        if p.is_file() {
            if let Some(parent) = p.parent() {
                if parent.join("DATA").join("FINAL").exists() {
                    return Some(parent.to_path_buf());
                }
            }
        } else if p.is_dir() {
            if p.join("DATA").join("FINAL").exists() {
                return Some(p.to_path_buf());
            }
            let game_sub = p.join("Game");
            if game_sub.join("DATA").join("FINAL").exists() {
                return Some(game_sub);
            }
        }

        None
    }

    /// Resolves the League Client root directory (parent of `Game`) where `lockfile` lives.
    pub fn resolve_league_root(game_path_str: Option<&str>) -> Option<PathBuf> {
        if let Some(path_str) = game_path_str {
            let p = Path::new(path_str);
            if p.exists() {
                let candidate = if p.is_file() {
                    p.parent().map(|d| {
                        if d.file_name().and_then(|n| n.to_str()).map(|n| n.eq_ignore_ascii_case("game")).unwrap_or(false) {
                            d.parent().unwrap_or(d).to_path_buf()
                        } else {
                            d.to_path_buf()
                        }
                    })
                } else {
                    Some(p.to_path_buf())
                };

                if let Some(cand) = candidate {
                    if cand.join("LeagueClientUx.exe").exists() || cand.join("lockfile").exists() {
                        return Some(cand);
                    }
                }
            }
        }

        // Fallback: check auto-detected root
        if let Some(detected) = Self::auto_detect_league_path() {
            let p = Path::new(&detected);
            if let Some(parent) = p.parent() {
                let root = if parent.file_name().and_then(|n| n.to_str()).map(|n| n.eq_ignore_ascii_case("game")).unwrap_or(false) {
                    parent.parent().unwrap_or(parent).to_path_buf()
                } else {
                    parent.to_path_buf()
                };
                if root.exists() {
                    return Some(root);
                }
            }
        }

        None
    }

    /// Loads the configuration from `./data/config.json`.
    /// If the configured path does not exist on this machine (e.g. portable drive moved to another PC),
    /// automatically triggers auto-detection and updates `./data/config.json`.
    pub fn load_and_validate_config(&self) -> Result<AppConfig, String> {
        let mut config = if self.config_file.exists() {
            match fs::read_to_string(&self.config_file) {
                Ok(content) => match serde_json::from_str::<AppConfig>(&content) {
                    Ok(cfg) => cfg,
                    Err(e) => {
                        warn!("Failed to parse config file {:?}: {}. Generating default.", self.config_file, e);
                        AppConfig::default()
                    }
                },
                Err(e) => {
                    warn!("Failed to read config file, generating default: {}", e);
                    AppConfig::default()
                }
            }
        } else {
            let mut def = AppConfig::default();
            if self.is_test {
                // Initialize default test profile: Faker #T1 (Mock Friend)
                def.last_summoner = Some(SummonerProfile {
                    game_name: "Faker".to_string(),
                    tag_line: "T1".to_string(),
                    summoner_id: Some(99999999),
                    profile_icon_id: Some(6038),
                    profile_icon_url: "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/profile-icons/6038.jpg".to_string(),
                    is_online: true,
                });
                def.is_sync_enabled = true;

                // Inherit League path and sync server URL from main data/config.json if available
                let main_config_file = self.base_dir.join("data").join("config.json");
                if let Ok(main_txt) = fs::read_to_string(&main_config_file) {
                    if let Ok(main_cfg) = serde_json::from_str::<AppConfig>(&main_txt) {
                        def.lol_game_path = main_cfg.lol_game_path;
                    }
                }
            }
            def
        };

        let mut needs_save = !self.config_file.exists();

        // Validate LoL game path
        let is_valid = config
            .lol_game_path
            .as_ref()
            .map(|p| Self::validate_league_path(p))
            .unwrap_or(false);

        if !is_valid {
            info!("Configured League path is missing or invalid on this machine. Running auto-detection...");
            if let Some(detected) = Self::auto_detect_league_path() {
                info!("Auto-detected League of Legends installation: {}", detected);
                config.lol_game_path = Some(detected);
                needs_save = true;
            } else {
                warn!("Could not auto-detect League of Legends installation. Manual configuration required.");
            }
        }

        if needs_save {
            let _ = self.save_config(&config);
        }

        Ok(config)
    }

    /// Persists configuration to `./data/config.json`.
    pub fn save_config(&self, config: &AppConfig) -> Result<(), String> {
        let json_str = serde_json::to_string_pretty(config)
            .map_err(|e| format!("Failed to serialize config: {}", e))?;
        fs::write(&self.config_file, json_str)
            .map_err(|e| format!("Failed to write config file {:?}: {}", self.config_file, e))?;
        Ok(())
    }
}

// ---------------------------------------------------------------------------
// Passive LCU Summoner Reader (0% Ban Risk)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone)]
pub struct LcuLockfileInfo {
    pub process_name: String,
    pub pid: u32,
    pub port: u16,
    pub password: String,
    pub protocol: String,
}

impl LcuLockfileInfo {
    /// Reads and parses the LCU lockfile (`process:pid:port:password:protocol`).
    pub fn parse(content: &str) -> Option<Self> {
        let parts: Vec<&str> = content.trim().split(':').collect();
        if parts.len() < 5 {
            return None;
        }

        let process_name = parts[0].to_string();
        let pid = parts[1].parse::<u32>().ok()?;
        let port = parts[2].parse::<u16>().ok()?;
        let password = parts[3].to_string();
        let protocol = parts[4].to_string();

        Some(Self {
            process_name,
            pid,
            port,
            password,
            protocol,
        })
    }
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RawLcuSummonerResponse {
    pub game_name: Option<String>,
    pub tag_line: Option<String>,
    pub display_name: Option<String>,
    pub summoner_id: Option<u64>,
    pub profile_icon_id: Option<i32>,
}

/// Passive LCU Summoner Reader:
/// Connects ONLY to the local League Client HTTPS endpoint via the credentials
/// published in the local `lockfile`. Does NOT attach to or read game memory.
pub struct LcuSummonerReader;

impl LcuSummonerReader {
    /// Locates the `lockfile` from the client root directory or known locations.
    pub fn find_lockfile(_paths: &PortablePaths, config: &AppConfig) -> Option<PathBuf> {
        // 1. Try from resolved league root
        if let Some(root) = PortablePaths::resolve_league_root(config.lol_game_path.as_deref()) {
            let lf = root.join("lockfile");
            if lf.exists() {
                return Some(lf);
            }
        }

        // 2. Try common locations
        let common = [
            "E:/Adobe Valorant/Riot Games/League of Legends/lockfile",
            "C:/Riot Games/League of Legends/lockfile",
            "D:/Riot Games/League of Legends/lockfile",
            "C:/Games/League of Legends/lockfile",
        ];
        for c in &common {
            let p = Path::new(c);
            if p.exists() {
                return Some(p.to_path_buf());
            }
        }

        None
    }

    /// Reads credentials from the local lockfile if LeagueClient is running.
    pub fn read_credentials(paths: &PortablePaths, config: &AppConfig) -> Option<LcuLockfileInfo> {
        let lf_path = Self::find_lockfile(paths, config)?;
        let content = fs::read_to_string(&lf_path).ok()?;
        LcuLockfileInfo::parse(&content)
    }

    /// Passively reads current summoner info from the local LCU client.
    /// If in test mode: preserves mock summoner profile (e.g. Faker #T1) to avoid colliding with main client.
    /// If client is running: fetches profile, saves to `./data/config.json`, and returns with `is_online: true`.
    /// If client is offline/closed: returns cached profile from `./data/config.json` with `is_online: false`.
    pub async fn get_current_summoner(
        paths: &PortablePaths,
        config: &mut AppConfig,
    ) -> SummonerProfile {
        if paths.is_test {
            if let Some(ref sum) = config.last_summoner {
                return sum.clone();
            }
            let default_test_sum = SummonerProfile {
                game_name: "Faker".to_string(),
                tag_line: "T1".to_string(),
                summoner_id: Some(99999999),
                profile_icon_id: Some(6038),
                profile_icon_url: "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/profile-icons/6038.jpg".to_string(),
                is_online: true,
            };
            config.last_summoner = Some(default_test_sum.clone());
            let _ = paths.save_config(config);
            return default_test_sum;
        }

        if let Some(creds) = Self::read_credentials(paths, config) {
            let client = reqwest::Client::builder()
                .danger_accept_invalid_certs(true)
                .timeout(std::time::Duration::from_millis(1500))
                .build();

            if let Ok(http) = client {
                let url = format!("https://127.0.0.1:{}/lol-summoner/v1/current-summoner", creds.port);
                let resp = http
                    .get(&url)
                    .basic_auth("riot", Some(&creds.password))
                    .send()
                    .await;

                if let Ok(res) = resp {
                    if res.status().is_success() {
                        if let Ok(raw) = res.json::<RawLcuSummonerResponse>().await {
                            let game_name = raw
                                .game_name
                                .filter(|s| !s.trim().is_empty())
                                .or(raw.display_name.filter(|s| !s.trim().is_empty()))
                                .unwrap_or_else(|| "".to_string());
                            let tag_line = raw
                                .tag_line
                                .filter(|s| !s.trim().is_empty())
                                .unwrap_or_else(|| "VN2".to_string());
                            let icon_id = raw.profile_icon_id.unwrap_or(29);
                            let profile_icon_url = format!(
                                "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/profile-icons/{}.jpg",
                                icon_id
                            );

                            let profile = SummonerProfile {
                                game_name,
                                tag_line,
                                summoner_id: raw.summoner_id,
                                profile_icon_id: raw.profile_icon_id,
                                profile_icon_url,
                                is_online: true,
                            };

                            // Cache profile in portable config
                            config.last_summoner = Some(profile.clone());
                            let _ = paths.save_config(config);
                            return profile;
                        }
                    }
                }
            }
        }

        // Offline fallback: return cached summoner with is_online = false
        if let Some(cached) = &config.last_summoner {
            let mut offline_profile = cached.clone();
            offline_profile.is_online = false;
            offline_profile
        } else {
            SummonerProfile::default()
        }
    }
}
