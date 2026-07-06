# Phân tích tổng hợp tài liệu đầu vào — chuẩn bị thiết kế database

Nguồn phân tích (07/2026):

| Tài liệu | Vai trò với thiết kế DB |
|---|---|
| `ERP_NoiThat_Requirement.docx` (SRS v1.0) | Danh sách yêu cầu đánh mã (FR/BR/NFR/INT/OI) — chuẩn nghiệm thu |
| `ERP_NoiThat_DacTa_v2.docx` | Nghiệp vụ chi tiết từng phòng + quan hệ dữ liệu cốt lõi (mục 2) |
| `Hoàng Gia - Tổng hợp mẫu in.docx` | **Biểu mẫu thật đang dùng** (sale contract, báo giá ×2, đơn đặt NCC ×3, LSX) — quy định dữ liệu tối thiểu DB phải lưu để in được |
| `Mẫu in.pdf` | Mẫu in tham chiếu từ phần mềm khác (1C): hoá đơn nhận hàng, phiếu nhập 01-VT, phiếu xuất 02-VT, **điều chuyển vật tư**, **kiểm kê kho** |

Đối chiếu với: `docs/db-design-erp.md` (thiết kế GĐ1 đã có) + schema thực tế
(migration 0001–0010: core, sales_customers, files, warehouse_materials/movements/stock).

**Kết luận chung:** xương sống trong `db-design-erp.md` (Đơn↔LSX 1-1, PO = 1 NCC +
1 LSX, thiếu = đặt−nhận, QC không vào tồn, BOM per-SP) **được mẫu in thực tế xác
nhận** — PO in thật ghi rõ số LSX trên header, LSX in thật gộp nhiều SP có số
lượng. Nhưng mẫu in lộ ra **một lớp dữ liệu xuất khẩu + spec sản xuất mà SRS không
nhắc tới** — cần bổ sung cột/bảng trước khi viết SQL 0011–0015.

## 1. Phát hiện mới từ mẫu in thật (không có trong SRS)

### 1.1 Sale Contract (bán B2B xuất khẩu — mẫu MARE BLU, USD)

- **Mã SP theo khách ≠ mã nội bộ.** Contract dùng "Customer Item" `P334`,
  trong khi LSX dùng mã nội bộ `1705775`. → `technical_products` cần
  `customer_item_code` (mã khách đặt) bên cạnh `code` nội bộ. Tìm kiếm phải chạy
  được theo cả hai.
- **USD là thực tế vận hành ngay GĐ1**, không phải hedge: giá FOB Quy Nhon (USD),
  tổng tiền + số tiền bằng chữ USD. Mua NCC lại toàn VND. Không thấy nhu cầu quy
  đổi → giữ `currency char(3)`, **không cần bảng tỷ giá GĐ1** (khớp OI-02).
- **Điều khoản thương mại phải lưu để in**: deposit 20%, "80% balance upon copy
  documents", L/C at sight, port of loading/discharging, partial shipment
  allowed, số container `1 x 40'HC`. → cột `deposit_percent`, `payment_terms`,
  `price_term` (FOB Quy Nhon…), `container_summary` trên đơn hàng/hợp đồng.
- **Hồ sơ pháp lý công ty trên mẫu in**: tài khoản ngân hàng, SWIFT, mã FSC
  certificate, người đại diện. → nhét vào `settings` (company profile), không
  cần bảng riêng.

### 1.2 Báo giá (2 mẫu, tiếng Anh, xuất khẩu)

- **Hiệu lực báo giá**: "Valid date: From 18/Mar/2026 to 18/June/2026"
  → `sales_quotes.valid_from/valid_to`.
- **Thuộc tính SP phục vụ báo giá xuất khẩu** (in trên từng dòng): kích thước
  L/W/H (cm), carton size (cm **và** inch), Q'ty/ctn, **Loading 40HC** (số SP
  xếp được 1 container), mô tả vật liệu (FSC eucalyptus, Olefin 300GSM…), ảnh SP.
  → đây là thuộc tính của **sản phẩm**, không phải của dòng báo giá: đề xuất
  `technical_products.packing jsonb` (dims, carton_cm, carton_inch,
  qty_per_carton, loading_40hc) + `description_en` + ảnh đại diện qua `files`.
- Giá theo `PCS/SET` → ĐVT bán nằm ở SP; dòng quote snapshot `unit_price`.

