import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, ShieldCheck, HeartHandshake, Clock } from "lucide-react";

export interface ConflictItem {
  championId: number;
  peerSummonerName: string;
  peerSkinName: string;
  localSkinName: string;
}

interface ConflictModalProps {
  conflict: ConflictItem | null;
  onYield: (conflict: ConflictItem) => void;
  onKeep: (conflict: ConflictItem) => void;
}

export const ConflictModal: React.FC<ConflictModalProps> = ({
  conflict,
  onYield,
  onKeep,
}) => {
  const [countdown, setCountdown] = useState(10);
  const conflictRef = React.useRef(conflict);
  conflictRef.current = conflict;

  const currentChampId = conflict?.championId;

  useEffect(() => {
    if (!currentChampId) return;

    setCountdown(10);
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          if (conflictRef.current) {
            onKeep(conflictRef.current);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [currentChampId, onKeep]);

  if (!conflict) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 select-none font-mono">
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 12 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 12 }}
          className="w-full max-w-md bg-[#181a1c] border-2 border-amber-500/60 rounded-xl shadow-2xl overflow-hidden text-[#E3E3E3]"
        >
          {/* Header */}
          <div className="p-4 bg-amber-500/10 border-b border-amber-500/30 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-wide">
                CẢNH BÁO TRÙNG TƯỚNG MOD
              </h3>
              <p className="text-[11px] text-amber-300/80">
                Hai người chơi cùng chọn mod cho 1 tướng
              </p>
            </div>
          </div>

          {/* Body */}
          <div className="p-5 space-y-4 text-xs">
            <p className="text-zinc-300 leading-relaxed">
              Bạn và <span className="font-bold text-sky-400">{conflict.peerSummonerName}</span> đều
              đang chọn trang phục cho cùng một vị tướng. Game chỉ có thể nén 1 mod tướng tại một
              thời điểm.
            </p>

            <div className="space-y-2 bg-[#121314] p-3 rounded-lg border border-white/5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-zinc-400">Skin của bạn:</span>
                <span className="font-bold text-rose-400 truncate max-w-[200px]">
                  {conflict.localSkinName}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-zinc-400">Skin của {conflict.peerSummonerName}:</span>
                <span className="font-bold text-sky-400 truncate max-w-[200px]">
                  {conflict.peerSkinName}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-center gap-1.5 text-zinc-400 text-[11px]">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span>
                Tự động giữ skin local sau:{" "}
                <span className="font-bold text-amber-400">{countdown}s</span>
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="p-4 bg-[#141517] border-t border-white/10 flex items-center gap-3">
            <button
              onClick={() => onYield(conflict)}
              className="flex-1 py-2.5 px-3 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 border border-sky-500/40 text-sky-300 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <HeartHandshake className="w-4 h-4" />
              <span>Nhường {conflict.peerSummonerName}</span>
            </button>

            <button
              onClick={() => onKeep(conflict)}
              className="flex-1 py-2.5 px-3 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Không nhường</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

