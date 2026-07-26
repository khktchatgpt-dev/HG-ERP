# Hồ sơ sản phẩm — thiết kế dữ liệu & hướng dẫn import

Tài liệu chụp **hiện trạng schema thật trên Supabase** (đọc trực tiếp từ DB ngày
2026-07-25, đã gồm migration 0091), không phải đọc lại file migration — vì lịch
sử migration remote không đáng tin (xem mục 7).

Mục đích: để tổng hợp dữ liệu sản phẩm từ Excel và import lên hệ thống.

---

## 1. Toàn cảnh

Hồ sơ sản phẩm nằm ở **2 bảng cốt lõi** cộng các bảng vệ tinh:

```
warehouse_materials  (danh mục vật tư)          ← BẮT BUỘC CÓ TRƯỚC
        ▲ material_id (RESTRICT)
        │
technical_bom_lines  (định mức: SP × vật tư)
        │ product_id (CASCADE)
        ▼
technical_products   (hồ sơ sản phẩm — 31 cột)
        ▲
        ├── files                (tài liệu + ảnh, SET NULL)
        ├── technical_samples    (mẫu showroom, RESTRICT)
        ├── sales_quote_lines    (dòng báo giá, RESTRICT)
        ├── sales_order_lines    (dòng đơn hàng, RESTRICT)
        └── production_components (bảng định hình theo từng LSX — không FK cứng)
```

`RESTRICT` nghĩa là: một khi sản phẩm đã lên báo giá / đơn hàng / mẫu thì **không
xoá được nữa**. Nên nhập sai thì sửa, đừng tính chuyện xoá làm lại.

---

## 2. `technical_products` — 31 cột

Khoá chính `id uuid` tự sinh. **`code` là UNIQUE toàn hệ thống** — đây là khoá
nghiệp vụ để đối chiếu khi import.

### 2.1 Nhận dạng (bắt buộc)

| Cột | Kiểu | Bắt buộc | Ghi chú |
|---|---|---|---|
| `code` | text | ✔ UNIQUE | Mã nội bộ. Trùng là insert lỗi. |
| `name` | text | ✔ | Tên tiếng Việt. Ràng buộc 1–200 ký tự. |
| `unit` | text | ✔ mặc định `cai` | ĐVT bán. |
| `is_active` | bool | ✔ mặc định `true` | Ngừng dùng = false, không xoá. |

### 2.2 Phân nhóm & khách hàng

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `customer_name` | text | **Nhãn khách/nhóm gõ tự do** (0091). Import chỉ cần cột tên, không cần khớp UUID. Trống = "Mẫu chung". |
| `customer_id` | uuid → `sales_customers` | FK cũ, **chỉ Kinh doanh dùng** để chia rổ SP trong form báo giá. Import bỏ qua được. |
| `customer_item_code` | text | Mã SP do khách đặt, in trên hợp đồng ("Customer Item"). |
| `category` | text | Danh mục tự do. |

### 2.3 Tên & mô tả cho chứng từ

| Cột | Kiểu | In ra đâu |
|---|---|---|
| `name_foreign` | text | Tên theo cách gọi của khách (mọi ngôn ngữ) — in trên LSX. |
| `description_en` | text | Mô tả tiếng Anh — in trên báo giá. |
| `shipping_mark` | text | Nội dung ký mã hiệu in trên thùng. **Khác** tên hàng. |
| `barcode` | text | Barcode thương mại. |
| `notes` | text | Ghi chú nội bộ. |

### 2.4 Đóng gói xuất khẩu — `packing` jsonb

`NOT NULL`, mặc định `{}`. Không được để `null`. Mọi khoá đều tuỳ chọn, kiểu số:

| Khoá | Ý nghĩa |
|---|---|
| `l_cm`, `w_cm`, `h_cm` | Kích thước sản phẩm (dài × rộng × cao). |
| `carton_l_cm`, `carton_w_cm`, `carton_h_cm` | Kích thước thùng carton. |
| `qty_per_carton` | Số SP trong 1 thùng (số nguyên). |
| `loading_40hc` | Lượng xếp được trong cont 40'HC (số nguyên). |
| `nw_kg`, `gw_kg` | Trọng lượng tịnh / cả bì trên mỗi thùng. |
| `pack_unit_label` | Nhãn đơn vị đóng gói: `ctn`, `pallet`… |

