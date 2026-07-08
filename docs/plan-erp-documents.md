# Kế hoạch: số hoá 3 chứng từ Sales/SX (Báo giá · LSX · Hợp đồng)

> Lập 07/2026. Nguồn: 3 file mẫu thật của Hoàng Gia — **Quotation 02.26**
> (KH YOTRIO), **Lệnh sản xuất 27/25-26** (KH MERXX, đơn HG-MX), **Sales
> Contract 17867HG-MX** (KH MERXX GmbH). Mục tiêu: (1) **lưu file gốc** vào đúng
> hồ sơ, (2) **bổ sung trường dữ liệu** để nhập/in đúng 3 mẫu này.

## 0. Bối cảnh & phát hiện chính

- **LSX hiện chỉ có header** (`production_orders`) — **chưa có bảng dòng SP**, nên
  toàn bộ thông số kỹ thuật trên phiếu LSX (barcode, tên Đức, sơn/kính/gỗ/nệm/máy,
  shipping mark, thời gian xuất theo dòng…) **chưa lưu được**.
- **Module `files` chưa cho đính kèm** vào báo giá/đơn/LSX (parent kind hiện chỉ:
  task, comment, customer, invoice, product) → chưa lưu được file gốc BG/LSX/HĐ.
- **Bản in hợp đồng** ([contract/page.tsx](../src/app/print/orders/[id]/contract/page.tsx))
  đang rút gọn (Article 1–4), thiếu thông tin ngân hàng/FSC/điều khoản XK của mẫu thật.
- Báo giá là chứng từ **đủ trường nhất** (~80%) nhờ `technical_products.packing`
  (dims/carton/loading) + `description_en` + `image_file_id`.

## 1. Báo giá (Quotation) — đối chiếu cột

| Cột trên mẫu | Trường hệ thống | Trạng thái |
|---|---|---|
| Picture | `technical_products.image_file_id` | ✅ |
| Description (tên EN + vật liệu + FSC) | `description_en` | ✅ (free text) |
| Dimension L/W/H (cm) | `packing.l_cm / w_cm / h_cm` | ✅ |
| Carton size L/W/H (cm) | `packing.carton_l_cm / carton_w_cm / carton_h_cm` | ✅ |
| Q'ty/ctn | `packing.qty_per_carton` | ⚠️ có; mẫu ghi cả "20 pcs/pallet" → cần **nhãn đơn vị đóng gói** |
| Loading 40HC | `packing.loading_40hc` | ✅ |
| FOB Qui Nhon (USD)/Set | line `unit_price` + `quote.price_term` + `product.unit` | ✅ |
| Giá tham khảo (cột nội bộ) | — | ❌ `product.reference_price` |
| Tên/số báo giá ("QUOTATION 02.26") | `quote.code` | ✅ (dùng code hệ thống) |
| Receiver (Ms. Trang) | `customer.contact_person` | ✅ (vừa thêm) |

**Bổ sung đề xuất:** `packing.pack_unit_label` (ctn/pallet), `product.reference_price`.

## 2. Lệnh sản xuất (LSX) — thiếu nhiều nhất

### Header
| Trường mẫu | Hệ thống | Trạng thái |
|---|---|---|
| Khách hàng | order → customer | ✅ |
| Đơn hàng số (HG-MX) | `order.code` / `customer_po_no` | ✅ |
| Số LSX (27/25-26 + ref 17951/17955) | `production_orders.code` + `note` | ✅ |
| Ngày nhận | — | ❌ `production_orders.received_date` |
| Ngày hoàn thành | — | ❌ `production_orders.completion_date` (hoặc suy từ trạng thái) |

### Dòng LSX — cần bảng mới `production_order_lines`
Phần lớn cột là **thông số kỹ thuật SP** → thêm vào `technical_products`.

| Cột LSX | Đề xuất trường | Thuộc |
|---|---|---|
| Hình ảnh sp | `image_file_id` | product ✅ |
| Mã SP | `code` | product ✅ |
| **Tên tiếng Đức** | `name_de` | product ❌ |
| **Nội dung shipping mark** | `shipping_mark` | product ❌ |
| Tên tiếng Việt | `name` | product ✅ |
| **Số barcode** | `barcode` | product ❌ |
| ĐVT | `unit` | product ✅ |
| Số lượng | LSX line `qty` (snapshot từ đơn) | ❌ (bảng mới) |
| **Máy** | `tech_spec.machine` | product ❌ |
| **Nệm** | `tech_spec.cushion` | product ❌ |
| **Sơn** (mã màu) | `tech_spec.paint` | product ❌ |
| **Kính** | `tech_spec.glass` | product ❌ |
| **Gỗ** (loại+FSC+mã màu) | `tech_spec.wood` | product ❌ |
| Đóng gói (1 cái/thùng) | `packing.qty_per_carton` + `pack_unit_label` | ✅ |
| **Thời gian xuất** (theo dòng) | LSX line `ship_week` | ❌ (bảng mới) |
| Note (17951/17955) | LSX line `note` | ❌ (bảng mới) |
| **Mẫu tại showroom** | `showroom_sample` | product ❌ |

**Cần:**
- Bảng `production_order_lines` — snapshot khi phát LSX: `production_order_id`,
  `product_id`, `qty`, `unit`, `ship_week`, `note`, `sort_order`. (Tách khỏi
  `sales_order_lines` để LSX bất biến, không đổi khi sale sửa đơn.)
