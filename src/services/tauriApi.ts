import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type {
  ActiveSkinProfile,
  AppConfig,
  ApplySkinRequest,
  ApplySkinResponse,
  ChampionInfo,
  DownloadProgressPayload,
  InitEnvironmentResult,
  MetadataSyncResult,
  OverlayBuildSummary,
  OverlayProgressPayload,
  RemoveSkinResponse,
  SkinChromaInfo,
  SkinInfo,
} from "../types";

/**
 * Checks whether the app is executing inside the native Tauri v2 desktop runtime.
 */
export const isTauri = (): boolean => {
  return typeof window !== "undefined" && Boolean(
    (window as any).__TAURI_INTERNALS__ || (window as any).__TAURI__
  );
};

const CDRAGON_BASE = "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global";

function resolveCdragonUrl(rawPath: string | null | undefined): string {
  if (!rawPath) return "";
  const lower = rawPath.toLowerCase();
  if (lower.startsWith("http://") || lower.startsWith("https://")) {
    return lower;
  }
  const cleanPath = lower.replace(/^\/?lol-game-data\/assets\//, "").replace(/^\//, "");
  return `${CDRAGON_BASE}/default/${cleanPath}`;
}

function parseRarity(rawKey: string | null | undefined) {
  if (!rawKey || rawKey === "kNoRarity") {
    return {
      rarity_key: "kNoRarity",
      rarity_tier_vi: "Mặc Định",
      rarity_gem_url: null,
    };
  }
  const tierWithoutK = rawKey.startsWith("k") ? rawKey.slice(1).toLowerCase() : rawKey.toLowerCase();
  const gemUrl = `${CDRAGON_BASE}/default/v1/rarity-gem-icons/${tierWithoutK}.png`;

  switch (tierWithoutK) {
    case "epic":
      return { rarity_key: rawKey, rarity_tier_vi: "Sử Thi", rarity_gem_url: gemUrl };
    case "legendary":
      return { rarity_key: rawKey, rarity_tier_vi: "Huyền Thoại", rarity_gem_url: gemUrl };
    case "ultimate":
      return { rarity_key: rawKey, rarity_tier_vi: "Tối Thượng", rarity_gem_url: gemUrl };
    case "mythic":
      return { rarity_key: rawKey, rarity_tier_vi: "Thần Thoại", rarity_gem_url: gemUrl };
    case "transcendent":
      return { rarity_key: rawKey, rarity_tier_vi: "Siêu Việt", rarity_gem_url: gemUrl };
    case "exalted":
      return { rarity_key: rawKey, rarity_tier_vi: "Tôn Quý", rarity_gem_url: gemUrl };
    default:
      return { rarity_key: rawKey, rarity_tier_vi: tierWithoutK, rarity_gem_url: gemUrl };
  }
}

/**
 * Fallback metadata synchronizer used only when running in browser preview mode (Vite dev server)
 * without the Tauri desktop runtime.
 */
async function fetchBrowserFallbackMetadata(): Promise<MetadataSyncResult> {
  const [championsRes, skinsRes] = await Promise.all([
    fetch(`${CDRAGON_BASE}/vi_vn/v1/champion-summary.json`),
    fetch(`${CDRAGON_BASE}/vi_vn/v1/skins.json`),
  ]);

  const rawChampions: any[] = await championsRes.json();
  const rawSkinsMap: Record<string, any> = await skinsRes.json();

  const skinsByChamp = new Map<number, SkinInfo[]>();

  for (const [_, skin] of Object.entries(rawSkinsMap)) {
    const skinId = Number(skin.id);
    const champId = Math.floor(skinId / 1000);
    if (!champId || skinId < 0) continue;

    const rarity = parseRarity(skin.rarity);
    const splashPath = resolveCdragonUrl(skin.splashPath || skin.uncenteredSplashPath);
    const loadingPath = resolveCdragonUrl(skin.loadScreenPath);
    const tilePath = resolveCdragonUrl(skin.tilePath);
    const skinNum = skinId % 1000;

    const chromas: SkinChromaInfo[] = Array.isArray(skin.chromas)
      ? skin.chromas.map((c: any) => ({
          id: Number(c.id),
          parent_skin_id: skinId,
          champion_id: champId,
          name_vi: c.name || `Đa Sắc #${c.id}`,
          name_en: c.name || `Chroma #${c.id}`,
          chroma_icon_url: resolveCdragonUrl(c.chromaPath),
          colors: Array.isArray(c.colors) ? c.colors : [],
          fantome_available: false,
          fantome_download_url: null,
          fantome_repo_path: null,
          is_cached: false,
        }))
      : [];

    const skinInfo: SkinInfo = {
      id: skinId,
      champion_id: champId,
      skin_num: skinNum,
      is_base: skinNum === 0,
      name_vi: skin.name || `Trang phục #${skinId}`,
      name_en: skin.name || `Skin #${skinId}`,
      splash_url: splashPath,
      uncentered_splash_url: splashPath,
      tile_url: tilePath,
      load_screen_url: loadingPath,
      rarity_key: rarity.rarity_key,
      rarity_tier_vi: rarity.rarity_tier_vi,
      rarity_gem_url: rarity.rarity_gem_url,
      description_vi: skin.description || null,
      fantome_available: true,
      fantome_download_url: null,
      fantome_repo_path: null,
      is_cached: false,
      chromas,
    };

    const existing = skinsByChamp.get(champId) ?? [];
    existing.push(skinInfo);
    skinsByChamp.set(champId, existing);
  }

  const champions: ChampionInfo[] = rawChampions
    .filter((c) => c.id > 0)
    .map((c) => {
      const champSkins = (skinsByChamp.get(c.id) ?? []).sort((a, b) => a.skin_num - b.skin_num);
      return {
        id: c.id,
        key: c.alias || String(c.id),
        name_vi: c.name,
        name_en: c.alias,
        title_vi: c.title,
        roles: Array.isArray(c.roles) ? c.roles : [],
        icon_url: resolveCdragonUrl(c.squarePortraitPath),
        square_icon_url: resolveCdragonUrl(c.squarePortraitPath),
        skins: champSkins,
      };
    })
    .sort((a, b) => a.name_vi.localeCompare(b.name_vi, "vi"));

  return {
    champions,
    total_champions: champions.length,
    total_skins: skinsByChamp.size,
    total_fantome_available: skinsByChamp.size,
    total_fantome_mapped: skinsByChamp.size,
    cached: false,
    cached_from_disk: false,
    duration_ms: 0,
    message: "OK",
    success: true,
    synced_at: Date.now(),
  };
}

/**
 * Service providing typed access to all Tauri v2 Rust IPC commands and events.
 */
export const tauriApi = {
  /**
   * Initializes portable environment, checks and auto-detects LoL path, validates directories.
   */
  async initPortableEnv(): Promise<InitEnvironmentResult> {
    if (!isTauri()) {
      return {
        paths: {
          base_dir: "./",
          data_dir: "./data",
          config_file: "./data/config.json",
          metadata_dir: "./data/metadata",
          cache_dir: "./data/cache",
          fantome_cache_dir: "./data/cache/fantome",
          mods_dir: "./data/mods",
          overlay_dir: "./data/overlay",
          webview_dir: "./data/webview",
        },
        config: {
          game_path: "E:/Adobe Valorant/Riot Games/League of Legends/Game/League of Legends.exe",
          active_skins: {},
          auto_detect_on_startup: true,
          locale: "vi_VN",
          theme: "hextech",
          last_synced_metadata: Date.now(),
        },
        is_game_path_valid: true,
        auto_detected: true,
      };
    }
    return await invoke<InitEnvironmentResult>("init_portable_env");
  },

  /**
   * Synchronizes CommunityDragon Vietnamese/English metadata and Alban1911/LeagueSkins tree.
   */
  async syncMetadata(forceRefresh: boolean = false): Promise<MetadataSyncResult> {
    if (!isTauri()) {
      return await fetchBrowserFallbackMetadata();
    }
    return await invoke<MetadataSyncResult>("sync_metadata", { forceRefresh });
  },

  /**
   * Retrieves active portable configuration from `./data/config.json`.
   */
  async getConfig(): Promise<AppConfig> {
    if (!isTauri()) {
      return {
        game_path: "E:/Adobe Valorant/Riot Games/League of Legends/Game/League of Legends.exe",
        active_skins: {},
        auto_detect_on_startup: true,
        locale: "vi_VN",
        theme: "hextech",
        last_synced_metadata: Date.now(),
      };
    }
    return await invoke<AppConfig>("get_config");
  },

  /**
   * Retrieves current map of active skins keyed by champion ID.
   */
  async getActiveSkins(): Promise<Record<number, ActiveSkinProfile>> {
    if (!isTauri()) {
      return {};
    }
    return await invoke<Record<number, ActiveSkinProfile>>("get_active_skins");
  },

  /**
   * Checks whether a .fantome archive is already downloaded locally in `./data/cache/fantome/`.
   */
  async isFantomeCached(championId: number, skinId: number): Promise<boolean> {
    if (!isTauri()) {
      return false;
    }
    return await invoke<boolean>("is_fantome_cached", {
      championId,
      skinId,
    });
  },

  /**
   * Sets and validates the League of Legends path.
   */
  async setGamePath(path: string): Promise<boolean> {
    if (!isTauri()) {
      return true;
    }
    return await invoke<boolean>("set_game_path", { path });
  },

  /**
   * Downloads (if needed), extracts with `ltk_fantome`, and applies skin to WAD overlay with `ltk_overlay`.
   */
  async applySkin(request: ApplySkinRequest): Promise<ApplySkinResponse> {
    if (!isTauri()) {
      return {
        success: true,
        champion_id: request.champion_id,
        skin_id: request.skin_id,
        skin_name: request.skin_name,
        fantome_cached: true,
        wads_built: 1,
        wads_reused: 0,
        duration_ms: 120,
        message: "Chế độ Preview Trình Duyệt: Chạy npm run tauri:dev để áp dụng vào game thật.",
      };
    }
    return await invoke<ApplySkinResponse>("apply_skin", { request });
  },

  /**
   * Removes active skin for a champion and refreshes overlay.
   */
  async removeSkin(championId: number): Promise<RemoveSkinResponse> {
    if (!isTauri()) {
      return {
        success: true,
        champion_id: championId,
        remaining_active_skins: 0,
        message: "Chế độ Preview Trình Duyệt",
      };
    }
    return await invoke<RemoveSkinResponse>("remove_skin", { championId });
  },

  /**
   * Clears all active skins and empties the WAD overlay directory.
   */
  async clearOverlay(): Promise<boolean> {
    if (!isTauri()) {
      return true;
    }
    return await invoke<boolean>("clear_overlay");
  },

  /**
   * Rebuilds the WAD overlay from current active skins.
   */
  async rebuildOverlay(): Promise<OverlayBuildSummary> {
    if (!isTauri()) {
      return {
        wads_built: 0,
        wads_reused: 0,
        duration_ms: 0,
      };
    }
    return await invoke<OverlayBuildSummary>("rebuild_overlay");
  },

  /**
   * Subscribes to real-time .fantome download progress events.
   */
  async onDownloadProgress(
    callback: (payload: DownloadProgressPayload) => void
  ): Promise<UnlistenFn> {
    if (!isTauri()) {
      return () => {};
    }
    return await listen<DownloadProgressPayload>("download-progress", (event) => {
      callback(event.payload);
    });
  },

  /**
   * Subscribes to real-time WAD overlay build progress events.
   */
  async onOverlayProgress(
    callback: (payload: OverlayProgressPayload) => void
  ): Promise<UnlistenFn> {
    if (!isTauri()) {
      return () => {};
    }
    return await listen<OverlayProgressPayload>("overlay-progress", (event) => {
      callback(event.payload);
    });
  },

  /**
   * Starts the League of Legends injection patcher host process.
   */
  async startPatcher(): Promise<import("../types").PatcherStatePayload> {
    if (!isTauri()) {
      return {
        status: "scanning",
        message: "Chế độ Preview Trình Duyệt: Giả lập đang quét trận đấu Liên Minh.",
        game_pid: null,
      };
    }
    return await invoke<import("../types").PatcherStatePayload>("start_patcher");
  },

  /**
   * Stops the running patcher host process.
   */
  async stopPatcher(): Promise<import("../types").PatcherStatePayload> {
    if (!isTauri()) {
      return {
        status: "stopped",
        message: "Chế độ Preview Trình Duyệt: Đã dừng patcher.",
        game_pid: null,
      };
    }
    return await invoke<import("../types").PatcherStatePayload>("stop_patcher");
  },

  /**
   * Retrieves the current status of the patcher host.
   */
  async getPatcherStatus(): Promise<import("../types").PatcherStatePayload> {
    if (!isTauri()) {
      return {
        status: "stopped",
        message: "Chưa khởi chạy patcher.",
        game_pid: null,
      };
    }
    return await invoke<import("../types").PatcherStatePayload>("get_patcher_status");
  },

  /**
   * Subscribes to real-time patcher status updates (scanning, injected, waiting, exited, failed).
   */
  async onPatcherStatus(
    callback: (payload: import("../types").PatcherStatePayload) => void
  ): Promise<UnlistenFn> {
    if (!isTauri()) {
      return () => {};
    }
    return await listen<import("../types").PatcherStatePayload>("patcher-status", (event) => {
      callback(event.payload);
    });
  },
};