Ví dụ thật: `{"l_cm":55,"w_cm":61,"h_cm":84,"nw_kg":3.3,"gw_kg":104.5}`

### 2.5 Thông số sản xuất — `tech_spec` jsonb

`NOT NULL`, mặc định `{}`. In trên LSX. Tất cả là text:

`machine` (máy), `cushion` (nệm), `paint` (sơn — mã màu), `glass` (kính),
`wood` (gỗ — loại + FSC + mã màu).

### 2.6 Xuất khẩu & đặc tính

| Cột | Kiểu | Ràng buộc |
|---|---|---|
| `hs_code` | text | Mã HS khai hải quan. |
| `origin_country` | text | Xuất xứ. |
| `material` | text | Chất liệu chính (mô tả tự do). |
| `max_load_kg` | numeric(10,2) | **≥ 0**. |
| `assembly` | text | **Chỉ nhận `assembled` hoặc `kd`** (nguyên chiếc / tháo rời). |
| `set_contents` | text | Bộ gồm gì, vd "1 bàn + 6 ghế". |
| `reference_price` | numeric(18,2) | Giá tham khảo nội bộ. |

### 2.7 Trạng thái & liên kết

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `bom_status` | text | **Chỉ `none` / `drawing` / `done`**. ⚠ Xem cảnh báo mục 6. |
| `showroom_sample` | bool | Có mẫu tại showroom. |
| `image_file_id` | uuid → `files` | Ảnh đại diện. **Không import bằng CSV được** — ảnh phải upload qua app vì file nằm trên Storage. |
| `stage_route` | jsonb | Lộ trình công đoạn mặc định, mảng mã: `["phoi","han","son","hoan_thien"]`. Null = lệnh tự khai. |
| `drawing_url`, `bom_url` | text | **Di sản cũ**, đã thay bằng bảng `files`. Đừng dùng. |
| `created_at`, `updated_at` | timestamptz | Tự động. |

---

## 3. `technical_bom_lines` — định mức

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `product_id` | uuid → `technical_products` | CASCADE: xoá SP thì BOM đi theo. |
| `material_id` | uuid → `warehouse_materials` | **RESTRICT: vật tư phải tồn tại trước.** |
| `qty_per_unit` | numeric(14,4) | **Bắt buộc > 0.** Định mức trên 1 SP. |
| `note` | text | Ghi chú dòng (vd "chân trước"). |
| `sort_order` | int | Thứ tự hiển thị, mặc định 0. |

**UNIQUE `(product_id, material_id)`** — một sản phẩm không thể có hai dòng cùng
một vật tư. Nếu Excel của bạn tách theo chi tiết (chân, mê, nan… cùng dùng một
loại ống) thì phải **cộng gộp lại** trước khi import, phần diễn giải đẩy vào `note`.

**Không có cột hao hụt.** Định mức là con số thuần, muốn tính hao hụt thì phải
cộng sẵn vào `qty_per_unit`.

---

## 4. `warehouse_materials` — điều kiện tiên quyết

BOM trỏ tới vật tư bằng FK RESTRICT, nên **phải import vật tư trước**. Hiện DB
mới có **7 vật tư** — đây là nút thắt lớn nhất của việc import định mức.

Khoá nghiệp vụ: `code` UNIQUE. Các cột đang có:

`code`✔, `name`✔, `unit`✔ (mặc định `cái`), `group_name`, `spec`, `barcode`,
`shelf_location`, `note`, `is_active`✔, `min_stock`✔ (mặc định 0), `max_stock`,
`reorder_point`, `reorder_qty`, `price_unit`, `unit2_factor`,
`conversion_profile`✔ (mặc định `A`), `vat_rate`, `last_purchase_price`,
`default_supplier_id` → `supply_suppliers`.

⚠ **Thiếu so với thiết kế**: `base_unit`, `weight_kg`, kích thước
(`length/width/thickness_mm`), `lead_time_days`, `make_or_buy`, `currency` —
migration `0043_material_master_erp.sql` **chưa được apply**. Nếu dữ liệu vật tư
bạn định tổng hợp có khối lượng riêng / quy cách / thời gian giao hàng thì cần
apply 0043 trước, nếu không sẽ không có chỗ chứa. Bảng `item_uom` (0044, quy đổi
đơn vị) cũng chưa tồn tại.

