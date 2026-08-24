# Kế hoạch SX — GĐ 0 (dọn nền) + GĐ 1 (Toàn cảnh xưởng thành dashboard thật)

> Soạn 23/08/2026. Trạng thái: **✅ XONG 23/08/2026** — `npm run check` sạch
> (1479 test), UI chờ user verify tay. Bản đồ tổng: `plan-san-xuat-roadmap.md`.
>
> Ghi nhận khi làm (khác kế hoạch):
>
> - **0090 ĐÃ nằm trên remote từ trước** (ghi chú memory cũ lỗi thời) — 0.1
>   chỉ còn là kiểm tra, không phải apply.
> - Cả 3 bảng dính 0165 **RỖNG trên remote** → drop không cần backfill.
> - 0165 phải **dựng lại `v_order_tracking`** (view chặn drop cột) — tiện thể
>   sửa bug tiềm ẩn: `jobs_total/jobs_done` join cột cũ nên đếm 0 với mọi job
>   tạo sau 0114; join mới đi qua `production_order_lines`.
> - Perf overview: fix thật nằm ở chỗ khác kế hoạch — `overview` gọi
>   `loadActiveContext` nên nạp cả components + entries bulk mà KHÔNG dùng;
>   nay gọi thẳng listActive + jobs. `listActive` giữ limit 500 sẵn có.
> - `assertAction` cho overview **KHÔNG làm** — comment ở
>   `production/page.tsx` ghi rõ user đã chốt "chỉ tách UI, không chặn quyền".

---

## GĐ 0 — Dọn nền

### 0.1 Xác nhận 0090 đã apply remote

Ghi chú cũ (memory) nói `0090_production_transfers_worker.sql` **chưa apply
remote**, nhưng UI giao tổ/`finish_state` đã dựng xong — có thể đã apply đợt
sau mà không ghi lại. Kiểm trước khi làm gì khác:

```
npx supabase migration list      # hoặc MCP list_migrations
```

Nếu thiếu → apply (MCP `apply_migration` — CLI từng lỗi IPv6) → chạy skill
`sync-types`.

### 0.2 Migration dọn nợ 0114 — `0165_production_drop_order_line_id.sql`

`0114_lsx_groups_lines.sql` (cuối file) đã hẹn mà chưa làm. Hiện
`production_jobs` và `production_components` mang **2 cột trỏ dòng SP song
song** (`order_line_id` cũ nullable + `production_order_line_id` mới) — query
mới rất dễ join nhầm cột chết.

**Trước khi viết migration:** grep `order_line_id` (đúng chuỗi, phân biệt với
`production_order_line_id`) trên `src/` — phải 0 tham chiếu ngoài types gen.
Còn tham chiếu thì sửa code trước, migration sau.

```sql
-- 0165_production_drop_order_line_id.sql
-- Dọn nợ 0114: bỏ cột trỏ dòng-đơn kiểu cũ (BỎ DÙNG từ 0114, thay bằng
-- production_order_line_id) + bảng specs cũ. Không đụng RLS (chỉ drop).
-- Idempotent: drop ... if exists.
alter table production_jobs       drop column if exists order_line_id;
alter table production_components drop column if exists order_line_id;
drop table if exists production_order_line_specs;
```

Sau apply: `sync-types`. Chạy `npm run check` — types gen đổi có thể làm lộ
chỗ nào còn đọc cột cũ.

**Khối lượng GĐ 0:** nửa buổi.

---

## GĐ 1 — Toàn cảnh xưởng thành dashboard thật

**Vấn đề.** `jobsService.overview` (jobs.service.ts:324–397) chỉ đọc lệnh +
jobs — **không chạm `production_entries`**, nên màn Toàn cảnh không có số
sản lượng/phế/kg nào. Vật tư chỉ có badge "Chưa nhận vật tư"
(`materials_received_at is null`, OverviewScreen.tsx:212) — không biết thiếu
gì, bao nhiêu, hẹn về khi nào. Quản đốc mở hồ sơ lệnh cũng không thấy panel
vật tư/PO (LsxDetailScreen.tsx:61 chỉ mở cho shell `exec`/`planning`).

**Không cần migration** — mọi số liệu đã nằm sẵn trong DB.

### 1.1 KPI sản lượng hôm nay

