# Kế hoạch hoàn thiện phân hệ Kinh doanh (Sales) & Kỹ thuật

> **✅ HOÀN THÀNH 07/2026** — T1/T2/T3 + S1/S2/S3/S4/S5 đã build đủ (xem git log
> các commit `feat(technical)`/`feat(sales)`/`feat(production)`/`feat(exec)`).
> Ghi chú lệch so với plan: notify đổi cờ BOM (T2) hoãn — SRS chỉ yêu cầu hiển
> thị cờ; ảnh SP trên bản in (S4) chờ chọn "ảnh đại diện" ở GĐ sau; OI-11 (ai
> nhập spec in LSX) vẫn chờ chốt — form spec sẽ làm trong sprint Cung ứng/SX.

Lập 07/2026. Schema nền đã có đủ (0012 products/BOM, 0013 quotes/orders, 0014
LSX, 0016 files) — sprint này là **module + UI + luồng duyệt + in ấn**.

## Hiện trạng

| Phân hệ | Đã có | Chưa có |
|---|---|---|
| Kỹ thuật | CRUD sản phẩm (cột cũ: code/name/category/URL), trang `technical/products`, `load-cont` | Thư viện theo khách, cờ BOM, packing XK, **BOM editor**, file kỹ thuật đính theo SP, tái sử dụng mẫu |
| Sales | CRUD khách hàng (`sales/customers`) | **Toàn bộ**: báo giá, duyệt BG, đơn hàng, lịch sử sửa đơn, phát LSX, theo dõi đơn, in báo giá/hợp đồng |

## Yêu cầu phải phủ (từ SRS + BR + mẫu in)

**Kỹ thuật:** FR-ENG-01 (thư viện SP theo khách) · 02 (tái sử dụng mẫu) ·
03 (file kỹ thuật đa loại, giữ lịch sử) · 04 (BOM per-SP, Kỹ thuật+Sales sửa được) ·
05 (cờ BOM chưa có/đang vẽ/đã vẽ, phòng khác nhìn thấy) · 06 (tìm theo mã SP/khách/đơn).

**Sales:** FR-SAL-01 (hồ sơ KH + lịch sử đơn) · 02 (báo giá nhiều dòng) ·
03 (duyệt BG — chỉ BG duyệt mới thành đơn) · 04 (đơn từ BG duyệt) · 05 (sửa đơn
+ lịch sử) · 06 (phát LSX 1-1, GĐ xác nhận, không cần đủ BOM) · 07 (bảng trạng
thái tổng hợp) · 09 (cảnh báo trễ/thiếu — mức badge).

**BR:** BR-01/02 (đơn↔LSX 1-1, LSX cụm SP — DB đã ép) · BR-03 (cờ BOM mức SP) ·
**BR-04** (duyệt BG trước đơn — *service + test bắt buộc*) · BR-07 (phát LSX
không chặn thiếu BOM, chỉ cảnh báo) · BR-11 (truy vết).

**Mẫu in phải xuất được:** Báo giá HG (ảnh SP, dims, carton cm/inch, Q'ty/ctn,
loading 40HC, FOB Qui Nhon USD, valid date) · Sale Contract (customer item code,
deposit %, payment terms, tổng cont) · phục vụ LSX in ở sprint sau (spec đã có bảng).

## Lộ trình — Kỹ thuật trước, Sales sau (Sales phụ thuộc SP + cờ BOM)

### Phase T1 — Nâng sản phẩm lên schema mới (1 ngày)
- Zod + repo + service: thêm `customer_id`, `bom_status`, `customer_item_code`,
  `description_en`, `unit`, `packing` (dims L/W/H, carton_cm, carton_inch,
  qty_per_carton, loading_40hc). Giữ `drawing_url/bom_url` legacy.
- UI `ProductsManager`: lọc theo khách hàng, badge trạng thái BOM (màu theo
  none/drawing/done), form 2 tab (thông tin + đóng gói XK).
- Tái sử dụng mẫu (FR-ENG-02): nút "Nhân bản từ mẫu" — copy thuộc tính + BOM
  sang SP mới cho khách khác.
- FR phủ: ENG-01, 02, 05 (data), 06 (search mã khách/mã SP).

### Phase T2 — BOM editor (1–1.5 ngày)
- API `technical/products/[id]/bom`: GET/PUT danh sách dòng (material picker từ
  danh mục kho, `qty_per_unit`, note, sort) — ghi đè theo bộ, transaction.
- Quyền: Kỹ thuật + Sales sửa được (FR-ENG-04), phòng khác read-only.
- Đổi cờ `bom_status` thủ công trên UI (none→drawing→done) + emit event
  `product.bom_status_changed` → notify Sales/Cung ứng.
