/**
 * 100% Portable Directory and File Paths.
 */
export interface PortablePaths {
  base_dir: string;
  data_dir: string;
  config_file: string;
  metadata_dir: string;
  cache_dir: string;
  fantome_cache_dir: string;
  mods_dir: string;
  overlay_dir: string;
  webview_dir: string;
  patcher_dir?: string;
}

/**
 * Passive LCU Summoner Profile (0% Ban Risk).
 */
export interface SummonerProfile {
  game_name: string;
  tag_line: string;
  summoner_id: number | null;
  profile_icon_id: number | null;
  profile_icon_url: string;
  is_online: boolean;
}

/**
 * Record of an active skin or chroma applied to a champion.
 */
export interface ActiveSkinProfile {
  champion_id: number;
  skin_id: number;
  chroma_id?: number | null;
  skin_name: string;
  is_chroma: boolean;
  parent_skin_id?: number | null;
  fantome_path: string;
  applied_at: number;
}

/**
 * Portable application configuration stored in `./data/config.json`.
 */
export interface AppConfig {
  lol_game_path?: string | null;
  game_path?: string | null; // Compatibility alias
  active_skins: Record<number, ActiveSkinProfile>;
  last_summoner?: SummonerProfile | null;
  auto_detect_on_startup: boolean;
  locale: string;
  theme: string;
  last_synced_metadata?: number | null;
  is_sync_enabled?: boolean;
}

/**
 * P2P Lobby sync configuration payload.
 */
export interface SyncConfigPayload {
  is_sync_enabled: boolean;
}

/**
 * App Auto-Updater types.
 */
export interface UpdateCheckResult {
  has_update: boolean;
  current_version: string;
  latest_version: string;
  title: string;
  release_date: string;
  changelog: string[];
  download_url: string;
  github_repo_url: string;
}

export interface UpdateProgressPayload {
  status: string;
  percentage: number;
  downloaded_bytes: number;
  total_bytes: number;
  is_finished: boolean;
  error?: string | null;
}

/**
 * Environment initialization result returned by `init_portable_env`.
 */
export interface InitEnvironmentResult {
  paths: PortablePaths;
  config: AppConfig;
  is_game_path_valid: boolean;
  auto_detected: boolean;
}

/**
 * Chroma skin metadata.
 */
export interface ChromaItem {
  id: number;
  parent_skin_id: number;
  champion_id?: number;
  name?: string;
  name_vi: string;
  name_en: string;
  chroma_path?: string;
  chroma_icon_url?: string;
  colors: string[];
  fantome_available?: boolean;
  fantome_url?: string | null;
  fantome_download_url: string | null;
  fantome_repo_path?: string | null;
  is_cached: boolean;
  is_active?: boolean;
}

/**
 * Multi-stage / Multi-form skin metadata (e.g. Ahri Risen Legend, Jinx Arcane Fractured, Lux Elementalist).
 */
export interface SkinStage {
  id: number;
  parent_skin_id: number;
  stage_number: number;
  name: string;
  name_vi: string;
  name_en: string;
  fantome_url?: string | null;
  fantome_download_url?: string | null;
  is_cached: boolean;
  is_active?: boolean;
}

/**
 * Individual skin metadata.
 */
export interface SkinItem {
  id: number;
  champion_id: number;
  skin_num: number;
  is_base: boolean;
  name?: string;
  name_vi: string;
  name_en: string;
  load_screen_path?: string;
  load_screen_url?: string;
  splash_path?: string;
  splash_url?: string;
  uncentered_splash_url?: string;
  tile_path?: string;
  tile_url?: string;
  rarity?: string;
  rarity_key?: string;
  rarity_tier?: string;
  rarity_tier_vi?: string;
  rarity_gem_url?: string | null;
  rarity_info?: {
    raw_key: string;
    tier_vi: string;
    gem_icon_url?: string | null;
  };
  description_vi?: string | null;
  fantome_available?: boolean;
  fantome_url?: string | null;
  fantome_download_url?: string | null;
  fantome_repo_path?: string | null;
  is_cached: boolean;
  is_active?: boolean;
  active_chroma_id?: number | null;
  model_preview_url?: string | null;
  chromas: ChromaItem[];
  stages?: SkinStage[];
}

