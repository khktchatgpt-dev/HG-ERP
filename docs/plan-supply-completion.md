# Kế hoạch hoàn thiện Kế hoạch & Cung ứng — đợt 2 (bảng giá NCC + cảnh báo + nhận VT)

> **✅ P1 + P2 + P3 HOÀN THÀNH 07/2026** — migration 0034/0035 đã apply + sync
> types; module `prices` (repo/service/routes + test giá hiện hành); modal Bảng
> giá ở `/planning/suppliers`; so giá + autofill đơn giá trong form tạo PO;
> `src/lib/late-risk.ts` (pure + test) với badge/lọc ⚠ ở tracking + widget
> sales/planning; nút "Đã nhận vật tư" trên chi tiết LSX. Traceability: G-1,
> G-3, SAL-09, SUP-06, PROD-02 đã chuyển ✅. **Còn lại P4** — chờ doanh nghiệp
> trả lời OI-08/09/10.

Lập 07/2026, sau khi khép chuỗi vận hành end-to-end (07/2026: tách nav Thu mua /
Kế hoạch SX, trang `/planning/production`, quyền tiến độ cho phòng KH-CƯ, bước
Giao hàng `completed → delivered`). Còn lại 3 mảnh chủ động làm được + 1 cụm chờ
doanh nghiệp chốt.

## Đã có sẵn (không phải làm lại)

- Chuỗi chạy trọn trên UI: đơn → LSX → duyệt → PO → duyệt → gửi NCC → Kho nhập
  (QC) → xuất theo LSX → tiến độ → hoàn thành → **xác nhận đã giao**.
- **Lịch sử giá mua** tra được từ `supply_purchase_order_lines.unit_price`
  (traceability G-1 ghi nhận: mới có lịch sử, chưa có bảng giá chào).
- **Đầu vào cảnh báo** (FR-SAL-09) nằm sẵn trong `v_order_tracking`: `due_date`,
  `ship_date`, `lines_bom_pending`, `pos_open`, `lsx_status`; nhu cầu thiếu theo
  LSX qua API `lsx-needs`.
- `production_progress` log start/done — G-3 chỉ cần nới check + nút UI.

## P1 — Bảng giá NCC (G-1, FR-SUP-06) — ~1.5 ngày

1. **Migration `0034_supply_supplier_prices.sql`** (theo chuẩn add-migration):
   - Bảng `supply_supplier_prices`: `id`, `supplier_id` FK → suppliers
     (on delete cascade — giá là dữ liệu con của NCC), `material_id` FK →
     warehouse_materials (on delete restrict), `price numeric(18,2) check >= 0`,
     `currency char(3) default 'VND'` (NCC ngoại ghi nguyên tệ — khớp OI-02/12:
     không quy đổi), `valid_from date not null`, `note`, `created_by`,
     timestamps + trigger `set_updated_at`.
   - `unique (supplier_id, material_id, valid_from)`; index theo `material_id`
     (màn so giá tra theo vật tư). RLS **enable, no policies**.
   - "Giá hiện hành" = bản ghi có `valid_from` lớn nhất ≤ hôm nay per cặp
     (NCC, vật tư) — không xoá lịch sử.
2. **Module** `src/modules/dept/supply/prices.repo.ts` + mở rộng service:
   CRUD cho phòng KH-CƯ (guard `isSupplyStaff` — dùng lại, đừng chép chuỗi tên
   phòng); đọc: mọi NV. API `/api/dept/supply/prices` (GET theo
   material/supplier, POST) + `[id]` (PATCH/DELETE).
3. **UI**:
   - Nút **"Bảng giá"** trên mỗi NCC ở `/planning/suppliers` → modal quản lý
     giá (vật tư, giá, tiền tệ, hiệu lực từ, lịch sử).
   - **So giá khi tạo PO** (`PosManager`): mỗi dòng vật tư hiện giá chào hiện
     hành của các NCC + giá mua gần nhất (PO cũ); chọn NCC → autofill
     `unit_price` từ bảng giá (sửa tay được).
