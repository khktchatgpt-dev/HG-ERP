# Ma trận truy vết: Requirement (SRS v1.0) ↔ Database (migration 0001–0016)

Rà sau khi apply `0011`–`0016` (07/2026). Ký hiệu cột **Mức đáp ứng**:
- **DB** — ràng buộc ép ngay ở schema (constraint/FK/unique/check).
- **DB đủ, app thực thi** — schema chứa đủ dữ liệu, quy tắc chặn ở service/UI
  (đúng chủ trương: validate ở API, service giữ nghiệp vụ).
- **GĐ2/GĐ3** — chủ đích để sau theo phân kỳ SRS mục 8 (không phải thiếu sót).
- ⚠️ — gap thật, có ghi chú xử lý.

## Kinh doanh (FR-SAL) — GĐ1: 01–07

| FR | Yêu cầu (rút gọn) | Schema | Mức |
|---|---|---|---|
| SAL-01 | Hồ sơ KH + lịch sử đơn | `sales_customers` (0005) + `sales_orders.customer_id` | DB |
| SAL-02 | Báo giá nhiều dòng SP | `sales_quotes` + `sales_quote_lines` (product_id, qty, unit_price) | DB |
| SAL-03 | Duyệt báo giá; chỉ BG duyệt mới thành đơn | `status pending→approved` + `approved_by/at`; chặn ở service (BR-04) | DB đủ, app thực thi |
| SAL-04 | Đơn từ BG đã duyệt, nhiều dòng | `sales_orders.quote_id NOT NULL FK` + `sales_order_lines` | DB |
| SAL-05 | Sửa đơn + lịch sử thay đổi | `sales_order_changes` (change jsonb, changed_by) | DB |
| SAL-06 | Phát LSX 1 đơn = 1 LSX, GĐ xác nhận | `production_orders.sales_order_id UNIQUE NOT NULL` + `issued_by/issued_at` | **DB (BR-01 ép cứng)** |
| SAL-07 | Trạng thái tổng hợp (chờ vẽ/chờ VT/đang SX…) | view `v_order_tracking` (status + lines_bom_pending + pos_open + current_stage) | DB |
| SAL-08 | Công nợ tổng của khách | — | GĐ2 (FR-ACC) |
| SAL-09 | Cảnh báo trễ/thiếu vật tư | đầu vào có sẵn: `due_date`, `ship_date`, `pos_open`, `qty_missing`; logic cảnh báo = app/notifications | DB đủ, app thực thi (GĐ2 "Nên có") |

## Kỹ thuật (FR-ENG) — GĐ1: 01–05

| FR | Yêu cầu | Schema | Mức |
|---|---|---|---|
| ENG-01 | Thư viện SP theo khách | `technical_products.customer_id` (null = mẫu chung) | DB |
| ENG-02 | Tái sử dụng mẫu khi đặt lại | chọn lại `product_id` cũ trong quote/order line — schema không cản | DB đủ (UI) |
| ENG-03 | File kỹ thuật nhiều loại, theo phiên bản | `files.product_id` (BOM Excel/CAD/ảnh/PDF); phiên bản = nhiều file cùng parent theo `created_at`, không xoá | DB đủ ⚠️ xem G-4 |
| ENG-04 | Bóc tách/cập nhật BOM per SP | `technical_bom_lines` (material_id = mã kho, qty_per_unit) | DB |
| ENG-05 | Cờ BOM per SP, phòng khác nhìn thấy | `technical_products.bom_status` (none/drawing/done) — đúng mức SP, không phải LSX (BR-03) | DB |
| ENG-06 | Tìm theo mã SP/khách/đơn | index `code`/`customer_item_code`/`name`; đơn→SP qua `sales_order_lines` | DB đủ (GĐ2 "Nên có") |

## Kế hoạch & Cung ứng (FR-SUP) — GĐ1: 01–08 (trừ 09)

