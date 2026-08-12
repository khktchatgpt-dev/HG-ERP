# Phân tích: tiền tệ trên đơn đặt hàng + chuẩn hoá mẫu đơn theo bàn giao A Nhân

_Ngày 12/08/2026 — nguồn: `E:\NHÂN BÀN GIAO\A NHÂN` (13 nhóm thư mục vật tư) đối
chiếu với form soạn đơn `planning/pos/new`, `src/lib/po-template.ts` (10 mẫu) và
schema `pos.schema.ts`. Bổ sung cho đợt đối chiếu 6 file ngày 09/08
(`docs` + memory `po-forms-6-file-doi-chieu`)._

## 1. Tiền tệ — đơn đặt hàng ĐÃ chọn được USD, nhưng chưa "sống" được với USD

Hiện trạng:

- DB + schema: `supply_purchase_orders.currency` (text 3 ký tự, default VND);
  bảng giá NCC (`supplier_prices`) có currency riêng từng dòng giá, màn so giá
  KHÔNG quy đổi chéo tiền tệ (đúng chủ đích); NCC khai được tiền tệ mặc định
  (VND/USD/EUR/CNY/JPY — `SupplierForm`).
- Form tạo đơn: có ô chọn tiền tệ ở thanh tổng tiền (`TotalsBar`), nhưng chỉ
  2 lựa chọn `VND | USD`.

4 lỗ hổng phát hiện:

| # | Lỗ hổng | Dẫn chứng |
|---|---------|-----------|
| 1 | **Chọn NCC không tự áp tiền tệ của NCC.** `supplier.currency` không được dùng ở `PoCreateForm` (chỉ hiện chip lead-time/payment). Nhân viên đặt gỗ phải nhớ tự đổi sang USD mỗi lần. | `PoCreateForm.tsx:348` — supplier chỉ lấy name/lead_time/payment |
| 2 | **`poMoney` làm tròn về đơn vị NGUYÊN** (`Math.round(subtotalRaw)`, VAT cũng vậy) — đúng cho VND, **nuốt cent với USD**. Đơn gỗ thật tổng $700.21, $2,747.70, $86,743.50 — làm tròn thành 700 / 2 748 là lệch với NCC. | `src/lib/po-line.ts:97-119`; file `GỖ/ĐƠN ĐẶT HÀNG GỖ/ĐH gỗ Minh Đạt.xlsx` |
| 3 | **Select thiếu EUR/CNY/JPY** trong khi hồ sơ NCC cho khai 5 loại; kính đặt Trung Quốc có thể cần CNY/USD. | `TotalsBar.tsx:160-163` |
| 4 | **Hiển thị/in/Excel format kiểu VND** (`toLocaleString('vi-VN')` không ép số lẻ) — USD chuẩn phải 2 số lẻ cố định; cột "Đơn giá (USD)" trên Excel cũng vậy. Thống kê tổng chi nếu cộng trộn tiền tệ sẽ ra số rác (bên Sales đã có mẫu `sumByCurrency` để tách). | `PoDetailScreen.tsx:74`, `po-excel.ts` |

KHÔNG đề xuất làm tỷ giá/quy đổi ở giai đoạn này: nghiệp vụ thật của phòng chỉ
cần đơn giữ đúng tiền tệ của NCC; so giá đã tách theo currency.

Việc sửa gọn (nửa ngày):

1. `poMoney` nhận `currency` (hoặc cờ `wholeUnit`): VND làm tròn 0 lẻ như cũ,
   khác VND làm tròn 2 lẻ. Kèm test USD.
2. Chọn NCC → auto-set tiền tệ theo `supplier.currency` (chỉ khi user chưa đụng
   tay vào ô tiền tệ — giống pattern `vatDirty` sẵn có).
3. Mở rộng option: VND/USD + EUR/CNY/JPY (đọc chung 1 hằng `CURRENCIES` dùng cả
   ở `SupplierForm`).
4. Helper `fmtMoney(n, currency)` dùng chung form/chi tiết/in/Excel: VND 0 lẻ,
   còn lại 2 lẻ.

## 2. Các nhóm đơn thật CHƯA có mẫu (đối chiếu 10 mẫu hiện tại)

10 mẫu hiện có: accessory, aluminium, metal_kg, carton, rattan, paint, chemical,
foam, mro, simple. Rà 13 thư mục bàn giao thấy 4 nghiệp vụ chưa có chỗ:

### 2.1 GỖ — USD, giá theo m³ tinh, dòng là SẢN PHẨM

File: `GỖ/ĐƠN ĐẶT HÀNG GỖ/*` (Minh Đạt, Thành Đạt, Đức Toàn, Tâm Phú, Thành Luân).

- Cột dòng: Hình ảnh · Mã SP · Tên TV · ĐVT (cái/bộ) · Số lượng · **Khối lượng
  Gỗ (m³/SP)** · **Đơn giá/m³ tinh (USD)** · Đơn giá/1SP (USD) = m³×giá/m³ ·
  Thành tiền (USD) · Loại gỗ (Acacia FSC 100%) · Màu gỗ · **Kế hoạch giao hàng
  THEO TỪNG DÒNG** (có khi 2 cột kế hoạch cho 2 xưởng).
- Công thức = đúng trục `unit2` sẵn có: `qty2 = m³/SP × SL`, `unit2 = 'm³'`,
  giá theo unit2 — y hệt `metal_kg` chỉ khác đơn vị và tiền tệ.
- Điều khoản lặp: "Đơn giá chưa bao gồm VAT", "Bề mặt gỗ không trám trít…",
  giao tại xưởng HG, đề nghị fax xác nhận.
- Điểm vướng: dòng là **Mã SP** (bàn/ghế mua gỗ theo SP), không phải mã vật tư
  → đụng ràng buộc `material_id` bắt buộc (xem §4).

### 2.2 GIA CÔNG NGOÀI — 2 biến thể, chưa có mẫu nào

File: `GIA CÔNG ĐAN MÂY/*` (Quốc, Lĩnh, Minh, hợp đồng + nghiệm thu),
`GIA CÔNG HÀNG SẮT - NHÔM/*` (A Dung, Trung, Đức Toàn, Vinh, An Khánh, Yên Nhật
Phú), tiêu đề phiếu là "ĐƠN ĐẶT HÀNG **GIA CÔNG**".

- Biến thể (a) **công theo SP**: đan mây — Mã SP · SL · Đơn giá/Ghế · Thành
  tiền (SL×giá). Điều khoản đặc thù: *"Toàn bộ khung ghế, dây đan… do HG cấp"*,
  đúng kiểu đan/không lỗi, hàng lỗi yêu cầu sửa, chở tới xưởng HG.
- Biến thể (b) **công theo kg**: hàn/mài sắt-nhôm — Mã SP · SL bộ · **ĐM SP
  (kg)** · **Đơn giá/kg** · Đơn giá/Ghế (=kg×giá/kg) · Thành tiền, ghi chú
  "Gia công công đoạn: Hàn, mài" — công thức = `metal_kg` nhưng dòng là SP.
- Ngoài đơn còn bộ hồ sơ đi kèm (hợp đồng gia công, phụ lục, biên bản nghiệm
  thu) và sổ theo dõi giao-nhận theo ngày (`GIA CÔNG NGOÀI T4.xlsx`: ngày giao,
  ngày nhận, còn lại, định mức kg) — đây là nghiệp vụ theo dõi, không thuộc form
  tạo đơn nhưng nên ghi nhận cho giai đoạn sau.

### 2.3 KÍNH — đặt theo TẤM với quy cách mm, tiền theo tấm hoặc m²

File: `KÍNH/DDH KÍNH MAI TRANG.xlsx`, `kính đặt tq.xlsx`, `DDH KÍNH NGHI
ĐẠT/VĨNH KHANG/MẪU ROSCO`.

- Mai Trang (trong nước): Loại kính · Tên SP · Quy cách (605x539x5mm) · ĐVT Tấm
  · SL · **m²/tấm** · Tổng m² · **Đơn giá/tấm** · Thành tiền — VND, giá ĐÃ gồm
  VAT, công nợ. Chân phiếu ghi giá gốc theo m² ("Kính trắng mờ = 205.000/m²").
- Đặt TQ: cùng trục tấm + m²/tấm nhưng thêm SL SP × chi tiết/SP → SL kính, và
  các sheet theo dõi **SL nhập về / đặt dư / xuất tuần** — đơn ngoại tệ (file
  không ghi giá; giá nằm ở chứng từ khác).
- Khớp mô hình carton sẵn có (dims → m², chọn basis tấm/m²): mẫu `glass` có thể
  tái dùng trục `unit2='m²'` + `carton_basis`-kiểu (`tấm | m²`), thêm cột dày mm.