### 1.3 Đơn đặt hàng NCC (3 mẫu: nhôm định hình, nhựa/dây mây, kính)

- **Xác nhận BR-06 bằng thực tế**: header in số LSX ("LSX Số 25 BS (17921HG/MX)").
  Mẫu số ĐH kiểu `ĐH 19: HG/TĐ` → sinh mã tự do, cột `code text unique` là đủ.
- **Dòng PO có ĐVT kép + định mức quy đổi**, khác nhau theo nhóm vật tư:
  - nhôm: số lượng (cây) + trọng lượng kg/m + tổng kg, **đơn giá tính trên kg**;
  - kính: SL (tấm) + m²/tấm + tổng m², **đơn giá tính trên tấm**;
  - dây mây: kg + định mức `48m/kg`.
  → GĐ1 không nên dựng hệ quy đổi ĐVT đầy đủ; đề xuất trên
  `supply_purchase_order_lines`: `spec text` (quy cách), `qty2 numeric` +
  `unit2 text` (số phụ: kg/m²…), đơn giá gắn với ĐVT ghi trong `unit_price_basis`
  hoặc đơn giản để đơn giá × qty2 khi cần — chốt ở OI-10 dưới.
- **VAT ghi ngay trên mẫu** ("đã bao gồm VAT 10%" / "chưa gồm VAT") →
  `vat_rate numeric` + `price_includes_vat bool` (hoặc tối thiểu `vat_note`).
- **Ghi chú dòng gắn bộ phận SP** ("chân trước", "tay vịn", "dọc ngồi") — cột
  `note` per line đã dự kiến là đủ.
- Thời gian giao hàng, bảo hành → `expected_at date`, `terms text` trên PO.

### 1.4 Lệnh sản xuất (mẫu in LAURA)

- **Số PO của khách trên header** (`PO#: 31032191120`) →
  `sales_orders.customer_po_no text`. Thiếu cột này không in được LSX đúng mẫu.
- **Mỗi dòng SP có spec sản xuất riêng để in**: Máy/dây (dây dù màu kem), Nệm
  (màu kem), Sơn (đen), Đóng gói (2 cái/thùng), thời gian xuất (07-10/05/2026),
  Note (tem nệm may số PO), "Lưu ý quan trọng". Ảnh SP in trên phiếu.
  → **va chạm với quyết định "LSX dùng chung `sales_order_lines`"** trong
  db-design-erp.md (mục 12.3). Giữ quyết định dùng chung, nhưng thêm bảng phụ:

  ```sql
  production_order_line_specs (
    id uuid PK,
    production_order_id uuid FK production_orders on delete cascade,
    order_line_id uuid FK sales_order_lines on delete cascade,
    specs jsonb not null default '{}',   -- {may, nem, son, dong_goi, ...} in theo mẫu
    note text, important_note text,
    unique (production_order_id, order_line_id)
  )
  ```
  jsonb vì cột spec thay đổi theo loại SP (ghế dây / bàn kính / sofa nệm).
- Ngày xuất hàng dự kiến + tổng container (`3 x 40'HC`) →
  `production_orders.ship_date date`, `container_summary text`.
- Nơi nhận phiếu (QLSX, tổ trưởng, kho, kế hoạch, kế toán) — chỉ là layout in,
  không cần dữ liệu.

### 1.5 Phiếu kho tham chiếu (PDF — 1C, chuẩn 01-VT/02-VT TT200)

- **Phiếu nhập/xuất chuẩn có 2 cột SL: "theo chứng từ" vs "thực nhập/xuất"** —
  khớp model hiện tại (`po_line.qty_ordered` vs `movements.qty`). Không đổi gì.
- Phiếu có "người giao/nhận", "lý do xuất" → `note` GĐ1 là đủ; cân nhắc
  `counterparty text` khi làm UI in phiếu.
- **Điều chuyển vật tư** (giữa kho/vị trí) — SRS **không có FR nào**, nhưng mẫu
  in tham chiếu có → khi nối FK kho (0015) nên mở rộng
  `warehouse_movements.ref_type` thêm `'transfer'` (cặp out/in cùng
  `transfer_group uuid`) để không phải đập check constraint về sau.
- **Kiểm kê kho** (thực tế vs sổ sách, chênh lệch) — SRS cũng không có FR.
  Nghiệp vụ kho thực tế chắc chắn cần. → thêm loại movement `'adjust'` +
  (GĐ2) bảng `warehouse_stocktakes`. Ghi thành Open Issue mới (OI-08).
