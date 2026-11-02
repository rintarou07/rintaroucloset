import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, AlertCircle, CheckCircle2, Info } from "lucide-react";
import { tauriClient } from "./services/tauriClient";
import TopHeaderBar, { type NavTab } from "./components/TopHeaderBar";
import SidebarNavigator from "./components/SidebarNavigator";
import SkinCard from "./components/SkinCard";
import CustomSkinView from "./components/CustomSkinView";
import SettingsModal from "./components/SettingsModal";
import { FriendsDrawer } from "./components/FriendsDrawer";
import { ConflictModal, type ConflictItem } from "./components/ConflictModal";
import { RepoSyncModal } from "./components/RepoSyncModal";
import { UpdateModal } from "./components/UpdateModal";
import { p2pLobby, type P2PLobbyState } from "./services/p2pLobby";
import type {
  ChampionItem,
  SkinItem,
  ChromaItem,
  SkinStage,
  ActiveSkinProfile,
  SummonerProfile,
  PatcherStatePayload,
  PortablePaths,
  RepoStatus,
  BulkDownloadProgress,
  UpdateCheckResult,
} from "./types/skin";

interface ToastInfo {
  id: number;
  message: string;
  type: "info" | "success" | "error";
}

export function App() {
  // Navigation & View State
  const [currentTab, setCurrentTab] = useState<NavTab>("GAME_SKIN");
  const [champions, setChampions] = useState<ChampionItem[]>([]);
  const [selectedChampionId, setSelectedChampionId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Mod & Backend State
  const [activeSkins, setActiveSkins] = useState<Record<number, ActiveSkinProfile>>({});
  const [summoner, setSummoner] = useState<SummonerProfile | null>(null);
  const [patcherState, setPatcherState] = useState<PatcherStatePayload | null>(null);
  const [portablePaths, setPortablePaths] = useState<PortablePaths | undefined>(undefined);
  const [gamePath, setGamePath] = useState<string | null>(null);
  const [isGamePathValid, setIsGamePathValid] = useState(false);
  const [isTestInstance, setIsTestInstance] = useState(false);

  // Friends & P2P Mesh Lobby State
  const [isFriendsDrawerOpen, setIsFriendsDrawerOpen] = useState(false);
  const [p2pState, setP2pState] = useState<P2PLobbyState>(p2pLobby.getState());
  const [activeConflict, setActiveConflict] = useState<ConflictItem | null>(null);
  const dismissedConflictsRef = useRef<Set<number>>(new Set());
  const lastBuiltFriendsKeyRef = useRef<string>("");

  // GitHub App Auto-Updater State
  const [updateInfo, setUpdateInfo] = useState<UpdateCheckResult | null>(null);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);

  // Alban1911 Repo Bulk Sync State
  const [repoStatus, setRepoStatus] = useState<RepoStatus | null>(null);
  const [bulkProgress, setBulkProgress] = useState<BulkDownloadProgress | null>(null);
  const [isRepoModalOpen, setIsRepoModalOpen] = useState(false);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);

  // Operation Progress State
  const [isBuildingOverlay, setIsBuildingOverlay] = useState(false);
  const [overlayStageText, setOverlayStageText] = useState<string | null>(null);
  const [applyingSkinId, setApplyingSkinId] = useState<number | null>(null);
  const [downloadPercentages, setDownloadPercentages] = useState<Record<number, number>>({});
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastInfo[]>([]);

  const showToast = (message: string, type: "info" | "success" | "error" = "info") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  // Startup initialization
  useEffect(() => {
    let unlistenProgress: (() => void) | undefined;
    let unlistenOverlay: (() => void) | undefined;
    let unlistenPatcherState: (() => void) | undefined;
    let unlistenRepoProgress: (() => void) | undefined;

    async function initClient() {
      try {
        // 1. Initialize Portable Environment & LoL Game Path
        const env = await tauriClient.initPortableEnv();
        setPortablePaths(env.paths);
        setGamePath(env.config.lol_game_path ?? null);
        setIsGamePathValid(env.is_game_path_valid);
        setActiveSkins(env.config.active_skins ?? {});

        try {
          const testMode = await tauriClient.isTestInstance();
          setIsTestInstance(testMode);
        } catch {
          // default false
        }

        if (!env.is_game_path_valid) {
          showToast("Chưa tìm thấy game. Vui lòng cài đặt đường dẫn LoL.", "error");
        }

        // 2. Fetch or load cached metadata
        await tauriClient.syncMetadata(false);
        const catalog = await tauriClient.getCatalog();
        setChampions(catalog);

        if (catalog.length > 0) {
          setSelectedChampionId(catalog[0].id);
        }

        // 3. Passive summoner profile reader
        try {
          const sum = await tauriClient.getCurrentSummoner();
          setSummoner(sum);
        } catch {
          // Client not open yet, passive default
        }

        // 4. Live patcher status
        try {
          const pStatus = await tauriClient.getPatcherStatus();
          setPatcherState(pStatus);
        } catch {
          // ignore
        }

        // 5. Initial check of Alban1911 skin repository cache status
        try {
          const rStatus = await tauriClient.checkRepoStatus(false);
          setRepoStatus(rStatus);
        } catch {
          // ignore
        }

        // 6. Passive background check for GitHub updates
        tauriClient
          .checkForUpdates()
          .then((res) => {
            setUpdateInfo(res);
            if (res.has_update) {
              showToast(`Có bản cập nhật mới v${res.latest_version} trên GitHub!`, "info");
            }
          })
          .catch(() => {});

        // 6. Register IPC Event Listeners
        unlistenProgress = await tauriClient.onDownloadProgress((payload) => {
          setDownloadPercentages((prev) => ({
            ...prev,
            [payload.skin_id]: payload.percentage,
          }));
        });

        unlistenOverlay = await tauriClient.onOverlayProgress((payload) => {
          setIsBuildingOverlay(true);
          setOverlayStageText(payload.message);
          if (payload.current >= payload.total && payload.total > 0) {
            setTimeout(() => {
              setIsBuildingOverlay(false);
              setOverlayStageText(null);
            }, 600);
          }
        });

        unlistenPatcherState = await tauriClient.onPatcherState((payload) => {
          setPatcherState(payload);
        });

        unlistenRepoProgress = await tauriClient.onRepoDownloadProgress((payload) => {
          setBulkProgress(payload);
          setRepoStatus((prev) => {
            if (!prev) return null;
            return {
              ...prev,
              total_files: payload.total_files > 0 ? payload.total_files : prev.total_files,
              cached_files: payload.downloaded_files,
              missing_files: Math.max(0, payload.total_files - payload.downloaded_files),
              percentage: payload.percentage,
              is_fully_synced: payload.downloaded_files >= payload.total_files && payload.total_files > 0,
              is_downloading: payload.is_active,
            };
          });
          if (payload.is_completed) {
            showToast("Đã đồng bộ xong toàn bộ kho trang phục!", "success");
            tauriClient.checkRepoStatus(false).then(setRepoStatus).catch(() => {});
          }
        });
      } catch (err) {
        console.error("Initialization error:", err);
        showToast("Lỗi khởi tạo hệ thống mod.", "error");
      }
    }

    initClient();

    return () => {
      if (unlistenProgress) unlistenProgress();
      if (unlistenOverlay) unlistenOverlay();
      if (unlistenPatcherState) unlistenPatcherState();
      if (unlistenRepoProgress) unlistenRepoProgress();
    };
  }, []);

  // Real-time P2P Mesh Lobby Subscription
  useEffect(() => {
    // Check initial sync config to see if user had sync enabled
    tauriClient.getSyncConfig().then((cfg) => {
      if (cfg.is_sync_enabled) {
        p2pLobby.joinLobby().catch(() => {});
      }
    }).catch(() => {});

    const unsub = p2pLobby.subscribe((st) => {
      setP2pState(st);
    });
    return () => unsub();
  }, []);

  // Update local mods in P2P mesh whenever summoner, active skins, or champions list change
  useEffect(() => {
    p2pLobby.updateLocalMods(summoner, activeSkins, champions);
  }, [summoner, activeSkins, champions]);

  // Duplicate Champion Conflict Detection
  useEffect(() => {
    if (p2pState.status !== "connected") {
      setActiveConflict(null);
      return;
    }

    const conflicts: ConflictItem[] = [];
    for (const peer of p2pState.peers) {
      for (const mod of peer.activeMods) {
        const localSkin = activeSkins[mod.championId];
        if (localSkin) {
          conflicts.push({
            championId: mod.championId,
            peerSummonerName: peer.summonerName || `Slot #${peer.slotNumber}`,
            peerSkinName: mod.skinName,
            localSkinName: localSkin.skin_name,
          });
        }
      }
    }

    // Clean up dismissed conflicts that are no longer colliding
    if (dismissedConflictsRef.current.size > 0) {
      const activeConflictChampIds = new Set(conflicts.map((c) => c.championId));
      for (const champId of dismissedConflictsRef.current) {
        if (!activeConflictChampIds.has(champId)) {
          dismissedConflictsRef.current.delete(champId);
        }
      }
    }

    // Only show popup for brand-new, unhandled conflicts
    const unhandled = conflicts.find((c) => !dismissedConflictsRef.current.has(c.championId));
    if (unhandled) {
      setActiveConflict((curr) => curr || unhandled);
    } else {
      setActiveConflict(null);
    }
  }, [p2pState.peers, activeSkins, p2pState.status]);

  // Automatically sync friend skins into game overlay whenever peers pick/change skins
  useEffect(() => {
    if (p2pState.status !== "connected") {
      if (lastBuiltFriendsKeyRef.current !== "") {
        lastBuiltFriendsKeyRef.current = "";
        tauriClient.rebuildOverlay().catch(() => {});
      }
      return;
    }

    const readyFriendSkins = p2pLobby.getSyncableFriendSkins();
    const key = readyFriendSkins
      .map((f) => `${f.champion_id}:${f.skin_id}`)
      .sort()
      .join("|");

    if (key === lastBuiltFriendsKeyRef.current) {
      return;
    }

    const timer = setTimeout(async () => {
      try {
        lastBuiltFriendsKeyRef.current = key;
        const res = await tauriClient.rebuildOverlayWithFriends(readyFriendSkins);
        if (readyFriendSkins.length > 0) {
          showToast(
            `Đã đồng bộ ${readyFriendSkins.length} skin của bạn bè vào WAD game! (${res.duration_ms}ms)`,
            "info"
          );
        }
      } catch (err) {
        console.warn("Auto friend overlay rebuild error:", err);
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [p2pState.peers, activeSkins, p2pState.status]);

  // Compute set of champions with active injected skins
  const activeChampionIds = useMemo(() => {
    return new Set<number>(Object.keys(activeSkins).map(Number));
  }, [activeSkins]);

  // Compute set of champions with active friend skins in P2P lobby
  const friendActiveChampionIds = useMemo(() => {
    const set = new Set<number>();
    for (const peer of p2pState.peers) {
      for (const mod of peer.activeMods) {
        set.add(mod.championId);
      }
    }
    return set;
  }, [p2pState.peers]);

  // Compute map of friend names by champion for rich tooltips
  const friendActiveNamesByChamp = useMemo(() => {
    const map: Record<number, string[]> = {};
    for (const peer of p2pState.peers) {
      for (const mod of peer.activeMods) {
        if (!map[mod.championId]) {
          map[mod.championId] = [];
        }
        map[mod.championId].push(`${peer.summonerName} (${mod.skinName})`);
      }
    }
    return map;
  }, [p2pState.peers]);

  // Selected champion object
  const currentChampion = useMemo(() => {
    return champions.find((c) => c.id === selectedChampionId) || champions[0];
  }, [champions, selectedChampionId]);

  // Mod Apply Handler (Supports Base Skin, Chromas, and Multi-Stage Forms)
  const handleApplySkin = useCallback(
    async (skin: SkinItem, chroma?: ChromaItem, stage?: SkinStage) => {
      if (!isGamePathValid) {
        setIsSettingsOpen(true);
        showToast("Vui lòng thiết lập đường dẫn game trước khi kích hoạt skin.", "error");
        return;
      }

      const targetSkinId = stage ? stage.id : (chroma ? chroma.id : skin.id);
      const isChroma = Boolean(chroma);
      const baseName = skin.name_vi || skin.name || skin.name_en || `Skin ${skin.id}`;
      let skinName = baseName;
      if (stage) {
        skinName = stage.name_vi || stage.name || `${baseName} (Dạng ${stage.stage_number})`;
      } else if (chroma) {
        const chromaName = chroma.name_vi || chroma.name || chroma.name_en || "";
        skinName = `${baseName} (${chromaName})`;
      }

      const parentSkinId = stage ? stage.parent_skin_id : (chroma ? skin.id : null);
      const downloadUrl = stage
        ? (stage.fantome_download_url || stage.fantome_url)
        : chroma
        ? (chroma.fantome_download_url || chroma.fantome_url || skin.fantome_download_url || skin.fantome_url)
        : (skin.fantome_download_url || skin.fantome_url);

      setApplyingSkinId(targetSkinId);
      dismissedConflictsRef.current.delete(skin.champion_id);

      try {
        await tauriClient.applySkin({
          champion_id: skin.champion_id,
          skin_id: targetSkinId,
          skin_name: skinName,
          is_chroma: isChroma,
          parent_skin_id: parentSkinId,
          fantome_url: downloadUrl,
        });

        // Update active skins
        const active = await tauriClient.getActiveSkins();
        setActiveSkins(active);

        showToast(`Đã áp dụng: ${skinName}!`, "success");
      } catch (err) {
        console.error("Apply skin error:", err);
        showToast(typeof err === "string" ? err : "Lỗi khi áp dụng skin.", "error");
      } finally {
        setApplyingSkinId(null);
        setDownloadPercentages((prev) => {
          const next = { ...prev };
          delete next[targetSkinId];
          return next;
        });
      }
    },
    [isGamePathValid]
  );

  // Mod Remove Handler
  const handleRemoveSkin = useCallback(async (championId: number) => {
    try {
      dismissedConflictsRef.current.delete(championId);
      await tauriClient.removeSkin(championId);
      const active = await tauriClient.getActiveSkins();
      setActiveSkins(active);
      showToast("Đã gỡ bỏ skin và cập nhật WAD overlay.", "info");
    } catch (err) {
      console.error("Remove skin error:", err);
      showToast(typeof err === "string" ? err : "Lỗi khi gỡ bỏ skin.", "error");
    }
  }, []);

  // Clear All Active Skins & Overlay
  const handleClearAll = useCallback(async () => {
    try {
      await tauriClient.clearOverlay();
      setActiveSkins({});
      showToast("Đã gỡ bỏ toàn bộ skin và làm sạch overlay.", "info");
    } catch (err) {
      console.error("Clear overlay error:", err);
      showToast(typeof err === "string" ? err : "Lỗi khi gỡ bỏ overlay.", "error");
    }
  }, []);

  // Conflict actions (yield or keep) - Dismisses from popup immediately and permanently for this champion
  const handleYieldConflict = useCallback(
    async (conflict: ConflictItem) => {
      dismissedConflictsRef.current.add(conflict.championId);
      setActiveConflict(null);

      p2pLobby.sendConflictAction(conflict.championId, conflict.peerSummonerName, "yield");
      await handleRemoveSkin(conflict.championId);
      showToast(`Đã nhường skin cho ${conflict.peerSummonerName}!`, "info");
    },
    [handleRemoveSkin]
  );

  const handleKeepConflict = useCallback(async (conflict: ConflictItem) => {
    dismissedConflictsRef.current.add(conflict.championId);
    setActiveConflict(null);

    p2pLobby.sendConflictAction(conflict.championId, conflict.peerSummonerName, "keep");
    showToast(`Bạn chọn giữ skin. Nếu đổi ý, bạn có thể nhường bất cứ lúc nào trong tab Bạn bè.`, "info");
  }, []);

  // Yield skin on-demand from Friends Drawer if user changes their mind later
  const handleYieldSkinFromFriends = useCallback(
    async (championId: number, peerSummonerName: string) => {
      dismissedConflictsRef.current.add(championId);

      p2pLobby.sendConflictAction(championId, peerSummonerName, "yield");
      await handleRemoveSkin(championId);
      showToast(`Đã nhường skin cho ${peerSummonerName}!`, "success");
    },
    [handleRemoveSkin]
  );

  // Patcher Host Toggle (Includes Merged Multi-Skin Overlay Build)
  const handleTogglePatcher = async () => {
    const isRunning =
      patcherState?.status === "Scanning" ||
      patcherState?.status === "Redirecting" ||
      patcherState?.status === "scanning" ||
      patcherState?.status === "injected" ||
      patcherState?.status === "waiting";

    try {
      if (isRunning) {
        const status = await tauriClient.stopPatcher();
        setPatcherState(status);
        showToast("Đã dừng patcher host.", "info");
      } else {
        // Multi-skin Merged Overlay Build before starting patcher
        if (p2pState.status === "connected") {
          const friendSkins = p2pLobby.getSyncableFriendSkins();
          if (friendSkins.length > 0) {
            try {
              await tauriClient.rebuildOverlayWithFriends(friendSkins);
            } catch (err) {
              console.warn("Merged overlay build warning:", err);
            }
          } else {
            try {
              await tauriClient.rebuildOverlay();
            } catch (err) {
              console.warn("Rebuild overlay warning:", err);
            }
          }
        }

        const status = await tauriClient.startPatcher();
        setPatcherState(status);
        showToast("Đã kích hoạt patcher host, đang quét tiến trình game...", "success");
      }
    } catch (err) {
      console.error("Patcher toggle error:", err);
      showToast(typeof err === "string" ? err : "Lỗi kích hoạt patcher.", "error");
    }
  };

  // Rebuild Overlay on Demand
  const handleRebuildOverlay = async () => {
    setIsBuildingOverlay(true);
    try {
      const summary = await tauriClient.rebuildOverlay();
      showToast(
        `Overlay hoàn tất (${summary.duration_ms}ms)! Đã tạo: ${summary.wads_built} WAD, Tái sử dụng: ${summary.wads_reused} WAD.`,
        "success"
      );
    } catch (err) {
      console.error("Rebuild overlay error:", err);
      showToast(typeof err === "string" ? err : "Lỗi xây dựng overlay.", "error");
    } finally {
      setIsBuildingOverlay(false);
      setOverlayStageText(null);
    }
  };

  // Alban1911 Repository Actions
  const handleCheckUpdate = async () => {
    setIsCheckingUpdate(true);
    try {
      const updated = await tauriClient.checkRepoStatus(true);
      setRepoStatus(updated);
      showToast(
        `Cập nhật kho thành công! Có ${updated.total_files.toLocaleString()} trang phục (${updated.percentage}% đã tải).`,
        "success"
      );
    } catch (err) {
      console.error("Check repo update error:", err);
      showToast(typeof err === "string" ? err : "Lỗi kiểm tra cập nhật kho từ GitHub.", "error");
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  const handleStartBulkDownload = async () => {
    try {
      await tauriClient.startBulkDownload();
      showToast("Đã bắt đầu tải toàn bộ kho trang phục ngầm...", "info");
    } catch (err) {
      console.error("Start bulk download error:", err);
      showToast(typeof err === "string" ? err : "Lỗi bắt đầu tải kho.", "error");
    }
  };

  const handleStopBulkDownload = async () => {
    try {
      await tauriClient.stopBulkDownload();
      showToast("Đã tạm dừng tải kho.", "info");
    } catch (err) {
      console.warn("Stop bulk download error:", err);
    }
  };

  // GitHub App Auto-Updater Action
  const handleCheckAppUpdate = useCallback(async (): Promise<UpdateCheckResult | null> => {
    try {
      const res = await tauriClient.checkForUpdates();
      setUpdateInfo(res);
      if (res.has_update) {
        showToast(`Phát hiện bản cập nhật mới v${res.latest_version} từ GitHub!`, "info");
      }
      return res;
    } catch (err) {
      console.warn("Check app update error:", err);
      return null;
    }
  }, []);

  return (
    <div className="h-screen w-screen bg-[#131314] text-[#E3E3E3] font-mono flex flex-col overflow-hidden select-none">
      {/* Zone 1: Top Header Bar (Fixed h-[60px]) */}
      <TopHeaderBar
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        summoner={summoner}
        activeCount={Object.keys(activeSkins).length}
        activeSkins={activeSkins}
        champions={champions}
        patcherState={patcherState}
        isBuildingOverlay={isBuildingOverlay}
        onTogglePatcher={handleTogglePatcher}
        onRebuildOverlay={handleRebuildOverlay}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onRemoveSkin={handleRemoveSkin}
        onClearAll={handleClearAll}
        onOpenFriends={() => setIsFriendsDrawerOpen(true)}
        isSyncConnected={p2pState.status === "connected"}
        syncPing={
          p2pState.peers.length > 0
            ? Math.min(...p2pState.peers.map((p) => p.pingMs ?? 999).filter((p) => p < 999))
            : null
        }
        peers={p2pState.peers}
        repoStatus={repoStatus}
        onOpenRepoSync={() => setIsRepoModalOpen(true)}
        isTestInstance={isTestInstance}
        onOpenUpdate={() => setIsUpdateModalOpen(true)}
        hasUpdate={Boolean(updateInfo?.has_update)}
      />

      {/* Main Container */}
      <div className="flex-1 flex mt-[60px] overflow-hidden">
        {currentTab === "GAME_SKIN" ? (
          <>
            {/* Zone 2: Left Navigator Sidebar (Fixed w-[270px]) */}
            <SidebarNavigator
              champions={champions}
              selectedChampionId={selectedChampionId}
              onSelectChampion={(champ) => setSelectedChampionId(champ.id)}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              activeChampionIds={activeChampionIds}
              friendActiveChampionIds={friendActiveChampionIds}
              friendActiveNamesByChamp={friendActiveNamesByChamp}
            />

            {/* Zone 3: Main Viewport & Skin Cards */}
            <main className="flex-1 ml-[210px] overflow-y-auto p-6 space-y-6">
              {currentChampion ? (
                <>
                  {/* Champion Header Title Banner */}
                  <div className="flex items-center justify-between pb-4 hairline-border-b">
                    <div className="flex items-center gap-3.5">
                      <div className="w-12 h-12 rounded-xl overflow-hidden ring-1 ring-white/15 bg-[#1E1F20] shrink-0">
                        <img
                          src={currentChampion.square_icon_url || currentChampion.icon_url}
                          alt={currentChampion.name_vi}
                          className="w-full h-full object-cover scale-110"
                        />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h1 className="text-xl font-bold text-white tracking-wide">
                            {currentChampion.name_vi || currentChampion.name || currentChampion.key}
                          </h1>
                          <span className="text-sm text-[#9AA0A6] font-normal">
                            ({currentChampion.name_en || currentChampion.key})
                          </span>
                        </div>
                        <p className="text-xs text-[#5F6368] mt-0.5">
                          {currentChampion.title_vi || currentChampion.title || "Vị tướng Liên Minh Huyền Thoại"} •{" "}
                          {currentChampion.skins.length} Trang Phục
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {friendActiveChampionIds.has(currentChampion.id) && (
                        <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-sky-500/15 border border-sky-500/30 text-xs text-sky-400 font-semibold">
                          <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse shadow-[0_0_6px_rgba(56,189,248,0.8)]" />
                          <span>Bạn bè đang mod: {friendActiveNamesByChamp[currentChampion.id]?.join(", ")}</span>
                        </div>
                      )}

                      {activeChampionIds.has(currentChampion.id) && (
                        <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#D91B2E]/15 border border-[#D91B2E]/30 text-xs text-[#F43F5E] font-semibold">
                          <span className="w-2 h-2 rounded-full bg-[#F43F5E] animate-pulse" />
                          <span>Trang phục đang kích hoạt</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Staggered Animated Grid of Authentic LoL Loadscreen Skin Cards */}
                  <motion.div
                    key={currentChampion.id}
                    initial="hidden"
                    animate="show"
                    variants={{
                      hidden: { opacity: 0 },
                      show: {
                        opacity: 1,
                        transition: {
                          staggerChildren: 0.035,
                        },
                      },
                    }}
                    className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-7 p-7"
                  >
                    {currentChampion.skins.map((skin) => {
                      const friendActiveName = p2pState.peers.find((p) => {
                        return p.activeMods.some(
                          (m) =>
                            m.championId === currentChampion.id &&
                            (m.skinId === skin.id ||
                              skin.chromas?.some((c) => c.id === m.skinId) ||
                              skin.stages?.some((st) => st.id === m.skinId))
                        );
                      })?.summonerName;

                      return (
                        <SkinCard
                          key={skin.id}
                          skin={skin}
                          championId={currentChampion.id}
                          activeProfile={activeSkins[currentChampion.id]}
                          friendActiveName={friendActiveName}
                          isApplying={applyingSkinId === skin.id}
                          downloadPercentage={downloadPercentages[skin.id]}
                          onApplySkin={handleApplySkin}
                          onRemoveSkin={handleRemoveSkin}
                        />
                      );
                    })}
                  </motion.div>
                </>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-[#5F6368] text-sm">
                  <Sparkles className="w-8 h-8 mb-2 text-white/20" />
                  <span>Chọn một vị tướng từ danh sách bên trái để xem trang phục.</span>
                </div>
              )}
            </main>
          </>
        ) : (
          /* Custom Skin View Tab */
          <main className="flex-1 overflow-y-auto">
            <CustomSkinView />
          </main>
        )}
      </div>

      {/* Floating Real-time Overlay Building Status */}
      <AnimatePresence>
        {isBuildingOverlay && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-5 right-5 z-50 flex items-center gap-3 px-4 py-2.5 rounded-xl bg-[#1E1F20] border border-[#D91B2E]/50 text-white shadow-2xl backdrop-blur-md"
          >
            <div className="w-4 h-4 border-2 border-[#D91B2E] border-t-transparent rounded-full animate-spin" />
            <span className="text-xs font-semibold tracking-wide">
              {overlayStageText || "Đang tái tạo WAD Overlay..."}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Toast Notification Pill */}
      <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 pointer-events-none">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 15, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -15, scale: 0.95 }}
              className={`flex items-center gap-2.5 px-4 py-2 rounded-xl border text-xs font-semibold shadow-2xl backdrop-blur-md pointer-events-auto ${
                toast.type === "success"
                  ? "bg-emerald-950/90 border-emerald-600/80 text-emerald-200"
                  : toast.type === "error"
                  ? "bg-rose-950/90 border-rose-600/80 text-rose-200"
                  : "bg-[#1E1F20]/90 border-white/20 text-white"
              }`}
            >
              {toast.type === "success" && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
              {toast.type === "error" && <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />}
              {toast.type === "info" && <Info className="w-4 h-4 text-[#D91B2E] shrink-0" />}
              <span>{toast.message}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Portable Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        currentPath={gamePath}
        isValid={isGamePathValid}
        paths={portablePaths}
        onPathUpdated={(newPath) => {
          setGamePath(newPath);
          setIsGamePathValid(true);
        }}
        onOpenUpdate={() => setIsUpdateModalOpen(true)}
      />

      {/* 1-Click P2P Mesh Lobby Drawer */}
      <FriendsDrawer
        isOpen={isFriendsDrawerOpen}
        onClose={() => setIsFriendsDrawerOpen(false)}
        p2pState={p2pState}
        onJoinLobby={() => p2pLobby.joinLobby()}
        onLeaveLobby={() => p2pLobby.leaveLobby()}
        onTogglePeerSync={(peerId) => p2pLobby.togglePeerSync(peerId)}
        onYieldSkin={handleYieldSkinFromFriends}
        activeSkins={activeSkins}
        champions={champions}
      />

      {/* Duplicate Champion Conflict Modal */}
      <ConflictModal
        conflict={activeConflict}
        onYield={handleYieldConflict}
        onKeep={handleKeepConflict}
      />

      {/* Alban1911 Repo Bulk Sync Modal */}
      <RepoSyncModal
        isOpen={isRepoModalOpen}
        onClose={() => setIsRepoModalOpen(false)}
        repoStatus={repoStatus}
        progress={bulkProgress}
        onCheckUpdate={handleCheckUpdate}
        onStartDownload={handleStartBulkDownload}
        onStopDownload={handleStopBulkDownload}
        isCheckingUpdate={isCheckingUpdate}
      />

      {/* GitHub App & Data Auto-Updater Modal */}
      <UpdateModal
        isOpen={isUpdateModalOpen}
        onClose={() => setIsUpdateModalOpen(false)}
        updateInfo={updateInfo}
        onCheckUpdate={handleCheckAppUpdate}
      />
    </div>
  );
}

export default App;
