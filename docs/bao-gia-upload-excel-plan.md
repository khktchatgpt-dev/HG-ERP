# Báo giá: upload file Excel + gỡ nút xung đột quy cách

Trạng thái: **§1 đã xong · §2–§3 chờ chốt + chờ file mẫu** (10/08/2026).

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

## 4. Đang chờ chủ dự án

| # | Cần | Vì sao chặn |
|---|---|---|
| **4.1** | **File Excel báo giá mẫu** (1–2 file thật, có ảnh + SP mới) | Không có thì không viết được bộ đọc: không biết dòng tiêu đề ở đâu, cột nào là gì, ảnh neo theo ô hay theo vùng. Đây là thứ chặn cứng. |
| **4.2** | Chốt §2: gộp về **một bộ mm**, báo giá tự quy ra cm khi in? | Làm upload trước khi chốt sẽ đẻ ra bộ số thứ ba. |
| **4.3** | Định nghĩa trục: “Dài” là cạnh nào? SP gập/mở lấy số nào? | 3/4 SP đang lệch chính vì hai phòng hiểu khác nhau. |
| **4.4** | 3 SP lệch số thật (CH0095, CH0065, ST0076) — số nào đúng? | Máy không quyết thay được; cần người đo/đối chiếu. |