| FR | Yêu cầu | Schema | Mức |
|---|---|---|---|
| SUP-01 | Từ LSX + BOM ra nhu cầu VT; cho đặt thủ công khi chưa BOM | `technical_bom_lines` × `sales_order_lines.qty` (tính được); `po_lines` không ràng BOM (BR-07) | DB đủ |
| SUP-02 | Nhiều PO / 1 LSX; mỗi PO = 1 NCC + 1 LSX | `supply_purchase_orders.production_order_id` + `supplier_id` đều `NOT NULL FK` | **DB (BR-06 ép cứng)** |
| SUP-03 | GĐ duyệt trước khi gửi NCC | `status pending_approval→approved→ordered` + `approved_by/at`; service chặn nhảy trạng thái (BR-05) | DB đủ, app thực thi |
| SUP-04 | Trạng thái từng đơn đặt | enum status đủ chuỗi đặc tả: ordered/confirmed/in_transit/partial/received | DB |
| SUP-05 | Còn thiếu từng dòng = đặt − nhận | view `supply_po_line_status` tính từ sổ cái, không denorm (BR-08) | DB |
| SUP-06 | Quản lý NCC: thông tin, lịch sử mua, **bảng giá** | `supply_suppliers` + lịch sử = PO theo supplier; **bảng giá NCC chưa có bảng riêng** | ⚠️ xem G-1 |
| SUP-07 | Hồ sơ mua hàng gắn LSX/đơn đặt | `files.purchase_order_id` (0016) | DB (GĐ2 "Nên có" — đã làm sớm) |
| SUP-08 | Tiến độ SX theo giai đoạn từng LSX | `production_orders.current_stage` + `production_progress` | DB |
| SUP-09 | Chi tiết từng người thợ | `production_progress` chờ thêm cột worker/qty/hours | GĐ3 (đường mở sẵn) |

## Kho (FR-WMS) — GĐ1: tất cả trừ 08/10 "Nên có"

| FR | Yêu cầu | Schema | Mức |
|---|---|---|---|
| WMS-01 | Danh mục VT (mã, ĐVT, nhóm, tồn min, vị trí kệ) | `warehouse_materials` (0009) | DB |
| WMS-02 | Nhập theo đơn, về từng phần / về đủ | `movements.po_line_id` + view `supply_po_line_status` | DB |
| WMS-03 | QC khi nhận; không đạt → ghi chú + trừ | `qty` (đạt) / `qty_rejected` / `qc_status` — loại QC không vào tồn (BR-10) | DB |
| WMS-04 | Nhập mua ngoài không theo đơn | `ref_type = 'external'` | DB |
| WMS-05 | Xuất theo đơn gắn LSX; đã xuất / còn tồn theo đơn | `movements.production_order_id` + check `warehouse_movements_lsx_link_check` (BR-09); "cần vs đã xuất" tính từ BOM×SL − out theo LSX | DB ⚠️ xem G-2 |
| WMS-06 | Xuất thường ngày, chỉ trừ tồn | `ref_type = 'daily'` (không gắn LSX) | DB |
| WMS-07 | Tồn realtime, theo vị trí | view `warehouse_stock` (sổ cái, không denorm) + `shelf_location` | DB |
| WMS-08 | Cảnh báo tồn < min → đề xuất Cung ứng | `min_stock` + `on_hand` so sánh được; đề xuất = notifications/event bus | DB đủ, app thực thi |
| WMS-09 | Máy scan mã | tra `code unique` — scan là thiết bị/UI | DB đủ |
| WMS-10 | Mở rộng nhiều kho | `warehouses` + `movements.warehouse_id` (backfill MAIN) | DB |

Ngoài SRS, mẫu in 1C bổ sung: điều chuyển (`ref_type='transfer'` + `transfer_group`),
kiểm kê (`ref_type='adjust'` — OI-08), giá trị phiếu (`unit_cost`, UI ẩn) — đã chừa sẵn.

## Xưởng (FR-PROD)

| FR | Yêu cầu | Schema | Mức |
|---|---|---|---|
| PROD-01 | Cập nhật giai đoạn LSX | `current_stage` + `production_progress` (log start/done) | DB |
| PROD-02 | Xác nhận đã nhận VT xuất kho theo LSX | movements out có `production_order_id`; **chưa có chỗ ghi "xưởng đã nhận"** | ⚠️ xem G-3 (GĐ2 "Nên có") |
| PROD-03 | Báo hoàn thành → giao hàng | `production_orders.status='completed'` → orders.status | DB |
| PROD-04 | Chi tiết từng người thợ | như SUP-09 | GĐ3 |

## Kế toán (FR-ACC), Nhân sự (FR-HR) — toàn bộ "Nên có" GĐ2

Đúng phân kỳ đã chốt (trục vận hành trước): chưa dựng bảng công nợ/khoản vay/hợp
đồng. Nền có sẵn: `accounting_invoices` (giữ nguyên), đơn bán/PO đều có
`currency` + giá trị dòng → gắn công nợ vào trục là việc GĐ2, không phải làm lại.
HR: `hr_leave_requests`, `users` (+ `files` mở thêm parent khi cần lưu hồ sơ).

## Quản trị & Phê duyệt (FR-ADM)

