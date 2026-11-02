import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Users,
  Radio,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  Sparkles,
  HeartHandshake,
  LogOut,
  Zap,
  Layers,
} from "lucide-react";
import type { P2PLobbyState } from "../services/p2pLobby";
import type { ActiveSkinProfile, ChampionItem } from "../types/skin";

interface FriendsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  p2pState: P2PLobbyState;
  onJoinLobby: () => void;
  onLeaveLobby: () => void;
  onTogglePeerSync: (peerId: string) => void;
  onYieldSkin?: (championId: number, peerSummonerName: string) => void;
  activeSkins?: Record<number, ActiveSkinProfile>;
  champions?: ChampionItem[];
}

export const FriendsDrawer: React.FC<FriendsDrawerProps> = ({
  isOpen,
  onClose,
  p2pState,
  onJoinLobby,
  onLeaveLobby,
  onTogglePeerSync,
  onYieldSkin,
  activeSkins = {},
  champions = [],
}) => {
  const isConnected = p2pState.status === "connected";
  const isConnecting = p2pState.status === "connecting";

  const getPingBadge = (ping: number | null) => {
    if (ping === null) {
      return { text: "--", color: "text-zinc-500 bg-zinc-800/80 border-zinc-700", dot: "bg-zinc-500" };
    }
    if (ping < 50) {
      return { text: `${ping} ms`, color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30", dot: "bg-emerald-400" };
    }
    if (ping < 120) {
      return { text: `${ping} ms`, color: "text-sky-400 bg-sky-500/10 border-sky-500/30", dot: "bg-sky-400" };
    }
    if (ping < 200) {
      return { text: `${ping} ms`, color: "text-amber-400 bg-amber-500/10 border-amber-500/30", dot: "bg-amber-400" };
    }
    return { text: `${ping} ms`, color: "text-rose-400 bg-rose-500/10 border-rose-500/30", dot: "bg-rose-400" };
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          />

          {/* Right Bar Drawer */}
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
            className="fixed top-0 right-0 z-50 h-full w-[420px] max-w-[95vw] bg-[#141517] border-l border-[#2E3134] flex flex-col shadow-2xl text-[#E3E3E3] font-mono select-none"
          >
            {/* 1. Header */}
            <div className="p-4 bg-[#18191c] border-b border-[#2E3134] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div
                  className={`p-2 rounded-xl border ${
                    isConnected
                      ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.3)]"
                      : isConnecting
                      ? "bg-sky-500/15 border-sky-500/40 text-sky-400"
                      : "bg-[#202225] border-white/10 text-zinc-400"
                  }`}
                >
                  <Radio className={`w-5 h-5 ${isConnected ? "animate-pulse" : ""}`} />
                </div>
                <div>
                  <h2 className="text-xs font-bold text-white tracking-wider flex items-center gap-1.5">
                    <span>PHÒNG P2P TOÀN CẦU</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30 font-mono">
                      MESH
                    </span>
                  </h2>
                  <span className="text-[10px] text-zinc-400 block">
                    {isConnected
                      ? "WebRTC Mesh Trực Tiếp • Chia Sẻ Thời Gian Thực"
                      : isConnecting
                      ? "Đang kết nối vào mạng lưới P2P..."
                      : "WebRTC DataChannel 100% P2P"}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg bg-[#222427] hover:bg-[#2b2d31] border border-white/10 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                title="Đóng panel"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 2. 1-Click Connect / Control Card */}
            <div className="p-3.5 bg-[#17181a] border-b border-[#2E3134] space-y-2.5">
              {!isConnected ? (
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={onJoinLobby}
                    disabled={isConnecting}
                    className={`w-full py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg ${
                      isConnecting
                        ? "bg-sky-500/30 text-sky-300 border border-sky-500/40 cursor-wait"
                        : "bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-black shadow-emerald-500/20 border border-emerald-400/50"
                    }`}
                  >
                    {isConnecting ? (
                      <>
                        <RotateCw className="w-4 h-4 animate-spin" />
                        <span>Đang kết nối vào mạng lưới P2P...</span>
                      </>
                    ) : (
                      <>
                        <Zap className="w-4 h-4 fill-current" />
                        <span>1-CLICK VÀO PHÒNG P2P TOÀN CẦU</span>
                      </>
                    )}
                  </button>
                  <p className="text-[10px] text-zinc-400 text-center leading-relaxed">
                    Tự động bắt tay và kết nối trực tiếp với tất cả bạn bè online. Không cần nhập URL hay mã phòng!
                  </p>
                </div>
              ) : (
                <div className="flex items-center justify-between bg-[#111213] p-2.5 rounded-xl border border-white/10">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)] animate-pulse" />
                    <div>
                      <span className="text-xs font-bold text-white block">
                        ĐÃ KẾT NỐI P2P TOÀN CẦU
                      </span>
                      <span className="text-[10px] text-zinc-400 block">
                        Mạng lưới P2P: {p2pState.peers.length} bạn bè trực tiếp
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={onLeaveLobby}
                    className="py-1 px-2.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 text-[11px] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                    title="Rời khỏi phòng P2P"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Rời phòng</span>
                  </button>
                </div>
              )}

              {p2pState.errorMessage && (
                <div className="p-2 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 text-[11px] flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{p2pState.errorMessage}</span>
                </div>
              )}
            </div>

            {/* 3. Peers & Mods Content Area */}
            <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5">
              {!isConnected ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 text-zinc-500 text-xs space-y-3">
                  <Users className="w-12 h-12 text-zinc-600 mb-1" />
                  <p className="font-semibold text-zinc-300 text-sm">Chưa tham gia phòng P2P</p>
                  <p className="text-[11px] text-zinc-400 max-w-[260px] leading-relaxed">
                    Bấm nút <strong className="text-emerald-400">"1-Click Vào Phòng P2P"</strong> ở trên để tham gia mạng lưới chia sẻ trang phục thời gian thực.
                  </p>
                </div>
              ) : p2pState.peers.length === 0 ? (
                <div className="py-12 flex flex-col items-center justify-center text-center p-4 text-zinc-500 text-xs space-y-2.5">
                  <Sparkles className="w-10 h-10 text-emerald-500/40 animate-pulse" />
                  <p className="font-semibold text-zinc-200 text-sm">Đang chờ bạn bè tham gia...</p>
                  <p className="text-[11px] leading-relaxed text-zinc-400 max-w-[260px]">
                    Phòng P2P đã sẵn sàng. Khi bạn bè mở app và bấm Vào Phòng, hai bên sẽ tự động đồng bộ ngay lập tức!
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-[11px] text-zinc-400 px-1">
                    <span className="font-semibold uppercase tracking-wider text-[10px]">
                      Thành viên trong phòng ({p2pState.peers.length})
                    </span>
                    <span className="text-emerald-400 font-bold">
                      {p2pState.syncedSkinsCount} skin đang nạp
                    </span>
                  </div>

                  {p2pState.peers.map((peer) => {
                    const ping = getPingBadge(peer.pingMs);

                    return (
                      <div
                        key={peer.peerId}
                        className="rounded-xl border border-[#2b2d31] bg-[#18191c] overflow-hidden shadow-sm hover:border-sky-500/40 transition-colors"
                      >
                        {/* Member Card Header */}
                        <div className="p-3 bg-[#1e2023] border-b border-white/5 flex items-center justify-between">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <img
                              src={peer.profileIconUrl}
                              alt=""
                              className="w-8 h-8 rounded-full border border-sky-400/50 object-cover shrink-0"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src =
                                  "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/profile-icons/29.jpg";
                              }}
                            />
                            <div className="min-w-0">
                              <span className="text-xs font-bold text-white truncate block max-w-[160px]">
                                {peer.summonerName}
                              </span>
                              <span className="text-[10px] text-zinc-400">
                                {peer.activeMods.length} trang phục đang chọn
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {/* WebRTC Ping Badge */}
                            <div
                              className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold font-mono ${ping.color}`}
                              title="Độ trễ WebRTC DataChannel trực tiếp"
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${ping.dot} animate-pulse`} />
                              <span>{ping.text}</span>
                            </div>

                            {/* Sync Toggle Button */}
                            <button
                              type="button"
                              onClick={() => onTogglePeerSync(peer.peerId)}
                              className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-colors cursor-pointer flex items-center gap-1 ${
                                peer.isSyncEnabled
                                  ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/30"
                                  : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-700"
                              }`}
                              title="Bật/Tắt nạp skin của bạn này vào game"
                            >
                              <CheckCircle2 className={`w-3 h-3 ${peer.isSyncEnabled ? "text-emerald-400" : "text-zinc-500"}`} />
                              <span>{peer.isSyncEnabled ? "Đồng bộ" : "Bỏ qua"}</span>
                            </button>
                          </div>
                        </div>

                        {/* Active Mod Skins List */}
                        <div className="p-3 space-y-2">
                          {peer.activeMods.length === 0 ? (
                            <div className="text-[11px] text-zinc-500 italic py-1 text-center">
                              Bạn này chưa kích hoạt skin nào.
                            </div>
                          ) : (
                            peer.activeMods.map((mod) => {
                              const localSkin = activeSkins[mod.championId];
                              const isConflict = Boolean(localSkin);
                              const champ = champions.find((c) => c.id === mod.championId);
                              const skin = champ?.skins.find((s) => s.id === mod.skinId);

                              const champIconUrl =
                                champ?.square_icon_url ||
                                champ?.icon_url ||
                                mod.championIconUrl ||
                                `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champion-icons/${mod.championId}.png`;

                              const skinImageUrl =
                                skin?.load_screen_url ||
                                skin?.splash_url ||
                                mod.loadScreenUrl ||
                                `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champion-splashes/uncentered/${mod.championId}/${mod.skinId}.jpg`;

                              return (
                                <div
                                  key={mod.skinId}
                                  className={`p-2 rounded-lg border text-xs flex items-center justify-between gap-2.5 ${
                                    isConflict
                                      ? "bg-amber-500/10 border-amber-500/40"
                                      : "bg-[#121314] border-white/5"
                                  }`}
                                >
                                  {/* Skin Splash & Info */}
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <div className="relative w-11 h-11 rounded-md overflow-hidden border border-white/10 shrink-0 bg-[#1e2023]">
                                      <img
                                        src={skinImageUrl}
                                        alt={mod.skinName}
                                        className="w-full h-full object-cover object-top"
                                        onError={(e) => {
                                          (e.target as HTMLImageElement).src = champIconUrl;
                                        }}
                                      />
                                      {/* Champion Avatar Corner Badge */}
                                      <img
                                        src={champIconUrl}
                                        alt=""
                                        className="absolute bottom-0 right-0 w-4 h-4 rounded-sm border border-black/80 object-cover shadow"
                                      />
                                    </div>

                                    <div className="min-w-0 leading-tight">
                                      <span className="text-[11px] font-bold text-white block truncate">
                                        {mod.skinName}
                                      </span>
                                      <span className="text-[10px] text-zinc-400 block truncate flex items-center gap-1 mt-0.5">
                                        <span className="text-zinc-500">Tướng:</span>
                                        <span className="text-sky-300 font-medium">
                                          {champ?.name_vi || champ?.name || mod.championName}
                                        </span>
                                      </span>
                                      {isConflict && (
                                        <span className="text-[9px] text-amber-300 font-semibold block mt-0.5">
                                          Bạn cũng đang chọn: {localSkin.skin_name}
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  {/* Conflict Action: Yield Button */}
                                  {isConflict && onYieldSkin && (
                                    <button
                                      type="button"
                                      onClick={() => onYieldSkin(mod.championId, peer.summonerName)}
                                      className="px-2.5 py-1 rounded bg-sky-500 hover:bg-sky-400 text-black font-bold text-[10px] cursor-pointer flex items-center gap-1 shrink-0 transition-colors shadow-sm"
                                      title={`Nhường tướng ${mod.championName} cho ${peer.summonerName}`}
                                    >
                                      <HeartHandshake className="w-3 h-3" />
                                      <span>Nhường skin</span>
                                    </button>
                                  )}
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 4. Footer Summary */}
            <div className="p-3 border-t border-[#2E3134] bg-[#18191c] text-[11px] text-zinc-400 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-sky-400" />
                <span>
                  Tổng skin phòng: <strong className="text-white">{p2pState.totalRoomSkins}</strong>
                </span>
              </div>
              <span className="text-[10px] text-emerald-400 font-semibold">
                WebRTC P2P Trực tiếp
              </span>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
};