- **Phiếu kho chuẩn có đơn giá/thành tiền** (giá trị tồn). Đặc tả nói "giá trị
  nhập/xuất — chi tiết sau", nhưng thêm cột sau khi movements đã dày là đau →
  đề xuất thêm `unit_cost numeric null` vào `warehouse_movements` ngay ở 0015,
  UI GĐ1 ẩn (cùng triết lý với `warehouses`).
- Số phiếu định dạng (`CMCM-000001`) → `doc_counters` bổ sung kind: `PNK`, `PXK`,
  `DCK` (điều chuyển), `KK` (kiểm kê) bên cạnh BG/DH/LSX/PO.

## 2. Bảng gap — điều chỉnh đề xuất so với `db-design-erp.md`

| # | Bổ sung | Bảng/cột | Vào migration |
|---|---|---|---|
| 1 | Mã SP theo khách | `technical_products.customer_item_code` | 0012 |
| 2 | Thuộc tính báo giá XK | `technical_products.description_en`, `packing jsonb`, ảnh đại diện (qua `files`) | 0012 |
| 3 | Hiệu lực + điều khoản báo giá | `sales_quotes.valid_from/valid_to`, `payment_terms`, `price_term` | 0013 |
| 4 | Số PO khách + điều khoản HĐ | `sales_orders.customer_po_no`, `deposit_percent`, `payment_terms`, `price_term`, `container_summary` | 0013 |
| 5 | Spec SX per dòng để in LSX | bảng mới `production_order_line_specs` (jsonb) | 0014 |
| 6 | Ngày xuất + container LSX | `production_orders.ship_date`, `container_summary` | 0014 |
| 7 | ĐVT kép / quy cách dòng PO | `supply_purchase_order_lines.spec`, `qty2`, `unit2` | 0015 |
| 8 | VAT trên PO | `supply_purchase_orders.vat_rate`, `price_includes_vat` | 0015 |
| 9 | Giao hàng/bảo hành PO | `supply_purchase_orders.expected_at`, `terms` | 0015 |
| 10 | Điều chuyển + điều chỉnh tồn | `warehouse_movements.ref_type` + `'transfer','adjust'`, `transfer_group uuid` | 0015 |
| 11 | Giá trị nhập/xuất (ẩn GĐ1) | `warehouse_movements.unit_cost numeric null` | 0015 |
| 12 | Kind số phiếu kho | seed `doc_counters`: PNK/PXK/DCK/KK | 0011 |
| 13 | Company profile để in (bank, SWIFT, FSC, đại diện) | dùng `settings` sẵn có | — |

Không thay đổi nào phá vỡ 5 quyết định đã chốt ở mục 12 của `db-design-erp.md`;
riêng quyết định #3 (LSX dùng chung dòng SP) được **giữ nguyên nhưng bù** bằng
bảng spec phụ (#5).

## 3. Open Issues bổ sung (nối tiếp OI-01…07 của SRS)

| Mã | Câu hỏi cần chốt với doanh nghiệp |
|---|---|
| OI-08 | Kiểm kê kho có cần trong GĐ1 không, hay chỉ cần loại movement `adjust`? |
| OI-09 | Điều chuyển giữa **vị trí kệ** trong 1 kho có cần phiếu in, hay chỉ sửa `shelf_location`? |
| OI-10 | Dòng PO ĐVT kép (cây↔kg, tấm↔m²): nhập cả 2 số + đơn giá theo số nào, hay chỉ lưu quy cách dạng text? |
| OI-11 | Spec sản xuất trên LSX (màu dây/nệm/sơn, đóng gói): ai nhập, ở bước nào — Sales lúc tạo đơn hay Kế hoạch lúc phát LSX? |
| OI-12 | Xác nhận: bán USD / mua VND, **không** quy đổi tỷ giá trong GĐ1? |

## 4. Việc tiếp theo

1. Chốt OI-08…12 (nhanh, chủ yếu xác nhận).
2. Cập nhật `docs/db-design-erp.md` mục 3–7 theo bảng gap ở mục 2.
3. Viết SQL 0011–0015 theo skill `add-migration` (idempotent, RLS no-policy,
   header chuẩn), mỗi migration xong: sync types + test schema.