4. **Test bắt buộc** (logic tiền): chọn đúng giá hiện hành theo `valid_from`,
   không lấy giá tương lai; quyền sửa chỉ KH-CƯ.
5. Flow Excel "BÁO GIÁ NCC" hiện tại vẫn chạy song song — nhập dần vào bảng.

## P2 — Cảnh báo trễ / thiếu vật tư (FR-SAL-09) — ~1 ngày

Thuần đọc, **không cần bảng mới**:

1. **Quy tắc "nguy cơ trễ"** (derive từ `v_order_tracking`, tính ở service):
   đơn chưa `completed/delivered/cancelled` và `due_date` ≤ 7 ngày nữa (hằng số,
   sau này đưa vào settings), độ nặng tăng khi: BOM chưa xong
   (`lines_bom_pending > 0`), vật tư chưa về đủ (`pos_open > 0`), LSX chưa
   duyệt / chưa vào sản xuất.
2. **UI**: badge ⚠ + bộ lọc "Nguy cơ trễ" ở `/sales/tracking`; widget "Đơn nguy
   cơ trễ" ở trang chủ `/planning` và `/sales`.
3. **Notification đẩy chưa làm đợt này** — cảnh báo theo thời gian cần hạ tầng
   cron (gap G5 trong erp-readiness-assessment). Ghi nhận 2 phương án cho GĐ2:
   Vercel Cron hoặc `pg_cron` gọi `/api/jobs/late-orders` với secret token.

## P3 — Xưởng xác nhận đã nhận vật tư (G-3, FR-PROD-02) — ~0.5 ngày

1. **Migration `0035_production_progress_received.sql`**: nới check
   `production_progress.action` từ `('start','done')` →
   `('start','done','received')` (drop constraint if exists + add — idempotent).
2. **Service**: `updateStage` nhận action `received` — chỉ ghi log (không đổi
   `current_stage`/`status`); guard `canTrackProgress` dùng lại.
3. **UI** `LsxDetailView`: nút "Xác nhận đã nhận vật tư" (hiện khi `canManage`,
   LSX đã duyệt) kèm ghi chú; hiện trong timeline tiến độ. Chưa có workspace
   Xưởng nên Cung ứng/GĐ bấm thay — đúng vai FR-SUP-08.

## P4 — Chờ doanh nghiệp chốt (OI-08/09/10) — ~1–1.5 ngày nếu đều "Có"

Gửi `docs/open-issues-cau-hoi.md` cho Hoàng Gia; khi có trả lời:
- **OI-08** kiểm kê kho → form đếm thực tế + phiếu chênh lệch (DB sẵn `adjust`).
- **OI-09** phiếu điều chuyển in được (DB sẵn `transfer` + `transfer_group`).
- **OI-10** ĐVT kép → nếu đổi cách tính thành tiền theo ĐVT phụ, sửa công thức
  PO line (nhỏ). Bảng giá P1 tạm ghi giá theo ĐVT chính của vật tư.

## Thứ tự & tổng ước lượng

P1 → P2 → P3 tuần tự (~3 ngày); P4 chạy khi có câu trả lời. Sau mỗi phase:
`npm run check` sạch + cập nhật `docs/db-requirements-traceability.md`
(G-1, SAL-09, G-3 chuyển ✅) + sync types nếu có migration.

## Rủi ro / lưu ý

- Guard tên phòng: luôn import `isSupplyStaff` — không chép chuỗi
  `"Kế Hoạch Sản Xuất-cung ứng"` ra chỗ mới (bug cũ đã vá 2 lần).
- Bảng giá đa tiền tệ: chỉ hiển thị nguyên tệ, KHÔNG quy đổi khi so giá khác
  tiền tệ (ghi chú rõ trên UI) — nhất quán OI-02/OI-12.
- P2 chỉ hiển thị, không đẩy notification — tránh nửa vời: hoặc có cron tử tế
  (GĐ2) hoặc chưa có gì, không tự bịa cơ chế "gần đúng".