/**
 * Champion catalog entry.
 */
export interface ChampionItem {
  id: number;
  key: string;
  name?: string;
  name_vi: string;
  name_en: string;
  title?: string;
  title_vi: string;
  square_icon_url?: string;
  icon_url?: string;
  roles: string[];
  skins: SkinItem[];
  has_active_skin?: boolean;
}

/**
 * Request payload for applying a skin.
 */
export interface ApplySkinRequest {
  champion_id: number;
  skin_id: number;
  skin_name: string;
  is_chroma: boolean;
  parent_skin_id?: number | null;
  fantome_url?: string | null;
}

/**
 * Response payload from applying a skin.
 */
export interface ApplySkinResponse {
  success: boolean;
  champion_id: number;
  skin_id: number;
  skin_name: string;
  fantome_cached: boolean;
  wads_built: number;
  wads_reused: number;
  duration_ms: number;
  message: string;
}

/**
 * Response payload from removing a skin.
 */
export interface RemoveSkinResponse {
  success: boolean;
  champion_id: number;
  remaining_active_skins: number;
  message: string;
}

/**
 * Overlay build performance metrics.
 */
export interface OverlayBuildSummary {
  wads_built: number;
  wads_reused: number;
  duration_ms: number;
}

/**
 * Streaming download progress event payload.
 */
export interface DownloadProgressPayload {
  skin_id: number;
  downloaded_bytes: number;
  total_bytes: number;
  percentage: number;
}

/**
 * Incremental WAD overlay progress event payload.
 */
export interface OverlayProgressPayload {
  stage: string;
  current: number;
  total: number;
  message: string;
}

/**
 * Patcher host process state.
 */
export type PatcherStatus =
  | "Stopped"
  | "Starting"
  | "Scanning"
  | "Redirecting"
  | "Error"
  | "stopped"
  | "starting"
  | "scanning"
  | "injected"
  | "waiting"
  | "failed";

/**
 * Patcher state payload returned by commands and events.
 */
export interface PatcherStatePayload {
  status: PatcherStatus;
  pid?: number | null;
  game_pid?: number | null;
  active_mod_count?: number;
  is_game_running?: boolean;
  message: string;
}

/**
 * Local peer presence payload synchronized directly on disk (0ms latency).
 */
export interface LocalPeerPayload {
  room: string;
  summoner_name: string;
  summoner_icon_url?: string | null;
  active_skins: Record<number, ActiveSkinProfile>;
  is_injected: boolean;
  last_seen?: number;
}

/**
 * Local conflict resolution action recorded on disk.
 */
export interface LocalConflictPayload {
  room: string;
  champion_id: number;
  from_summoner: string;
  target_summoner: string;
  action: "yield" | "keep" | string;
  timestamp?: number;
}

/**
 * Result of metadata synchronization.
 */
export interface MetadataSyncResult {
  success: boolean;
  total_champions: number;
  total_skins: number;
  total_fantome_mapped: number;
  total_fantome_available?: number;
  champions?: ChampionItem[];
  cached_from_disk: boolean;
  cached?: boolean;
  synced_at?: number;
  duration_ms: number;
  message: string;
}

// Backward-compatibility aliases
export type ChampionInfo = ChampionItem;
export type SkinInfo = SkinItem;
export type SkinChromaInfo = ChromaItem;
export type RoleFilter = "ALL" | "TOP" | "JUNGLE" | "MID" | "ADC" | "SUPPORT" | string;

/**
 * Alban1911/LeagueSkins repository cache status.
 */
export interface RepoStatus {
  total_files: number;
  cached_files: number;
  missing_files: number;
  percentage: number;
  is_fully_synced: boolean;
  total_size_mb: number;
  is_downloading: boolean;
  outdated_files?: number;
}

/**
 * Bulk download progress payload emitted via `repo-download-progress`.
 */
export interface BulkDownloadProgress {
  total_files: number;
  downloaded_files: number;
  current_file: string;
  percentage: number;
  speed_kbps: number;
  is_completed: boolean;
  is_active: boolean;
  failed_count: number;
}
