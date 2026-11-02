# Task List: Premade Real-Time Skin Sync

## Phase 1: Foundation (Cloudflare Worker & Portable Config)

### Task 1: Standalone Cloudflare Worker (`cloudflare-worker/worker.js` & README)
**Description:** Tạo file mã nguồn duy nhất `cloudflare-worker/worker.js` và tài liệu hướng dẫn `cloudflare-worker/README.md`. Worker xử lý các endpoint `GET /api/ping`, `POST /api/heartbeat`, và `POST /api/conflict` với logic in-memory dọn dẹp các peer không hoạt động quá 12s, hỗ trợ CORS đầy đủ.
**Acceptance criteria:**
- [x] File `cloudflare-worker/worker.js` hoàn chỉnh, không có dependencies npm, sẵn sàng copy-paste trực tiếp lên Cloudflare Dashboard.
- [x] `POST /api/heartbeat` nhận dữ liệu người chơi, lưu vào phòng, và trả về danh sách tất cả bạn bè online trong 12s gần nhất.
- [x] `GET /api/ping` trả về `{ pong: true, timestamp }` phục vụ đo ping ms.
- [x] File `cloudflare-worker/README.md` hướng dẫn chi tiết cách tạo Worker miễn phí trên Cloudflare Dashboard chỉ với 3 bước.
**Verification:**
- [x] Chạy kiểm thử request giả lập tới worker script (hoặc test local với node/fetch) xác nhận trả về JSON chuẩn.
**Dependencies:** None
**Files likely touched:**
- `cloudflare-worker/worker.js`
- `cloudflare-worker/README.md`
**Estimated scope:** Small (2 files)

---

### Task 2: Portable Server Config in Rust & TypeScript
**Description:** Mở rộng `AppConfig` trong Rust và các interface TypeScript để lưu trữ `sync_server_url` và `is_sync_enabled` trong `./data/config.json`. Thêm các lệnh Tauri để đọc và cập nhật cấu hình server.
**Acceptance criteria:**
- [x] Struct `AppConfig` trong `src-tauri/src/config.rs` (và `src-tauri/src/portable.rs`) có các trường `pub sync_server_url: Option<String>` và `pub is_sync_enabled: bool`.
- [x] Các lệnh `get_sync_config` và `set_sync_config` được đăng ký trong `src-tauri/src/commands.rs` và `src-tauri/src/lib.rs`.
- [x] File `./data/config.json` tự động cập nhật trường cấu hình khi lưu.
- [x] Interface TypeScript trong `src/types/skin.ts` và API trong `src/services/tauriClient.ts` được cập nhật đồng bộ.
**Verification:**
- [x] `cargo check --manifest-path src-tauri/Cargo.toml` biên dịch thành công 0 lỗi.
- [x] `npm run build` không có lỗi type error.
**Dependencies:** Task 1
**Files likely touched:**
- `src-tauri/src/config.rs` (portable.rs)
- `src-tauri/src/commands.rs`
- `src-tauri/src/lib.rs`
- `src/types/skin.ts`
- `src/services/tauriClient.ts`
**Estimated scope:** Medium (5 files)

---

## Checkpoint 1: Foundation
- [x] Mã nguồn Cloudflare Worker sẵn sàng để deploy miễn phí.
- [x] Backend Rust và Frontend TypeScript lưu trữ/truy xuất URL server an toàn qua `./data/config.json`.

---

## Phase 2: Client Sync Engine (Heartbeat & Background Downloader)

### Task 3: Client Sync Engine (`src/services/syncService.ts`)
**Description:** Xây dựng service quản lý vòng lặp heartbeat định kỳ (mỗi 2.5s khi bật đồng bộ), gửi trạng thái tướng/skin của bản thân lên server, đo ping ms, nhận danh sách bạn bè, và kích hoạt tải ngầm `.fantome` nếu bạn bè chọn skin mà máy mình chưa có cache.
**Acceptance criteria:**
- [x] Tạo `src/services/syncService.ts` với các phương thức `start()`, `stop()`, `updateLocalProfile()`, `onPeersUpdate()`.
- [x] Đo ping chính xác qua hiệu số thời gian request/response (`ms`).
- [x] Tự động gọi API tải skin `downloadSkin` ngầm khi phát hiện `fantome_url` của bạn bè chưa có trong cache cục bộ.
- [x] Quản lý trạng thái đồng bộ: tính toán bạn bè nào đã tải xong toàn bộ skin, bạn bè nào còn đang tải thiếu.
**Verification:**
- [x] Test chạy mock service, kiểm tra callback `onPeersUpdate` kích hoạt với danh sách bạn bè và ping.
**Dependencies:** Task 2
**Files likely touched:**
- `src/services/syncService.ts`
- `src/types/skin.ts`
**Estimated scope:** Small (2 files)

