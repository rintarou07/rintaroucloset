# Implementation Plan: Premade Real-Time Skin Sync (Cloudflare Worker)

## Overview
Xây dựng tính năng **Đồng Bộ Trang Phục Thời Gian Thực (Premade Skin Sync)** cho nhóm bạn chơi chung Liên Minh Huyền Thoại:
1. Máy chủ Cloudflare Worker hoàn toàn miễn phí (100% Free) đóng vai trò trung gian trao đổi thông tin phòng (REST heartbeat 2.5s).
2. Client lưu sẵn URL server trong `./data/config.json` để bạn bè mở app là dùng ngay.
3. Thanh trượt bên phải (Right Bar) hiển thị ping (ms), nút bật/tắt đồng bộ, danh sách bạn bè với thẻ bo góc chứa trạng thái Inject, trạng thái Đồng bộ, và số lượng viết tắt `C:x - T:y`.
4. Phân biệt trực quan: Chấm Đỏ (skin của mình), Chấm Xanh Dương (skin của bạn bè).
5. Tự động tải ngầm `.fantome` của bạn bè và chỉ nén vào WAD overlay một lần duy nhất khi người dùng bấm nút `INJECT`.
6. Xử lý xung đột khi 2 người cùng chọn skin cho 1 tướng với 2 lựa chọn "Nhường" / "Không nhường".

## Architecture Decisions
- **Cloudflare Worker 100% Free via Heartbeat:** Không sử dụng Cloudflare Durable Objects (tốn $5/tháng). Sử dụng Cloudflare Worker với in-memory room map và REST API (`POST /api/heartbeat`, `POST /api/conflict`). Client gửi heartbeat mỗi 2.5 giây khi bật chế độ đồng bộ. Với phòng 5-10 người, tổng request chỉ ~15.000 req/ngày, hoàn toàn nằm trong mức 100.000 req/ngày miễn phí của Cloudflare.
- **100% Portable Configuration:** Lưu `sync_server_url` và `is_sync_enabled` trong `./data/config.json`. Khi người dùng cấu hình server xong và nén thư mục gửi cho bạn bè, toàn bộ cấu hình đã có sẵn, bạn bè không cần nhập lại URL.
- **Tách biệt Tải ngầm (Background Download) và Đóng gói (WAD Build):** Khi nhận được skin bạn bè qua heartbeat, client lập tức tải ngầm file `.fantome` từ GitHub Alban1911 về `./data/cache/fantome/`. WAD overlay chỉ được build khi người dùng bấm nút `INJECT` (tránh nghẽn I/O và giật lag khi bạn bè đang click đổi skin liên tục).
- **Hợp nhất Overlay (Merged Overlay):** Tại thời điểm `INJECT`, hệ thống gộp danh sách `active_skins` của local với các skin của bạn bè (đã giải quyết xung đột) để chuyển vào `ltk_overlay`, tạo ra các file `.wad.client` cho tất cả tướng của cả đội.

---

## Task List

### Phase 1: Foundation (Cloudflare Worker & Portable Config)
- [ ] **Task 1: Standalone Cloudflare Worker (`cloudflare-worker/worker.js` & Setup Guide)**
  - Tạo file `cloudflare-worker/worker.js` xử lý `GET /api/ping` và `POST /api/heartbeat`.
  - Quản lý danh sách người chơi trong phòng (timeout 12s nếu ngắt kết nối).
  - Tạo tài liệu hướng dẫn 3 bước copy-paste lên Cloudflare Dashboard trong `cloudflare-worker/README.md`.
- [ ] **Task 2: Portable Server Config in Rust & TypeScript**
  - Cập nhật struct `AppConfig` trong Rust (`src-tauri/src/config.rs`) thêm `sync_server_url: Option<String>` và `is_sync_enabled: bool`.
  - Bổ sung commands `get_sync_config` và `set_sync_config`.
  - Cập nhật types trong `src/types/skin.ts` và API client trong `src/services/tauriClient.ts`.

### Checkpoint: Foundation
- [ ] Worker chạy thử nghiệm phản hồi ping và heartbeat hợp lệ.
- [ ] Rust đọc/ghi cấu hình `sync_server_url` vào `./data/config.json` không lỗi.

---

