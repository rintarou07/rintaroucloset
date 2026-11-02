import { useState } from "react";
import { Folder, AlertCircle, CheckCircle2, X } from "lucide-react";
import { tauriApi } from "../services/tauriApi";

interface GamePathModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPath: string | null;
  isValid: boolean;
  onPathUpdated: (newPath: string) => void;
}

export function GamePathModal({
  isOpen,
  onClose,
  currentPath,
  isValid,
  onPathUpdated,
}: GamePathModalProps) {
  const [pathInput, setPathInput] = useState(currentPath ?? "");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const handleSave = async () => {
    const trimmed = pathInput.trim();
    if (!trimmed) {
      setErrorMsg("Vui lòng nhập đường dẫn thư mục hoặc file game.");
      return;
    }

    setIsSaving(true);
    setErrorMsg(null);
    try {
      await tauriApi.setGamePath(trimmed);
      onPathUpdated(trimmed);
      onClose();
    } catch (err) {
      setErrorMsg(typeof err === "string" ? err : "Đường dẫn không hợp lệ. Hãy kiểm tra lại.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-lg hextech-panel p-6 shadow-glow-gold rounded-sm border border-hextech-gold">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-hextech-gold hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 bg-hextech-deep rounded-sm border border-hextech-gold/40">
            <Folder className="w-6 h-6 text-hextech-gold" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-hextech-gold tracking-wide">
              Đường Dẫn Liên Minh Huyền Thoại
            </h2>
            <p className="text-xs text-gray-400">
              Cần trỏ tới thư mục Game hoặc file League of Legends.exe
            </p>
          </div>
        </div>

        {/* Status Indicator */}
        <div
          className={`flex items-center gap-2 p-3 mb-4 rounded-sm border text-xs ${
            isValid
              ? "bg-green-950/40 border-green-700/60 text-green-300"
              : "bg-red-950/40 border-red-700/60 text-red-300"
          }`}
        >
          {isValid ? (
            <>
              <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
              <span>Đường dẫn game hợp lệ và sẵn sàng tạo overlay.</span>
            </>
          ) : (
            <>
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>Chưa tìm thấy game. Vui lòng dán đường dẫn cài đặt game của bạn.</span>
            </>
          )}
        </div>

        {/* Input */}
        <div className="space-y-2 mb-4">
          <label className="text-xs text-hextech-gold/80 block">
            Đường dẫn thư mục hoặc file game:
          </label>
          <input
            type="text"
            value={pathInput}
            onChange={(e) => setPathInput(e.target.value)}
            placeholder="Ví dụ: C:\Riot Games\League of Legends\Game"
            className="w-full px-3 py-2 bg-hextech-deep border border-hextech-border focus:border-hextech-cyan focus:outline-none text-xs text-gray-200 rounded-sm"
          />
          <p className="text-[11px] text-gray-500">
            Gợi ý: C:\Riot Games\League of Legends\Game hoặc D:\Riot Games\League of Legends\Game\League of Legends.exe
          </p>
        </div>

        {errorMsg && (
          <div className="p-2.5 mb-4 bg-red-900/30 border border-red-600/50 text-red-300 text-xs rounded-sm">
            {errorMsg}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs text-gray-400 hover:text-white transition-colors"
          >
            Hủy
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="hextech-button px-5 py-2 text-xs font-semibold uppercase tracking-wider rounded-sm disabled:opacity-50"
          >
            {isSaving ? "Đang kiểm tra..." : "Lưu Đường Dẫn"}
          </button>
        </div>
      </div>
    </div>
  );
}