- `technical_products`: `name_de`, `shipping_mark`, `barcode`, `showroom_sample`
  (bool/text), `reference_price`, jsonb `tech_spec {machine, cushion, paint, glass, wood}`.

## 3. Sales Contract — thiếu thông tin 2 bên + điều khoản XK

### Bên bán — `settings` (công ty)
Hiện có: `company_name/address/phone/tax_code`.
❌ Thiếu: `company_fax`, `company_email`, `company_bank_account`, `company_swift`,
`company_representative`, `company_representative_title`, `company_fsc_cert`.

### Bên mua — `sales_customers`
Vừa thêm: `contact_person/country/tax_code/port_of_discharge`.
❌ Còn thiếu: `fax`, `representative_title`, `fsc_cert`.

### Điều khoản hợp đồng — `sales_orders`
| Điều khoản (Article) | Đề xuất trường |
|---|---|
| 3.1 Dung sai SL/tiền ±10% | `qty_tolerance_pct` |
| 3.2 Partial shipment | `partial_shipment` (bool) |
| 3.3 Transhipment | `transhipment` (bool) |
| 3.4 Port of Loading | `port_of_loading` |
| 3.5 Port of Discharging | `port_of_discharge` (mặc định từ KH) |
| 4.x Wood/FSC (tên KH, xuất xứ, chủ rừng, exporter/importer, toạ độ) | **`settings`** cụm `fsc_*` (gần như cố định theo DN) |
| 5. Payment: method + chứng từ (Invoice/Packing/CO Form A/BL…) | `payment_method`, `required_docs` (jsonb list) |
| Mô tả hàng tiếng Đức | `product.name_de` (dùng chung LSX) |
| SAY … (amount in words) | đã có `usdAmountInWords()` ✅ |

## 4. Lưu file gốc (BG/LSX/HĐ scan)

Module `files` — thêm parent kind: **`quote`, `sales_order`, `production_order`**
(hiện chỉ có task/comment/customer/invoice/product). Cho phép upload PDF/Excel/scan
bản gốc vào đúng hồ sơ; MIME đã hỗ trợ pdf/xls/doc/ảnh sẵn.

## 5. Lộ trình (5 đợt — mỗi đợt 1 migration + service + UI, `npm run check` xanh)

| Đợt | Nội dung | Bảng/đối tượng | Phụ thuộc |
|---|---|---|---|
| **1** | Thông số kỹ thuật SP | `technical_products` (+`name_de`, `shipping_mark`, `barcode`, `showroom_sample`, `reference_price`, `tech_spec`, `pack_unit_label`) | nền cho 2, 4 |
| **2** | Dòng LSX + nâng bản in LSX | mới `production_order_lines`; sửa `production.service` khi phát LSX; route in `/print/lsx/[id]` | cần 1 |
| **3** | Thông tin 2 bên | `settings` (seller + `fsc_*`), `sales_customers` (fax/rep/fsc) | — |
| **4** | Điều khoản HĐ + nâng bản in hợp đồng | `sales_orders` (tolerance/ports/shipment/payment_docs); sửa `contract/page.tsx` đủ Article 1–6 | cần 1, 3 |
| **5** | Đính kèm file gốc | `files` parent `quote/sales_order/production_order` + UI upload/tải trên từng hồ sơ | — |

Thứ tự khuyến nghị: **1 → 2 → 3 → 4 → 5**. Đợt 5 độc lập, chen bất cứ lúc nào.

## 6. Câu hỏi cần chốt (Open Issues)

- **OI-A:** Thông số `sơn/kính/gỗ/nệm/máy` là **thuộc tính SP cố định** hay có thể
  **khác theo từng LSX**? Nếu khác theo LSX → phải cho override ở `production_order_lines`,
  không chỉ đọc từ product. (Đề xuất: mặc định từ product, cho ghi đè ở dòng LSX.)
- **OI-B:** Cụm Wood/FSC (Article 4) đặt ở `settings` (1 nguồn) hay theo lô/đơn?
  Mẫu cho thấy gần như cố định → `settings`, cho phép override text ở đơn nếu cần.
- **OI-C:** "Ngày nhận / Ngày hoàn thành" trên LSX: nhập tay khi phát LSX hay suy
  từ mốc hệ thống (issued_at / completed)?
- **OI-D:** Ai nhập thông số kỹ thuật SP (`tech_spec`, barcode, tên Đức) — Kỹ thuật
  hay Sales? (liên quan quyền sửa — dùng `permissions.can()`.)
- **OI-E:** Barcode có cần sinh/validate theo chuẩn (EAN-13) hay chỉ lưu chuỗi?

## 7. Ghi chú kỹ thuật

- Mọi migration theo chuẩn RLS-first (enable RLS, no policies), idempotent, đánh số
  tiếp `0026+`. Sau mỗi migration: **sync types**.
- `production_order_lines` **snapshot** (không FK cứng vào `sales_order_lines`) để
  LSX bất biến khi sale sửa đơn sau khi đã phát.
- `tech_spec` dùng jsonb (như `packing`) để linh hoạt; validate bằng zod ở service.
- Bản in LSX/HĐ: HTML + print CSS như phiếu kho, không lib ngoài.
