# Kế hoạch hoàn thiện phân hệ Quản lý Kho (FR-WMS-01..10)

> **✅ Phase 0–3 + 5 HOÀN THÀNH 07/2026** (0017/0019 + module + UI + in + scan +
> cảnh báo tồn min — xem commit `feat(warehouse)`). **Phase 4 (điều chuyển DCK /
> kiểm kê KK) đang chờ chốt OI-08/09** — schema đã sẵn (`ref_type` transfer/adjust,
> `transfer_group`, doc kind), chỉ cần thêm form khi doanh nghiệp xác nhận.
> Flow 1 dòng cũ (StockManager) giữ nguyên hoạt động song song với phiếu nhiều dòng.

Lập 07/2026, sau khi schema GĐ1 (0011–0016) đã apply. Mục tiêu: đưa Kho từ mức
"nhập/xuất đơn lẻ, tham chiếu text" lên **đúng chuẩn ERP đã thiết kế**: phiếu
nhiều dòng có số chứng từ, nối FK với PO/LSX, in được mẫu 01-VT/02-VT, scan,
cảnh báo tồn.

## Hiện trạng vs đích

| Mảng | Đang có | Đích |
|---|---|---|
| Danh mục VT (WMS-01) | ✅ CRUD + UI `MaterialsManager` | giữ, thêm ô quét mã |
| Nhập kho (WMS-02/03/04) | 1 dòng/lần, `ref_type/ref_no` text, QC qty/qty_rejected | **Phiếu PNK nhiều dòng**, chọn PO → dòng còn thiếu, tự cập nhật trạng thái PO partial/received |
| Xuất kho (WMS-05/06) | 1 dòng/lần, guard tồn, ref text | **Phiếu PXK nhiều dòng**, gắn `production_order_id` thật (BR-09), gợi ý nhu cầu từ BOM |
| Tồn (WMS-07) | ✅ view `warehouse_stock` + UI | thêm lọc dưới min + vị trí |
| Cảnh báo tồn min (WMS-08) | ❌ | event bus → notification cho Cung ứng |
| Scan (WMS-09) | ❌ | ô quét (scanner = bàn phím) tra tồn + autofill dòng phiếu |
| Nhiều kho (WMS-10) | cột `warehouse_id` đã backfill MAIN | service luôn ghi MAIN, UI ẩn |
| Điều chuyển / kiểm kê | schema sẵn (`transfer`/`adjust`) | phiếu DCK/KK — chờ chốt OI-08/09 |
| In phiếu | ❌ | mẫu 01-VT/02-VT + số phiếu `PNK-2026-0001` (`next_doc_code`) |

**Thiếu cấu trúc duy nhất**: movements là sổ cái *từng dòng*, chưa có khái niệm
**phiếu** (nhiều dòng, số chứng từ, người giao/nhận) để in. → thêm bảng header.

## Phase 0 — Nền & chốt scope (0.5 ngày)

1. Commit mốc schema GĐ1 (0011–0016 + docs + types) trước khi build.
2. **Migration 0017** `warehouse_docs`:
   ```sql
   warehouse_docs (
     id uuid PK, code text unique,          -- PNK-/PXK-/DCK-/KK-2026-NNNN
     kind text check in ('receipt','issue','transfer','stocktake'),
     doc_date date default today,
     counterparty text,                      -- người giao/nhận (mẫu 01/02-VT)
     reason text,                            -- lý do xuất / ghi chú phiếu
     created_by uuid FK users, created_at, updated_at
   )
   alter warehouse_movements + doc_id uuid FK warehouse_docs on delete set null;
   ```
   Sổ cái vẫn là movements (không đổi triết lý); docs chỉ là header gom dòng để in.
   Gộp luôn 2 vá bảo mật cũ: `settings` enable RLS, `v_task_summary` security_invoker.
3. Hỏi doanh nghiệp OI-08/09 (kiểm kê, điều chuyển có cần GĐ1?) → quyết Phase 4.

## Phase 1 — Nâng module backend lên schema 0015 (1–1.5 ngày)

`src/modules/dept/warehouse/` (schema + repo + service):

- **Zod mới**: phiếu nhập = `{ counterparty?, note?, po_id?, lines: [{material_id,
  qty, qty_rejected, qc_status, po_line_id?, shelf_location?}] }`; phiếu xuất
  tương tự với `production_order_id?` (bắt buộc khi `ref_type='lsx'` — khớp check
  DB) và `lines[]`. Giữ schema cũ 1 dòng cho backward compat API nếu cần.
- **Service `createReceipt`**: sinh `code = next_doc_code('PNK')` → insert doc →
  insert N movements (`warehouse_id` = MAIN, `doc_id`, `po_line_id`); nếu theo PO:
  đối chiếu `supply_po_line_status.qty_missing` (cảnh báo nhập vượt đặt),
  sau ghi → tính lại toàn PO: mọi dòng missing ≤ 0 → status `received`, ngược
  lại `partial`.