- **Test service**: qty > 0, không trùng vật tư, đổi cờ đúng luồng.

### Phase T3 — File kỹ thuật theo SP (1 ngày)
- Dùng module files sẵn có (bucket attachments, `product_id`): upload/list/tải
  bản vẽ CAD, BOM Excel, ảnh SP, PDF hướng dẫn; sắp theo `created_at` làm
  lịch sử phiên bản (NFR-03 mức GĐ1); chọn 1 ảnh làm ảnh đại diện (in báo giá).
- FR phủ: ENG-03.

### Phase S1 — Báo giá + duyệt (1.5 ngày)
- Module `quotes`: CRUD nháp, lines (product picker hiện ảnh + packing + giá
  gần nhất), `next_doc_code('BG')`, valid_from/to, price_term, payment_terms,
  currency (mặc định USD).
- Luồng trạng thái: draft → pending (gửi duyệt) → approved / rejected (+lý do).
  Emit `quote.submitted` → notify GĐ; `quote.decided` → notify người lập.
- **Test service BR-04**: từ chối tạo đơn khi quote ≠ approved; không sửa quote
  đã approved (phải nhân bản thành BG mới).
- FR phủ: SAL-02, 03.

### Phase S2 — Đơn hàng + lịch sử thay đổi (1–1.5 ngày)
- Tạo đơn từ BG approved: snapshot lines sang `sales_order_lines`, copy
  customer/currency/terms, nhập `customer_po_no`, deposit_percent, due_date.
- Sửa đơn (thêm/bớt dòng, đổi SL/giá/hạn) → mỗi lần ghi `sales_order_changes`
  (jsonb diff) — FR-SAL-05; timeline thay đổi trên trang chi tiết.
- UI: OrdersManager (list + filter trạng thái) + Order detail (lines, changes,
  files hợp đồng qua `files.sales_order_id`).
- FR phủ: SAL-01 (lịch sử đơn của KH), 04, 05.

### Phase S3 — Phát LSX + theo dõi đơn (1 ngày)
- Action "Phát LSX" trên đơn confirmed: hiện cảnh báo SP thiếu BOM
  (`lines_bom_pending`) nhưng **không chặn** (BR-07); xác nhận (vai trò GĐ/manager)
  → tạo `production_orders` (`next_doc_code('LSX')`, issued_by/at) + đơn sang
  `lsx_issued`. DB tự chặn LSX thứ hai (BR-01).
- Trang "Theo dõi đơn hàng" từ view `v_order_tracking`: trạng thái tổng hợp,
  giai đoạn SX, BOM pending, PO mở, badge trễ (`due_date < today` chưa xong) —
  FR-SAL-06, 07, 09.
- Event `order.lsx_issued` → notify Cung ứng + Kỹ thuật.

### Phase S4 — In báo giá & hợp đồng (1 ngày)
- Route in `sales/quotes/[id]/print`: layout đúng mẫu Quotation HG (header cty
  từ `settings`, bảng ảnh/mô tả EN/dims/carton/loading/giá FOB, note terms).
- Route in `sales/orders/[id]/contract`: khung Sale Contract (buyer/seller,
  customer item code, deposit, payment terms, tổng cont, amount in words).
- In = HTML + print CSS (giống phiếu kho), không lib ngoài.

### Phase S5 — Màn duyệt Giám đốc (0.5 ngày)
- Workspace exec: bảng "Chờ duyệt" gộp BG pending (+ chỗ sẵn cho PO
  pending_approval của sprint Cung ứng) — duyệt/từ chối tại chỗ — FR-ADM-03.

### Chốt sprint (0.5 ngày)
- `npm run check` sạch; cập nhật ma trận truy vết (ENG-01..06, SAL-01..07, 09 → ✅ có UI);
- Demo E2E: tạo SP theo khách → BOM done → BG → GĐ duyệt → đơn (+PO khách) →
  phát LSX → thấy trên theo dõi đơn → in BG + contract.

**Tổng: ~8–9 ngày.** Thứ tự bắt buộc: T1 → T2 → S1 → S2 → S3; T3/S4/S5 chen được.

## Phụ thuộc & lưu ý

- `load-cont` (trang tính xếp cont hiện có) sẽ đọc `packing.loading_40hc` từ SP
  sau T1 — đồng bộ 1 nguồn số liệu.
- Ảnh SP để in: cần T3 xong trước S4 (ảnh đại diện).
- Quyền theo ma trận đặc tả mục 6: Sales sửa Sales, Kỹ thuật sửa Kỹ thuật,
  Sales được sửa BOM (FR-ENG-04), GĐ/manager duyệt — dùng `permissions.can()`.
- OI-11 (ai nhập spec in LSX) chưa chốt → form spec để ở sprint Cung ứng/SX,
  không chặn sprint này.
