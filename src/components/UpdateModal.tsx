import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Sparkles,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Download,
  Github,
  ShieldCheck,
  ArrowUpRight,
} from "lucide-react";
import { tauriClient, formatBytes } from "../services/tauriClient";
import type { UpdateCheckResult, UpdateProgressPayload } from "../types/skin";

interface UpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  updateInfo: UpdateCheckResult | null;
  onCheckUpdate: () => Promise<UpdateCheckResult | null>;
}

export const UpdateModal: React.FC<UpdateModalProps> = ({
  isOpen,
  onClose,
  updateInfo,
  onCheckUpdate,
}) => {
  const [isChecking, setIsChecking] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [progress, setProgress] = useState<UpdateProgressPayload | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    tauriClient
      .onUpdateProgress((payload) => {
        setProgress(payload);
        if (payload.error) {
          setErrorMsg(payload.error);
          setIsUpdating(false);
        }
      })
      .then((fn) => {
        unlisten = fn;
      })
      .catch(() => {});

    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  const handleManualCheck = async () => {
    setIsChecking(true);
    setErrorMsg(null);
    try {
      await onCheckUpdate();
    } catch (err: any) {
      setErrorMsg(err?.message || "Không thể kiểm tra bản cập nhật từ GitHub.");
    } finally {
      setIsChecking(false);
    }
  };

  const handleStartUpdate = async () => {
    if (!updateInfo?.download_url) return;
    setIsUpdating(true);
    setErrorMsg(null);
    setProgress({
      status: "Đang kết nối tới GitHub...",
      percentage: 0,
      downloaded_bytes: 0,
      total_bytes: 0,
      is_finished: false,
      error: null,
    });

    try {
      await tauriClient.downloadAndApplyUpdate(updateInfo.download_url);
    } catch (err: any) {
      setErrorMsg(err?.message || typeof err === "string" ? err : "Lỗi tải cập nhật.");
      setIsUpdating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 select-none font-mono text-[#E3E3E3]">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => {
            if (!isUpdating) onClose();
          }}
          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative w-full max-w-lg bg-[#18191c] border border-[#2E3134] rounded-2xl shadow-2xl overflow-hidden flex flex-col z-10"
        >
          {/* Header */}
          <div className="p-4 bg-[#1e2023] border-b border-[#2E3134] flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-sky-500/15 border border-sky-500/30 text-sky-400">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <span>CẬP NHẬT RINTAROU CLOSET</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-sky-500/20 text-sky-300 font-mono">
                    GITHUB
                  </span>
                </h3>
                <span className="text-[11px] text-zinc-400">
                  Phiên bản hiện tại: <strong className="text-zinc-200">v{updateInfo?.current_version || "0.1.1"}</strong>
                </span>
              </div>
            </div>

            {!isUpdating && (
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg bg-[#282A2C] hover:bg-[#343739] text-zinc-400 hover:text-white transition-colors cursor-pointer"
                title="Đóng"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Content Body */}
          <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
            {/* Safe Notice */}
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-2.5 text-xs text-emerald-300 leading-relaxed">
              <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
              <div>
                <strong>Cập nhật an toàn 100%:</strong> Tự động tải và áp dụng code, data app và patcher mới. Dữ liệu cấu hình game và trang phục của bạn được bảo toàn nguyên vẹn.
              </div>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-start gap-2.5 text-xs text-rose-300">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                <div>{errorMsg}</div>
              </div>
            )}

            {/* Update Info Card */}
            {updateInfo?.has_update ? (
              <div className="p-4 rounded-xl bg-[#121314] border border-sky-500/30 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40">
                      CÓ BẢN MỚI v{updateInfo.latest_version}
                    </span>
                    <h4 className="text-sm font-bold text-white mt-1.5">{updateInfo.title}</h4>
                    <span className="text-[10px] text-zinc-400">Ngày phát hành: {updateInfo.release_date}</span>
                  </div>
                </div>

                {/* Changelog list */}
                {updateInfo.changelog && updateInfo.changelog.length > 0 && (
                  <div className="pt-2 border-t border-white/5 space-y-1.5">
                    <span className="text-[11px] font-bold text-sky-400 uppercase tracking-wider block">
                      Các thay đổi mới:
                    </span>
                    <ul className="space-y-1 text-xs text-zinc-300 list-disc list-inside">
                      {updateInfo.changelog.map((log, idx) => (
                        <li key={idx} className="leading-relaxed">
                          {log}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-6 rounded-xl bg-[#121314] border border-white/5 text-center space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                <h4 className="text-sm font-bold text-white">Bạn đang ở phiên bản mới nhất!</h4>
                <p className="text-xs text-zinc-400 max-w-sm mx-auto leading-relaxed">
                  Rintarou Closet đang hoạt động ở phiên bản v{updateInfo?.current_version || "0.1.1"}. Bạn có thể kiểm tra lại bất cứ lúc nào khi có code mới trên GitHub.
                </p>
              </div>
            )}

            {/* Progress bar during update */}
            {isUpdating && progress && (
              <div className="p-4 rounded-xl bg-[#121314] border border-sky-500/40 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-sky-300">{progress.status}</span>
                  <span className="font-mono text-zinc-400">{progress.percentage.toFixed(1)}%</span>
                </div>
                <div className="w-full h-2.5 rounded-full bg-black/50 overflow-hidden border border-white/10">
                  <motion.div
                    className="h-full bg-gradient-to-r from-sky-500 to-emerald-400 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${progress.percentage}%` }}
                    transition={{ duration: 0.2 }}
                  />
                </div>
                {progress.total_bytes > 0 && (
                  <div className="text-[10px] text-zinc-500 text-right font-mono">
                    {formatBytes(progress.downloaded_bytes)} / {formatBytes(progress.total_bytes)}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="p-4 bg-[#1e2023] border-t border-[#2E3134] flex items-center justify-between">
            <a
              href="https://github.com/rintarou07/rintaroucloset"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors"
            >
              <Github className="w-4 h-4" />
              <span>rintarou07/rintaroucloset</span>
              <ArrowUpRight className="w-3 h-3" />
            </a>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleManualCheck}
                disabled={isChecking || isUpdating}
                className="px-3 py-1.5 rounded-lg bg-[#282A2C] hover:bg-[#343739] border border-white/10 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? "animate-spin text-sky-400" : ""}`} />
                <span>{isChecking ? "Đang kiểm tra..." : "Kiểm tra lại"}</span>
              </button>

              {updateInfo?.has_update && (
                <button
                  type="button"
                  onClick={handleStartUpdate}
                  disabled={isUpdating}
                  className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-black text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-lg shadow-emerald-500/20 disabled:opacity-50"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{isUpdating ? "Đang cập nhật..." : "Cập Nhật Ngay (1-Click)"}</span>
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
