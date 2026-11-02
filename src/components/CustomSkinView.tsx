import React, { useState } from "react";
import { UploadCloud, FileArchive, Trash2, CheckCircle2, ShieldAlert, Sparkles } from "lucide-react";
import clsx from "clsx";

interface CustomModItem {
  id: string;
  name: string;
  author: string;
  champion: string;
  size: string;
  filePath: string;
  isEnabled: boolean;
}

interface CustomSkinViewProps {
  onApplyCustomMod?: (mod: CustomModItem) => void;
}

export const CustomSkinView: React.FC<CustomSkinViewProps> = ({ onApplyCustomMod }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [mods, setMods] = useState<CustomModItem[]>([
    {
      id: "mod-1",
      name: "Spirit Blossom Yone Custom VFX",
      author: "Runeforge Artist",
      champion: "Yone",
      size: "14.2 MB",
      filePath: "./data/mods/custom_yone.fantome",
      isEnabled: false,
    },
  ]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    // In Tauri desktop, files can be dropped or added via open dialog
    const files = Array.from(e.dataTransfer.files);
    const fantomeFiles = files.filter((f) => f.name.endsWith(".fantome") || f.name.endsWith(".zip"));

    if (fantomeFiles.length === 0) return;

    const newMods: CustomModItem[] = fantomeFiles.map((f, idx) => ({
      id: `mod-${Date.now()}-${idx}`,
      name: f.name.replace(/\.(fantome|zip)$/, ""),
      author: "Custom Import",
      champion: "Đa Tướng / Custom",
      size: `${(f.size / (1024 * 1024)).toFixed(1)} MB`,
      filePath: f.name,
      isEnabled: true,
    }));

    setMods((prev) => [...prev, ...newMods]);
  };

  const toggleMod = (id: string) => {
    setMods((prev) =>
      prev.map((m) => {
        if (m.id === id) {
          const updated = { ...m, isEnabled: !m.isEnabled };
          if (onApplyCustomMod && updated.isEnabled) {
            onApplyCustomMod(updated);
          }
          return updated;
        }
        return m;
      })
    );
  };

  const deleteMod = (id: string) => {
    setMods((prev) => prev.filter((m) => m.id !== id));
  };

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6 select-none">
      {/* Title & Info Banner */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#D91B2E]" />
            Quản Lý Custom Skin (.fantome)
          </h2>
          <p className="text-xs text-[#9AA0A6] mt-1">
            Kéo thả hoặc tải lên các tệp .fantome do cộng đồng sáng tạo (Runeforge, Killerskins).
          </p>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#1E1F20] border border-white/10 text-xs text-emerald-400 font-mono">
          <CheckCircle2 className="w-4 h-4" />
          <span>LTK OVERLAY ENGINE READY</span>
        </div>
      </div>

      {/* Drag & Drop Target Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={clsx(
          "border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center transition-all duration-200 cursor-pointer bg-[#1E1F20]/40",
          isDragging
            ? "border-[#D91B2E] bg-[#D91B2E]/10 shadow-[0_0_24px_rgba(217,27,46,0.3)]"
            : "border-white/10 hover:border-white/20"
        )}
      >
        <div className="p-4 rounded-full bg-[#131314] border border-white/10 mb-3">
          <UploadCloud className="w-8 h-8 text-[#D91B2E]" />
        </div>
        <p className="text-sm font-semibold text-white">
          Kéo thả tệp <span className="text-[#F43F5E]">.fantome</span> vào đây
        </p>
        <p className="text-xs text-[#5F6368] mt-1">
          Hỗ trợ định dạng mod LeagueToolkit chuẩn (.fantome, .zip). Tự động trích xuất và nối vào overlay.
        </p>
      </div>

      {/* Installed Custom Mods List */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold text-[#9AA0A6] tracking-wider uppercase">
          Danh Sách Mod Đã Thêm ({mods.length})
        </h3>

        {mods.length === 0 ? (
          <div className="py-12 text-center text-xs text-[#5F6368] bg-[#1E1F20] rounded-xl border border-white/[0.07]">
            Chưa có custom mod nào được cài đặt.
          </div>
        ) : (
          <div className="space-y-2">
            {mods.map((mod) => (
              <div
                key={mod.id}
                className="flex items-center justify-between p-4 rounded-xl bg-[#1E1F20] border border-white/[0.07] hover:border-white/15 transition-colors"
              >
                <div className="flex items-center gap-3.5">
                  <div className="p-2.5 rounded-lg bg-[#131314] border border-white/10">
                    <FileArchive className="w-5 h-5 text-[#D91B2E]" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-white tracking-wide">
                      {mod.name}
                    </h4>
                    <div className="flex items-center gap-3 text-xs text-[#9AA0A6] mt-0.5">
                      <span>Tác giả: {mod.author}</span>
                      <span>•</span>
                      <span>Tướng: {mod.champion}</span>
                      <span>•</span>
                      <span className="font-mono text-[11px]">{mod.size}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => toggleMod(mod.id)}
                    className={clsx(
                      "px-4 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 border",
                      mod.isEnabled
                        ? "bg-[#D91B2E] border-[#D91B2E] text-white shadow-[0_0_12px_rgba(217,27,46,0.4)]"
                        : "bg-[#282A2C] border-white/10 text-[#9AA0A6] hover:text-white"
                    )}
                  >
                    {mod.isEnabled ? "ĐANG BẬT" : "BẬT MOD"}
                  </button>

                  <button
                    onClick={() => deleteMod(mod.id)}
                    className="p-2 rounded-lg bg-[#282A2C] border border-white/10 text-[#9AA0A6] hover:text-rose-400 transition-colors"
                    title="Xóa mod"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Safety Notice */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-[#131314] border border-white/[0.07] text-xs text-[#9AA0A6]">
        <ShieldAlert className="w-4 h-4 text-[#C89B3C] shrink-0 mt-0.5" />
        <span>
          Lưu ý: Custom mod chỉ thay đổi mô hình hiển thị cục bộ phía máy của bạn qua WAD Overlay. Mod không chỉnh sửa bộ nhớ tiến trình game, giữ an toàn tuyệt đối.
        </span>
      </div>
    </div>
  );
};

export default CustomSkinView;

