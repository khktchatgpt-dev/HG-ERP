# Báo giá: upload file Excel + gỡ nút xung đột quy cách

Trạng thái: **ĐÃ LÀM XONG phần upload (10/08/2026)** — còn 2 quyết định về dữ liệu ở §4.

Chủ dự án chốt hai việc: (a) bỏ dán vùng ô, thay bằng **upload file Excel báo giá**
— vì file báo giá SP mới mang theo cả ảnh lẫn thông số, thứ vùng dán không có;
(b) nêu vấn đề **quy cách trên báo giá khác hồ sơ sản phẩm**.

---

## 1. Đã gỡ tính năng dán vùng ô ✅

Gỡ trọn `lib/order-paste`, `OrderPasteDialog` và phần nối vào form đơn hàng
(commit `adaa27b`). Bộ dán BOM của Kỹ thuật (`PartsBulkEntry`) **không đụng tới** —
đó là tính năng riêng, vẫn dùng.

## 2. Vấn đề quy cách — đã dò ra gốc

Hồ sơ sản phẩm đang giữ **hai bộ kích thước song song**, hai phòng điền hai nơi,
không bên nào biết bên kia:

| Bộ | Cột | Đơn vị | Ai điền | Ai đọc |
|---|---|---|---|---|
| A | `packing.l_cm / w_cm / h_cm` | **cm** | Kinh doanh (khi báo giá) | báo giá, hợp đồng |
| B | `length_mm / width_mm / height_mm` (+ `*_open_mm`) | **mm** | Kỹ thuật (hồ sơ SP, định mức) | hồ sơ SP, lệnh SX |

### Số đo trên dữ liệu thật (593 SP)

| | SP |
|---|---|
| Có kích thước **cm** (báo giá đọc) | **12** |
| Có kích thước **mm** (hồ sơ kỹ thuật) | **353** |
| Có **cả hai** | 4 |
| Trong 4 đó, **lệch nhau** | **3** |
| Trống cả hai | 232 |

⇒ Hai hệ quả, cái nào cũng nặng:

1. **Báo giá in ra trống kích thước với 98% sản phẩm** — hệ có 353 SP đã đo đủ,
   nhưng báo giá không đọc bộ đó nên coi như không có.
2. Khi cả hai cùng có thì **3/4 lệch**, và lệch theo *ba kiểu khác nhau*:

| Mã SP | Báo giá (cm) | Hồ sơ (mm) | Kiểu lệch |
|---|---|---|---|
| CH0197HG-AL | 55,5 × 63 × 93,5 | 555 × 630 × 935 | ✅ khớp |
| CH0095HG-AL | 68 × 62 × 99 | 620 × 680 × 990 | **hoán vị trục** — 68cm=680mm nhưng nằm ở ô Rộng |
| CH0065HG-AL | 58 × 60 × 87,5 | 548 × 565 × 876 | **số đo khác nhau** (580≠548) — hai lần đo khác nhau |
| ST0076HG-IR | 239,5 × 239,5 × 52 | 1520 × 800 × 760 | **đo hai vật khác nhau** (bộ vs một món?) |

Kiểu "hoán vị trục" không phải lỗi nhập: chính script backfill cũ đã ghi rõ quy
ước của nó là `dimd → l_cm (sâu ≈ dài)`, tức **hai bên định nghĩa "Dài" khác
nhau** — một bên coi chiều sâu là dài, bên kia coi chiều ngang là dài.

> Đây cũng chính là câu hỏi **Q3** đang treo trong
> [dinh-muc-redesign-plan.md](./dinh-muc-redesign-plan.md) §7: *"KTSP đơn vị nào —
> biểu mẫu ghi mm, hệ lưu cm"*. Giờ nó không còn là câu hỏi lý thuyết nữa.

### Đề xuất: MỘT nguồn cho kích thước sản phẩm

Chia lại vai cho hai bộ trường, không để chồng lấn:

