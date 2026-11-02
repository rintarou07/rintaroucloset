import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { Search } from "lucide-react";
import clsx from "clsx";
import type { ChampionItem } from "../types/skin";

interface SidebarNavigatorProps {
  champions: ChampionItem[];
  selectedChampionId: number | null;
  onSelectChampion: (champ: ChampionItem) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  activeChampionIds: Set<number>;
  friendActiveChampionIds?: Set<number>;
  friendActiveNamesByChamp?: Record<number, string[]>;
}

const SidebarNavigatorComponent: React.FC<SidebarNavigatorProps> = ({
  champions,
  selectedChampionId,
  onSelectChampion,
  searchQuery,
  onSearchChange,
  activeChampionIds,
  friendActiveChampionIds = new Set(),
  friendActiveNamesByChamp = {},
}) => {
  // Filter Out Jade_, Ruby_, Strawberry_, non-standard duplicates & id: -1
  const validChampions = useMemo(() => {
    return champions.filter((champ) => {
      const aliasLower = (champ.key || champ.name_en || "").toLowerCase();
      return (
        champ.id > 0 &&
        champ.id < 1000 &&
        !aliasLower.startsWith("jade_") &&
        !aliasLower.startsWith("ruby_") &&
        !aliasLower.startsWith("strawberry_") &&
        !aliasLower.includes("_")
      );
    });
  }, [champions]);

  // Filter champions by Vietnamese name, English name, or key
  const filteredChampions = useMemo(() => {
    if (!searchQuery.trim()) return validChampions;
    const q = searchQuery.toLowerCase().trim();
    return validChampions.filter((champ) => {
      const nameVi = (champ.name_vi || champ.name || "").toLowerCase();
      const nameEn = (champ.name_en || champ.key || "").toLowerCase();
      const titleVi = (champ.title_vi || champ.title || "").toLowerCase();
      return nameVi.includes(q) || nameEn.includes(q) || titleVi.includes(q);
    });
  }, [validChampions, searchQuery]);

  return (
    <aside className="fixed top-[60px] left-0 bottom-0 w-[210px] min-w-[210px] max-w-[210px] bg-[#1E1F20] hairline-border-r flex flex-col z-30 select-none">
      {/* 1. Sticky Search Box */}
      <div className="p-2.5 hairline-border-b bg-[#1E1F20] sticky top-0 z-10">
        <div className="relative flex items-center">
          <Search className="absolute left-2.5 w-3.5 h-3.5 text-[#9AA0A6] pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Tìm kiếm tướng..."
            className="w-full bg-[#131314] border border-white/[0.08] focus:border-[#D91B2E] focus:outline-none rounded-lg pl-8 pr-2.5 py-1.5 text-xs text-[#E3E3E3] placeholder-[#5F6368] transition-colors"
          />
        </div>
      </div>

      {/* 2. Compact 1-Column Circular Champion List */}
      <div className="flex-1 overflow-y-auto space-y-0.5 p-1.5">
        {filteredChampions.length === 0 ? (
          <div className="py-8 text-center text-xs text-[#5F6368]">
            Không tìm thấy tướng
          </div>
        ) : (
          filteredChampions.map((champ) => {
            const isSelected = selectedChampionId === champ.id;
            const hasInjectedSkin = activeChampionIds.has(champ.id);
            const hasFriendSkin = friendActiveChampionIds.has(champ.id);
            const friendNames = friendActiveNamesByChamp[champ.id];

            return (
              <button
                key={champ.id}
                onClick={() => onSelectChampion(champ)}
                className={clsx(
                  "relative w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-left transition-colors duration-150 group",
                  isSelected
                    ? "text-white"
                    : "text-[#9AA0A6] hover:text-[#E3E3E3] hover:bg-white/[0.03]"
                )}
              >
                {/* Framer motion sliding active row indicator */}
                {isSelected && (
                  <motion.div
                    layoutId="activeChampionIndicator"
                    className="absolute inset-0 bg-[#D91B2E]/15 rounded-lg border border-[#D91B2E]/30"
                    transition={{ type: "spring", stiffness: 450, damping: 35 }}
                  >
                    {/* Left glowing vertical bar */}
                    <div className="absolute left-1 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-[#D91B2E] rounded-full shadow-[0_0_8px_#D91B2E]" />
                  </motion.div>
                )}

                {/* Crisp Circular Champion Avatar (w-7 h-7) */}
                <div className="relative shrink-0 w-7 h-7 rounded-full overflow-hidden ring-1 ring-white/15 bg-[#131314] z-10">
                  <img
                    src={champ.square_icon_url || champ.icon_url}
                    alt={champ.name_vi || champ.name || champ.key}
                    className="w-full h-full object-cover scale-110"
                    loading="lazy"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/profile-icons/29.jpg";
                    }}
                  />
                </div>

                {/* Single-Line Champion Name (text-[12px] font-medium truncate) */}
                <div className="flex-1 min-w-0 z-10">
                  <p className="text-[12px] font-medium truncate">
                    {champ.name_vi || champ.name || champ.key}
                  </p>
                </div>

                {/* Status Dots (Local Crimson & Friend Sky Blue) */}
                {(hasInjectedSkin || hasFriendSkin) && (
                  <div className="shrink-0 flex items-center gap-1 z-10 mr-0.5">
                    {/* Local Injected Crimson Dot */}
                    {hasInjectedSkin && (
                      <div
                        className="w-1.5 h-1.5 rounded-full bg-[#F43F5E] shadow-[0_0_8px_#F43F5E]"
                        title="Bạn đang kích hoạt trang phục tướng này"
                      />
                    )}

                    {/* Friend Injected Sky Blue Dot */}
                    {hasFriendSkin && (
                      <div
                        className="w-1.5 h-1.5 rounded-full bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.9)] animate-pulse"
                        title={
                          friendNames && friendNames.length > 0
                            ? `Bạn bè đang chọn: ${friendNames.join(", ")}`
                            : "Bạn bè trong phòng đang chọn trang phục tướng này"
                        }
                      />
                    )}
                  </div>
                )}
              </button>
            );
          })
        )}
      </div>
    </aside>
  );
};

export const SidebarNavigator = React.memo(SidebarNavigatorComponent);
export default SidebarNavigator;
