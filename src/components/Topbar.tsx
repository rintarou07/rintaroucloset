import {
  Search,
  RefreshCw,
  Folder,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Sparkles,
  Zap,
  Play,
} from "lucide-react";
import type { RoleFilter, PatcherStatePayload } from "../types";

interface TopbarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedRole: RoleFilter;
  onRoleChange: (role: RoleFilter) => void;
  activeCount: number;
  onToggleActiveDrawer: () => void;
  isGamePathValid: boolean;
  gamePath: string | null;
  onOpenGamePathModal: () => void;
  isRebuilding: boolean;
  onRebuildOverlay: () => void;
  isSyncing: boolean;
  onSyncMetadata: () => void;
  patcherState: PatcherStatePayload | null;
  onTogglePatcher: () => void;
}

const ROLES: { id: RoleFilter; label: string }[] = [
  { id: "all", label: "Tất Cả" },
  { id: "top", label: "Đường Trên" },
  { id: "jungle", label: "Đi Rừng" },
  { id: "mid", label: "Đường Giữa" },
  { id: "bottom", label: "Xạ Thủ" },
  { id: "support", label: "Hỗ Trợ" },
];

export function Topbar({
  searchQuery,
  onSearchChange,
  selectedRole,
  onRoleChange,
  activeCount,
  onToggleActiveDrawer,
  isGamePathValid,
  gamePath,
  onOpenGamePathModal,
  isRebuilding,
  onRebuildOverlay,
  isSyncing,
  onSyncMetadata,
  patcherState,
  onTogglePatcher,
}: TopbarProps) {
  return (
    <header className="sticky top-0 z-40 bg-hextech-deep/95 backdrop-blur-md border-b border-hextech-border shadow-md">
      {/* Top Banner / Controls */}
      <div className="max-w-[1720px] mx-auto px-4 py-2.5 flex flex-wrap items-center justify-between gap-4">
        {/* Brand Logo */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-sm bg-gradient-to-br from-hextech-gold-dark via-hextech-gold to-hextech-gold-light p-[1px] shadow-glow-gold">
            <div className="w-full h-full bg-hextech-bg flex items-center justify-center rounded-sm">
              <Sparkles className="w-5 h-5 text-hextech-gold" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-extrabold tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-hextech-gold-light via-hextech-gold to-hextech-gold-bright uppercase">
                Hextech Client
              </h1>
              <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-sm bg-hextech-cyan-dark/40 text-hextech-cyan border border-hextech-cyan/40">
                100% Portable
              </span>
            </div>
            <p className="text-[11px] text-gray-400">Trang Phục Tùy Chỉnh Liên Minh</p>
          </div>
        </div>

        {/* Search Bar */}
        <div className="flex-1 max-w-md relative">
          <Search className="w-4 h-4 text-hextech-gold/70 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Tìm tướng hoặc trang phục (Tiếng Việt / English)..."
            className="w-full pl-9 pr-4 py-1.5 bg-hextech-surface/80 border border-hextech-border focus:border-hextech-gold focus:outline-none focus:shadow-glow-gold text-xs text-hextech-gold-light placeholder-gray-500 rounded-sm transition-all"
          />
        </div>

        {/* Status Indicators & Action Buttons */}
        <div className="flex items-center gap-2.5">
          {/* LoL Path Indicator */}
          <button
            onClick={onOpenGamePathModal}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-sm border text-xs transition-all ${
              isGamePathValid
                ? "bg-hextech-surface/80 border-hextech-border hover:border-hextech-gold text-gray-300"
                : "bg-red-950/40 border-red-700/60 hover:border-red-500 text-red-300 animate-pulse"
            }`}
            title={gamePath ?? "Chưa có đường dẫn"}
          >
            <Folder className="w-3.5 h-3.5 text-hextech-gold" />
            <span className="hidden sm:inline">Game:</span>
            {isGamePathValid ? (
              <span className="flex items-center gap-1 text-green-400 font-medium">
                <CheckCircle2 className="w-3 h-3" /> Sẵn Sàng
              </span>
            ) : (
              <span className="flex items-center gap-1 text-red-400 font-medium">
                <AlertTriangle className="w-3 h-3" /> Cần Cài Đặt
              </span>
            )}
          </button>

          {/* Active Mods Counter Drawer Toggle */}
          <button
            onClick={onToggleActiveDrawer}
            className="relative flex items-center gap-2 px-3 py-1.5 bg-hextech-surface/80 border border-hextech-border hover:border-hextech-cyan text-xs text-gray-200 rounded-sm transition-all shadow-sm"
          >
            <Layers className="w-3.5 h-3.5 text-hextech-cyan" />
            <span className="hidden md:inline">Đang Bật:</span>
            <span className="px-1.5 py-0.2 rounded-full bg-hextech-cyan text-hextech-bg font-bold text-[11px]">
              {activeCount}
            </span>
          </button>

          {/* Rebuild Overlay Button */}
          <button
            onClick={onRebuildOverlay}
            disabled={isRebuilding || !isGamePathValid}
            className="hextech-button-cyan px-3.5 py-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider rounded-sm disabled:opacity-50"
            title="Biên dịch lại WAD Overlay vào ./data/overlay/"
          >
            <Zap className={`w-3.5 h-3.5 ${isRebuilding ? "animate-spin text-yellow-300" : ""}`} />
            <span className="hidden lg:inline">{isRebuilding ? "Đang Chạy..." : "Tạo Overlay"}</span>
          </button>

          {/* Patcher Start / Stop Button */}
          <button
            onClick={onTogglePatcher}
            disabled={!isGamePathValid}
            className={`px-3.5 py-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider rounded-sm transition-all shadow-md ${
              patcherState?.status === "injected" || patcherState?.status === "waiting"
                ? "bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.4)] animate-pulse"
                : patcherState?.status === "scanning"
                ? "bg-amber-600 hover:bg-amber-500 text-white border border-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.3)] animate-pulse"
                : "bg-hextech-gold hover:bg-hextech-gold-light text-hextech-black font-extrabold border border-amber-300 hover:shadow-[0_0_10px_rgba(200,170,110,0.5)]"
            } disabled:opacity-50`}
            title={
              patcherState?.status === "injected"
                ? "Mod đang hoạt động trong game. Nhấn để dừng."
                : patcherState?.status === "scanning"
                ? "Đang đợi trận đấu Liên Minh... Nhấn để dừng."
                : "Kích hoạt patcher để nạp mod skin khi vào trận Liên Minh"
            }
          >
            {patcherState?.status === "injected" || patcherState?.status === "waiting" ? (
              <>
                <span className="w-2 h-2 rounded-full bg-white animate-ping mr-0.5" />
                <span>ĐÃ VÀO TRẬN (MOD ON)</span>
              </>
            ) : patcherState?.status === "scanning" ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>ĐANG ĐỢI VÀO GAME...</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>BẬT MOD (RUN)</span>
              </>
            )}
          </button>

          {/* Force Refresh CDragon Metadata */}
          <button
            onClick={onSyncMetadata}
            disabled={isSyncing}
            className="p-1.5 bg-hextech-surface/80 border border-hextech-border hover:border-hextech-gold text-hextech-gold rounded-sm transition-all disabled:opacity-50"
            title="Đồng bộ lại dữ liệu Riot & Kho Skin"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? "animate-spin text-hextech-cyan" : ""}`} />
          </button>
        </div>
      </div>

      {/* Role Navigation Filters Bar */}
      <div className="border-t border-hextech-border/50 bg-hextech-bg/90 px-4 py-1.5">
        <div className="max-w-[1720px] mx-auto flex items-center gap-1 overflow-x-auto no-scrollbar">
          {ROLES.map((role) => {
            const isActive = selectedRole === role.id;
            return (
              <button
                key={role.id}
                onClick={() => onRoleChange(role.id)}
                className={`px-3.5 py-1 text-xs font-medium uppercase tracking-wider rounded-sm transition-all whitespace-nowrap ${
                  isActive
                    ? "bg-hextech-gold/20 text-hextech-gold-light border border-hextech-gold shadow-glow-gold"
                    : "text-gray-400 hover:text-hextech-gold hover:bg-hextech-surface/50 border border-transparent"
                }`}
              >
                {role.label}
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
}

