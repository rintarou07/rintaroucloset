import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RotateCcw, Settings, Play, Square, ShieldCheck, Trash2, X, Users, CloudDownload, CheckCircle2, Sparkles } from "lucide-react";
import clsx from "clsx";
import type {
  SummonerProfile,
  PatcherStatePayload,
  ActiveSkinProfile,
  ChampionItem,
  RepoStatus,
} from "../types/skin";
import type { PeerMember } from "../services/p2pLobby";

export type NavTab = "GAME_SKIN" | "CUSTOM_SKIN";

interface TopHeaderBarProps {
  currentTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  summoner: SummonerProfile | null;
  activeCount: number;
  activeSkins?: Record<number, ActiveSkinProfile>;
  champions?: ChampionItem[];
  patcherState: PatcherStatePayload | null;
  isBuildingOverlay: boolean;
  onTogglePatcher: () => void;
  onRebuildOverlay: () => void;
  onOpenSettings: () => void;
  onRemoveSkin?: (championId: number) => void;
  onClearAll?: () => void;
  onOpenFriends?: () => void;
  isSyncConnected?: boolean;
  syncPing?: number | null;
  peers?: PeerMember[];
  repoStatus?: RepoStatus | null;
  onOpenRepoSync?: () => void;
  isTestInstance?: boolean;
  onOpenUpdate?: () => void;
  hasUpdate?: boolean;
}

