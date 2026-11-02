import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  CloudDownload,
  RotateCw,
  CheckCircle2,
  HardDrive,
  Sparkles,
  Pause,
  Play,
  Zap,
} from "lucide-react";
import type { RepoStatus, BulkDownloadProgress } from "../types/skin";

interface RepoSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  repoStatus: RepoStatus | null;
  progress: BulkDownloadProgress | null;
  onCheckUpdate: () => Promise<void>;
  onStartDownload: () => Promise<void>;
  onStopDownload: () => Promise<void>;
  isCheckingUpdate: boolean;
}

export const RepoSyncModal: React.FC<RepoSyncModalProps> = ({
  isOpen,
  onClose,
  repoStatus,
  progress,
  onCheckUpdate,
  onStartDownload,
  onStopDownload,
  isCheckingUpdate,
}) => {
  const [activeAction, setActiveAction] = useState<string | null>(null);

  if (!isOpen) return null;

  const isDownloading = progress?.is_active ?? repoStatus?.is_downloading ?? false;
  const isCompleted = (progress?.is_completed || repoStatus?.is_fully_synced) && !isDownloading;
  const totalFiles = (progress?.total_files && progress.total_files > 0)
    ? progress.total_files
    : (repoStatus?.total_files && repoStatus.total_files > 0)
    ? repoStatus.total_files
    : 9096;
  const cachedFiles = progress?.downloaded_files !== undefined && progress.downloaded_files > 0
    ? progress.downloaded_files
    : repoStatus?.cached_files ?? 0;
  const currentPct = progress?.percentage !== undefined && progress.percentage > 0
    ? progress.percentage
    : repoStatus?.percentage ?? (totalFiles > 0 ? Math.min(100, Math.round(((cachedFiles / totalFiles) * 100) * 10) / 10) : 100);
  const missingFiles = Math.max(0, totalFiles - cachedFiles);

  const handleStart = async () => {
    setActiveAction("start");
    await onStartDownload();
    setActiveAction(null);
  };

  const handleStop = async () => {
    setActiveAction("stop");
    await onStopDownload();
    setActiveAction(null);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md select-none font-mono">
        <motion.div
          initial={{ scale: 0.94, opacity: 0, y: 16 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.94, opacity: 0, y: 16 }}
          className="w-full max-w-lg bg-[#161719] border border-[#2E3134] rounded-2xl shadow-2xl overflow-hidden text-[#E3E3E3] flex flex-col"
        >
          {/* Header */}
          <div className="p-4 bg-[#1b1c1e] border-b border-[#2E3134] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <CloudDownload className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white tracking-wide flex items-center gap-2">
                  KHO TRANG PHỤC
                </h3>
                <p className="text-[11px] text-[#9AA0A6]">
                  Tải sẵn toàn bộ skin để kích hoạt tức thì 0 giây & chơi offline
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-[#252729] border border-white/10 text-zinc-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body Content */}
          <div className="p-5 space-y-4 text-xs">
            {/* Status Card */}
            <div className="grid grid-cols-3 gap-2.5">
              <div className="p-3 rounded-xl bg-[#1d1f21] border border-white/5 flex flex-col items-center text-center">
                <HardDrive className="w-4 h-4 text-zinc-400 mb-1" />
                <span className="text-[10px] text-zinc-400">Tổng file kho</span>
                <span className="text-sm font-bold text-white mt-0.5">
                  {totalFiles.toLocaleString()}
                </span>
                <span className="text-[9px] text-zinc-500">~{repoStatus?.total_size_mb || 140} MB</span>
              </div>

              <div className="p-3 rounded-xl bg-[#1d1f21] border border-white/5 flex flex-col items-center text-center">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 mb-1" />
                <span className="text-[10px] text-zinc-400">Đã tải về máy</span>
                <span className="text-sm font-bold text-emerald-400 mt-0.5">
                  {cachedFiles.toLocaleString()}
                </span>
                <span className="text-[9px] text-zinc-500">{currentPct}% hoàn thành</span>
              </div>

              <div className="p-3 rounded-xl bg-[#1d1f21] border border-white/5 flex flex-col items-center text-center">
                <Zap className="w-4 h-4 text-amber-400 mb-1" />
                <span className="text-[10px] text-zinc-400">Còn thiếu</span>
                <span className="text-sm font-bold text-amber-400 mt-0.5">
                  {missingFiles.toLocaleString()}
                </span>
                <span className="text-[9px] text-zinc-500">cần tải</span>
              </div>
            </div>

            {/* Progress Section */}
            <div className="p-4 rounded-xl bg-[#121314] border border-white/5 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-zinc-300 flex items-center gap-1.5">
                  {isDownloading ? (
                    <>
                      <RotateCw className="w-3.5 h-3.5 text-sky-400 animate-spin" />
                      <span>Đang tải kho trang phục...</span>
                    </>
                  ) : isCompleted ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Kho đã đầy đủ 100%!</span>
                    </>
                  ) : (
                    <span>Tiến độ tải</span>
                  )}
                </span>
                <span className="font-bold text-sky-400">{currentPct}%</span>
              </div>

              {/* Progress Bar */}
              <div className="w-full h-2.5 bg-[#252729] rounded-full overflow-hidden p-0.5 border border-white/5">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-sky-500 via-amber-400 to-emerald-400 shadow-[0_0_10px_rgba(56,189,248,0.5)]"
                  initial={{ width: 0 }}
                  animate={{ width: `${currentPct}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>

              {/* Live Speed & Current File */}
              {isDownloading && progress && (
                <div className="flex items-center justify-between text-[11px] text-zinc-400 pt-1">
                  <span className="truncate max-w-[280px]" title={progress.current_file}>
                    {progress.current_file}
                  </span>
                  <span className="font-bold text-amber-400 shrink-0">
                    {progress.speed_kbps > 1024
                      ? `${(progress.speed_kbps / 1024).toFixed(1)} MB/s`
                      : `${Math.round(progress.speed_kbps)} KB/s`}
                  </span>
                </div>
              )}

              {isCompleted && (
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  Tất cả các trang phục từ kho skin đã được tải sẵn đầy đủ vào máy của bạn.
                  Bất kỳ lúc nào bạn click chọn skin, app sẽ kích hoạt ngay lập tức (0ms).
                </p>
              )}
            </div>

            {/* Explanatory Note */}
            <div className="flex items-start gap-2 p-3 rounded-lg bg-sky-500/10 border border-sky-500/20 text-[11px] text-sky-200/90 leading-relaxed">
              <Sparkles className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
              <span>
                Toàn bộ 9,000+ trang phục của kho chỉ nặng khoảng <strong>~140 MB</strong>.
                Bạn có thể bấm <strong>"Tải Toàn Bộ Kho"</strong> rồi tắt popup này, quá trình tải sẽ chạy
                ngầm êm ái mà không làm đơ giao diện.
              </span>
            </div>
          </div>

          {/* Footer Controls */}
          <div className="p-4 bg-[#1b1c1e] border-t border-[#2E3134] flex items-center justify-between gap-3">
            <button
              onClick={onCheckUpdate}
              disabled={isCheckingUpdate || isDownloading}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#252729] hover:bg-[#2e3134] border border-white/10 text-xs font-semibold text-zinc-300 hover:text-white transition-colors disabled:opacity-50 cursor-pointer"
            >
              <RotateCw className={`w-3.5 h-3.5 ${isCheckingUpdate ? "animate-spin text-amber-400" : ""}`} />
              <span>{isCheckingUpdate ? "Đang kiểm tra..." : "Check For Update"}</span>
            </button>

            <div className="flex items-center gap-2">
              {isDownloading ? (
                <button
                  onClick={handleStop}
                  disabled={activeAction === "stop"}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 text-amber-300 text-xs font-bold transition-all cursor-pointer"
                >
                  <Pause className="w-3.5 h-3.5 fill-current" />
                  <span>Tạm dừng</span>
                </button>
              ) : (
                <button
                  onClick={handleStart}
                  disabled={activeAction === "start" || (isCompleted && currentPct >= 100)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-black text-xs font-bold transition-all shadow-[0_0_12px_rgba(56,189,248,0.4)] disabled:opacity-50 cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>{currentPct >= 100 ? "Đã đầy đủ" : "Tải Toàn Bộ Kho"}</span>
                </button>
              )}

              <button
                onClick={onClose}
                className="px-3.5 py-2 rounded-xl bg-[#252729] text-zinc-400 hover:text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

