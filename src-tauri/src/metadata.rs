use crate::portable::PortablePaths;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::fs;
use std::time::{Instant, SystemTime, UNIX_EPOCH};
use tracing::{info, warn};

pub const CD_BASE_URL: &str =
    "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default";

pub const URL_CHAMPION_SUMMARY: &str =
    "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/vi_vn/v1/champion-summary.json";

pub const URL_SKINS_VI: &str =
    "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/vi_vn/v1/skins.json";

pub const URL_SKINS_EN: &str =
    "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/skins.json";

pub const URL_GITHUB_TREE: &str =
    "https://api.github.com/repos/Alban1911/LeagueSkins/git/trees/main?recursive=1";

/// Resolves raw CDragon asset paths (`/lol-game-data/assets/...`) into complete, valid CDN URLs.
pub fn resolve_cdragon_asset_url(raw_path: &str) -> String {
    let trimmed = raw_path.trim();
    if trimmed.is_empty() {
        return String::new();
    }
    if trimmed.starts_with("http://") || trimmed.starts_with("https://") {
        return trimmed.to_string();
    }

    let lower = trimmed.to_lowercase();
    const PREFIX: &str = "/lol-game-data/assets/";
    if let Some(pos) = lower.find(PREFIX) {
        let sub = &lower[pos + PREFIX.len()..];
        format!("{}/{}", CD_BASE_URL, sub)
    } else {
        let clean = lower.trim_start_matches('/');
        format!("{}/{}", CD_BASE_URL, clean)
    }
}

/// Rarity tier metadata mapping with Vietnamese labels and official gem icon URLs.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct RarityTierInfo {
    pub raw_key: String,
    pub tier_vi: String,
    pub gem_icon_url: Option<String>,
}

/// Maps CommunityDragon skin rarity strings (`kEpic`, `kLegendary`, `kUltimate`, `kMythic`, `kTranscendent`, `kExalted`)
/// to their localized labels and official SVG/PNG gem URLs.
pub fn map_rarity(raw_rarity: &str) -> RarityTierInfo {
    match raw_rarity {
        "kEpic" => RarityTierInfo {
            raw_key: raw_rarity.to_string(),
            tier_vi: "Sử Thi".to_string(),
            gem_icon_url: Some(format!("{}/v1/rarity-gem-icons/epic.png", CD_BASE_URL)),
        },
        "kLegendary" => RarityTierInfo {
            raw_key: raw_rarity.to_string(),
            tier_vi: "Huyền Thoại".to_string(),
            gem_icon_url: Some(format!("{}/v1/rarity-gem-icons/legendary.png", CD_BASE_URL)),
        },
        "kUltimate" => RarityTierInfo {
            raw_key: raw_rarity.to_string(),
            tier_vi: "Tối Thượng".to_string(),
            gem_icon_url: Some(format!("{}/v1/rarity-gem-icons/ultimate.png", CD_BASE_URL)),
        },
        "kMythic" => RarityTierInfo {
            raw_key: raw_rarity.to_string(),
            tier_vi: "Thần Thoại".to_string(),
            gem_icon_url: Some(format!("{}/v1/rarity-gem-icons/mythic.png", CD_BASE_URL)),
        },
        "kTranscendent" => RarityTierInfo {
            raw_key: raw_rarity.to_string(),
            tier_vi: "Siêu Việt".to_string(),
            gem_icon_url: Some(format!("{}/v1/rarity-gem-icons/transcendent.png", CD_BASE_URL)),
        },
        "kExalted" => RarityTierInfo {
            raw_key: raw_rarity.to_string(),
            tier_vi: "Tôn Quý".to_string(),
            gem_icon_url: Some(format!("{}/v1/rarity-gem-icons/exalted.png", CD_BASE_URL)),
        },
        _ => RarityTierInfo {
            raw_key: raw_rarity.to_string(),
            tier_vi: "Tiêu Chuẩn".to_string(),
            gem_icon_url: None,
        },
    }
}

