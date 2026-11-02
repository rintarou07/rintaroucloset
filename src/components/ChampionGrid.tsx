import { useMemo } from "react";
import { Sparkles, Check, Flame } from "lucide-react";
import type { ActiveSkinProfile, ChampionInfo, RoleFilter } from "../types";

interface ChampionGridProps {
  champions: ChampionInfo[];
  activeSkins: Record<number, ActiveSkinProfile>;
  searchQuery: string;
  selectedRole: RoleFilter;
  onSelectChampion: (champ: ChampionInfo) => void;
}

export function ChampionGrid({
  champions,
  activeSkins,
  searchQuery,
  selectedRole,
  onSelectChampion,
}: ChampionGridProps) {
  // Filter champions based on query and role
  const filteredChampions = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    return champions.filter((champ) => {
      // Role match
      if (selectedRole !== "all") {
        const hasRole = champ.roles.some((r) => {
          const rLower = r.toLowerCase();
          if (selectedRole === "top") return rLower.includes("fighter") || rLower.includes("tank");
          if (selectedRole === "jungle") return rLower.includes("assassin") || rLower.includes("fighter");
          if (selectedRole === "mid") return rLower.includes("mage") || rLower.includes("assassin");
          if (selectedRole === "bottom") return rLower.includes("marksman");
          if (selectedRole === "support") return rLower.includes("support") || rLower.includes("tank");
          return false;
        });
        if (!hasRole) return false;
      }

      // Query match (name VI, name EN, title, or skin names)
      if (q) {
        const matchesChamp =
          champ.name_vi.toLowerCase().includes(q) ||
          champ.name_en.toLowerCase().includes(q) ||
          champ.title_vi.toLowerCase().includes(q) ||
          champ.key.toLowerCase().includes(q);

        if (matchesChamp) return true;

        const matchesSkin = champ.skins.some(
          (s) =>
            s.name_vi.toLowerCase().includes(q) ||
            s.name_en.toLowerCase().includes(q)
        );

        return matchesSkin;
      }

      return true;
    });
  }, [champions, searchQuery, selectedRole]);

  if (filteredChampions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-16 text-center">
        <div className="w-16 h-16 rounded-full bg-hextech-deep border border-hextech-border flex items-center justify-center mb-4">
          <Sparkles className="w-8 h-8 text-hextech-gold/40" />
        </div>
        <h3 className="text-base font-bold text-hextech-gold">Không tìm thấy tướng phù hợp</h3>
        <p className="text-xs text-gray-500 mt-1 max-w-sm">
          Thử tìm kiếm với tên khác hoặc thay đổi bộ lọc vị trí ở thanh trên cùng.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-[1720px] mx-auto p-4 md:p-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 gap-3 sm:gap-4">
        {filteredChampions.map((champ) => {
          const activeMod = activeSkins[champ.id];
          const hasActiveMod = !!activeMod;

          return (
            <div
              key={champ.id}
              onClick={() => onSelectChampion(champ)}
              className={`group relative flex flex-col rounded-sm overflow-hidden cursor-pointer transition-all duration-300 bg-hextech-deep border ${
                hasActiveMod
                  ? "border-hextech-cyan shadow-glow-cyan"
                  : "border-hextech-border hover:border-hextech-gold hover:shadow-glow-gold hover:-translate-y-1"
              }`}
            >
              {/* Champion Portrait Container */}
              <div className="relative aspect-square w-full overflow-hidden bg-hextech-bg">
                <img
                  src={champ.icon_url}
                  alt={champ.name_vi}
                  loading="lazy"
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  onError={(e) => {
                    // Fallback to placeholder if asset fails to load
                    (e.target as HTMLImageElement).src =
                      "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champion-icons/-1.png";
                  }}
                />

                {/* Dark gradient overlay at bottom of icon */}
                <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-hextech-deep via-hextech-deep/70 to-transparent pointer-events-none" />

                {/* Active Mod Glowing Badge */}
                {hasActiveMod && (
                  <div className="absolute top-1.5 right-1.5 flex items-center gap-1 px-1.5 py-0.5 rounded-sm bg-hextech-deep/90 border border-hextech-cyan text-[10px] font-bold text-hextech-cyan shadow-glow-cyan">
                    <Check className="w-2.5 h-2.5 stroke-[3]" />
                    <span className="hidden sm:inline">Active</span>
                  </div>
                )}

                {/* Total Skins Count Pill */}
                <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-sm bg-black/60 backdrop-blur-sm border border-hextech-border/50 text-[10px] font-medium text-gray-300">
                  {champ.skins.length} Skins
                </div>
              </div>

              {/* Champion Info Details */}
              <div className="p-2 sm:p-2.5 flex flex-col flex-1 justify-between bg-hextech-surface/40">
                <div>
                  <h4 className="text-xs font-bold text-hextech-gold-light group-hover:text-hextech-gold tracking-wide truncate">
                    {champ.name_vi}
                  </h4>
                  <p className="text-[10px] text-gray-400 truncate">
                    {champ.title_vi || champ.name_en}
                  </p>
                </div>

                {/* Active Mod Skin Name Indicator */}
                {hasActiveMod && (
                  <div className="mt-1.5 pt-1.5 border-t border-hextech-cyan/20 flex items-center gap-1 text-[10px] text-hextech-cyan truncate">
                    <Flame className="w-2.5 h-2.5 text-hextech-cyan shrink-0 animate-pulse" />
                    <span className="truncate font-medium">{activeMod.skin_name}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