* **Kích thước SẢN PHẨM** → chỉ sống ở `length/width/height_mm` (mm, hồ sơ SP).
  Báo giá **đọc** từ đây và tự quy ra cm khi in. Bỏ 3 ô `l_cm/w_cm/h_cm`.
* **Đóng gói & logistics** → ở lại `packing`: `carton_l/w/h_cm`, `qty_per_carton`,
  `loading_40hc`, `nw_kg`, `gw_kg`. Không trùng với bộ trên.
* **Chốt định nghĩa trục một lần** (Dài = cạnh nào, khi SP có chiều gập/mở thì lấy
  số nào) và ghi vào nhãn ô, để không tái diễn.
* Di trú: 12 SP đang có cm → đối chiếu tay với mm (chỉ 4 SP đụng nhau, 3 cần
  người quyết số nào đúng), phần còn lại quy đổi máy.

Việc này **phải làm trước** phần upload: nếu không, file Excel đổ vào lại sinh ra
bộ số thứ ba.

## 3. Upload file Excel báo giá — thiết kế

### Mục tiêu
Sale gửi file báo giá (SP mới, có ảnh + thông số) → hệ thống đọc: tạo/khớp sản
phẩm, gắn ảnh vào hồ sơ, dựng dòng báo giá — thay cho gõ tay từng SP.

### Nền có sẵn
* `exceljs` + `xlsx` đã là dependency; exceljs đọc được **ảnh nhúng**
  (`workbook.model.media` + `worksheet.getImages()` cho neo theo ô).
* Đường nạp ảnh vào hồ sơ SP đã chạy thật: 154 ảnh từ sổ TỔNG HỢP (07/2026), và
  `lsx-products-import.mjs` đã có nhánh `fill_image`.
* Kho lưu ảnh + gắn vào SP: `files` + `technical_products.image_file_id`.
* **Chưa có**: module bóc ảnh dùng lại được trong `src/` — trước nay làm rời bằng
  script sinh plan JSON. Lần này viết thành module server để nút bấm gọi được.

### Luồng đề xuất
1. Sale bấm **“Nạp từ file Excel”** trong form báo giá → chọn file.
2. Server đọc file: mỗi dòng → mã SP / tên / quy cách / đơn giá; ảnh nhúng gắn
   theo dòng neo.
3. **Màn xem trước** (bắt buộc, không ghi thẳng): mỗi dòng hiện ảnh thu nhỏ, khớp
   được SP nào, thiếu trường gì; đánh dấu rõ **SP mới sẽ được tạo**.
4. Sale duyệt → ghi: tạo SP mới (kèm ảnh) + dựng dòng báo giá.
5. Dòng không khớp / thiếu mã → báo ra, không nuốt im lặng.

### Ràng buộc phải giữ
* SP mới chỉ vào thư viện Kỹ thuật **khi Sale bấm lưu** — giữ đúng nguyên tắc
  “không tạo SP mồ côi” mà form hiện tại đang theo.
* Quy cách đọc từ file ghi vào **bộ mm** (theo §2), không sinh thêm ô cm.
* Ảnh: chặn theo `MAX_UPLOAD_BYTES` như đường upload hiện có.

---

## 4. Trạng thái các câu hỏi

### Đã trả lời được từ CHỨNG TỪ GỐC (10/08/2026)

Tìm được bảng kê quy cách thật của công ty trong `Downloads/All Bom`:
`BKQC - C0065HG-AL - Hoanggia - Ghế đan mây Rattan.xlsx`. Ô KTTT ghi:

```
KTTT: 548 x 565 x 876    (L/D x W x H) mm
```

| # | Câu hỏi | Trả lời |
|---|---|---|
| **4.1** | File mẫu | ✅ Đã có 2 file thật để đối chiếu (QCBG- GIGA DAYBED = phiếu hỏi giá của khách, ảnh neo theo ô; BKQC- = bảng kê nội bộ). Mẫu mới sinh bằng `scripts/make-quote-template.mjs`. |
| **4.3** | “Dài” là cạnh nào, đơn vị gì | ✅ **Dài(/Sâu) × Rộng × Cao, đơn vị mm** — đúng nhãn `(L/D x W x H) mm` của bảng kê. File mẫu + bộ đọc đã theo chuẩn này. |
| **4.4** — ca CH0065 | Số nào đúng | ✅ **Bộ mm đúng**: bảng kê ghi 548×565×876, khớp `length/width/height_mm`; bộ cm (58×60×87,5) là số gõ tay làm tròn sai. |