---

### Task 4: Conflict Detection & Resolution Logic
**Description:** Xây dựng logic phát hiện xung đột khi 2 người chơi cùng chọn skin cho cùng 1 `champion_id`. Quản lý trạng thái "Nhường" / "Không nhường" với cơ chế mặc định giữ skin riêng của từng máy nếu không phản hồi sau 10 giây.
**Acceptance criteria:**
- [x] Khi phát hiện `peer.champion_id === local.champion_id`, kích hoạt sự kiện xung đột gửi tới UI.
- [x] Nếu người dùng bấm "Nhường", máy local sẽ tạm thời tắt skin local của tướng đó và sử dụng skin của bạn bè cho WAD overlay.
- [x] Nếu người dùng bấm "Không nhường" hoặc hết 10 giây không chọn, giữ nguyên skin local.
**Verification:**
- [x] Kiểm thử logic conflict handler với các kịch bản: cả 2 chọn cùng tướng, 1 người nhường, không ai nhường.
**Dependencies:** Task 3
**Files likely touched:**
- `src/services/conflictManager.ts` (tích hợp trong syncService.ts)
- `src/services/syncService.ts`
**Estimated scope:** Small (2 files)

---

## Checkpoint 2: Sync Engine
- [x] Client tự động đồng bộ danh sách người chơi với Cloudflare Worker.
- [x] File skin của bạn bè được tải ngầm vào `./data/cache/fantome/` mà không ảnh hưởng tới UI.
- [x] Logic xung đột nhận diện chính xác khi có người chơi chọn trùng tướng.

---

## Phase 3: UI Implementation (Right Bar, Cards & Active Status)

### Task 5: Friends Right Bar Drawer (`src/components/FriendsDrawer.tsx`)
**Description:** Xây dựng component drawer trượt từ bên phải với thiết kế Hextech Dark sang trọng (`w-[320px]`). Hiển thị độ trễ ping (`ms`), nút bật/tắt "Đồng bộ với bạn bè", danh sách bạn bè dạng thẻ bo góc (`rounded rectangle`).
**Acceptance criteria:**
- [x] Drawer trượt mượt mà từ cạnh phải màn hình với animation `framer-motion`.
- [x] Badge hiển thị Ping (`... ms`) có chấm màu (xanh lá nếu <80ms, vàng nếu <150ms, đỏ nếu cao hơn).
- [x] Toggle switch bật/tắt đồng bộ với server Cloudflare.
- [x] Mỗi thẻ bạn bè có viền bo góc (`rounded-lg border border-white/10 bg-[#1e1f20]`):
  - Tên Summoner và icon đại diện.
  - Trạng thái Inject: `Đã Inject` (xanh lá) / `Chưa Inject` (xám).
  - Trạng thái Đồng bộ: `Đã đồng bộ` (xanh) / `Thiếu: [Tên skin]` (cam).
  - Thống kê viết tắt: `C:<số_skin_của_bạn_đó>` | `T:<tổng_skin_cả_phòng>`.
**Verification:**
- [x] Component render sạch sẽ, không tràn layout, đáp ứng đủ các trạng thái rỗng (khi chưa có ai) và khi có nhiều bạn bè.
**Dependencies:** Task 3
**Files likely touched:**
- `src/components/FriendsDrawer.tsx`
**Estimated scope:** Small (1 file)

---

### Task 6: Top Header Button & Visual Status Indicators
**Description:** Thêm nút mở Friends Drawer trên Top Header Bar. Cập nhật thẻ trang phục (`SkinCard.tsx`) và danh sách Active Skins để phân biệt rõ ràng skin cá nhân (Chấm đỏ) và skin của bạn bè (Chấm xanh dương).
**Acceptance criteria:**
- [x] Thêm nút biểu tượng Bạn bè (SVG `Users`) trên `TopHeaderBar.tsx`, có chấm trạng thái kết nối server.
- [x] Trên `SkinCard.tsx`: Nếu skin đang được bạn bè chọn, hiển thị **Chấm Xanh Dương** trực quan (khác biệt với Chấm Đỏ của cá nhân).
- [x] Trong popover Active Skins của Header: Liệt kê các skin đang kích hoạt, nhóm các skin của bạn bè dưới tên của từng người bạn kèm chấm xanh dương.
**Verification:**
- [x] Kiểm tra trực quan trên giao diện: Chấm đỏ của bản thân và chấm xanh của bạn bè hiển thị chuẩn xác, không bị lẫn lộn.
**Dependencies:** Task 5
**Files likely touched:**
- `src/components/TopHeaderBar.tsx`
- `src/components/SkinCard.tsx`
- `src/App.tsx`
**Estimated scope:** Medium (3 files)