- **Service `createIssue`**: guard tồn từng dòng (giữ logic cũ), gắn
  `production_order_id`, code `PXK`.
- **Event bus** (đúng convention CLAUDE.md — không gọi chéo service):
  `warehouse.receipt.created` (Cung ứng nhận notify "hàng về"), 
  `warehouse.stock.low` sau mỗi lần xuất nếu `on_hand < min_stock` (WMS-08).
  Handler ở `src/events/handlers/warehouse.notifications.ts`.
- **Tests bắt buộc** (logic tiền/tồn — theo quy định repo): nhập theo PO cập nhật
  đúng partial/received; QC loại không vào tồn (BR-10); chặn xuất quá tồn;
  xuất LSX thiếu `production_order_id` bị chặn; mã phiếu sinh tuần tự.

## Phase 2 — UI nghiệp vụ (ERP kit, 1.5–2 ngày)

Trang mới trong `(workspace)/warehouse/` (dùng skill `add-erp-page`, mẫu
`ProductsManager`):

- **/warehouse/receipts** — lập phiếu nhập: chọn nguồn *Theo đơn đặt* (dropdown
  PO đang mở → tự đổ các dòng còn thiếu, sửa số thực nhập + QC per dòng) hoặc
  *Mua ngoài* (thêm dòng tự do). Submit → toast + nút "In phiếu".
- **/warehouse/issues** — lập phiếu xuất: *Theo LSX* (chọn LSX → gợi ý nhu cầu
  BOM×SL trừ đã xuất) hoặc *Thường ngày*. Guard tồn hiển thị ngay trên dòng.
- **/warehouse/docs** — danh sách phiếu (lọc loại/ngày/người tạo) + drill-down
  dòng; sổ kho movements giữ trong tab.
- **/warehouse/stock** — bổ sung: cột min_stock + badge "Dưới mức", lọc
  `low_only`, cột vị trí kệ.

## Phase 3 — In phiếu & scan (1 ngày)

- **In phiếu** route `/warehouse/docs/[id]/print`: server component render HTML
  + print CSS theo mẫu **01-VT / 02-VT** (đã có ảnh mẫu chuẩn trong
  `Mẫu in.pdf`): số phiếu, 2 cột "SL theo chứng từ / thực nhập" (chứng từ =
  qty_ordered dòng PO), người giao/nhận, chữ ký. `unit_cost` ẩn GĐ1.
- **Scan (WMS-09)**: máy quét = keyboard wedge → ô input focus-trap ở trang
  stock (quét → nhảy tới vật tư, hiện tồn) và trong form phiếu (quét → thêm
  dòng đúng vật tư). Không cần lib ngoài.
- **View `v_lsx_material_status`** (gộp vào 0017 hoặc 0018): cần theo
  BOM × SL đơn − đã xuất theo LSX (đóng gap G-2, phục vụ màn xuất theo LSX).

## Phase 4 — Điều chuyển & kiểm kê (0.5–1 ngày, chạy nếu OI-08/09 = cần)

- **Điều chuyển (DCK)**: phiếu kind `transfer` → cặp movement out/in cùng
  `transfer_group` (đổi vị trí kệ hoặc kho sau này).
- **Kiểm kê (KK)**: nhập số đếm thực tế theo danh sách vật tư → sinh movement
  `adjust` bằng chênh lệch (+ vào / − ra), phiếu in đối chiếu thực tế vs sổ.

## Phase 5 — Chốt sprint (0.5 ngày)

- `npm run check` sạch + chạy `check-rls` (advisor) + sync types nếu có 0017/0018.
- Cập nhật `docs/db-requirements-traceability.md`: WMS-08/09 và G-2 chuyển ✅.
- Demo luồng end-to-end: (seed 1 PO) → nhập theo PO có QC → PO thành received →
  xuất theo LSX → tồn cập nhật → in 2 phiếu.

## Phụ thuộc & rủi ro

- **Nhập theo PO / xuất theo LSX cần dữ liệu PO/LSX** — module Cung ứng & Sales
  chưa build UI. Không chặn: Phase 1–3 test bằng seed SQL; flow "mua ngoài" và
  "thường ngày" dùng được ngay. Khi sprint Sales/Supply xong, các dropdown tự
  có dữ liệu thật.
- Quyền: hiện `canEdit` = admin/manager — giữ nguyên GĐ1, rà lại khi làm ma trận
  phân quyền FR-ADM.
- Thứ tự ưu tiên nếu cần rút gọn: Phase 1 → 2 → 3 là lõi; Phase 4 hoãn được.

**Tổng ước lượng: ~5–6 ngày làm việc** (không tính chờ chốt OI-08/09).
