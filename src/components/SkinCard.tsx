import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Star } from "lucide-react";
import clsx from "clsx";
import HextechSkinFrame from "./HextechSkinFrame";
import type { SkinItem, ChromaItem, SkinStage, ActiveSkinProfile } from "../types/skin";

interface SkinCardProps {
  skin: SkinItem;
  championId: number;
  activeProfile?: ActiveSkinProfile;
  friendActiveName?: string | null;
  isApplying: boolean;
  downloadPercentage?: number;
  onApplySkin: (skin: SkinItem, chroma?: ChromaItem, stage?: SkinStage) => void;
  onRemoveSkin: (championId: number) => void;
}

const SkinCardComponent: React.FC<SkinCardProps> = ({
  skin,
  championId,
  activeProfile,
  friendActiveName,
  isApplying,
  downloadPercentage,
  onApplySkin,
  onRemoveSkin,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [hoveredChroma, setHoveredChroma] = useState<ChromaItem | null>(null);
  const [hoveredStage, setHoveredStage] = useState<SkinStage | null>(null);
  const [previewError, setPreviewError] = useState(false);

  // Check if this skin (or a chroma or a stage of it) is currently active
  const hasStages = Boolean(skin.stages && skin.stages.length > 0);
  const isSkinActive =
    activeProfile?.skin_id === skin.id ||
    activeProfile?.parent_skin_id === skin.id ||
    (hasStages && skin.stages?.some((st) => st.id === activeProfile?.skin_id));
  const activeChromaId = activeProfile?.chroma_id;

  // Artwork to display (loadScreen or splash)
  const displayArtwork =
    skin.load_screen_url ||
    skin.load_screen_path ||
    skin.splash_url ||
    skin.splash_path ||
    skin.tile_url ||
    skin.tile_path;

  const displayNameVi = skin.name_vi || skin.name || skin.name_en || "Trang phục";
  const displayNameEn = skin.name_en || skin.name || "";

  // Dynamic subtitle that changes to stage or chroma name when hovered
  const currentSubtitle = hoveredStage
    ? hoveredStage.name_vi || hoveredStage.name
    : hoveredChroma
    ? hoveredChroma.name_vi || hoveredChroma.name
    : displayNameEn;

  const gemUrl = skin.rarity_gem_url || (skin as any).rarity_info?.gem_icon_url;
  const rarityTitle = skin.rarity_tier_vi || skin.rarity_tier || (skin as any).rarity_info?.tier_vi || "Độ hiếm";

  // Active preview URL (Chroma on hover or Skin 3D model cutout on hover)
  let activePreviewUrl: string | null = null;
  let activePreviewTitle: string | null = null;

  if (hoveredChroma) {
    activePreviewUrl = hoveredChroma.chroma_path || hoveredChroma.chroma_icon_url || null;
    activePreviewTitle = hoveredChroma.name_vi || hoveredChroma.name || "Đa sắc";
  } else if (hoveredStage) {
    activePreviewTitle = hoveredStage.name_vi || hoveredStage.name;
    if (skin.model_preview_url && !previewError) {
      activePreviewUrl = skin.model_preview_url;
    }
  } else if (isHovered && skin.model_preview_url && !previewError) {
    activePreviewUrl = skin.model_preview_url;
    activePreviewTitle = displayNameVi;
  }

  // When hovered, display 100% of chromas; when idle, show compact first 7
  const hasChromas = Boolean(skin.chromas && skin.chromas.length > 0);
  const displayedChromas = isHovered || !hasChromas
    ? skin.chromas
    : (skin.chromas.length > 7 ? skin.chromas.slice(0, 6) : skin.chromas);
  const hiddenCount = hasChromas ? skin.chromas.length - displayedChromas.length : 0;

  const handleClick = (e: React.MouseEvent) => {
    // If clicking directly on a chroma swatch or stage swatch, swatch handler handles it
    if (
      (e.target as HTMLElement).closest(".chroma-swatch") ||
      (e.target as HTMLElement).closest(".stage-swatch")
    ) {
      return;
    }

    if (isSkinActive && !activeProfile?.is_chroma) {
      onRemoveSkin(championId);
    } else {
      if (hasStages && skin.stages && skin.stages.length > 0) {
        onApplySkin(skin, undefined, skin.stages[0]);
      } else {
        onApplySkin(skin);
      }
    }
  };

  const handleChromaClick = (chroma: ChromaItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (activeChromaId === chroma.id) {
      onRemoveSkin(championId);
    } else {
      onApplySkin(skin, chroma);
    }
  };

  const handleStageClick = (stage: SkinStage, e: React.MouseEvent) => {
    e.stopPropagation();
    const isStageActive =
      activeProfile?.skin_id === stage.id ||
      (!activeProfile?.parent_skin_id && stage.stage_number === 1 && activeProfile?.skin_id === skin.id);

    if (isStageActive) {
      onRemoveSkin(championId);
    } else {
      onApplySkin(skin, undefined, stage);
    }
  };

  return (
    <div
      onMouseEnter={() => {
        setIsHovered(true);
        setPreviewError(false);
      }}
      onMouseLeave={() => {
        setIsHovered(false);
        setHoveredChroma(null);
        setHoveredStage(null);
      }}
      onClick={handleClick}
      className="relative aspect-[308/560] rounded-sm cursor-pointer select-none group transition-transform duration-200 ease-out hover:-translate-y-1.5 will-change-transform"
    >
      {/* 1. Clipped Inner Loadscreen Artwork Container */}
      <div className="absolute inset-[7px] overflow-hidden bg-[#0A0A0B] rounded-[2px]">
        <img
          src={displayArtwork}
          alt={displayNameVi}
          className="w-full h-full object-cover object-center group-hover:scale-[1.07] transition-transform duration-500 ease-out"
          loading="lazy"
          onError={(e) => {
            (e.target as HTMLImageElement).src =
              skin.splash_url || skin.splash_path || skin.tile_url || skin.tile_path || "";
          }}
        />

        {/* Dark bottom gradient overlay */}
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[#09090A] via-[#09090A]/80 to-transparent pointer-events-none" />

        {/* Active Injected Top Badge: Self vs Friend */}
        {isSkinActive && !friendActiveName && (
          <div className="absolute top-3 inset-x-3 z-30 flex items-center justify-center">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#131314]/95 border border-[#E11D48]/80 text-[#F43F5E] text-[10px] font-bold tracking-wider shadow-md">
              <span className="w-1.5 h-1.5 rounded-full bg-[#F43F5E] animate-pulse" />
              <span>ĐANG SỬ DỤNG</span>
            </div>
          </div>
        )}

        {!isSkinActive && friendActiveName && (
          <div className="absolute top-3 inset-x-3 z-30 flex items-center justify-center">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#101923]/95 border border-sky-400/80 text-sky-300 text-[10px] font-bold tracking-wider shadow-md">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
              <span className="truncate max-w-[130px]">{friendActiveName.toUpperCase()}</span>
            </div>
          </div>
        )}

        {isSkinActive && friendActiveName && (
          <div className="absolute top-3 inset-x-3 z-30 flex items-center justify-center">
            <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#18111e]/95 border border-purple-400/80 text-purple-300 text-[9px] font-bold tracking-wider shadow-md">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
              <span className="truncate max-w-[150px]">BẠN & {friendActiveName.toUpperCase()}</span>
            </div>
          </div>
        )}

        {/* Loading / Progress Overlay */}
        {isApplying && (
          <div className="absolute inset-0 bg-black/85 z-30 flex flex-col items-center justify-center p-4">
            <Loader2 className="w-8 h-8 text-[#D91B2E] animate-spin mb-2" />
            <span className="text-xs font-semibold text-white tracking-wide">
              {downloadPercentage !== undefined && downloadPercentage > 0
                ? `ĐANG TẢI... ${Math.round(downloadPercentage)}%`
                : "ĐANG CÀI ĐẶT..."}
            </span>
            {downloadPercentage !== undefined && downloadPercentage > 0 && (
              <div className="w-3/4 h-1 bg-white/10 rounded-full mt-2 overflow-hidden">
                <div
                  className="h-full bg-[#D91B2E] transition-all duration-150"
                  style={{ width: `${downloadPercentage}%` }}
                />
              </div>
            )}
          </div>
        )}

        {/* Real In-Game Model Preview (Chroma or Skin 3D cutout) */}
        <AnimatePresence>
          {activePreviewUrl && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 10 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-x-3 top-4 bottom-[112px] z-25 flex flex-col items-center justify-center rounded-xl bg-[#131314]/95 border border-[#D91B2E]/60 p-3 shadow-2xl pointer-events-none"
            >
              <img
                src={activePreviewUrl}
                alt={activePreviewTitle || "Model Preview"}
                className="max-h-[82%] w-auto object-contain drop-shadow-[0_8px_16px_rgba(0,0,0,0.9)]"
                onError={() => setPreviewError(true)}
              />
              <span className="text-[11px] font-semibold text-white bg-[#D91B2E]/20 border border-[#D91B2E]/50 px-2.5 py-0.5 rounded-md mt-1.5 truncate max-w-full">
                {activePreviewTitle}
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Multi-Stage Selector (e.g. Ahri 103085, Jinx 222060, Lux 99007) */}
        {hasStages && (
          <div className="absolute bottom-[68px] inset-x-2 z-30 flex items-center justify-center gap-1.5 flex-wrap pointer-events-auto transition-all duration-200 bg-[#131314]/95 px-2.5 py-1.5 rounded-xl border border-amber-500/30 shadow-lg max-w-[96%] mx-auto">
            {skin.stages!.map((stage) => {
              const isStageActive =
                activeProfile?.skin_id === stage.id ||
                (!activeProfile?.parent_skin_id && stage.stage_number === 1 && activeProfile?.skin_id === skin.id);

              return (
                <button
                  key={stage.id}
                  onClick={(e) => handleStageClick(stage, e)}
                  onMouseEnter={() => setHoveredStage(stage)}
                  onMouseLeave={() => setHoveredStage(null)}
                  title={stage.name_vi || stage.name}
                  className={clsx(
                    "stage-swatch flex items-center justify-center rounded-full transition-all duration-150 cursor-pointer select-none",
                    stage.stage_number <= 3 ? "w-6 h-6" : "h-6 px-1.5",
                    isStageActive
                      ? "bg-amber-950/90 border border-amber-400 ring-2 ring-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.7)] scale-110"
                      : "bg-[#18181B] border border-amber-500/30 hover:border-amber-400 hover:scale-125 text-amber-400/80 hover:text-amber-300"
                  )}
                >
                  {stage.stage_number === 1 && (
                    <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                  )}
                  {stage.stage_number === 2 && (
                    <div className="flex items-center -space-x-1">
                      <Star className="w-2.5 h-2.5 text-amber-400 fill-amber-400" />
                      <Star className="w-2.5 h-2.5 text-amber-400 fill-amber-400" />
                    </div>
                  )}
                  {stage.stage_number === 3 && (
                    <div className="flex items-center -space-x-1.5">
                      <Star className="w-2 h-2 text-amber-400 fill-amber-400" />
                      <Star className="w-2 h-2 text-amber-400 fill-amber-400" />
                      <Star className="w-2 h-2 text-amber-400 fill-amber-400" />
                    </div>
                  )}
                  {stage.stage_number > 3 && (
                    <div className="flex items-center gap-0.5 text-[10px] font-bold text-amber-400 font-mono">
                      <Star className="w-2.5 h-2.5 fill-amber-400" />
                      <span>{stage.stage_number}</span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Chroma Circles ABOVE the Skin Title (bottom-[68px]), expands on hover (only when no stages) */}
        {!hasStages && hasChromas && (
          <div
            className={clsx(
              "absolute bottom-[68px] inset-x-2 z-30 flex items-center justify-center gap-1.5 flex-wrap pointer-events-auto transition-all duration-200",
              isHovered && skin.chromas.length > 6 && "bg-[#131314]/95 px-2.5 py-1.5 rounded-xl border border-white/10 shadow-lg max-w-[96%] mx-auto"
            )}
          >
            {displayedChromas.map((chroma) => {
              const isChromaActive = activeChromaId === chroma.id;
              const colors = chroma.colors || [];
              const bgStyle =
                colors.length > 1
                  ? `linear-gradient(135deg, ${colors[0]} 50%, ${colors[1]} 50%)`
                  : colors[0] || "#888888";

              return (
                <button
                  key={chroma.id}
                  onClick={(e) => handleChromaClick(chroma, e)}
                  onMouseEnter={() => setHoveredChroma(chroma)}
                  onMouseLeave={() => setHoveredChroma(null)}
                  style={{ background: bgStyle }}
                  title={chroma.name_vi || chroma.name}
                  className={clsx(
                    "chroma-swatch w-3.5 h-3.5 rounded-full border transition-all duration-150 hover:scale-125",
                    isChromaActive
                      ? "border-[#E11D48] ring-2 ring-[#E11D48] shadow-[0_0_8px_#E11D48]"
                      : "border-white/30 hover:border-white"
                  )}
                />
              );
            })}
            {!isHovered && hiddenCount > 0 && (
              <span className="text-[9px] text-[#9AA0A6] font-mono">
                +{hiddenCount}
              </span>
            )}
          </div>
        )}

        {/* Strict Fixed Baseline for Skin Titles (Pinned at bottom-6 across all cards) */}
        <div className="absolute bottom-6 inset-x-3 z-20 flex flex-col items-center justify-end h-[38px] text-center pointer-events-none">
          <p className="text-[13px] font-bold text-white leading-tight line-clamp-1 drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)]">
            {displayNameVi}
          </p>
          <p className="text-[11px] text-[#9AA0A6] leading-tight line-clamp-1 mt-0.5">
            {currentSubtitle}
          </p>
        </div>
      </div>

      {/* 2. Authentic Stepped LoL Hextech SVG Frame */}
      <HextechSkinFrame isActive={isSkinActive} isHovered={isHovered} />

      {/* 3. Bottom-Center Rarity Gem Badge */}
      {gemUrl && (
        <div
          className="absolute bottom-[3px] left-1/2 -translate-x-1/2 z-30 w-5 h-5 flex items-center justify-center pointer-events-none"
          title={rarityTitle}
        >
          <img
            src={gemUrl}
            alt="Rarity Gem"
            className="w-full h-full object-contain filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]"
            loading="lazy"
          />
        </div>
      )}
    </div>
  );
};

export const SkinCard = React.memo(SkinCardComponent);
export default SkinCard;