---

### Task 7: Conflict Notification Modal (`src/components/ConflictModal.tsx`)
**Description:** Tạo popup thông báo đụng hàng khi 2 người chơi cùng chọn skin cho 1 tướng, cung cấp 2 nút hành động "Nhường..." và "Không nhường...".
**Acceptance criteria:**
- [x] Modal hiển thị tên người bạn bị trùng và tên tướng đang chọn.
- [x] Nút "Nhường [Tên bạn]" (chuyển sang nhận skin của bạn bè).
- [x] Nút "Không nhường" (giữ skin của mình).
- [x] Thanh đếm ngược 10 giây tự đóng và mặc định giữ skin của mình.
**Verification:**
- [x] Kiểm tra tương tác click nút và đếm ngược tự đóng popup.
**Dependencies:** Task 4, Task 6
**Files likely touched:**
- `src/components/ConflictModal.tsx`
- `src/App.tsx`
**Estimated scope:** Small (2 files)

---

## Checkpoint 3: UI & Visuals
- [x] Right Bar mở/đóng mượt mà, hiển thị đầy đủ thông tin server, danh sách bạn bè với thẻ bo góc và viết tắt `C:x - T:y`.
- [x] Giao diện phân biệt hoàn hảo giữa Chấm Đỏ (của mình) và Chấm Xanh Dương (của bạn).
- [x] Modal cảnh báo đụng hàng hoạt động chuẩn xác.

---

## Phase 4: Multi-Skin WAD Build & Verification

### Task 8: Merged Overlay Injection Engine
**Description:** Cập nhật quy trình khi người dùng bấm nút `INJECT`: Tổng hợp danh sách skin đang chọn của bản thân cùng toàn bộ skin hợp lệ của bạn bè đã tải xong, chuyển vào bộ nén WAD overlay để đóng gói 1 lần duy nhất, sau đó cập nhật cờ `is_injected: true` gửi lên server.
**Acceptance criteria:**
- [x] Khi bấm nút `INJECT`, app kiểm tra và hợp nhất `active_skins` cá nhân với danh sách skin của bạn bè.
- [x] Kích hoạt `rebuildOverlay()` để `ltk_overlay` đóng gói tất cả các tướng thành file `.wad.client` trong `./data/overlay/`.
- [x] Gửi cờ `is_injected: true` trong heartbeat tiếp theo, giúp bạn bè trên mạng thấy trạng thái `Đã Inject` chuyển sang màu xanh lá.
**Verification:**
- [x] Kiểm tra thư mục `./data/overlay/DATA/FINAL/Champions/`: Chứa đầy đủ file WAD của tướng mình chọn VÀ tướng bạn bè chọn.
**Dependencies:** Task 3, Task 6
**Files likely touched:**
- `src/App.tsx`
- `src/services/tauriClient.ts`
- `src-tauri/src/mod_engine.rs`
**Estimated scope:** Medium (3 files)

---

### Task 9: End-to-End Testing & Project Build Verification
**Description:** Thực hiện kiểm thử toàn diện toàn bộ tính năng và đảm bảo dự án build sạch sẽ 100%.
**Acceptance criteria:**
- [x] `cargo check --manifest-path src-tauri/Cargo.toml` vượt qua với 0 cảnh báo/lỗi.
- [x] `npm run build` (`tsc && vite build`) hoàn tất sạch sẽ 0 lỗi.
- [x] Hướng dẫn sử dụng và file `worker.js` được sắp xếp gọn gàng.
**Verification:**
- [x] Terminal chạy lệnh build thực tế thành công.
**Dependencies:** Tasks 1-8
**Files likely touched:**
- Toàn bộ các file trong dự án
**Estimated scope:** Small (1-2 files)

---

## Checkpoint 4: Complete
- [x] Toàn bộ tính năng Premade Real-Time Skin Sync qua Cloudflare Worker hoàn thành và sẵn sàng sử dụng.