⇒ Suy ra cho §2: **bộ mm là nguồn đúng**, bộ cm là số nhập tay kém tin cậy.

### Đã gộp xong (migration 0129 — 10/08/2026)

Bộ `packing.l_cm/w_cm/h_cm` **đã xoá khỏi DB**. Kích thước SP nay chỉ sống ở ba
cột mm. Sao lưu trước khi xoá: `supabase/backups/2026-08-10_product_dims_cm.json`.

* 8 SP chỉ có cm → chuyển sang mm (×10), **giữ nguyên thứ tự trục** (không tự
  hoán vị — xem danh sách cần rà bên dưới).
* 4 SP có cả hai → giữ bộ mm.
* `ST0076HG-IR` (SET "1 Bank II + 1 Table"): hai bộ số đo HAI VẬT khác nhau —
  cm là kích thước cả bộ, mm là món bàn. Đã chép kích thước bộ vào `notes`
  ("2395 x 2395 x 520 mm") để không mất, mm giữ nguyên.
* Ô nhập cm đã gỡ khỏi: hồ sơ SP (tab Đóng gói), form bổ sung quy cách của Sale,
  form tạo nhanh SP, và `packingSchema` — không còn đường nào ghi lại bộ cm.
* Báo giá/bản in **không đổi gì trên mặt giấy**: vẫn in cm, tự quy từ mm
  (`@/lib/packing-dims`). Đã đối chiếu BG-2026-0001: 212×95×75 y như trước.

### Cần Kỹ thuật rà lại 5 SP (số đã chuyển nguyên xi, không đoán thay)

| Mã | Số hiện tại (D/S × R × C mm) | Ngờ gì |
|---|---|---|
| `RHONE-DT` | 2120 × 950 × 750 | Bàn ăn sâu 2,12m là vô lý ⇒ nhiều khả năng **hoán vị Dài↔Rộng** |
| `RHONE-BENCH` | 1870 × 360 × 450 | Cùng kiểu; so với `BN0190HG-AL` (360 × 1870 — đúng chuẩn) thì bản này ngược |
| `21605-217` | 1500 × 900 × 740 | Bàn 150×90: cạnh dài đang nằm ở ô Dài/Sâu |
| `CH0170HG-AL` | 705 × 595 × **111** | Ghế cao 11,1 cm — có thể là chiều cao khi GẤP, hoặc gõ thiếu số |
| `26443-228` | 800 × 700 × **—** | Thiếu hẳn chiều cao |

Ba ca đầu đều là kiểu "l = cạnh dài nhất" (lối Sale) thay vì "L/D = sâu" (chuẩn
bảng kê). Máy không tự đảo vì đoán sai thì hỏng số thật; sửa tay trên hồ sơ SP
(tab Đóng gói, ô mm) là xong.

## 5. Đã làm xong (10/08/2026)

* Mẫu `docs/mau/MAU_BAO_GIA_SP_MOI.xlsx` (sinh bằng script, 20 cột).
* Bộ đọc `lib/quote-excel.ts` + luật khớp `lib/quote-import-match.ts` (32 test).
* Luồng hai nhịp: xem trước (không ghi gì) → lưu (tạo SP mới kèm ảnh + dựng báo giá).
* Màn `/sales/quotes/import` + nút “Nhập từ Excel” ở danh sách báo giá + tải file mẫu.
* Chặn 5 ca hỏng dữ liệu: trùng nhiều SP · SP ngừng dùng · trùng dòng trong file ·
  số âm/bằng 0 · mã tạm đụng nhau (và danh mục đổi giữa xem trước với lưu).