### 2.4 XỐP theo KHỐI (m³) — mẫu foam hiện tại chỉ SL×giá

File: `XỐP-…/DDH XỐP TÂN HOÀNG LONG.xlsx` (sheet "Xốp Casual"), `ĐƠN HÀNG XỐP
TÂN HOÀNG LONG.xlsx`.

- Cột dòng: Mã SP · Mã hàng · **Quy cách D×R×Dày (mm)** · **Tổng số khối (m³)**
  · Số chi tiết/SP · SL đặt (tấm) · **Đơn giá/m³** · Thành tiền = m³ × giá/m³.
  Hai loại xốp (10kg/16kg) giá /m³ khác nhau trong cùng đơn.
- Cùng file, các sheet mút/foam cuộn lại đúng mẫu `foam` hiện tại (SL cuộn ×
  giá) → không thay mẫu cũ, mà **thêm biến thể basis m³** cho xốp tấm:
  `qty2 = D×R×Dày/10⁹ × SL`, `unit2='m³'` — cùng khuôn `deriveLine` với carton.

### 2.5 Carton — xác nhận lại gap cũ, thêm chi tiết mới

`BAO BÌ/Đơn hàng hồng đào chu lai.xlsx`: kích thước **PHỦ BÌ** (form hiện dùng
lọt lòng), cách mở "**Đối khẩu**" (ngoài AD/MR → `cartonAreaM2` trả null, nhập
m² tay), và cột **"Bản in + công"** cộng thêm vào đơn giá/thùng:
`giá/thùng = m² × giá/m² + bản in`. Dòng "Giấy lót" đi kèm trong cùng đơn tính
SL×giá thường. → đủ dữ kiện để chốt cách làm gap #4 (giá kép m²/thùng).

## 3. Vật tư — ĐVT / giá: nền đã khá đủ, thiếu 2 mảnh

Đã có trên `warehouse_materials`: `unit` (ĐVT mua), `unit2 + unit2_factor` (giá
theo đơn vị kép), `kg_per_m`, `kg_per_unit`, `pack_size/pack_unit` (bì/bao),
`material_grade`, `po_template` gợi ý ngầm; giá theo NCC + tiền tệ ở
`supplier_prices` (+ giá mua gần nhất theo đơn). Nhánh 0132 đang bổ sung quy đổi
định mức→đơn vị mua ở phía Kỹ thuật (bar_length_m, pcs_per_bar, sheet_w/l_mm,
m3_per_sheet, roll_width_m, waste_pct).

Thiếu cho các mẫu mới ở §2:

1. **Hệ số quy đổi m³/m² trên danh mục VT** — cơ chế `unit2 + unit2_factor` đã
   có sẵn, chỉ cần nhập liệu (kính: m²/tấm; xốp: m³/tấm; gỗ: m³/SP nằm ở dòng
   đơn chứ không ở danh mục). KHÔNG cần cột mới.
2. **Dòng đơn không phải vật tư kho** — `poLineInputSchema.material_id` đang
   bắt buộc `uuid` của `warehouse_materials`. Đơn gỗ/gia công đặt theo **Mã SP**
   (technical_products) hoặc chi tiết. Ba hướng, khuyến nghị (c):
   - (a) tạo "vật tư ảo" cho từng SP — rác danh mục, sai bản chất;
   - (b) thêm FK thứ hai `product_id` — đúng nhưng đụng nhiều tầng (needs,
     tồn kho, nhận hàng);
   - (c) **cho phép dòng tự do** `material_id nullable + line_name text` với
     ràng buộc: chỉ mẫu `wood`/`outsourcing` được dùng, dòng tự do không đi vào
     tồn kho/needs (đúng thực tế: gỗ/gia công nhận về là bán thành phẩm SP,
     không nhập kho vật tư). Phù hợp nguyên tắc "gõ tự do thay vì FK danh mục".

## 4. Lộ trình đề xuất (theo ưu tiên)

