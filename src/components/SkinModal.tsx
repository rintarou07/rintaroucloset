import { useState, useMemo } from "react";
import {
  X,
  Check,
  Download,
  Trash2,
  Sparkles,
  Zap,
  Palette,
  Loader2,
  HardDriveDownload,
  AlertCircle,
} from "lucide-react";
import type {
  ActiveSkinProfile,
  ChampionInfo,
  DownloadProgressPayload,
  OverlayProgressPayload,
  SkinChromaInfo,
  SkinInfo,
} from "../types";

interface SkinModalProps {
  champion: ChampionInfo | null;
  isOpen: boolean;
  onClose: () => void;
  activeSkin: ActiveSkinProfile | undefined;
  onApplySkin: (skin: SkinInfo, chroma?: SkinChromaInfo) => Promise<void>;
  onRemoveSkin: (championId: number) => Promise<void>;
  isApplying: boolean;
  downloadProgress: DownloadProgressPayload | null;
  overlayProgress: OverlayProgressPayload | null;
}

export function SkinModal({
  champion,
  isOpen,
  onClose,
  activeSkin,
  onApplySkin,
  onRemoveSkin,
  isApplying,
  downloadProgress,
  overlayProgress,
}: SkinModalProps) {
  const [selectedSkinIndex, setSelectedSkinIndex] = useState(0);
  const [selectedChromaId, setSelectedChromaId] = useState<number | null>(null);

  // Reset selected skin and chroma when modal champion changes
  const skins = champion?.skins ?? [];
  const currentSkin: SkinInfo | undefined = skins[selectedSkinIndex] ?? skins[0];

  const selectedChroma: SkinChromaInfo | undefined = useMemo(() => {
    if (!selectedChromaId || !currentSkin) return undefined;
    return currentSkin.chromas.find((c) => c.id === selectedChromaId);
  }, [currentSkin, selectedChromaId]);

  if (!isOpen || !champion || !currentSkin) return null;

  // Check if current skin or chroma is active
  const isCurrentlyActive =
    activeSkin &&
    (selectedChroma
      ? activeSkin.skin_id === selectedChroma.id
      : activeSkin.skin_id === currentSkin.id);

  // Check if target is available in Alban1911 repo
  const isAvailable = selectedChroma
    ? selectedChroma.fantome_available
    : currentSkin.fantome_available;

  const isCached = selectedChroma
    ? selectedChroma.is_cached
    : currentSkin.is_cached;

  const handleApply = async () => {
    await onApplySkin(currentSkin, selectedChroma);
  };

  const handleRemove = async () => {
    await onRemoveSkin(champion.id);
  };

  const handleSelectSkin = (idx: number) => {
    setSelectedSkinIndex(idx);
    setSelectedChromaId(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-2 sm:p-4 overflow-y-auto">
      <div className="relative w-full max-w-5xl hextech-panel rounded-sm border border-hextech-gold shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-30 p-1.5 rounded-sm bg-black/60 hover:bg-black text-hextech-gold hover:text-white border border-hextech-gold/40 transition-colors shadow-lg"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Scrollable Content */}
        <div className="overflow-y-auto flex-1">
          {/* 16:9 Hero Splash Art Display */}
          <div className="relative aspect-video w-full bg-hextech-bg overflow-hidden border-b border-hextech-border">
            <img
              src={currentSkin.uncentered_splash_url || currentSkin.splash_url || currentSkin.splash_path}
              alt={currentSkin.name_vi || currentSkin.name}
              className="w-full h-full object-cover transition-opacity duration-300"
              onError={(e) => {
                (e.target as HTMLImageElement).src = currentSkin.splash_url || currentSkin.splash_path || "";
              }}
            />

            {/* Gradient Dark Overlays */}
            <div className="absolute inset-0 bg-gradient-to-t from-hextech-deep via-transparent to-transparent opacity-90" />
            <div className="absolute inset-x-0 bottom-0 p-4 sm:p-6 flex flex-wrap items-end justify-between gap-4">
              <div>
                {/* Rarity & Tier Tag */}
                <div className="flex items-center gap-2 mb-1.5">
                  {currentSkin.rarity_gem_url && (
                    <img
                      src={currentSkin.rarity_gem_url}
                      alt={currentSkin.rarity_tier_vi}
                      className="w-5 h-5 object-contain drop-shadow"
                    />
                  )}
                  <span className="text-xs uppercase font-extrabold tracking-wider px-2 py-0.5 rounded-sm bg-black/70 border border-hextech-gold/60 text-hextech-gold-light">
                    {currentSkin.rarity_tier_vi}
                  </span>
                  {currentSkin.is_base && (
                    <span className="text-xs uppercase font-bold px-2 py-0.5 rounded-sm bg-hextech-cyan-dark/60 text-hextech-cyan border border-hextech-cyan/40">
                      Mặc Định
                    </span>
                  )}
                  {isCached && (
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-sm bg-green-950/80 text-green-300 border border-green-600/50 flex items-center gap-1">
                      <HardDriveDownload className="w-3 h-3" /> Đã Tải Sẵn
                    </span>
                  )}
                </div>

                {/* Skin Name */}
                <h2 className="text-xl sm:text-2xl font-black text-white drop-shadow-md tracking-wide">
                  {selectedChroma ? selectedChroma.name_vi : currentSkin.name_vi}
                </h2>
                <p className="text-xs text-gray-300 drop-shadow">
                  {selectedChroma ? selectedChroma.name_en : currentSkin.name_en} • {champion.name_vi}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3">
                {isCurrentlyActive ? (
                  <button
                    onClick={handleRemove}
                    disabled={isApplying}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-sm bg-red-950/80 hover:bg-red-900 border border-red-600 text-red-200 text-xs font-bold uppercase tracking-wider transition-all shadow-lg disabled:opacity-50"
                  >
                    <Trash2 className="w-4 h-4 text-red-400" />
                    <span>Gỡ Bỏ Trang Phục</span>
                  </button>
                ) : (
                  <button
                    onClick={handleApply}
                    disabled={isApplying || !isAvailable}
                    className={`flex items-center gap-2 px-6 py-2.5 rounded-sm text-xs font-bold uppercase tracking-widest transition-all shadow-lg ${
                      isAvailable
                        ? "hextech-button-cyan shadow-glow-cyan"
                        : "bg-gray-800 text-gray-500 border border-gray-700 cursor-not-allowed"
                    }`}
                  >
                    {isApplying ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-hextech-cyan" />
                        <span>Đang Áp Dụng...</span>
                      </>
                    ) : (
                      <>
                        <Zap className="w-4 h-4 text-yellow-300" />
                        <span>Áp Dụng Skin</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Progress Indicators Bar (Download / Overlay) */}
          {isApplying && (
            <div className="p-3 bg-hextech-deep border-b border-hextech-gold/40 space-y-2">
              {downloadProgress && (
                <div>
                  <div className="flex justify-between text-[11px] text-hextech-gold mb-1">
                    <span className="flex items-center gap-1.5">
                      <Download className="w-3.5 h-3.5 text-hextech-cyan animate-bounce" />
                      Đang tải file trang phục...
                    </span>
                    <span>{downloadProgress.percentage.toFixed(0)}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-hextech-bg rounded-full overflow-hidden border border-hextech-border">
                    <div
                      className="h-full bg-gradient-to-r from-hextech-cyan-deep to-hextech-cyan transition-all duration-200 shadow-glow-cyan"
                      style={{ width: `${downloadProgress.percentage}%` }}
                    />
                  </div>
                </div>
              )}

              {overlayProgress && (
                <div className="text-[11px] text-gray-300 flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-hextech-gold" />
                  <span>{overlayProgress.message}</span>
                </div>
              )}
            </div>
          )}

          {/* Skin Details & Chroma Selector */}
          <div className="p-4 sm:p-6 space-y-5 bg-hextech-deep/70">
            {/* Description */}
            {currentSkin.description_vi && (
              <p className="text-xs text-gray-300 italic leading-relaxed border-l-2 border-hextech-gold pl-3">
                "{currentSkin.description_vi}"
              </p>
            )}

            {/* Chromas Selector Palette */}
            {currentSkin.chromas.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-hextech-border/60">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-hextech-gold uppercase tracking-wider flex items-center gap-1.5">
                    <Palette className="w-3.5 h-3.5 text-hextech-cyan" />
                    Đa Sắc (Chromas - {currentSkin.chromas.length})
                  </span>
                  {selectedChroma && (
                    <button
                      onClick={() => setSelectedChromaId(null)}
                      className="text-[11px] text-hextech-cyan hover:underline"
                    >
                      Bỏ chọn đa sắc (Dùng skin gốc)
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {/* Base Skin Circle */}
                  <button
                    onClick={() => setSelectedChromaId(null)}
                    className={`relative w-8 h-8 rounded-full border-2 overflow-hidden transition-all ${
                      selectedChromaId === null
                        ? "border-hextech-cyan shadow-glow-cyan scale-110"
                        : "border-hextech-border hover:border-hextech-gold"
                    }`}
                    title="Skin Gốc"
                  >
                    <img
                      src={currentSkin.tile_url}
                      alt="Base"
                      className="w-full h-full object-cover"
                    />
                  </button>

                  {/* Chroma Circles */}
                  {currentSkin.chromas.map((chroma) => {
                    const isSelected = selectedChromaId === chroma.id;
                    const primaryColor = chroma.colors[0] ?? "#C8AA6E";

                    return (
                      <button
                        key={chroma.id}
                        onClick={() => setSelectedChromaId(chroma.id)}
                        className={`group relative w-8 h-8 rounded-full border-2 transition-all p-0.5 ${
                          isSelected
                            ? "border-hextech-cyan shadow-glow-cyan scale-110"
                            : "border-hextech-border hover:border-hextech-gold"
                        }`}
                        style={{ backgroundColor: primaryColor }}
                        title={chroma.name_vi}
                      >
                        {chroma.chroma_icon_url && (
                          <img
                            src={chroma.chroma_icon_url}
                            alt={chroma.name_vi}
                            className="w-full h-full object-cover rounded-full"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = "none";
                            }}
                          />
                        )}
                        {isSelected && (
                          <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center">
                            <Check className="w-3.5 h-3.5 text-hextech-cyan stroke-[3]" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Warning if skin is not in repository */}
            {!isAvailable && (
              <div className="flex items-center gap-2 p-3 bg-yellow-950/40 border border-yellow-700/60 rounded-sm text-yellow-300 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 text-yellow-400" />
                <span>
                  Trang phục này hiện chưa có file trong kho skin.
                </span>
              </div>
            )}
          </div>

          {/* Skins Horizontal Carousel Strip */}
          <div className="p-4 bg-hextech-bg border-t border-hextech-border">
            <h4 className="text-xs font-bold text-hextech-gold uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-hextech-gold" />
              Tất Cả Trang Phục ({skins.length})
            </h4>

            <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-thin">
              {skins.map((skin, idx) => {
                const isSelected = idx === selectedSkinIndex;
                const isSkinActive =
                  activeSkin &&
                  (activeSkin.skin_id === skin.id || activeSkin.parent_skin_id === skin.id);

                return (
                  <button
                    key={skin.id}
                    onClick={() => handleSelectSkin(idx)}
                    className={`relative w-28 shrink-0 rounded-sm overflow-hidden border text-left transition-all ${
                      isSelected
                        ? "border-hextech-gold shadow-glow-gold scale-105"
                        : "border-hextech-border hover:border-hextech-gold/70 opacity-70 hover:opacity-100"
                    }`}
                  >
                    <div className="aspect-[4/3] w-full overflow-hidden bg-hextech-deep">
                      <img
                        src={skin.tile_url || skin.splash_url}
                        alt={skin.name_vi}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    </div>
                    {isSkinActive && (
                      <div className="absolute top-1 right-1 p-0.5 rounded-sm bg-hextech-deep/90 border border-hextech-cyan text-hextech-cyan">
                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                      </div>
                    )}
                    <div className="p-1.5 bg-hextech-surface/90">
                      <p className="text-[10px] font-bold text-gray-200 truncate">
                        {skin.name_vi}
                      </p>
                      <p className="text-[9px] text-hextech-gold/80 truncate">
                        {skin.rarity_tier_vi}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