// ---------------------------------------------------------------------------
// DTOs from CommunityDragon and Alban1911/LeagueSkins
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RawChampionSummary {
    pub id: i32,
    pub name: String,
    #[serde(default)]
    pub alias: String,
    #[serde(default)]
    pub title: Option<String>,
    #[serde(default)]
    pub description: String,
    #[serde(rename = "squarePortraitPath", default)]
    pub square_portrait_path: Option<String>,
    #[serde(default)]
    pub roles: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RawChroma {
    pub id: u32,
    pub name: String,
    #[serde(rename = "chromaPath", default)]
    pub chroma_path: Option<String>,
    #[serde(default)]
    pub colors: Vec<String>,
    #[serde(default)]
    pub description: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RawSkin {
    pub id: u32,
    #[serde(rename = "isBase", default)]
    pub is_base: bool,
    pub name: String,
    #[serde(rename = "splashPath", default)]
    pub splash_path: Option<String>,
    #[serde(rename = "uncenteredSplashPath", default)]
    pub uncentered_splash_path: Option<String>,
    #[serde(rename = "tilePath", default)]
    pub tile_path: Option<String>,
    #[serde(rename = "loadScreenPath", default)]
    pub load_screen_path: Option<String>,
    #[serde(default)]
    pub rarity: Option<String>,
    #[serde(rename = "chromaPath", default)]
    pub chroma_path: Option<String>,
    #[serde(default)]
    pub chromas: Option<Vec<RawChroma>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitHubTreeItem {
    pub path: String,
    #[serde(rename = "type")]
    pub item_type: String,
    pub size: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitHubTreeResponse {
    pub sha: String,
    pub tree: Vec<GitHubTreeItem>,
    pub truncated: bool,
}

// ---------------------------------------------------------------------------
// Unified Client Output Data Models
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ChromaItem {
    pub id: u32,
    #[serde(default)]
    pub parent_skin_id: u32,
    pub name: String,
    #[serde(default)]
    pub name_vi: String,
    #[serde(default)]
    pub name_en: String,
    pub chroma_path: Option<String>,
    #[serde(default)]
    pub chroma_icon_url: Option<String>,
    pub colors: Vec<String>,
    pub fantome_url: Option<String>,
    #[serde(default)]
    pub fantome_download_url: Option<String>,
    pub is_cached: bool,
    pub is_active: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct SkinStage {
    pub id: u32,
    #[serde(default)]
    pub parent_skin_id: u32,
    #[serde(default)]
    pub stage_number: u32,
    pub name: String,
    #[serde(default)]
    pub name_vi: String,
    #[serde(default)]
    pub name_en: String,
    pub fantome_url: Option<String>,
    #[serde(default)]
    pub fantome_download_url: Option<String>,
    pub is_cached: bool,
    pub is_active: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SkinItem {
    pub id: u32,
    pub champion_id: u32,
    #[serde(default)]
    pub skin_num: u32,
    pub is_base: bool,
    pub name: String,
    #[serde(default)]
    pub name_vi: String,
    pub name_en: String,
    pub load_screen_path: String,
    #[serde(default)]
    pub load_screen_url: String,
    pub splash_path: String,
    #[serde(default)]
    pub splash_url: String,
    pub tile_path: String,
    #[serde(default)]
    pub tile_url: String,
    pub rarity: String,
    #[serde(default)]
    pub rarity_tier: String,
    #[serde(default)]
    pub rarity_tier_vi: String,
    #[serde(default)]
    pub rarity_gem_url: Option<String>,
    pub rarity_info: RarityTierInfo,
    pub fantome_url: Option<String>,
    #[serde(default)]
    pub fantome_download_url: Option<String>,
    pub is_cached: bool,
    pub is_active: bool,
    pub active_chroma_id: Option<u32>,
    #[serde(default)]
    pub model_preview_url: Option<String>,
    pub chromas: Vec<ChromaItem>,
    #[serde(default)]
    pub stages: Vec<SkinStage>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ChampionItem {
    pub id: u32,
    pub key: String,
    pub name: String,
    #[serde(default)]
    pub name_vi: String,
    #[serde(default)]
    pub name_en: String,
    pub title: String,
    #[serde(default)]
    pub title_vi: String,
    pub icon_url: String,
    #[serde(default)]
    pub square_icon_url: String,
    pub roles: Vec<String>,
    pub skins: Vec<SkinItem>,
    pub has_active_skin: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MetadataSyncResult {
    pub success: bool,
    pub champions_count: usize,
    pub skins_count: usize,
    pub duration_ms: u128,
    pub from_cache: bool,
    pub message: String,
}

// ---------------------------------------------------------------------------
// Metadata Manager Engine
// ---------------------------------------------------------------------------

pub struct MetadataManager;

impl MetadataManager {
    /// Builds an HTTP client with proper User-Agent header for GitHub and CDragon.
    fn make_http_client() -> Result<reqwest::Client, String> {
        reqwest::Client::builder()
            .user_agent("HextechPortableClient/1.0 (Windows NT 10.0; Win64; x64)")
            .timeout(std::time::Duration::from_secs(30))
            .build()
            .map_err(|e| format!("Không thể khởi tạo HTTP client: {}", e))
    }

    /// Fetches JSON data from remote URL and caches it to the portable metadata directory.
    /// If network is unavailable or cached file exists and force_refresh is false, reads from cache.
    async fn fetch_or_cache<T: for<'de> Deserialize<'de> + Serialize>(
        client: &reqwest::Client,
        url: &str,
        cache_path: &std::path::Path,
        force_refresh: bool,
    ) -> Result<T, String> {
        if !force_refresh && cache_path.exists() {
            if let Ok(content) = fs::read_to_string(cache_path) {
                if let Ok(parsed) = serde_json::from_str::<T>(&content) {
                    return Ok(parsed);
                }
            }
        }

        info!("Downloading remote metadata from: {}", url);
        match client.get(url).send().await {
            Ok(resp) => {
                if resp.status().is_success() {
                    let text = resp
                        .text()
                        .await
                        .map_err(|e| format!("Lỗi đọc nội dung từ {}: {}", url, e))?;

                    let parsed = serde_json::from_str::<T>(&text)
                        .map_err(|e| format!("Lỗi parse JSON từ {}: {}", url, e))?;

                    let _ = fs::write(cache_path, &text);
                    Ok(parsed)
                } else {
                    // Fallback to cache if available
                    if cache_path.exists() {
                        if let Ok(content) = fs::read_to_string(cache_path) {
                            if let Ok(parsed) = serde_json::from_str::<T>(&content) {
                                warn!("Remote returned status {}, using cached version for {}", resp.status(), url);
                                return Ok(parsed);
                            }
                        }
                    }
                    Err(format!("Yêu cầu tải thất bại với HTTP status {}: {}", resp.status(), url))
                }
            }
            Err(e) => {
                if cache_path.exists() {
                    if let Ok(content) = fs::read_to_string(cache_path) {
                        if let Ok(parsed) = serde_json::from_str::<T>(&content) {
                            warn!("Network error: {}, using cached file {:?}", e, cache_path);
                            return Ok(parsed);
                        }
                    }
                }
                Err(format!("Lỗi kết nối mạng tới {}: {}", url, e))
            }
        }
    }

    /// Synchronizes CommunityDragon Vietnamese + English metadata with Alban1911/LeagueSkins tree.
    pub async fn sync_metadata(
        paths: &PortablePaths,
        force_refresh: bool,
    ) -> Result<MetadataSyncResult, String> {
        let start = Instant::now();
        let client = Self::make_http_client()?;

        let summary_file = paths.metadata_dir.join("champion-summary.json");
        let skins_vi_file = paths.metadata_dir.join("skins_vi.json");
        let skins_en_file = paths.metadata_dir.join("skins_en.json");
        let tree_file = paths.metadata_dir.join("github_tree.json");
        let catalog_cache_file = paths.metadata_dir.join("catalog_cache.json");

        // 1. Fetch champion summary (VI)
        let raw_champions: Vec<RawChampionSummary> =
            Self::fetch_or_cache(&client, URL_CHAMPION_SUMMARY, &summary_file, force_refresh).await?;

        // 2. Fetch skins (VI)
        let raw_skins_vi: HashMap<String, RawSkin> =
            Self::fetch_or_cache(&client, URL_SKINS_VI, &skins_vi_file, force_refresh).await?;

        // 3. Fetch skins (EN)
        let raw_skins_en: HashMap<String, RawSkin> =
            Self::fetch_or_cache(&client, URL_SKINS_EN, &skins_en_file, force_refresh).await?;

        // 4. Fetch GitHub Tree from Alban1911/LeagueSkins
        let github_tree: GitHubTreeResponse =
            Self::fetch_or_cache(&client, URL_GITHUB_TREE, &tree_file, force_refresh).await?;

        // Build set of all known chroma IDs from CDragon so we can distinguish chromas from skin stages
        let mut all_chroma_ids: HashSet<u32> = HashSet::new();
        for vi_skin in raw_skins_vi.values() {
            if let Some(ref chromas) = vi_skin.chromas {
                for c in chromas {
                    all_chroma_ids.insert(c.id);
                }
            }
        }

        // Build index of GitHub .fantome and .zip paths
        let mut fantome_by_id: HashMap<u32, String> = HashMap::new();
        let mut fantome_by_key: HashMap<String, String> = HashMap::new();
        let mut sub_stages_by_parent: HashMap<u32, Vec<(u32, String)>> = HashMap::new();

        for item in &github_tree.tree {
            let path_lower = item.path.to_lowercase();
            if path_lower.ends_with(".fantome") || path_lower.ends_with(".zip") || path_lower.ends_with(".wad.client") {
                let encoded_path = urlencoding::encode(&item.path);
                let download_url = format!(
                    "https://raw.githubusercontent.com/Alban1911/LeagueSkins/main/{}",
                    encoded_path
                );

                // Index 1: By the TARGET ID extracted strictly from the filename itself
                if let Some(filename) = item.path.rsplit('/').next() {
                    let clean_filename = filename
                        .trim_end_matches(".fantome")
                        .trim_end_matches(".zip")
                        .trim_end_matches(".wad.client");
                    if let Ok(target_id) = clean_filename.parse::<u32>() {
                        fantome_by_id.insert(target_id, download_url.clone());
                        fantome_by_key.insert(target_id.to_string(), download_url.clone());
                    }

                    let normalized_key: String = clean_filename
                        .to_lowercase()
                        .chars()
                        .filter(|c| c.is_alphanumeric())
                        .collect();
                    if !normalized_key.is_empty() {
                        fantome_by_key.insert(normalized_key, download_url.clone());
                    }
                }

                // Index 2: Detect nested sub-stages (e.g. skins/103/103085/103086/103086.fantome)
                let parts: Vec<&str> = item.path.split('/').collect();
                if parts.len() == 5 && parts[0] == "skins" {
                    if let (Ok(parent_id), Ok(sub_id)) = (parts[2].parse::<u32>(), parts[3].parse::<u32>()) {
                        if sub_id != parent_id && !all_chroma_ids.contains(&sub_id) {
                            sub_stages_by_parent.entry(parent_id).or_default().push((sub_id, download_url));
                        }
                    }
                }
            }
        }

        // Load active skins to mark current active state
        let config = paths.load_and_validate_config()?;
        let active_skins = &config.active_skins;

        let mut catalog: Vec<ChampionItem> = Vec::new();
        let mut total_skins = 0;

        for raw_champ in raw_champions {
            // FIX 1: Filter out Jade_, Ruby_, Strawberry_, non-standard duplicates & id: -1
            let alias_lower = raw_champ.alias.to_lowercase();
            if raw_champ.id <= 0
                || raw_champ.id >= 1000
                || alias_lower.starts_with("jade_")
                || alias_lower.starts_with("ruby_")
                || alias_lower.starts_with("strawberry_")
                || alias_lower.contains('_')
            {
                continue;
            }

            let champ_id = raw_champ.id as u32;
            let champ_key = if !raw_champ.alias.is_empty() {
                raw_champ.alias.clone()
            } else {
                raw_champ.name.clone()
            };

            let square_url = raw_champ
                .square_portrait_path
                .as_deref()
                .map(resolve_cdragon_asset_url)
                .unwrap_or_else(|| {
                    format!("{}/v1/champion-icons/{}.png", CD_BASE_URL, champ_id)
                });

            let active_profile = active_skins.get(&champ_id);
            let active_skin_id = active_profile.map(|p| p.skin_id);
            let active_chroma_id = active_profile.and_then(|p| p.chroma_id);

            // Find all skins belonging to this champion
            let mut champ_skins: Vec<SkinItem> = Vec::new();

            for (skin_id_str, vi_skin) in &raw_skins_vi {
                if let Ok(sid) = skin_id_str.parse::<u32>() {
                    // In League data, skin_id is typically `champion_id * 1000 + skin_num`
                    if sid / 1000 == champ_id {
                        let skin_num = sid % 1000;
                        let en_name = raw_skins_en
                            .get(skin_id_str)
                            .map(|s| s.name.clone())
                            .unwrap_or_else(|| vi_skin.name.clone());

                        let load_screen = vi_skin
                            .load_screen_path
                            .as_deref()
                            .map(resolve_cdragon_asset_url)
                            .unwrap_or_else(|| {
                                format!("{}/v1/champion-splashes/uncentered/{}/{}.jpg", CD_BASE_URL, champ_id, sid)
                            });

                        let splash = vi_skin
                            .splash_path
                            .as_deref()
                            .map(resolve_cdragon_asset_url)
                            .unwrap_or_else(|| load_screen.clone());

                        let tile = vi_skin
                            .tile_path
                            .as_deref()
                            .map(resolve_cdragon_asset_url)
                            .unwrap_or_else(|| square_url.clone());

                        let raw_rarity = vi_skin.rarity.as_deref().unwrap_or("kDefault");
                        let rarity_info = map_rarity(raw_rarity);

                        // Resolve on-demand .fantome URL with normalized fuzzy matching
                        let mut fantome_url = fantome_by_id.get(&sid).cloned();
                        if fantome_url.is_none() {
                            fantome_url = fantome_by_key.get(&sid.to_string()).cloned();
                        }
                        if fantome_url.is_none() {
                            let clean_en: String = en_name.to_lowercase().chars().filter(|c| c.is_alphanumeric()).collect();
                            fantome_url = fantome_by_key.get(&clean_en).cloned();
                        }
                        if fantome_url.is_none() {
                            let lookup_key = format!("{}_{}", champ_key.to_lowercase(), skin_num);
                            fantome_url = fantome_by_key.get(&lookup_key).cloned();
                        }

                        // FIX 2: Guaranteed Deterministic Fallback URL (NEVER return None)
                        let final_skin_url = fantome_url.unwrap_or_else(|| {
                            format!(
                                "https://raw.githubusercontent.com/Alban1911/LeagueSkins/main/skins/{}/{}/{}.fantome",
                                champ_id, sid, sid
                            )
                        });

                        // Process chromas
                        let mut chromas: Vec<ChromaItem> = Vec::new();
                        if let Some(raw_chromas) = &vi_skin.chromas {
                            for rc in raw_chromas {
                                // FIX 3: In-Game Chroma Model Preview URL
                                let c_path = rc.chroma_path.as_deref()
                                    .map(resolve_cdragon_asset_url)
                                    .filter(|p| !p.is_empty())
                                    .unwrap_or_else(|| {
                                        format!(
                                            "{}/v1/champion-chroma-images/{}/{}.png",
                                            CD_BASE_URL, champ_id, rc.id
                                        )
                                    });

                                let is_c_active = active_chroma_id == Some(rc.id);
                                let is_c_cached = paths.is_fantome_cached(champ_id, rc.id);

                                let mut chroma_fantome_url = fantome_by_id.get(&rc.id).cloned();
                                if chroma_fantome_url.is_none() {
                                    chroma_fantome_url = fantome_by_key.get(&rc.id.to_string()).cloned();
                                }
                                let final_chroma_url = chroma_fantome_url.unwrap_or_else(|| {
                                    format!(
                                        "https://raw.githubusercontent.com/Alban1911/LeagueSkins/main/skins/{}/{}/{}/{}.fantome",
                                        champ_id, sid, rc.id, rc.id
                                    )
                                });

                                chromas.push(ChromaItem {
                                    id: rc.id,
                                    parent_skin_id: sid,
                                    name: rc.name.clone(),
                                    name_vi: rc.name.clone(),
                                    name_en: rc.name.clone(),
                                    chroma_path: Some(c_path.clone()),
                                    chroma_icon_url: Some(c_path),
                                    colors: rc.colors.clone(),
                                    fantome_url: Some(final_chroma_url.clone()),
                                    fantome_download_url: Some(final_chroma_url),
                                    is_cached: is_c_cached,
                                    is_active: is_c_active,
                                });
                            }
                        }

                        // Process multi-stage forms (e.g. Ahri 103085, Jinx 222060, Lux 99007, etc.)
                        let mut stages: Vec<SkinStage> = Vec::new();
                        if let Some(sub_list) = sub_stages_by_parent.get(&sid) {
                            let mut sorted_subs = sub_list.clone();
                            sorted_subs.sort_by_key(|(id, _)| *id);

                            let stage1_name_vi = if sid == 103085 {
                                "Dạng 1: Huyền Thoại Trỗi Dậy".to_string()
                            } else if sid == 222060 {
                                "Dạng 1: Arcane Vụn Vỡ".to_string()
                            } else {
                                format!("Dạng 1 ({})", vi_skin.name)
                            };
                            let stage1_name_en = if sid == 103085 {
                                "Stage 1: Risen Legend".to_string()
                            } else if sid == 222060 {
                                "Stage 1: Arcane Fractured".to_string()
                            } else {
                                format!("Stage 1 ({})", en_name)
                            };

                            stages.push(SkinStage {
                                id: sid,
                                parent_skin_id: sid,
                                stage_number: 1,
                                name: stage1_name_vi.clone(),
                                name_vi: stage1_name_vi,
                                name_en: stage1_name_en,
                                fantome_url: Some(final_skin_url.clone()),
                                fantome_download_url: Some(final_skin_url.clone()),
                                is_cached: paths.is_fantome_cached(champ_id, sid),
                                is_active: active_skin_id == Some(sid),
                            });

                            for (idx, (sub_id, sub_url)) in sorted_subs.iter().enumerate() {
                                let stage_num = (idx + 2) as u32;
                                let s_name_vi = if sid == 103085 && *sub_id == 103086 {
                                    "Dạng 2: Huyền Thoại Bất Tử".to_string()
                                } else if sid == 103085 && *sub_id == 103087 {
                                    "Dạng 3: Chữ Ký Chuyển Sinh".to_string()
                                } else if sid == 222060 && *sub_id == 222998 {
                                    "Dạng 2: Biến Thể 2".to_string()
                                } else if sid == 222060 && *sub_id == 222999 {
                                    "Dạng 3: Biến Thể 3".to_string()
                                } else {
                                    format!("Dạng {}", stage_num)
                                };

                                let s_name_en = if sid == 103085 && *sub_id == 103086 {
                                    "Stage 2: Immortalized Legend".to_string()
                                } else if sid == 103085 && *sub_id == 103087 {
                                    "Stage 3: Signature Immortalized".to_string()
                                } else if sid == 222060 && *sub_id == 222998 {
                                    "Stage 2: Variant 2".to_string()
                                } else if sid == 222060 && *sub_id == 222999 {
                                    "Stage 3: Variant 3".to_string()
                                } else {
                                    format!("Stage {}", stage_num)
                                };

                                stages.push(SkinStage {
                                    id: *sub_id,
                                    parent_skin_id: sid,
                                    stage_number: stage_num,
                                    name: s_name_vi.clone(),
                                    name_vi: s_name_vi,
                                    name_en: s_name_en,
                                    fantome_url: Some(sub_url.clone()),
                                    fantome_download_url: Some(sub_url.clone()),
                                    is_cached: paths.is_fantome_cached(champ_id, *sub_id),
                                    is_active: active_skin_id == Some(*sub_id),
                                });
                            }
                        }

                        let skin_stage_active = stages.iter().any(|st| active_skin_id == Some(st.id));
                        let is_active = active_skin_id == Some(sid) || skin_stage_active;
                        let is_cached = paths.is_fantome_cached(champ_id, sid);
                        let rarity_gem_url = rarity_info.gem_icon_url.clone();
                        let rarity_tier_vi = rarity_info.tier_vi.clone();
                        let model_preview_url = vi_skin
                            .chroma_path
                            .as_deref()
                            .map(resolve_cdragon_asset_url)
                            .filter(|p| !p.is_empty())
                            .or_else(|| {
                                if vi_skin.chromas.as_ref().map(|c| !c.is_empty()).unwrap_or(false) {
                                    Some(format!("{}/v1/champion-chroma-images/{}/{}.png", CD_BASE_URL, champ_id, sid))
                                } else {
                                    None
                                }
                            });

                        champ_skins.push(SkinItem {
                            id: sid,
                            champion_id: champ_id,
                            skin_num,
                            is_base: vi_skin.is_base || skin_num == 0,
                            name: vi_skin.name.clone(),
                            name_vi: vi_skin.name.clone(),
                            name_en: en_name,
                            load_screen_path: load_screen.clone(),
                            load_screen_url: load_screen,
                            splash_path: splash.clone(),
                            splash_url: splash,
                            tile_path: tile.clone(),
                            tile_url: tile,
                            rarity: raw_rarity.to_string(),
                            rarity_tier: raw_rarity.to_string(),
                            rarity_tier_vi,
                            rarity_gem_url,
                            rarity_info,
                            fantome_url: Some(final_skin_url.clone()),
                            fantome_download_url: Some(final_skin_url),
                            is_cached,
                            is_active,
                            active_chroma_id: if is_active { active_chroma_id } else { None },
                            model_preview_url,
                            chromas,
                            stages,
                        });
                    }
                }
            }

            // Sort skins: base skin first, then by skin id ascending
            champ_skins.sort_by(|a, b| {
                if a.is_base {
                    std::cmp::Ordering::Less
                } else if b.is_base {
                    std::cmp::Ordering::Greater
                } else {
                    a.id.cmp(&b.id)
                }
            });

            total_skins += champ_skins.len();
            let has_active_skin = active_skin_id.is_some();
            let champ_title = raw_champ.title.clone().unwrap_or_default();

            catalog.push(ChampionItem {
                id: champ_id,
                key: champ_key.clone(),
                name: raw_champ.name.clone(),
                name_vi: raw_champ.name,
                name_en: champ_key,
                title: champ_title.clone(),
                title_vi: champ_title,
                icon_url: square_url.clone(),
                square_icon_url: square_url,
                roles: raw_champ.roles,
                skins: champ_skins,
                has_active_skin,
            });
        }

        // Sort champions alphabetically by Vietnamese display name
        catalog.sort_by(|a, b| a.name.cmp(&b.name));

        // Save unified catalog to cache file for instant startup loads
        if let Ok(catalog_json) = serde_json::to_string(&catalog) {
            let _ = fs::write(&catalog_cache_file, catalog_json);
        }

        // Record timestamp in config
        let mut updated_config = config;
        let now_ts = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0);
        updated_config.last_synced_metadata = Some(now_ts);
        let _ = paths.save_config(&updated_config);

        let duration = start.elapsed().as_millis();
        let champ_count = catalog.len();

        info!(
            "Metadata synchronization completed in {} ms: {} champions, {} skins mapped.",
            duration, champ_count, total_skins
        );

        Ok(MetadataSyncResult {
            success: true,
            champions_count: champ_count,
            skins_count: total_skins,
            duration_ms: duration,
            from_cache: false,
            message: format!(
                "Đồng bộ hoàn tất {} tướng và {} trang phục CDragon thành công!",
                champ_count, total_skins
            ),
        })
    }

    /// Loads the unified catalog from local `./data/metadata/catalog_cache.json`.
    /// If not cached yet, triggers an initial sync.
    pub async fn get_catalog(paths: &PortablePaths) -> Result<Vec<ChampionItem>, String> {
        let catalog_cache_file = paths.metadata_dir.join("catalog_cache.json");
        if catalog_cache_file.exists() {
            if let Ok(content) = fs::read_to_string(&catalog_cache_file) {
                if let Ok(mut catalog) = serde_json::from_str::<Vec<ChampionItem>>(&content) {
                    // FIX 1: Filter out Jade_, Ruby_, Strawberry_, non-standard duplicates & id: -1 dynamically
                    catalog.retain(|champ| {
                        let key_lower = champ.key.to_lowercase();
                        champ.id > 0
                            && champ.id < 1000
                            && !key_lower.starts_with("jade_")
                            && !key_lower.starts_with("ruby_")
                            && !key_lower.starts_with("strawberry_")
                            && !key_lower.contains('_')
                    });

                    // Update live active state based on current config
                    if let Ok(config) = paths.load_and_validate_config() {
                        for champ in &mut catalog {
                            let active_prof = config.active_skins.get(&champ.id);
                            champ.has_active_skin = active_prof.is_some();
                            for skin in &mut champ.skins {
                                skin.is_cached = paths.is_fantome_cached(champ.id, skin.id);
                                let skin_matches = active_prof.map(|p| p.skin_id == skin.id).unwrap_or(false);
                                let stage_matches = skin.stages.iter().any(|st| active_prof.map(|p| p.skin_id == st.id).unwrap_or(false));
                                skin.is_active = skin_matches || stage_matches;
                                skin.active_chroma_id = if skin.is_active {
                                    active_prof.and_then(|p| p.chroma_id)
                                } else {
                                    None
                                };
                                for chroma in &mut skin.chromas {
                                    chroma.is_cached = paths.is_fantome_cached(champ.id, chroma.id);
                                    chroma.is_active = skin.is_active && skin.active_chroma_id == Some(chroma.id);
                                }
                                for stage in &mut skin.stages {
                                    stage.is_cached = paths.is_fantome_cached(champ.id, stage.id);
                                    stage.is_active = active_prof.map(|p| p.skin_id == stage.id).unwrap_or(false);
                                }
                            }
                        }
                    }
                    return Ok(catalog);
                }
            }
        }

        // If cache doesn't exist, run initial sync
        let sync_res = Self::sync_metadata(paths, false).await?;
        if !sync_res.success {
            return Err("Không thể tải danh mục trang phục ban đầu.".to_string());
        }

        if let Ok(content) = fs::read_to_string(&catalog_cache_file) {
            serde_json::from_str::<Vec<ChampionItem>>(&content)
                .map_err(|e| format!("Lỗi đọc danh mục sau khi đồng bộ: {}", e))
        } else {
            Err("Không tìm thấy file danh mục sau khi đồng bộ.".to_string())
        }
    }
}
