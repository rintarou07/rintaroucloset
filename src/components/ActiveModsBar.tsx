import { useState } from "react";
import { X, Trash2, Layers, AlertCircle, Sparkles } from "lucide-react";
import type { ActiveSkinProfile, ChampionInfo } from "../types";

interface ActiveModsBarProps {
  isOpen: boolean;
  onClose: () => void;
  activeSkins: Record<number, ActiveSkinProfile>;
  championsMap: Map<number, ChampionInfo>;
  onRemoveSkin: (championId: number) => Promise<void>;
  onClearOverlay: () => Promise<void>;
}

export function ActiveModsBar({
  isOpen,
  onClose,
  activeSkins,
  championsMap,
  onRemoveSkin,
  onClearOverlay,
}: ActiveModsBarProps) {
  const [confirmClear, setConfirmClear] = useState(false);
  const activeList = Object.values(activeSkins);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-96 hextech-panel border-l border-hextech-gold shadow-2xl flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-hextech-border flex items-center justify-between bg-hextech-deep">
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-hextech-cyan" />
          <h3 className="text-sm font-bold text-hextech-gold uppercase tracking-wider">
            Trang Phục Đang Kích Hoạt ({activeList.length})
          </h3>
        </div>
        <button
          onClick={onClose}
          className="text-hextech-gold hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Content List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {activeList.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center text-gray-500">
            <Sparkles className="w-8 h-8 text-hextech-gold/30 mb-2" />
            <p className="text-xs">Chưa có trang phục nào được bật.</p>
            <p className="text-[11px] mt-1">
              Nhấn vào bất kỳ tướng nào để chọn và áp dụng skin.
            </p>
          </div>
        ) : (
          activeList.map((active) => {
            const champ = championsMap.get(active.champion_id);
            const champName = champ ? champ.name_vi : `Tướng #${active.champion_id}`;
            const champIcon = champ?.icon_url;

            return (
              <div
                key={active.champion_id}
                className="flex items-center justify-between p-2.5 rounded-sm bg-hextech-surface/80 border border-hextech-border hover:border-hextech-cyan/60 transition-all"
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  {champIcon && (
                    <img
                      src={champIcon}
                      alt={champName}
                      className="w-10 h-10 rounded-sm object-cover border border-hextech-border shrink-0"
                    />
                  )}
                  <div className="truncate">
                    <h4 className="text-xs font-bold text-hextech-gold-light truncate">
                      {active.skin_name}
                    </h4>
                    <p className="text-[11px] text-gray-400 truncate">
                      {champName} {active.is_chroma && "• Đa Sắc"}
                    </p>
                  </div>
                </div>

                {/* Remove button */}
                <button
                  onClick={() => onRemoveSkin(active.champion_id)}
                  className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-950/40 rounded-sm transition-colors shrink-0"
                  title="Gỡ bỏ trang phục này"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Footer / Clear All */}
      {activeList.length > 0 && (
        <div className="p-4 border-t border-hextech-border bg-hextech-deep/90 space-y-2">
          {confirmClear ? (
            <div className="p-3 bg-red-950/70 border border-red-700/60 rounded-sm space-y-2 text-xs text-red-200">
              <p className="flex items-center gap-1.5 font-bold">
                <AlertCircle className="w-4 h-4 text-red-400" />
                Xác nhận gỡ toàn bộ trang phục?
              </p>
              <p className="text-[11px] text-red-300">
                Thư mục WAD overlay sẽ được xóa sạch.
              </p>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  onClick={() => setConfirmClear(false)}
                  className="px-3 py-1 bg-gray-800 text-gray-300 text-xs rounded-sm hover:bg-gray-700"
                >
                  Hủy
                </button>
                <button
                  onClick={async () => {
                    await onClearOverlay();
                    setConfirmClear(false);
                  }}
                  className="px-3 py-1 bg-red-700 text-white font-bold text-xs rounded-sm hover:bg-red-600"
                >
                  Đồng Ý Xóa Hết
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setConfirmClear(true)}
              className="w-full py-2 bg-red-950/40 hover:bg-red-900/60 border border-red-800/60 text-red-300 text-xs font-bold uppercase tracking-wider rounded-sm flex items-center justify-center gap-2 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5 text-red-400" />
              <span>Gỡ Bỏ Toàn Bộ Skin</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