Service: thêm block vào kết quả `jobsService.overview` (hoặc method riêng
`entriesService.todayPulse()` gọi song song từ page — chọn lúc code, ưu tiên
đường nào ít đụng type `OverviewData` hơn):

- Nguồn `production_entries` với `entry_date = hôm nay` (đã có index
  `production_entries_date_idx (entry_date, team_department_id)`):
  - Σ `qty` đạt, Σ `kg`, Σ `defect_qty` toàn xưởng.
  - Nhóm theo `team_department_id`: SL đạt / phế từng tổ.
- Nguồn `production_day_locks` với `entry_date = hôm nay`: tổ nào đã chốt sổ.
  KPI "Tổ chốt sổ x/y" (y = số tổ CÓ việc doing hôm nay, không phải mọi tổ).
- **Múi giờ**: "hôm nay" phải theo giờ VN, không phải UTC của server — dùng
  cùng cách lấy ngày mà `entriesService.record`/FastEntryGrid đang dùng khi
  ghi `entry_date` (soi lại lúc code, tránh lệch ngày sau 17h).

UI (OverviewScreen): thêm hàng KPI thứ hai vào StatsBar hiện có (đừng đẻ
component mới): `SL hôm nay · Kg · Phế · Tổ chốt sổ`. Số dùng `t-data`
(mono, tabular-nums). Panel "Tải việc theo tổ" (:253–276) thêm 2 cột SL đạt /
phế hôm nay cạnh todo/doing/done.

### 1.2 Cảnh báo vật tư định lượng

Thay badge có/không bằng số liệu thật, cho lệnh `approved`/`in_progress`
chưa `materials_received_at`:

- Đọc `v_lsx_material_status` (0142) theo `production_order_id`: đếm số vật
  tư còn `qty_remaining > 0` + tổng còn thiếu. Badge thành
  **"Thiếu 4 vật tư"** (thay "Chưa nhận vật tư").
- So `materials_due_at` với hôm nay: quá hẹn → badge chuyển sắc `--warn` kèm
  "trễ hẹn N ngày". KPI đầu trang thêm ô **"Chờ vật tư: n lệnh (m trễ hẹn)"**
  — bấm lọc như các KPI khác (pattern lọc all/late/plan_overdue/no_plan có
  sẵn, OverviewScreen.tsx:138–150).
- **Hiệu năng**: 1 query view cho CẢ danh sách lệnh active (in-list), gom
  client theo `production_order_id` — không N+1 per lệnh.

### 1.3 Panel vật tư/PO cho quản đốc trong hồ sơ lệnh

`LsxDetailScreen.tsx:61–86`: mở panel Cung ứng/BOM cho variant `production`,
**read-only** — thấy danh sách PO + trạng thái vật tư, KHÔNG thấy nút "chốt
lại định mức" (`resnapBom` giữ nguyên chỉ `exec`/`planning`). Cân nhắc giấu
cột giá nếu panel hiện giá mua (quản đốc không cần giá — soi lại component
lúc code; Kho đã được thấy giá theo 0161/0162 nhưng đó là người kho).

### 1.4 Giới hạn dữ liệu overview

`productionRepo.listActive()` đang nạp toàn bộ rồi lọc client-side. Sửa mức
tối thiểu: order theo (trễ hạn trước, rồi `ship_date` gần nhất), limit ~100 +
đếm tổng để KPI vẫn đúng. Chưa cần phân trang đầy đủ — số lệnh active thực tế
vài chục.

### Quyền

`jobsService.overview` đang bỏ qua `_user` (jobs.service.ts:323, có
eslint-disable) — tiện tay thêm `assertAction` cùng action mà layout
workspace `production` đang gác (soi `perms.ts` của module). Đây cũng là mục
GĐ 5, làm luôn ở đây nếu không phát sinh tranh cãi quyền.

### Test

- Logic thuần tách được (gom KPI ngày từ mảng entries, đếm tổ chốt sổ, phân
  loại badge vật tư theo `qty_remaining`/`materials_due_at`) → unit test
  co-located.
- UI verify tay: seed 1 lệnh thiếu vật tư + 1 lệnh trễ hẹn vật tư + entries
  hôm nay ở 2 tổ, soi 3 KPI mới + badge + panel PO ở shell production.

### Khối lượng

GĐ 1: ~2 buổi (service 1 buổi, UI + test 1 buổi).
