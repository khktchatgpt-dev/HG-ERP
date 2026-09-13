# Quản lý khuôn nhôm — kế hoạch thiết kế

Viết 13/09/2026. Nguồn: `QUAN LY KHUON NHOM - HOP NHAT_5.xlsx` (13 sheet, hợp nhất
từ 4 file cũ) + số đo trên DB thật và mã nguồn HG-ERP.

Mọi con số dưới đây đo được, có cách kiểm lại. Đọc mục 1 trước khi bàn màn hình:
**một nửa việc của tính năng này là việc dữ liệu, không phải việc giao diện.**

Mục **[§4](#4-khuôn-phục-vụ-sản-xuất--phần-sâu-nhất-và-phần-đang-trống-nhất)** là
phần dành cho xưởng — và là phần trả lời câu "lệnh này cần mấy cây nhôm", thứ hôm
nay **0/994 chi tiết sản xuất** trả lời được.

---

## 1. Đo hiện trạng

### 1.1 Điều quan trọng nhất: bảng khuôn ĐÃ CÓ và đã nối vào hai chỗ

`public.technical_dies` được tạo từ migration
[`0106_po_templates_and_dies.sql`](../supabase/migrations/0106_po_templates_and_dies.sql),
hiện đang sống trên DB thật với **142 dòng**, và đã được dùng ở hai nơi:

| Nơi dùng          | File                                                                        | Việc nó làm                                          |
| ----------------- | --------------------------------------------------------------------------- | ---------------------------------------------------- |
| Soạn đơn mua nhôm | `src/app/(workspace)/planning/pos/new/PoLineCells.tsx:301`                   | Chọn mã khuôn → tự có `kg/m` để tính tiền            |
| Lưới định mức SP  | [`PartField.tsx:73`](../src/components/technical/PartField.tsx)              | Chọn khuôn → ghi `profile_code` + `kg_per_m` vào BOM |

Cả hai đi qua cùng một thành phần [`DiePicker`](../src/components/supply/DiePicker.tsx)
và một đường đọc duy nhất [`dies.repo.ts`](../src/modules/dept/technical/dies.repo.ts).

**Hệ quả cho kế hoạch: đây là việc MỞ RỘNG một danh mục đang chạy, không phải dựng
một module mới.** Dựng bảng `technical_molds` song song là ngay lập tức có hai nguồn
kg/m cho cùng một mã khuôn — thứ mà chính file Excel này đang phải đi dọn hậu quả
(sheet ĐỐI CHIẾU LỆCH, 145 dòng, sinh ra vì 4 file cùng ghi một mã).

### 1.2 Độ phủ dữ liệu — file Excel mới

| Trường                      | Phủ                | Ghi chú                                                        |
| --------------------------- | ------------------ | -------------------------------------------------------------- |
| Mã khuôn (chuẩn)            | 189/189            | Đã chuẩn hoá `<Tiền tố NCC>-<Số>`                              |
| **Ảnh mặt cắt khuôn**       | **170/189 (90%)**  | Ảnh PNG **nhúng thật** trong file (167 media, neo ở cột C)     |
| Mã ghi trên file gốc        | 189/189            | Giữ để tra ngược — nhiều cách viết cho một mã                  |
| Tên sản phẩm / chi tiết     | 187/189            |                                                                 |
| Nhóm chi tiết               | 189/189            | 12 nhóm (Chân 51, Diềm bàn 22, Tựa 19…)                        |
| Trọng lượng kg/m            | 178/189 (94%)      |                                                                 |
| Đơn giá mở khuôn            | 143/189 (76%)      | Tổng **1.397.241.600 ₫**                                       |
| Hợp kim                     | 120/189 (63%)      | 6063 = 106, Nhôm 96% = 14                                      |
| Dạng profile                | 58/189 (31%)       |                                                                 |
| kg/m sau sửa (bỏ gân)       | 14/189 (7%)        |                                                                 |
| Có trong BOM Buning         | 9/189 (5%)         |                                                                 |

**Tình trạng khuôn** — đây là con số phải nhìn thẳng:

| Tình trạng             | Số mã       |
| ---------------------- | ----------- |
| **Chưa xác định**      | **74 (39%)** |
| Đang dùng              | 65          |
| Đã sửa / bỏ gân        | 18          |
| Đã chuyển nơi khác     | 16          |
| Chờ mở khuôn           | 7           |
| Khuôn hư               | 5           |
| Khuôn cũ (đã thay)     | 3           |
| Đã bỏ / không còn      | 1           |

39% số khuôn — mang theo khoảng 387 triệu tiền mở khuôn — **không ai biết nó còn
sống hay đã chết**. Thêm nữa, 62/189 mã (33%) chỉ xuất hiện ở đúng một trong bốn
file cũ, tức là chưa có gì đối chứng.

Đây chính là lý do tính năng này đáng làm, và cũng là lý do **màn hình phải bày
được câu "chỗ này chưa biết"** chứ không phải giấu ô trống đi cho đẹp.

Nơi giữ khuôn — 11 nơi: Tiến Đạt 95 · Ynghua 31 · TaiWan 23 · Việt Eco 12 ·
Miên Hua 9 · Quang Minh 9 · Xuân Kỳ 4 · Phong Gia Phát 2 · Việt Ý 2 · ALANMI 1 ·
Hoàng Gia Hà Nội 1.

Ba sheet phụ đều là **việc cần làm một lần rồi thôi**, không phải chức năng thường trực:

- `LỊCH SỬ SỬA KHUÔN`: 43 dòng / 30 mã (13 dòng có ngày sửa, 26 có báo giá sửa, 6 có tiền tiết kiệm).
- `KHUÔN TRÙNG NHIỀU NCC`: **22 cụm / 53 mã**, 19 cụm ở mức "chắc chắn" — tức là
  đang trả tiền mở khuôn hai–ba lần cho cùng một loại profile.
- `ĐỐI CHIẾU LỆCH`: 145 dòng / **20 mã** có số liệu đá nhau giữa các file cũ.

### 1.3 Khớp file mới với DB đang chạy

| Phép đo                                            | Kết quả                                             |
| -------------------------------------------------- | --------------------------------------------------- |
| 142 mã trong DB khớp mã chuẩn của file mới         | 101                                                 |
| …khớp qua "mã ghi trên file gốc"                   | 23                                                  |
| …**không khớp gì**                                 | **11** (DT02, VEC-B40, TW-HỘP 20x40x1.0, TW-22…)    |
| Mã trong file mới mà DB **chưa có**                | **88**                                              |
| kg/m giữa hai bên                                  | 94 khớp, **6 lệch**                                 |

Nói cách khác: nạp file này vào là danh mục khuôn nhảy từ 142 → khoảng 230 mã, và
có 11 + 6 = 17 điểm phải quyết bằng tay chứ không tự động được.

### 1.4 Khuôn đang nối với phần còn lại của ERP mạnh tới đâu

| Đường nối                                     | Số đo                    | Đọc ra                                                                                                                                        |
| --------------------------------------------- | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| BOM: `technical_product_parts.profile_code`   | 462/4203 dòng (11%)      | Trong đó chỉ **50 mã khớp danh mục khuôn** (247 dòng); 87 mã còn lại là gõ tay kiểu `15x35`, `VUONG20`, `OVAL` — quy cách chứ không phải mã khuôn |
| Số SP có ít nhất một chi tiết gắn khuôn       | **66/779 (8%)**          | Câu "khuôn này dùng cho SP nào" hôm nay trả lời được cho 8% hồ sơ                                                                              |
| Đơn mua: `supply_purchase_order_lines.die_code` | **0/207**              | Ô chọn khuôn trên form đơn mua **chưa từng được dùng thật lần nào**                                                                           |
| `technical_dies.supplier_id`                  | **0/142**                | Nơi giữ khuôn đang là chữ tự do, chưa trỏ vào 164 NCC trong `supply_suppliers`                                                                 |

Hai con số 0 ở trên là **cảnh báo thiết kế**, không phải lời mời xây thêm. Cái ô
chọn khuôn trên đơn mua đã có sẵn mà không ai dùng, thì việc cần làm là hỏi **vì
sao** (danh mục thiếu ảnh? thiếu mã? người soạn đơn không biết có ô đó?) trước khi
xây thêm ô thứ hai ở chỗ khác.

---

## 2. Khuôn là DANH MỤC, không phải chứng từ

Theo [`docs/tieu-chi-workflow-erp.md`](tieu-chi-workflow-erp.md) §1.2: danh mục thì
**không có vòng đời duyệt**, sửa tại chỗ và để lại vết. Khuôn đúng là loại đó — không
ai "gửi duyệt một cái khuôn".

Nhưng khuôn **có đời sống**, và đời sống đó hôm nay đang bị nhét vào ô ghi chú. Một
dòng thật trong DB:

> `Hư · TD-DTBD05 (Mở Lại) · Khuôn này vẫn còn bên Tiến Đạt Báo khuôn hư 23/2/2022 ĐỨC TOÀN MỞ LẠI KHUÔN 12/5/2022`

Một dòng ghi chú đó chứa 3 sự kiện, 2 mốc thời gian, 1 mã thay thế và 1 nơi giữ.
Không lọc được, không đếm được, không ai trả lời được "năm nay sửa bao nhiêu khuôn,
tốn bao nhiêu".

### 2.1 Máy trạng thái của một cái khuôn

```
      (đề nghị mở)
           │
           ▼
    ┌─ chờ mở khuôn ─┐
    │                │  mở xong
    │                ▼
    │          ┌─ đang dùng ─────────────┐
    │          │      │        │         │
    │   sửa/bỏ gân    │        │      không dùng nữa
    │          │      │        │         ▼
    │          └──────┘   báo hư      ít dùng
    │       (vẫn đang dùng,   │           │
    │        kg/m đổi)        ▼           │
    │                      khuôn hư ──────┤ (mở lại → đang dùng)
    │                                     ▼
    └──────────────────────────────► đã bỏ / không còn
                                          ▲
                     khuôn cũ (đã thay) ──┘
```

Trục thứ hai, **độc lập** với trạng thái trên: **nơi giữ khuôn**. Khuôn chuyển từ
Xuân Kỳ sang Tiến Đạt vẫn là khuôn đang dùng. File Excel trộn hai trục này vào một
cột (`Đã chuyển nơi khác` = 16 mã) nên hỏi "có bao nhiêu khuôn đang dùng" là ra số
sai. **Tách hai trục là quyết định thiết kế đầu tiên.**

### 2.2 Kéo theo: một sổ sự kiện

Mỗi lần đổi trạng thái / đổi nơi giữ / sửa gân ghi **một dòng sự kiện** có ngày,
người ghi, và số liệu kèm theo (kg/m trước–sau, tiền sửa). Ba thứ tự nhiên rơi ra
từ đó:

- Sheet `LỊCH SỬ SỬA KHUÔN` (43 dòng) **là** dữ liệu mồi cho sổ này, không cần bảng riêng.
- Mẹo `is_current` hiện tại (cùng mã nhiều dòng khác kg/m — 16 dòng "đời cũ" trong DB)
  hết lý do tồn tại: một mã = một dòng, kg/m đổi thì ghi sự kiện.
- Câu "năm nay sửa mấy khuôn, tiết kiệm bao nhiêu kg" trả lời được bằng một phép đếm.

---

## 3. Mô hình dữ liệu đề xuất

### 3.1 Mở rộng `technical_dies` (migration `0190`)

Thêm vào bảng đang có — không đụng cột cũ, không đổi tên cột nào (hai chỗ đang đọc):

| Cột thêm             | Kiểu                            | Vì sao                                                                        |
| -------------------- | ------------------------------- | ----------------------------------------------------------------------------- |
| `part_group`         | text                            | Nhóm chi tiết (Chân / Diềm bàn / Tựa…) — 12 giá trị, lọc chính của màn danh sách |
| `profile_shape`      | text                            | Dạng profile (Hộp vuông, Oval, La…)                                           |
| `alloy`              | text                            | Hợp kim (6063 / 96%)                                                          |
| `holder_name`        | text                            | **Nơi giữ khuôn** — tách khỏi `status`                                        |
| `holder_supplier_id` | uuid → `supply_suppliers`       | Điền được thì điền; không ép (xem §3.3)                                       |
| `legacy_codes`       | text[]                          | Mọi cách viết cũ của mã — đường tra ngược, và là chìa khoá khớp BOM            |
| `image_file_id`      | uuid → `files`                  | Ảnh mặt cắt (cùng nếp `technical_products.image_file_id`)                      |
| `data_confidence`    | text                            | `confirmed` / `needs_review` — thay cột "CẢNH BÁO lệch số liệu" + "Số file = 1" |
| `duplicate_group`    | text                            | Mã cụm trùng (22 cụm) — để lọc, không phải bảng riêng                         |
| `in_use_note`        | text                            | Ghi chú nghiệp vụ, sạch, sau khi đã bóc sự kiện ra khỏi `note`                 |

Mở rộng `status` từ 3 → 6 giá trị: `pending` (chờ mở) · `active` (đang dùng) ·
`rarely_used` (ít dùng) · `broken` (hư) · `replaced` (đã thay) · `retired` (đã bỏ).
Ba giá trị cũ giữ nguyên tên nên hai chỗ đang đọc không gãy. "Đã chuyển nơi khác"
**không** là trạng thái — nó là `holder_name` đổi + một dòng sự kiện.

### 3.2 Bảng mới `technical_die_events`

```
id · die_id → technical_dies (on delete cascade)
event_type: opened | modified | transferred | broken | replaced | retired | reopened | note
event_date date · created_by uuid → users · created_at
weight_before / weight_after numeric(12,4)   -- sửa gân
cost numeric(14,2)                            -- tiền mở / tiền sửa
from_holder / to_holder text                  -- chuyển nơi giữ
related_die_id uuid                           -- mã thay thế
content text · source text                    -- nguồn dữ liệu khi nạp từ file cũ
```

Và một cột `files.die_id` (theo đúng nếp `product_id` / `quote_id` đang có) để đính
ảnh mặt cắt + báo giá sửa khuôn vào hồ sơ khuôn.

### 3.3 Ba thứ CỐ Ý không làm

1. **Không ép `holder_supplier_id` thành bắt buộc.** 11 nơi giữ khuôn viết ngắn
   ("Tiến Đạt"), 164 NCC viết tên pháp nhân ("Công Ty TNHH Nhôm Tiến Đạt"). Ánh xạ
   11 dòng bằng tay là việc một buổi; ép FK là chặn người dùng ghi một nơi giữ mà
   phòng Cung ứng chưa kịp khai. Giữ text + trỏ FK khi có.
2. **Không FK từ dòng BOM sang khuôn.** `technical_product_parts.profile_code` là
   text và **phải giữ là text**: 87/137 giá trị đang có không phải mã khuôn mà là
   quy cách (`15x35`, `VUONG20`). Ép FK là hoặc mất 215 dòng dữ liệu, hoặc đẻ ra
   87 mã khuôn ma. Thay vào đó: khớp mềm theo `code` + `legacy_codes`, và bày
   **chất lượng khớp** ra màn hình.
3. **Không dựng vòng duyệt cho khuôn.** Không có nút "gửi duyệt". Đề nghị mở khuôn
   mới, nếu cần duyệt, là một **đơn mua** ở phòng Cung ứng — chứng từ đã có sẵn.

---

## 4. Khuôn phục vụ SẢN XUẤT — phần sâu nhất, và phần đang trống nhất

Mục 1–3 mới chỉ làm cho khuôn **được ghi chép tử tế**. Nhưng khuôn không phải để
lưu trữ: nó là thứ quyết định **cây nhôm nào về xưởng, dài bao nhiêu, cắt được mấy
phôi**. Mục này là chỗ tính năng đổi từ "sổ danh mục đẹp" sang "thứ xưởng dùng".

### 4.1 Chuỗi tính của xưởng — và chỗ nó đứt

```
  KHUÔN ──ép ra──► MÃ VẬT TƯ NHÔM (đặt mua theo CÂY hoặc KG)
    │                        │
    │ kg/m, tiết diện        │ chiều dài cây (6 m), số cây/bó, dung sai ±5%
    ▼                        ▼
  CHI TIẾT (BOM) ── dài cắt ──► số phôi/cây = ⌊(dài cây − đầu chừa) ÷ (dài cắt + mạch cưa)⌋
    │                                              │
    │ SL chi tiết của lệnh                         ▼
    └──────────────────────────► SỐ CÂY = ⌈SL ÷ số phôi/cây⌉ ──► KG = kg/m × dài cây × số cây
```

Đo trên **462 dòng định mức đang ghi mã khuôn**:

| Mắt xích                        | Phủ            | Đứt ở đâu                                        |
| ------------------------------- | -------------- | ------------------------------------------------ |
| Dài cắt (`cut_length_mm`)       | 430/462 (93%)  | ✅ xưởng có sẵn                                   |
| Tiết diện A × B                 | ~247/462 (53%) | một nửa                                          |
| **kg/m (`kg_per_m`)**           | **5/462 (1%)** | ❌ **đứt** — dù ô chọn khuôn lẽ ra tự điền số này |
| **Chiều dài cây**               | **0/462**      | ❌ **đứt**                                        |
| **Số phôi/cây (`pcs_per_bar`)** | **0/462**      | ❌ **đứt**                                        |
| Độ dày thành                    | 8/462 (2%)     | ❌                                                |
| Mã vật tư (`material_code`)     | 97/462 (21%)   | ❌ phần lớn không biết mua mã nào                 |

Và trên **994 chi tiết của 17 lệnh sản xuất đang chạy** (`production_components`,
trong đó 217 chi tiết nhôm):

| Trường                 | Phủ            |
| ---------------------- | -------------- |
| `spec_length_mm`       | 612/994 (62%)  |
| `dm_kg`                | 350/994 (35%)  |
| **`material_id`**      | **0/994**      |
| **`pcs_per_bar`**      | **0/994**      |

Đọc thẳng ra: **xưởng biết cắt dài bao nhiêu, nhưng không chỗ nào đổi được ra "mấy
cây nhôm"** — và đúng ba số còn thiếu (kg/m · dài cây · tiết diện) đều là **thuộc
tính của khuôn**, không phải của chi tiết. Đây chính là lỗi gốc đã ghi trong
[định mức quy đổi sang đơn vị mua](../src/lib/bom-unit.ts): số chi tiết bị đem dùng
làm số cây, thừa khoảng 6 lần.

Nói cách khác: **danh mục khuôn là mảnh còn thiếu của bài toán "lệnh này cần mấy cây
nhôm"**, chứ không phải một trang tra cứu cho vui.

### 4.2 Năm bảng TRA CỨU trong file — đó là dữ liệu sản xuất, đừng bỏ

Năm sheet `TRA CỨU - ...` (Phú Mỹ 125 · Alanmi 146 · Phong Gia Phát 252 · HHT 136 ·
Taiwan 66 dòng) đang bị coi là "phụ lục giữ nguyên từ file cũ". Thực ra chúng chứa
đúng những trường mà sheet DANH MỤC KHUÔN không có:

| Bảng            | Trường nó có mà danh mục không có                                      |
| --------------- | ---------------------------------------------------------------------- |
| Phú Mỹ          | **kg/6m** · **SỐ CÂY/BÓ** · độ dày · quy cách · nhóm hình dạng          |
| HHT             | **Chiều dài cây = 6000 mm** (ghi rõ từng dòng) · kích thước · độ dày    |
| Phong Gia Phát  | **Dung sai trọng lượng: 3 cột −0.05 / TIÊU CHUẨN / +0.05 (tức ±5%)**   |
| Alanmi          | kích thước · T · kg/m · kg/6m · hình dạng (HỘP VUÔNG / LA)             |
| Taiwan          | **Tỷ lệ quy đổi kg ↔ cây** (`1 kg = 1/0,98 cây`)                       |

Dung sai ±5% là con số nghiệp vụ thật, không phải chi tiết kỹ thuật: đặt 1 tấn nhôm
có thể nhận về lệch 5% số cây. Kho đang nhận theo cây, đơn mua tính theo kg — chênh
đó hôm nay không ai ghi ở đâu cả.

### 4.3 Trường thêm vào `technical_dies` cho sản xuất

Thêm vào cùng migration `0190` với các cột ở §3.1:

| Nhóm            | Cột                                                        | Ai dùng, để làm gì                                                         |
| --------------- | ---------------------------------------------------------- | -------------------------------------------------------------------------- |
| **Tiết diện**   | `section_a_mm` · `section_b_mm` · `wall_thickness_mm` · `outer_diameter_mm` | Nhận dạng cây nhôm · kiểm tra cây NCC giao có đúng khuôn không            |
|                 | `rib_count`                                                | **Số gân** — toàn bộ nghiệp vụ "bỏ gân" xoay quanh nó (28 mã đã sửa)        |
| **Cây nhôm**    | `bar_length_m` (mặc định 6,0)                              | Đổi từ dài cắt ra số cây                                                    |
|                 | `pcs_per_bundle`                                           | Kho + vận chuyển: nhận theo bó, không đếm từng cây                          |
|                 | `weight_tolerance_pct` (mặc định 5)                        | Đối chiếu kg đặt ↔ cây thực nhận                                           |
| **Gia công**    | `saw_kerf_mm` · `end_trim_mm`                              | Mạch cưa + đầu chừa — hai số làm phép chia phôi/cây ra số đúng              |
| **Nhận dạng**   | `surface_finish` · `marking`                               | Tổ định hình cầm cây nhôm không có mã: nhận bằng ảnh mặt cắt + dấu in       |

`saw_kerf_mm` / `end_trim_mm` nên có **giá trị mặc định toàn công ty** (khai một
lần ở cấu hình), khuôn chỉ ghi đè khi khác — không bắt Kỹ thuật gõ 230 lần cùng một số.

**Cố ý KHÔNG tự tính kg/m từ tiết diện.** kg/m là số **cân thật** (và 5 bảng tra
trên là số cân thật của từng NCC); tiết diện chỉ để nhận dạng. Tính lại từ công thức
là đẻ ra nguồn thứ hai cho cùng một số — đúng thứ file Excel này đang đi dọn.

### 4.4 Đường nối còn thiếu: khuôn → mã vật tư (`technical_die_materials`)

Hôm nay không có gì nối khuôn với 533 mã vật tư nhôm (ĐVT: Cây 486 · Kg 37 · Tấm 10).
Thiếu đường này thì biết kg/m cũng không biết **đặt mã nào**.

Một bảng nối nhỏ, nhiều–nhiều (một khuôn ép ra nhiều mã do khác độ dày / hợp kim /
xử lý bề mặt):

```
technical_die_materials: die_id → technical_dies · material_id → warehouse_materials
                         is_primary boolean · note text
```

**Mồi được bao nhiêu:** đo thử khớp tên vật tư với mã khuôn → **64/533 (12%)** mã vật
tư đã có sẵn mã khuôn nằm ngay trong tên (`NH-0167 "Nhôm tD-HG17 (10x50x 1li)"`,
`NH-0126 "Nhôm oval TD-HG09"`). 64 dòng mồi tự động, phần còn lại Kỹ thuật gắn dần khi
chạm tới — **đừng hứa 100% ngay**.

### 4.5 Ba câu của xưởng, trả lời được sau khi có

1. **"Cây nhôm này là khuôn nào?"** — tổ định hình cầm cây nhôm không có mã in.
   Tra bằng ảnh mặt cắt + tiết diện A×B×T. Đây là lý do 170 ảnh mặt cắt trong file
   là tài sản, không phải trang trí.
2. **"Lệnh này cần mấy cây, mấy kg?"** — kg/m + dài cây + dài cắt + mạch cưa.
   Hôm nay: 0/994 chi tiết trả lời được.
3. **"Khuôn hư thì lệnh nào chết?"** — khuôn → mã vật tư → định mức → lệnh sản xuất.
   Hiện có 5 khuôn hư + 7 chờ mở; không ai biết chúng chặn lệnh nào.

Câu 3 là thứ đáng làm nhất cho sản xuất, và nó **chỉ chạy được sau khi có §4.4** —
nên thứ tự các đợt ở §6 không đảo được.

### 4.6 Bốn thứ CỐ Ý không làm cho phần sản xuất

1. **Không quản lý lịch ép / đặt chỗ máy ép của NCC.** Máy không phải của mình, số
   liệu không kiểm được. Cần biết "bao giờ có hàng" thì đó là **hẹn giao trên đơn
   mua** — đã có sẵn.
2. **Không đếm số lần ép / tuổi thọ khuôn (shot count).** Không đo được. Thay bằng
   sự kiện "NCC báo hư" — thứ quan sát được thật.
3. **Không sinh lệnh cắt / sơ đồ cắt tối ưu (nesting).** Đó là bài toán riêng; ở đây
   chỉ cần số phôi/cây bằng một phép chia thẳng, có nói rõ đầu mẩu thừa.
4. **Không tự sửa 462 dòng định mức đang thiếu kg/m.** Khuôn là **nguồn** của số đó;
   dòng định mức lấy về khi người dùng chọn khuôn. Chạy script ghi đè hàng loạt là
   đè lên cả những dòng Kỹ thuật đã cân tay.

---

## 5. Màn hình

Theo sổ [`/design-lab`](../src/app/design-lab/page.tsx), chốt khuôn màn trước khi
chọn thành phần. Dựng **bằng `@/components/kit`** (màn mới).

### 5.1 `/khuon` — Khuôn C · Danh sách

Câu hỏi: _"Trong 230 cái khuôn, cái nào cần tôi động vào?"_

> **DỰNG BẰNG THEME V3 + `components/erp`/`shadcn`, KHÔNG dùng bộ kit mới** (chốt
> 13/09/2026 sau ba bản: bảng-kit → lưới-kit → lưới-v3). Luật chung của dự án là màn
> mới dùng `@/components/kit`; luật đứng trên nó là **một cặp màn người dùng đọc cùng
> nhau thì phải cùng một hệ**. Khuôn nhôm và Thư viện sản phẩm nằm cạnh nhau trong mục
> "Dùng chung", cùng là thư viện tra cứu có ảnh, người dùng nhảy qua lại giữa chúng —
> kit dày–phẳng–hairline đặt cạnh v3 bo góc–đổ bóng là hai bộ token đánh nhau ngay
> trước mắt người xem. Cấu trúc chép thẳng từ `ProductsManager`: `PageHeader` · thẻ
> lọc `bg-card rounded-lg border shadow-sm` · `StartPanel` (vòng tròn biểu tượng + một
> câu + hàng `FilterChip`) · lưới `ProductCard`-style · phân trang.
>
> **`/khuon/[id]` HIỆN VẪN dựng bằng kit** — biết là còn lệch, là việc kế tiếp.

**LƯỚI THẺ, KHÔNG PHẢI BẢNG** (chủ dự án chốt 13/09/2026 — bản bảng dày đã dựng rồi
và bị thay). Lý do không phải thẩm mỹ: **khuôn được nhận ra bằng hình mặt cắt**, như
sản phẩm được nhận ra bằng ảnh. Người ở xưởng cầm cây nhôm không có mã in trên thân,
họ so hình. Bản bảng nhét mặt cắt vào con tem 48×28px — bày thứ quan trọng nhất ở
kích thước không dùng được — còn kg/m và tiền khuôn, thứ hiếm khi cần lúc TÌM, thì
chiếm hết bề ngang. Đây đúng là bài toán của `/products`, nên mượn nguyên khuôn của nó.

- **Vào là thấy TRANG ĐẦU, không thấy hết** (chủ dự án chốt 13/09, lần sửa thứ hai).
  Bản trước KHÔNG đổ lưới cho tới khi người dùng gõ hoặc lọc — tiết kiệm thật, nhưng mở
  một thư viện ra mà không thấy thứ gì trong thư viện thì phải đoán trong đó có gì. Nay
  hiện ngay **24 thẻ**, phần còn lại đi theo phân trang; lối tắt theo nơi giữ co thành
  một hàng chip đứng trên lưới. **`/products` sửa cùng luật** — và ở đó `imagePref`
  `'auto'` cũng đổi nghĩa từ "chỉ hiện ảnh khi đang lọc" thành "bật", vì thư viện sản
  phẩm mở ra với 24 ô xám là mất đúng thứ khiến nó là thư viện.
- **Ảnh chỉ tải theo trang đang xem** — 24 thẻ/trang, tức trần 24 lượt gọi kho ảnh,
  bằng đúng chi phí một lượt tìm. Đây là chỗ bản đầu sai nặng nhất: nó đổ 169 ảnh ngay
  lúc mở trang.
- **Số trên chip đếm trên CẢ TẬP**, không phải trên trang đang xem (nguyên tắc 3 — con
  số là một lời hứa).
- **Ảnh KHÔNG đi qua `next/image`, và không phóng to.** Ảnh gốc trung vị 150×103 px;
  cho `sizes` ~288px thì trình tối ưu phóng lên `w=384` rồi mã hoá lại — hai lần làm mờ
  chồng nhau, đó chính là lý do mặt cắt trông nhoè. Nay thẻ `<img>` trần, hiện ở khổ
  gốc. Bấm nút phóng ở góc thẻ mở `KhuonImageViewer`: 1×/2×/3× bằng
  `image-rendering: pixelated` — nét vẽ kỹ thuật là đường thẳng mảnh, làm mượt biến
  chúng thành vệt xám, nhân điểm ảnh thì giữ được đường ở đâu và dày bao nhiêu.
  **Không thuật toán nào thêm được nét mà bản gốc không có** — muốn nét thật thì phải
  chụp lại từ bản vẽ gốc.
- Trên lưới có dòng tổng: `53 khuôn khớp · Tiền khuôn 311.076.200 ₫ · chưa gồm 18
  khuôn không ghi giá` (nguyên tắc 6).
- Ô tìm chạy trên `code` + `legacy_codes` + tên chi tiết + nơi giữ. Người xưởng nhớ
  "TD916-3", không nhớ "TD-916".
- Thẻ để `object-contain` và khung ảnh chỉ 124px: ảnh gốc trung vị 150×103 px, phóng
  to là thành vệt xám, mà cắt mép thì mất đúng thứ dùng để nhận dạng.

**Ba lỗi thẩm mỹ của bản lưới đầu tiên** (chủ dự án chê "giao diện xấu", sửa cùng ngày):

1. **Màn mở đầu là tường 16 ô số** — 5 ô "việc cần làm" + 11 ô "nơi giữ", cùng cỡ,
   cùng số 26px. Ba cái sai cùng lúc: năm ô đầu **lặp nguyên năm chip ngay phía trên**;
   `WorkTile` là ô VIỆC nên "Tiến Đạt 109" bị thổi thành một nhiệm vụ trong khi nó chỉ
   là nhãn phân nhóm; dòng chú "khuôn nơi này đang giữ" lặp 11 lần và nhãn hoa dài
   ("HOÀNG GIA HÀ NỘI") gãy hai dòng làm hàng ô so le. Nay là **một khối giữa màn** —
   một câu + hàng chip nơi giữ, đúng nhịp màn mở đầu của `/products`.
2. **Nền khung ảnh để xám** trong khi mặt cắt là PNG nét đen trên **nền trắng đặc** →
   ra một hình chữ nhật trắng nổi giữa ô xám. Nền khung ảnh nay trắng như thân thẻ.
   Ngược lại, thẻ **chưa có** mặt cắt thì để nền xám + viền đứt: ô trống phải trông
   như ô trống có chủ ý, không như ảnh đang tải dở.
3. **Thân thẻ là bốn hàng nhãn–giá trị cùng cỡ cùng độ đậm** (nhóm, kg/m, nơi giữ,
   tiền khuôn) — mắt không biết đọc đâu trước. Nay ba tầng rõ: mã + kg/m · tên chi
   tiết · nơi giữ + trạng thái. Tiền khuôn bỏ khỏi thẻ (lúc TÌM không ai cần), giữ ở
   hồ sơ và ở dòng tổng trên lưới.

### 5.2 `/khuon/[id]` — Khuôn E · Hồ sơ danh mục

Câu hỏi: _"Cái khuôn này là gì, đang ở đâu, ai giữ, dùng cho SP nào?"_

**Không** dùng ba trục trạng thái của khuôn chứng từ. Chỗ đó là `MetricStrip`, mỗi
ô kèm mẫu số:

| Ô                  | Nội dung                                                                  |
| ------------------ | ------------------------------------------------------------------------- |
| Đang dùng ở        | `4 SP` (mẫu số: _trên 779 hồ sơ, khớp theo mã khuôn_)                     |
| kg/m hiện hành     | `0,743` (kèm _đã bỏ 2 gân 14/12/2024, trước đó 0,780_)                    |
| Tiền mở khuôn      | `12.650.000 ₫` (kèm _đã hoàn 2013 — ĐH số 23_)                            |
| Lần động gần nhất  | `14/12/2024 · sửa gân`                                                    |

Thân trang: ảnh mặt cắt lớn bên trái · khối thuộc tính bên phải · tab
**Dùng ở SP nào** (khớp theo mã + mã cũ, ghi rõ _khớp chắc / khớp qua mã cũ_) ·
tab **Nhật ký đời khuôn** (sổ sự kiện) · tab **Tệp** (ảnh, báo giá sửa).

Kỹ thuật sửa tại chỗ (`canEdit`), mỗi lần đổi trạng thái / nơi giữ / kg/m thì **bắt
ghi một dòng sự kiện** — đây là chỗ duy nhất bắt buộc gõ thêm, và nó đổi lại toàn bộ
giá trị của tính năng.

### 5.3 `/khuon/ra-soat` — công cụ, dùng xong thì tắt

Hai việc một lần, đừng làm thành hai màn thường trực:

- **Trùng NCC** (22 cụm): mỗi cụm một khối, các mã xếp theo kg/m tăng dần, cụm nào
  cũng phải nói **bằng chứng** và **gợi ý xử lý** (file đã soạn sẵn hai cột này).
  Đây là màn có tiền thật: 19 cụm chắc chắn × ~9,7 triệu/khuôn bình quân.
- **Lệch số liệu** (20 mã / 145 dòng): mỗi mã bày các giá trị từng file cũ, Kỹ thuật
  bấm chọn số đúng → ghi vào danh mục + đặt `data_confidence = confirmed`. Xong
  20 mã là màn này trống, và trống **đúng nghĩa là xong**.

### 5.4 Đặt ở đâu

Khuôn là dữ liệu **dùng chung**: Kỹ thuật giữ, Cung ứng tra để đặt hàng, Sản xuất tra
để nhận dạng. Đúng khuôn của `/products` → `src/app/(shared)/khuon/*` + thêm vào
`SHARED_SECTION` của [`workspaces.config.ts`](../src/workspaces/workspaces.config.ts),
người xem giữ sidebar phòng mình.

Quyền: xem = mọi người đã đăng nhập. Sửa = `technical.edit` (+ Giám đốc), theo đúng
nếp `canEditProducts`.

---

## 6. Kế hoạch thực hiện — 7 đợt

Mỗi đợt kết thúc bằng **một thứ nghiệm thu được**, rồi dừng báo cáo.

> **Đợt 1 XONG 13/09/2026.** `0190_khuon_mo_rong.sql` đã áp remote,
> `scripts/khuon-import.mjs --apply` đã chạy: `technical_dies` 142 → **215 dòng**
> (+73 mới, 116 cập nhật), `technical_die_events` 40 dòng. Bản đối chiếu:
> [`docs/khuon-doi-chieu.md`](khuon-doi-chieu.md). Sao lưu trước khi ghi:
> `backups/technical-dies-2026-09-13.json`.
>
> **Ảnh mặt cắt XONG cùng ngày**: `scripts/khuon-images.mjs --apply` nạp
> **169 ảnh** (1,3 MB) lên bucket `attachments`, đường dẫn `die/<id>/…`,
> `files.die_id` + `technical_dies.image_file_id`. **169/215 khuôn có mặt cắt.**
> Ảnh thứ 170 neo ở dòng tiêu đề, không thuộc mã nào — bỏ đúng.
>
> **Đợt 2 XONG 13/09/2026.** `/khuon` (Khuôn C, xếp khối theo nơi giữ) và
> `/khuon/[id]` (Khuôn E) dựng bằng `@/components/kit`, đặt ở `(shared)` + thêm
> vào `SHARED_SECTION`. Nghiệm thu chạy thật: gõ **"TD916-3"** (cách viết cũ) ra
> đúng khuôn **TD-916**, thấy ảnh mặt cắt. Chỉ ĐỌC — chưa có nút sửa.
>
> Hai thứ đo được khi dựng: (1) ảnh nhúng bé thật — 167 ảnh, **trung vị 150×103
> px, không ảnh nào rộng quá 150** — nên khung ảnh ở hồ sơ để 200px chứ không
> phóng lên 420px thành vệt xám; (2) `TFoot` của kit tự thêm một ô `colSpan={2}`
> cho lời chú, nên `label + cells` phải cộng đúng `số cột − 2`.
>
> **Sửa lỗi tải + lỗi hiển thị 13/09/2026** (chủ dự án chỉ ra, đo lại xác nhận):
>
> - **Bản đầu đổ cả 169 ảnh ngay khi mở trang** — mỗi tấm là một vòng gọi Supabase
>   Storage (~1–1,5s, đo 31/08 ở thư viện SP). Nay theo đúng lối `ProductsManager`:
>   `auto` = ảnh chỉ hiện khi ĐANG tìm/lọc, cộng nút bật tay. Đo lại: **0 ảnh** lúc
>   mở, 47 ảnh sau khi bấm chip "Nghi trùng".
> - **Bản đầu dựng cả 215 dòng** — nay dựng 60 dòng, còn lại bấm "xem tiếp";
>   **chip vẫn đếm trên cả tập** vì số trên chip là một lời hứa.
> - **Lỗi trong chính bộ kit**: `Chip` thiếu `shrink-0 whitespace-nowrap` và
>   `FilterBar` thiếu `flex-wrap`, nên ở pane 705px chữ trong mọi chip gãy đôi và
>   tràn khỏi viền bo (chiều cao chip đóng cứng 26px). Vá ở kit nên `/mua-hang/don`
>   cũng hết vỡ.
> - `--table-min` phải khai theo số cột của màn: để mặc định 680px thì 8 cột bị ép
>   và tiêu đề "Tiền khuôn"/"Tình trạng" dính liền nhau.
> - Cột mã rộng 190px cho mã dài nhất (`DT-BD-02_11.5X11.5X3.5`) — hẹp hơn là mã bị
>   cắt **không có dấu ba chấm** rồi dính vào tên chi tiết.
> - Bỏ `step` ở `GroupRow`: số đó là số **công đoạn sản xuất**, gắn cho nơi giữ
>   khuôn là bịa ra thứ tự.

| Đợt              | Làm gì                                                                                                                                                                          | Nghiệm thu bằng                                                                                     |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| **1. Dữ liệu**   | Migration `0190` (cột mới + `technical_die_events` + `files.die_id`) · script nạp 189 mã, hợp nhất với 142 mã đang có, bóc **170 ảnh** lên Storage · nạp 43 dòng lịch sử sửa thành sự kiện · sinh `legacy_codes` | Một bản đối chiếu: bao nhiêu mã mới, bao nhiêu mã ghép, **17 điểm phải quyết tay** liệt kê đích danh |
| **2. Xem**       | `/khuon` (danh sách + chip lọc + tìm theo mã cũ) và `/khuon/[id]` (hồ sơ, chỉ đọc)                                                                                               | Mở trang, gõ "TD916-3" ra đúng khuôn, thấy ảnh mặt cắt                                              |
| **3. Sửa**       | Kỹ thuật sửa hồ sơ · ghi sự kiện (đổi trạng thái / chuyển nơi giữ / sửa gân) · thêm khuôn mới · đính ảnh                                                                        | Chuyển thật một khuôn từ Xuân Kỳ sang Tiến Đạt, nhật ký hiện đúng                                   |
| **3. Sửa** ✅ XONG 13/09 | `dies.schema/service` + `dieWriteRepo` · `POST /api/dept/technical/dies`, `PATCH\|DELETE .../[id]` · 4 action rbac `technical.die.*` · form dùng chung cho Thêm và Sửa · đổi tình trạng/nơi giữ/kg-m **tự đẻ nhật ký** | Đã chạy thật vòng thêm → sửa → xoá; nhật ký tự lên 3 dòng |
| **4. Dọn**       | `/khuon/ra-soat`: 20 mã lệch + 22 cụm trùng                                                                                                                                      | 20 mã lệch về `confirmed`; 22 cụm có kết luận                                                       |
| **5. Nối định mức** | Tab "Dùng ở SP nào" · nâng `DiePicker` (có ảnh + tìm theo mã cũ) · rà vì sao `die_code` trên đơn mua = 0                                                                     | Soạn thật một đơn nhôm chọn khuôn từ danh mục, `die_code` khác 0 lần đầu tiên                        |
| **6. Khuôn → vật tư** | Bảng `technical_die_materials` · script mồi **64 mã khớp theo tên** · màn gắn mã vật tư vào khuôn (§4.4)                                                                  | Mở một mã vật tư nhôm, thấy nó do khuôn nào ép; mở khuôn hư, thấy nó chặn mã vật tư nào             |
| **7. Xưởng dùng**  | Phép tính số phôi/cây + số cây (§4.1) chạy trên bảng kê vật tư của lệnh · cảnh báo "lệnh này dùng khuôn đang hư"                                                              | Một lệnh SX thật ra được số cây nhôm cần đặt, kèm câu đầu mẩu thừa bao nhiêu                         |

Đợt 1 là đợt nặng nhất và **không có giao diện nào** — đó là chủ ý. Dựng màn trước
khi dọn dữ liệu là dựng màn trên 39% ô trống.

Đợt 6–7 là phần sản xuất ở §4. Chúng đứng SAU vì phép tính số cây chỉ đúng khi kg/m
và chiều dài cây đã sạch; chạy sớm là ra một con số trông rất thuyết phục mà sai —
loại sai tệ nhất, vì không ai nghi ngờ nó.

---

## 7. Chín câu cần chốt trước khi làm Đợt 1

1. **74 mã "Chưa xác định" xử lý sao?** Nạp nguyên trạng và bày ra để Kỹ thuật điền
   dần (đề xuất), hay chặn lại chờ điền xong mới nạp?
2. **11 mã trong DB không khớp file mới** (DT02, VEC-B40, TW-22…) — giữ lại như khuôn
   riêng, hay coi là cách viết cũ của mã nào đó trong file?
3. **6 mã lệch kg/m giữa DB và file** — lấy số nào làm chuẩn? Đề xuất: lấy file mới
   (vừa hợp nhất từ 4 nguồn), ghi số cũ vào sự kiện để tra ngược.
4. **Tiền khuôn có phải theo dõi công nợ không?** Ghi chú có "đã hoàn tiền khuôn 2013
   (ĐH số 23)" — nếu tiền khuôn là khoản NCC hoàn lại thì nó thuộc Kế toán, và phải
   nói rõ ngay bây giờ để không phải đập ra làm lại.
5. **Ai được ghi sự kiện?** Chỉ Kỹ thuật (đề xuất), hay Cung ứng cũng ghi được khi NCC
   báo khuôn hư — vì thực tế tin khuôn hư đến từ NCC qua Cung ứng trước.
6. **Có cần "khuôn ở đâu" theo nghĩa tài sản không?** Tức là có bao giờ cần biên bản
   giao–nhận khuôn giữa công ty và NCC, hay chỉ cần ghi nhận nơi giữ là đủ?

Ba câu của phần sản xuất (§4) — cần hỏi thẳng **tổ định hình**, không suy từ file:

7. **Mạch cưa và đầu chừa mỗi cây là bao nhiêu mm?** Hai số này quyết định số phôi/cây.
   Đề xuất khai một giá trị chung toàn công ty, khuôn nào khác thì ghi đè.
8. **Chiều dài cây nhôm thực nhận là 6 m tròn hay có NCC giao 5,8 / 6,1 m?**
   Bảng HHT ghi 6000 mm cho mọi dòng, nhưng đó là catalogue của một NCC.
9. **Dung sai ±5% của Phong Gia Phát là chuẩn chung hay riêng NCC đó?** Nếu riêng thì
   `weight_tolerance_pct` phải khai theo từng nơi giữ khuôn chứ không để một mặc định.

---

## 8. Bẫy đã biết

- **Đừng dựng bảng khuôn thứ hai.** `technical_dies` đang được hai màn đọc; thêm
  bảng mới là tự tạo ra sheet ĐỐI CHIẾU LỆCH phiên bản 2.
- **Đừng bỏ `is_current` trước khi chuyển hết 16 dòng "đời cũ" thành sự kiện** —
  `diesRepo.search()` đang lọc theo cột đó, bỏ sớm là ô chọn khuôn trên đơn mua
  hiện cả khuôn đã hư.
- **Ảnh mặt cắt là thứ đắt nhất trong file này.** 170 ảnh nhúng, bóc bằng
  `readWorkbookImages` (đã có, dùng cho BOM) — nhưng ở đây ảnh neo **một ảnh một
  dòng** ở cột C, phải ghép theo `row` của anchor chứ không lấy ảnh lớn nhất như
  luồng BOM.
- **`ĐVT` có 1 dòng ghi `0.385`** — dữ liệu bẩn, script nạp phải chặn chứ không
  ghi thẳng.
- **`profile_code` trong BOM phần lớn KHÔNG phải mã khuôn** (87/137 mã). Tab "Dùng ở
  SP nào" phải nói rõ độ chắc của từng dòng khớp, đừng trưng một con số gộp.
- **Đừng tính kg/m từ tiết diện.** kg/m là số cân thật của từng NCC (5 bảng TRA CỨU
  chính là số cân đó). Suy từ công thức là đẻ nguồn thứ hai cho cùng một số.
- **Số phôi/cây phải chia THẲNG và nói ra đầu mẩu thừa.** Làm tròn êm cho đẹp là
  xưởng thiếu cây giữa ca — và không ai truy được vì sao (nguyên tắc 6 của
  [`/design-lab`](../src/app/design-lab/page.tsx): số nào không kiểm được thì không
  ai tin).
- **`pcs_per_bar` tồn tại ở CẢ HAI nơi** — `technical_product_parts` và
  `production_components` — và cả hai đều đang 0%. Khi bật §4.1 phải chốt nơi nào là
  nguồn, nơi nào là bản sao, kẻo lặp lại đúng bài học của file Excel này.
