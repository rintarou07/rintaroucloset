import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type {
  ActiveSkinProfile,
  AppConfig,
  ApplySkinRequest,
  ApplySkinResponse,
  ChampionItem,
  DownloadProgressPayload,
  InitEnvironmentResult,
  MetadataSyncResult,
  OverlayBuildSummary,
  OverlayProgressPayload,
  PatcherStatePayload,
  RemoveSkinResponse,
  RepoStatus,
  BulkDownloadProgress,
  SummonerProfile,
  SyncConfigPayload,
  LocalPeerPayload,
  LocalConflictPayload,
  UpdateCheckResult,
  UpdateProgressPayload,
} from "../types/skin";

/**
 * Strongly-typed Tauri IPC client communicating with the Rust backend.
 * Zero %APPDATA% or Windows Registry usage.
 */
export const tauriClient = {
  /**
   * Initializes portable environment, validates/auto-detects League path,
   * and isolates WebView2 profile inside `./data/webview`.
   */
  async initPortableEnv(): Promise<InitEnvironmentResult> {
    return invoke<InitEnvironmentResult>("init_portable_env");
  },

  /**
   * Synchronizes CommunityDragon Vietnamese metadata with the Alban1911/LeagueSkins tree.
   */
  async syncMetadata(forceRefresh: boolean = false): Promise<MetadataSyncResult> {
    return invoke<MetadataSyncResult>("sync_metadata", { forceRefresh });
  },

  /**
   * Returns current portable configuration and path state.
   */
  async getConfig(): Promise<AppConfig> {
    return invoke<AppConfig>("get_config");
  },

  /**
   * Passively reads current summoner info via local LCU lockfile API (0% Ban Risk).
   */
  async getCurrentSummoner(): Promise<SummonerProfile> {
    return invoke<SummonerProfile>("get_current_summoner");
  },

  /**
   * Retrieves the full unified champion catalog with skins, chromas, and download URLs.
   */
  async getCatalog(): Promise<ChampionItem[]> {
    return invoke<ChampionItem[]>("get_catalog");
  },

  /**
   * Returns a map of all currently active champion skin profiles.
   */
  async getActiveSkins(): Promise<Record<number, ActiveSkinProfile>> {
    return invoke<Record<number, ActiveSkinProfile>>("get_active_skins");
  },

  /**
   * Checks if a .fantome archive is already cached locally.
   */
  async isFantomeCached(championId: number, skinId: number): Promise<boolean> {
    return invoke<boolean>("is_fantome_cached", { championId, skinId });
  },

  /**
   * Sets and validates the League of Legends path.
   */
  async setGamePath(path: string): Promise<boolean> {
    return invoke<boolean>("set_game_path", { path });
  },

  /**
   * Downloads (on demand) a skin into local cache without applying to WAD overlay.
   */
  async ensureSkinCached(request: ApplySkinRequest): Promise<boolean> {
    return invoke<boolean>("ensure_skin_cached", { request });
  },

  /**
   * Downloads (on demand), extracts via ltk_fantome, and applies skin into WAD overlay.
   */
  async applySkin(request: ApplySkinRequest): Promise<ApplySkinResponse> {
    return invoke<ApplySkinResponse>("apply_skin", { request });
  },

  /**
   * Removes active skin mod for a champion and refreshes WAD overlay.
   */
  async removeSkin(championId: number): Promise<RemoveSkinResponse> {
    return invoke<RemoveSkinResponse>("remove_skin", { championId });
  },

  /**
   * Clears all active skins and empties `./data/overlay/`.
   */
  async clearOverlay(): Promise<boolean> {
    return invoke<boolean>("clear_overlay");
  },

  /**
   * Manually triggers a complete rebuild of `./data/overlay/`.
   */
  async rebuildOverlay(): Promise<OverlayBuildSummary> {
    return invoke<OverlayBuildSummary>("rebuild_overlay");
  },

  /**
   * Builds WAD overlay merging local active skins with verified friends' active skins.
   */
  async rebuildOverlayWithFriends(
    friendSkins: ActiveSkinProfile[]
  ): Promise<OverlayBuildSummary> {
    return invoke<OverlayBuildSummary>("rebuild_overlay_with_friends", {
      friendSkins,
    });
  },

  /**
   * Starts the League of Legends injection patcher host process.
   */
  async startPatcher(): Promise<PatcherStatePayload> {
    return invoke<PatcherStatePayload>("start_patcher");
  },

  /**
   * Stops the running patcher host process.
   */
  async stopPatcher(): Promise<PatcherStatePayload> {
    return invoke<PatcherStatePayload>("stop_patcher");
  },

  /**
   * Retrieves the current live status of the patcher host process.
   */
  async getPatcherStatus(): Promise<PatcherStatePayload> {
    return invoke<PatcherStatePayload>("get_patcher_status");
  },

  /**
   * Retrieves P2P lobby sync configuration from `./data/config.json`.
   */
  async getSyncConfig(): Promise<SyncConfigPayload> {
    return invoke<SyncConfigPayload>("get_sync_config");
  },

  /**
   * Sets and saves P2P lobby sync configuration to `./data/config.json`.
   */
  async setSyncConfig(payload: SyncConfigPayload): Promise<SyncConfigPayload> {
    return invoke<SyncConfigPayload>("set_sync_config", { payload });
  },

  /**
   * Checks Alban1911 skin repository cache status and coverage.
   */
  async checkRepoStatus(forceRemoteCheck: boolean = false): Promise<RepoStatus> {
    return invoke<RepoStatus>("check_repo_status", { forceRemoteCheck });
  },

  /**
   * Starts background multi-stream download of all missing skins from Alban1911.
   */
  async startBulkDownload(): Promise<boolean> {
    return invoke<boolean>("start_bulk_download");
  },

  /**
   * Pauses/stops the active bulk download.
   */
  async stopBulkDownload(): Promise<boolean> {
    return invoke<boolean>("stop_bulk_download");
  },

  /**
   * Gets whether bulk download is currently active.
   */
  async getBulkDownloadStatus(): Promise<boolean> {
    return invoke<boolean>("get_bulk_download_status");
  },

  /**
   * Returns true if this desktop instance is running in test mock mode.
   */
  async isTestInstance(): Promise<boolean> {
    return invoke<boolean>("is_test_instance");
  },

  /**
   * Synchronizes peer state locally on disk (0ms latency, zero dropouts).
   */
  async syncLocalPeer(payload: LocalPeerPayload): Promise<LocalPeerPayload[]> {
    return invoke<LocalPeerPayload[]>("sync_local_peer", { payload });
  },

  /**
   * Records conflict resolution decision locally on disk.
   */
  async recordLocalConflict(payload: LocalConflictPayload): Promise<boolean> {
    return invoke<boolean>("record_local_conflict", { payload });
  },

  /**
   * Retrieves active conflict resolution decisions from disk for room.
   */
  async getLocalConflicts(
    room: string
  ): Promise<Record<number, LocalConflictPayload>> {
    return invoke<Record<number, LocalConflictPayload>>("get_local_conflicts", {
      room,
    });
  },

  // ==========================================
  // Real-time Event Listeners
  // ==========================================

  /**
   * Listens for streaming download progress events.
   */
  async onDownloadProgress(
    callback: (payload: DownloadProgressPayload) => void
  ): Promise<UnlistenFn> {
    return listen<DownloadProgressPayload>("download-progress", (event) => {
      callback(event.payload);
    });
  },

  /**
   * Listens for incremental WAD overlay building stage events.
   */
  async onOverlayProgress(
    callback: (payload: OverlayProgressPayload) => void
  ): Promise<UnlistenFn> {
    return listen<OverlayProgressPayload>("overlay-progress", (event) => {
      callback(event.payload);
    });
  },

  /**
   * Listens for patcher host status transitions.
   */
  async onPatcherState(
    callback: (payload: PatcherStatePayload) => void
  ): Promise<UnlistenFn> {
    return listen<PatcherStatePayload>("patcher-state", (event) => {
      callback(event.payload);
    });
  },

  /**
   * Listens for live stdout log lines from the patcher host process.
   */
  async onPatcherLog(callback: (logLine: string) => void): Promise<UnlistenFn> {
    return listen<string>("patcher-log", (event) => {
      callback(event.payload);
    });
  },

  /**
   * Listens for bulk repository download progress updates.
   */
  async onRepoDownloadProgress(
    callback: (payload: BulkDownloadProgress) => void
  ): Promise<UnlistenFn> {
    return listen<BulkDownloadProgress>("repo-download-progress", (event) => {
      callback(event.payload);
    });
  },

  /**
   * Checks official GitHub repository for new app or data updates.
   */
  async checkForUpdates(): Promise<UpdateCheckResult> {
    return invoke<UpdateCheckResult>("check_for_updates");
  },

  /**
   * Downloads the update package from GitHub and triggers safe application restart.
   */
  async downloadAndApplyUpdate(downloadUrl: string): Promise<void> {
    return invoke<void>("download_and_apply_update", { downloadUrl });
  },

  /**
   * Listens for update download and installation progress.
   */
  async onUpdateProgress(
    callback: (payload: UpdateProgressPayload) => void
  ): Promise<UnlistenFn> {
    return listen<UpdateProgressPayload>("update-progress", (event) => {
      callback(event.payload);
    });
  },
};

/**
 * Utility helpers
 */
export function formatBytes(bytes: number, decimals: number = 1): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