### Phase 2: Client Sync Engine (Heartbeat & Background Downloader)
- [ ] **Task 3: Client Sync Engine (`src/services/syncService.ts`)**
  - Quản lý chu kỳ heartbeat 2.5s khi bật chế độ đồng bộ.
  - Đo độ trễ ping mạng (`ms`) gửi lên UI.
  - Tự động phát hiện skin mới từ bạn bè và kích hoạt tải ngầm `.fantome` về cache nếu chưa có.
  - Theo dõi tiến trình tải và xác định trạng thái "Đã đồng bộ" hoặc "Thiếu skin...".
- [ ] **Task 4: Conflict Detection & Resolution Logic**
  - Phát hiện khi có 2 người chơi cùng chọn skin cho 1 `champion_id`.
  - Xử lý 2 hành động: "Nhường" (nhận skin của bạn) và "Không nhường" (giữ skin local).
  - Mặc định ưu tiên skin local nếu không có tương tác sau 10 giây.

### Checkpoint: Sync Engine
- [ ] Client gửi heartbeat định kỳ, nhận danh sách bạn bè, tự tải `.fantome` của bạn bè vào `./data/cache/fantome/` mượt mà.

---

### Phase 3: UI Implementation (Right Bar, Cards & Active Status)
- [ ] **Task 5: Friends Right Bar Drawer (`src/components/FriendsDrawer.tsx`)**
  - Thiết kế drawer trượt từ bên phải với giao diện Hextech Dark (`w-[320px]`).
  - Hiển thị: Chỉ số Ping (`ms`), Switch bật/tắt "Đồng bộ với bạn bè".
  - Danh sách bạn bè thẻ bo góc (`rounded rectangle`): Tên summoner, trạng thái Inject, trạng thái Đồng bộ, viết tắt `C:x - T:y`.
- [ ] **Task 6: Top Header Button & Visual Status Indicators**
  - Nút biểu tượng Bạn bè (SVG) trên Header Bar để đóng/mở Right Bar.
  - Hiển thị Chấm Đỏ (của mình) vs Chấm Xanh Dương (của bạn) trên `SkinCard.tsx`.
  - Cập nhật Popover Active Skins trên Header: gom nhóm theo tên bạn bè với chấm xanh dương.
- [ ] **Task 7: Conflict Notification Modal (`src/components/ConflictModal.tsx`)**
  - Popup cảnh báo khi có đụng hàng tướng với 2 nút "Nhường" và "Không nhường".

### Checkpoint: UI & Visuals
- [ ] Click nút bạn bè mở Right Bar mượt mà; thẻ bạn bè hiển thị chuẩn thông tin và viết tắt; skin card hiển thị chấm xanh/đỏ rõ ràng.

---

### Phase 4: Multi-Skin WAD Build & Verification
- [ ] **Task 8: Merged Overlay Injection Engine**
  - Cập nhật logic `INJECT`: Tổng hợp toàn bộ skin của mình và các skin hợp lệ của bạn bè đã tải xong.
  - Gọi backend nén tất cả vào WAD overlay (`./data/overlay/DATA/FINAL/Champions/`).
  - Gửi cờ `is_injected: true` trong heartbeat tiếp theo để cập nhật trạng thái cho cả phòng.
- [ ] **Task 9: End-to-End Multi-Client Testing & Build Verification**
  - Kiểm tra toàn bộ quy trình: Chạy test 2 client ảo, kiểm tra đồng bộ, xử lý nhường skin, bấm Inject, xác nhận file WAD sinh ra chính xác.
  - Kiểm tra `npm run build` và `cargo check` không lỗi.

### Checkpoint: Complete
- [ ] Hệ thống hoạt động trơn tru 100%, không gián đoạn game, sẵn sàng đóng gói chia sẻ cho bạn bè.

---

## Risks and Mitigations
| Risk | Impact | Mitigation |
|------|--------|------------|
| Cloudflare Worker ngủ đông (Cold Start / Memory reset) | Thấp | Heartbeat định kỳ 2.5s giữ Worker luôn hoạt động (warm); mỗi lần gửi heartbeat đều mang theo trạng thái đầy đủ của client để tự phục hồi phòng. |
| Bạn bè đổi skin liên tục gây gián đoạn WAD | Trung bình | Chỉ tải ngầm file `.fantome` trong nền, chỉ đóng gói WAD khi bấm nút `INJECT`. |
| Trùng tướng giữa 2 người chơi | Trung bình | Cảnh báo trực tiếp cho cả hai, mặc định giữ skin riêng của từng máy nếu không ai nhường. |
| Máy bạn bè không có kết nối internet tải skin | Thấp | Hiển thị rõ trạng thái `Thiếu: [Tên tướng]` trên thẻ bạn bè trong Right Bar. |