---

## 5. Thứ tự import

1. **`warehouse_materials`** — danh mục vật tư. Bắt buộc trước BOM.
2. **`technical_products`** — hồ sơ sản phẩm. Đối chiếu theo `code`.
3. **`technical_bom_lines`** — định mức. Cần tra `product_id` từ mã SP và
   `material_id` từ mã vật tư, nên file nguồn nên để **mã** rồi convert khi nạp.
4. Ảnh và tài liệu: upload qua giao diện app, không qua CSV.

Về cách nạp: mọi bảng đều bật RLS không policy, nên **anon key bị chặn hoàn
toàn**. Chỉ nạp được bằng `SUPABASE_SECRET_KEY` phía server hoặc dán SQL trong
Supabase SQL editor.

File mẫu để đổ dữ liệu có sẵn ở `docs/import-templates/`, đánh số theo đúng thứ
tự nạp: `1-vat-tu.csv`, `2-san-pham.csv`, `3-dinh-muc-bom.csv`. Các file lưu UTF-8
có BOM để Excel mở không vỡ tiếng Việt. Riêng file sản phẩm, cột kích thước và
`spec_*` được trải phẳng cho dễ gõ — khi nạp sẽ gom lại thành `packing` và
`tech_spec`; `stage_route` viết các mã công đoạn ngăn nhau bằng dấu `|`.

Muốn chạy lại nhiều lần an toàn thì dùng upsert theo khoá nghiệp vụ:

```sql
insert into technical_products (code, name, unit, customer_name, ...)
values (...)
on conflict (code) do update set name = excluded.name, ...;
```

---

## 6. Cạm bẫy đã biết

**`bom_status` hiện KHÔNG phản ánh định mức thật.** 67 sản phẩm mang cờ "đã vẽ"
nhưng cả DB chỉ có **10 dòng BOM thuộc 4 sản phẩm**. Cờ này đang được hiểu theo
nghĩa "đã có bản vẽ" (suy từ file upload), không phải "đã bóc định mức vật tư".
Khi import đừng tin cờ cũ — cứ nạp BOM thật rồi set lại cờ theo dữ liệu.

**Dữ liệu kích thước rác.** Một số dòng đang có `{"l_cm":0,"w_cm":0,"h_cm":0}`.
Số 0 khác với "chưa biết"; nên để trống hẳn thay vì ghi 0, vì 0 sẽ chảy vào tính
toán xếp container.

**`packing` và `tech_spec` không được `null`** — để `{}` nếu chưa có dữ liệu.

**`assembly` chỉ nhận đúng 2 giá trị.** Ghi "KD" hoa hay "tháo rời" sẽ bị DB từ chối.

**Mã sản phẩm là duy nhất toàn hệ thống** — nếu Excel của bạn có cùng một mã cho
hai khách khác nhau thì phải chuẩn hoá trước, không thể import cả hai.

---

## 7. Hiện trạng dữ liệu (112 SP)

Tỷ lệ điền thực tế, để biết cột nào cần bổ sung khi tổng hợp:

| Đầy đủ | Điền một phần | Bỏ trống hoàn toàn |
|---|---|---|
| `material` 100%, ảnh 100%, `category` 95%, `origin_country` 95%, kích thước 94% | `customer_item_code` 44%, `description_en` 31%, `notes` 22%, nhãn khách 13%, `reference_price` 6%, `tech_spec` 6%, `name_foreign` 4%, `barcode` 4% | `hs_code`, `max_load_kg`, `assembly`, `set_contents`, `shipping_mark` — **0%** |

Nhóm cột 0% chính là phần "hồ sơ hoàn chỉnh" còn thiếu: khai hải quan, tải trọng,
kiểu lắp ráp, thành phần bộ, ký mã hiệu.

**Lưu ý về lịch sử migration:** bảng `supabase_migrations.schema_migrations` chỉ
ghi 72 dòng trong khi repo có 91 file, và nhiều migration đã apply thật mà không
được ghi sổ (vd `0058_product_name_foreign` — cột tồn tại nhưng không có dòng lịch
sử). Ngược lại `0043` có file nhưng chưa apply. **Đừng dùng bảng lịch sử để suy ra
schema — hãy query DB thật.**
