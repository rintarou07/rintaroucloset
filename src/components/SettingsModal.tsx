import React, { useState } from "react";
import { Folder, AlertCircle, CheckCircle2, X, RefreshCw, HardDrive } from "lucide-react";
import { tauriClient } from "../services/tauriClient";
import type { PortablePaths } from "../types/skin";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPath: string | null;
  isValid: boolean;
  paths?: PortablePaths;
  onPathUpdated: (newPath: string) => void;
  onOpenUpdate?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  currentPath,
  isValid,
  paths,
  onPathUpdated,
  onOpenUpdate,
}) => {
  const [pathInput, setPathInput] = useState(currentPath ?? "");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);

  if (!isOpen) return null;

  const handleSave = async () => {
    const trimmed = pathInput.trim();
    if (!trimmed) {
      setErrorMsg("Vui lòng nhập đường dẫn thư mục hoặc file thực thi của game.");
      return;
    }

    setIsSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await tauriClient.setGamePath(trimmed);
      setSuccessMsg("Cập nhật đường dẫn game thành công!");
      onPathUpdated(trimmed);
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err) {
      setErrorMsg(typeof err === "string" ? err : "Đường dẫn không hợp lệ. Hãy kiểm tra lại.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAutoDetect = async () => {
    setIsDetecting(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await tauriClient.initPortableEnv();
      if (res.config.lol_game_path) {
        setPathInput(res.config.lol_game_path);
        setSuccessMsg(
          res.auto_detected
            ? "Đã tự động tìm thấy đường dẫn Liên Minh Huyền Thoại!"
            : "Đã nạp đường dẫn hiện tại."
        );
        onPathUpdated(res.config.lol_game_path);
      } else {
        setErrorMsg("Không thể tự động tìm thấy game. Vui lòng dán đường dẫn thủ công.");
      }
    } catch (err) {
      setErrorMsg("Lỗi khi quét tìm đường dẫn game.");
    } finally {
      setIsDetecting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 select-none">
      <div className="relative w-full max-w-lg bg-[#1E1F20] rounded-2xl border border-white/10 p-6 shadow-2xl">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-[#9AA0A6] hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3.5 mb-5">
          <div className="p-3 bg-[#131314] rounded-xl border border-white/10">
            <Folder className="w-6 h-6 text-[#D91B2E]" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white tracking-wide">
              Cài Đặt Portable & Đường Dẫn Game
            </h2>
            <p className="text-xs text-[#9AA0A6]">
              Cần trỏ tới thư mục Game (chứa DATA/FINAL) hoặc LeagueClient
            </p>
          </div>
        </div>

        {/* Validation Status Indicator */}
        <div
          className={`flex items-center gap-2.5 p-3 mb-5 rounded-xl border text-xs ${
            isValid
              ? "bg-emerald-950/40 border-emerald-700/50 text-emerald-300"
              : "bg-rose-950/40 border-rose-700/50 text-rose-300"
          }`}
        >
          {isValid ? (
            <>
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Đường dẫn game hợp lệ và sẵn sàng xây dựng WAD Overlay.</span>
            </>
          ) : (
            <>
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>Chưa nhận diện được game. Vui lòng dán đường dẫn cài đặt của bạn.</span>
            </>
          )}
        </div>

        {/* Input & Auto Detect */}
        <div className="space-y-2 mb-5">
          <label className="text-xs font-semibold text-[#E3E3E3] block">
            Đường dẫn thư mục hoặc file thực thi Liên Minh:
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={pathInput}
              onChange={(e) => setPathInput(e.target.value)}
              placeholder="VD: C:\Riot Games\League of Legends\Game"
              className="flex-1 bg-[#131314] border border-white/10 focus:border-[#D91B2E] focus:outline-none rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-[#5F6368] font-mono transition-colors"
            />
            <button
              onClick={handleAutoDetect}
              disabled={isDetecting}
              className="px-3.5 py-2.5 rounded-xl bg-[#282A2C] border border-white/10 text-xs font-semibold text-white hover:bg-[#343739] transition-colors flex items-center gap-1.5 shrink-0 disabled:opacity-50"
              title="Tự động dò tìm qua ổ đĩa"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isDetecting ? "animate-spin text-[#D91B2E]" : ""}`} />
              <span>Tự Quét</span>
            </button>
          </div>
        </div>

        {/* Feedback Alerts */}
        {errorMsg && (
          <div className="p-3 mb-4 rounded-xl bg-rose-900/30 border border-rose-700 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="p-3 mb-4 rounded-xl bg-emerald-900/30 border border-emerald-700 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Portable Storage Info */}
        <div className="p-3.5 rounded-xl bg-[#131314] border border-white/[0.07] mb-6 space-y-1.5 text-[11px] text-[#9AA0A6]">
          <div className="flex items-center gap-2 text-white font-semibold mb-1">
            <HardDrive className="w-3.5 h-3.5 text-[#D91B2E]" />
            <span>Cơ Chế 100% Portable (0% Registry / %AppData%)</span>
          </div>
          <p>
            Cấu hình: <span className="font-mono text-zinc-300">{paths?.config_file || "./data/config.json"}</span>
          </p>
          <p>
            WAD Overlay: <span className="font-mono text-zinc-300">{paths?.overlay_dir || "./data/overlay/"}</span>
          </p>
          <p>
            WebView2 Cache: <span className="font-mono text-zinc-300">{paths?.webview_dir || "./data/webview/"}</span>
          </p>
        </div>

        {/* App Version & GitHub Auto-Update */}
        <div className="p-3.5 rounded-xl bg-[#131314] border border-white/[0.07] mb-6 flex items-center justify-between text-xs">
          <div>
            <span className="font-bold text-white block">Phiên Bản Ứng Dụng: v0.1.1</span>
            <span className="text-[10px] text-zinc-400">Tự động cập nhật trực tiếp qua GitHub</span>
          </div>
          {onOpenUpdate && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenUpdate();
              }}
              className="px-3 py-1.5 rounded-lg bg-sky-500/15 border border-sky-500/30 text-sky-300 hover:bg-sky-500/25 text-xs font-semibold cursor-pointer transition-colors"
            >
              Kiểm Tra Cập Nhật
            </button>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2.5">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-[#282A2C] border border-white/10 text-xs font-semibold text-[#9AA0A6] hover:text-white transition-colors"
          >
            Đóng
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-5 py-2 rounded-xl bg-[#D91B2E] text-xs font-semibold text-white hover:bg-[#F43F5E] shadow-[0_0_12px_rgba(217,27,46,0.4)] transition-all disabled:opacity-50"
          >
            {isSaving ? "Đang lưu..." : "Lưu & Xác Nhận"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;