| FR | Yêu cầu | Schema | Mức |
|---|---|---|---|
| ADM-01 | Tài khoản, vai trò, phân quyền | `users.role` + `src/server/permissions.ts` (RLS no-policy, authz tại app) | DB đủ, app thực thi |
| ADM-02 | Quản lý xem chéo read-only | phân quyền app (`can()`) — không cần schema | app |
| ADM-03 | Màn duyệt tập trung (BG + mua VT) | partial index `status='pending'` / `'pending_approval'` trên 2 bảng — query màn GĐ nhanh; không bảng approvals riêng (YAGNI, đã chốt) | DB |
| ADM-04 | Danh mục dùng chung | `catalog_items` (unit/material_group/production_stage/contract_type) + seed | DB |
| ADM-05 | Audit log nghiệp vụ quan trọng | `activity_log` + event bus (mẫu tasks đã có); duyệt/nhập/xuất/sửa đơn emit event | DB đủ, app thực thi |

## Business Rules (BR-01…11)

| BR | Nơi thực thi | Kiểm chứng |
|---|---|---|
| BR-01 đơn↔LSX 1-1 | **DB**: `production_orders.sales_order_id UNIQUE NOT NULL` | insert LSX thứ 2 cùng đơn → lỗi unique |
| BR-02 LSX cụm SP | dùng chung `sales_order_lines` | không nhân bản dòng |
| BR-03 BOM per-SP | **DB**: `bom_status` trên products (không phải LSX) | — |
| BR-04 duyệt BG trước đơn | service (`quote.status='approved'` mới cho tạo order) | cần **test service** khi build module |
| BR-05 duyệt PO trước gửi | service (chỉ `approved` → `ordered`) | cần **test service** |
| BR-06 PO = 1 LSX + 1 NCC | **DB**: 2 FK NOT NULL | insert thiếu → lỗi |
| BR-07 phát LSX không cần đủ BOM | không có ràng buộc chặn — đúng chủ đích | — |
| BR-08 thiếu = đặt − nhận | **view** `supply_po_line_status` (nguồn sự thật là sổ cái) | — |
| BR-09 xuất LSX phải gắn LSX | **DB check** `warehouse_movements_lsx_link_check` (NOT VALID cho data cũ) | insert `ref_type='lsx'` thiếu FK → lỗi |
| BR-10 QC loại không vào tồn | **DB + view**: chỉ `qty` đạt cộng `on_hand` | đã có test warehouse |
| BR-11 truy vết từ đơn ra cả chuỗi | chuỗi FK: order→quote / →LSX (unique) →PO→po_line→movements; files 8 parent | join thông suốt, không nhánh đứt |

## Gaps thật (4) — không cái nào chặn GĐ1

| # | Gap | Đề xuất |
|---|---|---|
| G-1 | FR-SUP-06 "bảng giá NCC": chưa có bảng giá chào theo vật tư/NCC; hiện chỉ tra được lịch sử giá từ `supply_purchase_order_lines.unit_price` | GĐ2: thêm `supply_supplier_prices` (supplier_id, material_id, price, valid_from). Trong lúc chờ, flow Excel "BÁO GIÁ NCC" hiện tại vẫn chạy song song |
| G-2 | FR-WMS-05 "đơn cần 4 ốc → đã xuất bao nhiêu": dữ liệu đủ (BOM×SL đơn − out theo LSX) nhưng chưa có view tổng hợp | Thêm view `v_lsx_material_status` khi build UI kho/xưởng — chỉ thêm view, không đổi bảng |
| G-3 | FR-PROD-02 (Nên có): chưa có chỗ ghi "xưởng xác nhận đã nhận vật tư" | GĐ2: dùng `production_progress` (action mới `received`) hoặc thêm `received_by/received_at` vào movements — đều chỉ thêm, không phá |
| G-4 | NFR-03 "file theo phiên bản": mới là dạng "nhiều file cùng parent, không xoá", chưa có chain version tường minh | GĐ1 chấp nhận (đã chốt ở db-design-erp.md §4); GĐ2 nếu cần: thêm `files.replaces_file_id` |

## Kết luận

- **GĐ1 (Bắt buộc): 29/29 FR có chỗ đứng trong schema** — trong đó các quy tắc
  xương sống (BR-01, BR-06, BR-09, BR-10) ép ngay ở DB, phần còn lại schema đủ
  dữ liệu và chờ service/UI thực thi đúng chủ trương validate-tại-API.
- Tiêu chí nghiệm thu end-to-end (SRS §7) đi được trọn chuỗi trên schema:
  quote → duyệt → order → LSX → PO → duyệt → nhập (QC) → xuất theo LSX → tiến độ → hoàn thành.
- 4 gap ghi nhận đều thuộc mức "Nên có"/GĐ2 hoặc chỉ cần thêm view; không gap
  nào yêu cầu đổi cấu trúc bảng đã apply.
- Việc còn lại để "đáp ứng" trọn: viết **service tests** cho BR-04/BR-05 khi
  build module sales/supply (DB không ép 2 rule này — chủ đích).