const TopHeaderBarComponent: React.FC<TopHeaderBarProps> = ({
  currentTab,
  onTabChange,
  summoner,
  activeCount,
  activeSkins = {},
  champions = [],
  patcherState,
  isBuildingOverlay,
  onTogglePatcher,
  onRebuildOverlay,
  onOpenSettings,
  onRemoveSkin,
  onClearAll,
  onOpenFriends,
  isSyncConnected = false,
  syncPing = null,
  peers = [],
  repoStatus = null,
  onOpenRepoSync,
  isTestInstance = false,
  onOpenUpdate,
  hasUpdate = false,
}) => {
  const [isActivePopoverOpen, setIsActivePopoverOpen] = useState(false);

  const isPatcherRunning =
    patcherState?.status === "Scanning" ||
    patcherState?.status === "Redirecting" ||
    patcherState?.status === "scanning" ||
    patcherState?.status === "injected" ||
    patcherState?.status === "waiting";

  const isGameActive = patcherState?.is_game_running;

  // Derive status text
  let statusText = `${activeCount} ACTIVE`;
  if (isBuildingOverlay) {
    statusText = "BUILDING...";
  } else if (isGameActive || patcherState?.status === "Redirecting" || patcherState?.status === "injected") {
    statusText = `${activeCount} INJECTED`;
  } else if (isPatcherRunning) {
    statusText = "SCANNING...";
  }

  const avatarUrl =
    summoner?.profile_icon_url ||
    "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/profile-icons/29.jpg";

  const activeEntries = Object.entries(activeSkins);

  return (
    <header className="fixed top-0 left-0 right-0 h-[60px] bg-[#1E1F20] hairline-border-b z-40 px-4 flex items-center justify-between select-none">
      {/* 1. Left: Brand & Safe LCU Summoner Profile */}
      <div className="flex items-center gap-3.5 min-w-[340px]">
        {/* App Branding */}
        <div className="flex items-center gap-2.5 pr-3 border-r border-white/10 shrink-0">
          <img
            src="/icon.ico"
            alt="Rintarou Closet"
            className="w-8 h-8 rounded-lg object-cover ring-1 ring-pink-500/30 shadow-md shadow-pink-500/10"
          />
          <div className="flex flex-col">
            <span className="text-[13px] font-black tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-pink-400 via-rose-300 to-amber-200">
              Rintarou Closet
            </span>
            <span className="text-[9px] text-[#9AA0A6] font-mono leading-none">
              LoL Skin Studio
            </span>
          </div>
        </div>

        {/* Summoner Profile */}
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <img
              src={avatarUrl}
              alt="Summoner Avatar"
              className="w-8 h-8 rounded-full object-cover ring-1 ring-[#D91B2E]/60 bg-[#131314]"
              onError={(e) => {
                (e.target as HTMLImageElement).src =
                  "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/profile-icons/29.jpg";
              }}
            />
            {/* Online status dot */}
            <span
              className={clsx(
                "absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#1E1F20]",
                summoner?.is_online ? "bg-emerald-500 shadow-[0_0_6px_#10B981]" : "bg-zinc-500"
              )}
              title={summoner?.is_online ? "LCU Online" : "LCU Offline (Passive Cache)"}
            />
          </div>

          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="text-[12px] font-semibold text-white tracking-wide truncate max-w-[130px]">
                {summoner?.game_name || "Chưa Đăng Nhập"}
              </span>
              <span className="text-[10px] font-normal text-[#9AA0A6]">
                #{summoner?.tag_line || "OFFLINE"}
              </span>
              {isTestInstance && (
                <span className="px-1.5 py-0.2 rounded bg-amber-500/20 border border-amber-500/40 text-amber-300 font-bold text-[9px] tracking-wider">
                  MOCK TEST
                </span>
              )}
            </div>
            {isTestInstance ? (
              <div className="flex items-center gap-1 text-[9px] text-amber-400 font-mono font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                <span>TEST BẠN BÈ • PEER SIMULATOR</span>
              </div>
            ) : (
              <div className="flex items-center gap-1 text-[9px] text-emerald-400 font-mono">
                <ShieldCheck className="w-3 h-3" />
                <span>LCU SAFE • PASSIVE</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. Center: Animated Tab Switcher (GAME SKIN | CUSTOM SKIN) */}
      <div className="bg-[#131314] p-1 rounded-xl border border-white/[0.07] flex gap-1 items-center">
        <button
          onClick={() => onTabChange("GAME_SKIN")}
          className={clsx(
            "relative px-4 py-1.5 rounded-lg text-xs font-semibold tracking-wider transition-colors duration-200 z-10 cursor-pointer",
            currentTab === "GAME_SKIN" ? "text-white" : "text-[#9AA0A6] hover:text-white"
          )}
        >
          {currentTab === "GAME_SKIN" && (
            <motion.div
              layoutId="topNavTabPill"
              className="absolute inset-0 bg-[#D91B2E] rounded-lg -z-10 shadow-[0_0_12px_rgba(217,27,46,0.5)]"
              transition={{ type: "spring", stiffness: 380, damping: 30 }}
            />
          )}
          GAME SKIN
        </button>

        <button
          onClick={() => onTabChange("CUSTOM_SKIN")}
          className={clsx(
            "relative px-4 py-1.5 rounded-lg text-xs font-semibold tracking-wider transition-colors duration-200 z-10 cursor-pointer",
            currentTab === "CUSTOM_SKIN" ? "text-white" : "text-[#9AA0A6] hover:text-white"
          )}
        >
          {currentTab === "CUSTOM_SKIN" && (
            <motion.div
              layoutId="topNavTabPill"
              className="absolute inset-0 bg-[#D91B2E] rounded-lg -z-10 shadow-[0_0_12px_rgba(217,27,46,0.5)]"
              transition={{ type: "spring", stiffness: 380, damping: 30 }}
            />
          )}
          CUSTOM SKIN
        </button>
      </div>

      {/* 3. Right: Pipeline Status & Controls */}
      <div className="flex items-center gap-2.5 min-w-[250px] justify-end">
        {/* Request 2: Status Pill with Hover/Click Active Skins Popover */}
        <div
          className="relative"
          onMouseEnter={() => setIsActivePopoverOpen(true)}
          onMouseLeave={() => setIsActivePopoverOpen(false)}
        >
          <button
            onClick={() => setIsActivePopoverOpen((prev) => !prev)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#131314] border border-white/[0.08] hover:border-white/20 text-xs font-semibold cursor-pointer transition-colors"
          >
            <span
              className={clsx(
                "w-2 h-2 rounded-full",
                activeCount > 0 ? "bg-[#F43F5E] animate-pulse shadow-[0_0_8px_#F43F5E]" : "bg-zinc-600"
              )}
            />
            <span className="text-[#E3E3E3] tracking-wide">{statusText}</span>
          </button>

          {/* Active Skins Popover */}
          <AnimatePresence>
            {isActivePopoverOpen && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 top-[38px] w-80 bg-[#1E1F20] border border-white/10 rounded-2xl shadow-2xl p-3 z-50 flex flex-col gap-2.5"
              >
                {/* Header */}
                <div className="flex items-center justify-between pb-2 border-b border-white/[0.07]">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#F43F5E]" />
                    <span className="text-xs font-bold text-white tracking-wide">
                      Đang Kích Hoạt ({activeCount})
                    </span>
                  </div>

                  {activeCount > 0 && onClearAll && (
                    <button
                      onClick={() => {
                        onClearAll();
                        setIsActivePopoverOpen(false);
                      }}
                      className="flex items-center gap-1 text-[11px] font-semibold text-rose-400 hover:text-white bg-rose-500/10 hover:bg-rose-600 px-2.5 py-1 rounded-lg border border-rose-500/30 transition-all cursor-pointer"
                      title="Gỡ bỏ tất cả skin đang dùng"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Xoá Tất Cả</span>
                    </button>
                  )}
                </div>

                {/* Active Skin List */}
                <div className="max-h-72 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                  {/* Local User Active Skins (Red Dot) */}
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5 px-1 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                      <div className="w-1.5 h-1.5 rounded-full bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.8)]" />
                      <span>Của Bạn ({activeEntries.length})</span>
                    </div>

                    {activeEntries.length === 0 ? (
                      <div className="py-2 px-2 text-xs text-[#5F6368] italic">
                        Chưa chọn trang phục nào.
                      </div>
                    ) : (
                      activeEntries.map(([champIdStr, profile]) => {
                        const champId = Number(champIdStr);
                        const champ = champions.find((c) => c.id === champId);

                        return (
                          <div
                            key={champId}
                            className="flex items-center justify-between p-2 rounded-xl bg-[#131314] border border-white/[0.05] hover:border-white/15 transition-all group"
                          >
                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                              <div className="w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.8)] shrink-0" title="Trang phục cá nhân" />
                              <img
                                src={champ?.square_icon_url || champ?.icon_url}
                                alt={champ?.name_vi || "Champion"}
                                className="w-7 h-7 rounded-lg object-cover ring-1 ring-white/10 shrink-0"
                              />
                              <div className="min-w-0 flex-1">
                                <p className="text-[12px] font-semibold text-white truncate">
                                  {profile.skin_name}
                                </p>
                                <p className="text-[10px] text-[#9AA0A6] truncate">
                                  {champ?.name_vi || champ?.name || `Tướng ${champId}`}
                                </p>
                              </div>
                            </div>

                            {onRemoveSkin && (
                              <button
                                onClick={() => onRemoveSkin(champId)}
                                className="p-1.5 rounded-lg text-[#9AA0A6] hover:text-rose-400 hover:bg-rose-500/10 transition-colors shrink-0 cursor-pointer"
                                title="Hủy kích hoạt skin này"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Friends Active Skins (Blue Dot) */}
                  {peers.length > 0 && peers.some((p) => p.activeMods && p.activeMods.length > 0) && (
                    <div className="pt-2 border-t border-white/10 space-y-2">
                      <div className="flex items-center gap-1.5 px-1 text-[10px] font-bold text-sky-400 uppercase tracking-wider">
                        <div className="w-1.5 h-1.5 rounded-full bg-sky-400 shadow-[0_0_6px_rgba(56,189,248,0.8)]" />
                        <span>Của Bạn Bè Trong Phòng</span>
                      </div>

                      {peers.map((peer) => {
                        const peerMods = peer.activeMods || [];
                        if (peerMods.length === 0) return null;

                        return (
                          <div key={peer.peerId} className="space-y-1">
                            <div className="text-[10px] font-semibold text-zinc-400 px-1 flex items-center gap-1.5">
                              <img
                                src={peer.profileIconUrl || "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/profile-icons/29.jpg"}
                                alt=""
                                className="w-4 h-4 rounded-full"
                              />
                              <span className="truncate">{peer.summonerName || "Bạn bè P2P"}</span>
                              {peer.pingMs !== null && (
                                <span className="text-[9px] font-mono text-zinc-500">({peer.pingMs}ms)</span>
                              )}
                            </div>

                            {peerMods.map((pMod) => {
                              const cId = Number(pMod.championId);
                              const c = champions.find((item) => item.id === cId);

                              return (
                                <div
                                  key={`${peer.peerId}-${pMod.championId}-${pMod.skinId}`}
                                  className="flex items-center justify-between p-1.5 rounded-lg bg-[#141618] border border-sky-500/20"
                                >
                                  <div className="flex items-center gap-2 min-w-0 flex-1">
                                    <div className="w-2 h-2 rounded-full bg-sky-400 shadow-[0_0_6px_rgba(56,189,248,0.8)] shrink-0" title="Skin bạn bè chọn" />
                                    {c && (
                                      <img
                                        src={c.square_icon_url || c.icon_url}
                                        alt=""
                                        className="w-6 h-6 rounded-md object-cover ring-1 ring-white/10 shrink-0"
                                      />
                                    )}
                                    <div className="min-w-0 flex-1">
                                      <p className="text-[11px] font-medium text-white truncate">
                                        {pMod.skinName || `Skin ${pMod.skinId}`}
                                      </p>
                                      <p className="text-[9px] text-zinc-400 truncate">
                                        {c?.name_vi || c?.name || pMod.championName || `Tướng ${cId}`}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Repo Cache Sync & Update Button */}
        <button
          onClick={onOpenRepoSync}
          className={clsx(
            "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer",
            repoStatus?.is_downloading
              ? "bg-sky-500/15 border-sky-400 text-sky-300 shadow-[0_0_10px_rgba(56,189,248,0.3)]"
              : repoStatus?.is_fully_synced
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
              : "bg-[#282A2C] border-white/10 text-[#9AA0A6] hover:text-white hover:bg-[#343739]"
          )}
          title="Kho trang phục (Tải trước để kích hoạt tức thì 0s)"
        >
          {repoStatus?.is_downloading ? (
            <RotateCcw className="w-3.5 h-3.5 animate-spin text-sky-400" />
          ) : repoStatus?.is_fully_synced ? (
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          ) : (
            <CloudDownload className="w-3.5 h-3.5" />
          )}
          <span className="text-[11px] font-mono">
            {repoStatus?.is_downloading
              ? "ĐANG TẢI KHO..."
              : repoStatus?.is_fully_synced
              ? "KHO: 100%"
              : `KHO: ${repoStatus ? `${repoStatus.percentage}%` : "KHO SKIN"}`}
          </span>
        </button>

        {/* Check for Update Button */}
        <button
          onClick={onOpenUpdate}
          className={clsx(
            "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer relative",
            hasUpdate
              ? "bg-amber-500/20 border-amber-400 text-amber-300 shadow-[0_0_12px_rgba(251,191,36,0.4)]"
              : "bg-[#282A2C] border-white/10 text-[#9AA0A6] hover:text-white hover:bg-[#343739]"
          )}
          title={hasUpdate ? "Có bản cập nhật mới trên GitHub!" : "Kiểm tra cập nhật (GitHub)"}
        >
          <Sparkles className={clsx("w-3.5 h-3.5", hasUpdate ? "text-amber-400 animate-spin" : "text-sky-400")} />
          <span className="text-[11px] font-mono">
            {hasUpdate ? "BẢN MỚI!" : "UPDATE"}
          </span>
          {hasUpdate && (
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
          )}
        </button>

        {/* Friends & P2P Mesh Lobby Drawer Button with Live Ping Badge */}
        <button
          onClick={onOpenFriends}
          className={clsx(
            "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer",
            isSyncConnected
              ? "bg-sky-500/10 border-sky-500/30 text-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.2)]"
              : "bg-[#282A2C] border-white/10 text-[#9AA0A6] hover:text-white hover:bg-[#343739]"
          )}
          title={`P2P Mesh Lobby (${
            isSyncConnected
              ? `Online • ${syncPing !== null ? `${syncPing}ms` : "Connected"}`
              : "Chưa kết nối Lobby"
          })`}
        >
          <Users className="w-3.5 h-3.5" />
          <span className="text-[11px] font-mono">
            {isSyncConnected
              ? (syncPing !== null ? `${syncPing}ms` : "LOBBY")
              : "LOBBY"}
          </span>
          {isSyncConnected && (
            <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse shadow-[0_0_6px_rgba(56,189,248,0.8)]" />
          )}
        </button>

        {/* Patcher Toggle Button */}
        <button
          onClick={onTogglePatcher}
          className={clsx(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 border cursor-pointer",
            isPatcherRunning
              ? "bg-[#D91B2E]/20 border-[#D91B2E] text-[#F43F5E] hover:bg-[#D91B2E]/30 shadow-[0_0_10px_rgba(217,27,46,0.3)]"
              : "bg-[#282A2C] border-white/10 text-white hover:bg-[#343739]"
          )}
          title={isPatcherRunning ? "Dừng Patcher Host" : "Kích hoạt Patcher Host"}
        >
          {isPatcherRunning ? (
            <>
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>DỪNG</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>INJECT</span>
            </>
          )}
        </button>

        {/* Rebuild Overlay Button */}
        <button
          onClick={onRebuildOverlay}
          disabled={isBuildingOverlay}
          className="p-2 rounded-lg bg-[#282A2C] border border-white/10 text-[#9AA0A6] hover:text-white hover:bg-[#343739] transition-colors disabled:opacity-50 cursor-pointer"
          title="Tạo lại WAD Overlay"
        >
          <RotateCcw className={clsx("w-4 h-4", isBuildingOverlay && "animate-spin text-[#D91B2E]")} />
        </button>

        {/* Settings Button */}
        <button
          onClick={onOpenSettings}
          className="p-2 rounded-lg bg-[#282A2C] border border-white/10 text-[#9AA0A6] hover:text-white hover:bg-[#343739] transition-colors cursor-pointer"
          title="Cài đặt Portable & Đường dẫn LoL"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};

export const TopHeaderBar = React.memo(TopHeaderBarComponent);
export default TopHeaderBar;