| Đợt | Việc | Cỡ | Ghi chú |
|-----|------|----|---------|
| 1 | Tiền tệ: sửa `poMoney` theo currency + auto theo NCC + mở rộng option + `fmtMoney` dùng chung | S | Không migration; sửa lib thuần + 3 chỗ UI + po-excel; thêm test USD |
| 2 | Mẫu `wood` (m³ × giá/m³, USD mặc định, kế hoạch giao theo dòng, terms FSC) | M | Cần quyết định §3.2 trước (dòng SP) |
| 3 | Mẫu `outsourcing` 2 biến thể (công/SP và kg×giá/kg) + terms gia công | M | Cùng quyết định §3.2; biến thể kg tái dùng `weight_per_unit` |
| 4 | Xốp m³: thêm basis `m3` cho mẫu foam (dims → m³, giá/m³) | S | Cùng khuôn carton, thêm `thickness_mm` vào line |
| 5 | Mẫu `glass` (tấm + m²/tấm, giá tấm/m², cột dày) | S-M | Tái dùng trục carton |
| 6 | Carton giá kép: giá/m² + bản in công → giá/thùng, phủ bì + cách mở "Đối khẩu" | M | Gap #4 cũ, giờ đủ dữ kiện chốt |

Ngoài phạm vi form tạo đơn (ghi nhận, làm sau): sổ theo dõi giao-nhận gia công
theo ngày; theo dõi kính đặt dư/xuất tuần; hh 3% (mâu thuẫn cũ, chờ phòng chốt).

## 5. ĐÃ THỰC HIỆN — 12/08/2026 (cùng ngày, migration 0134)

Cả 6 đợt ở §4 đã code xong, `npm run check` sạch (1.165 test). Chi tiết:

1. **Tiền tệ** — `poMoney`/`roundMoney`/`fmtMoney` nhận currency (VND/JPY tròn
   đồng, USD/EUR/CNY tròn cent, hiện đủ 2 số lẻ); chọn NCC auto-áp
   `supplier.currency` (cờ `currencyDirty` như vatDirty); ô chọn dùng chung
   `PO_CURRENCIES` (VND/USD/EUR/CNY/JPY) với hồ sơ NCC; form/chi tiết/phiếu
   in/Excel cùng một phép tính (`poMoney`) — Excel đổi numFmt `#,##0.00` khi
   ngoại tệ.
2. **Migration `0134_po_free_lines_va_gia_kep.sql`** — `material_id` nullable +
   `line_name`/`line_unit` (dòng tự do), `print_fee`, nới check `carton_basis`
   thêm `'m3'`/`'kg'`, view `supply_po_line_status` lọc `material_id is not
   null` (dòng tự do không đi vào sổ nhận kho). ⚠️ **CHƯA apply remote — phải
   apply trước khi chạy app** (repo giờ luôn ghi các cột mới khi lưu dòng).
   `database.types.ts` đã vá TAY — chạy sync-types khi tiện.
3. **Mẫu `wood`** — m³/SP (mượn `weight_per_unit`) × giá/m³ tinh, unit2 m³;
   cột Loại gỗ / Màu gỗ / KH giao hàng theo dòng; terms chép từ ĐH Minh Đạt.
4. **Mẫu `outsourcing`** — basis SP/kg từng dòng (`carton_basis`), ĐM kg/SP ×
   giá/kg khớp file A Dung (65 bộ × 18,91 × 28.000 = 34.416.200); terms đan mây
   New ISO. **Dòng tự do** cho cả wood/outsourcing: nút "＋ Dòng SP tự gõ",
   tên/ĐVT gõ trên dòng, không trừ kho, không vào needs; service chặn mẫu khác;
   đơn TOÀN dòng tự do có nút "Đã nhận đủ (nghiệm thu)" (advance→received,
   chặn khi đơn còn dòng vật tư kho).
5. **Xốp m³** — foam thêm basis m³: D×R×Dày (ô gộp kiểu lọt lòng) → m³ tròn
   6 lẻ (tròn 4 lẻ là lệch 9đ/tấm), khớp file Tân Hoàng Long. **Mẫu `glass`** —
   tấm + m²/tấm, giá theo tấm hoặc m² (trục carton), terms Mai Trang.
6. **Carton giá kép** — thêm ô Đơn giá/m² (`price_per_m2`) + Bản in + công
   (`print_fee`); gợi ý bấm-để-dùng dưới ô Đơn giá: giá/thùng = m²×giá/m² +
   bản in (khớp Hồng Đào CL 3,591×18.770+3.278=70.681); phiếu in/Excel in cả
   hai cột; cách mở thêm **ĐK** (đối khẩu — m² nhập tay, chưa có công thức
   kiểm chứng). Hậu tố đơn giá /thùng·/m²·/m³·/kg·/SP qua `poPriceSuffix`
   dùng chung in + Excel.

Còn treo: công thức m² phủ bì cho cách mở ĐK (cần thêm file đối chiếu); các
mục "ngoài phạm vi" ở trên.
