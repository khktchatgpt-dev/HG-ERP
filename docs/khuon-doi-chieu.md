# Bản đối chiếu nạp khuôn — 2026-09-13

Nguồn: `C:/Users/HP/Downloads/QUAN LY KHUON NHOM - HOP NHAT_5.xlsx`
Chế độ: **GHI DB (--apply)**

## 1. Tổng quan

| Phép đo | Số |
| --- | --- |
| Mã khuôn trong file | 189 |
| Dòng đang có trong DB | 142 |
| Ghép được vào dòng DB đã có | 116 |
| **Mã MỚI sẽ thêm** | **73** |
| Dòng DB không thấy trong file | 11 |
| Ảnh mặt cắt bóc được | 170/189 (90%) |
| Sự kiện sửa khuôn | 43 dòng / 30 mã |
| Mã thuộc cụm nghi trùng | 53 |
| Mã cần rà (lệch số liệu hoặc 1 nguồn) | 80 |

## 2. Điểm PHẢI QUYẾT TAY

### 2.1 Lệch kg/m giữa DB và file — 0 mã

kg/m hiệu lực = **cột "kg/m sau sửa" nếu có**, không thì cột "Trọng lượng kg/m".
Trong file có 14 mã đã sửa gân nên hai cột khác nhau.

_Không có mã nào lệch mà không giải thích được._

**6 mã DB còn giữ số TRƯỚC sửa** — file có số sau bỏ gân, ghi đè an toàn + đẻ một sự kiện:

| Mã | DB (trước sửa) | File (sau sửa) | Nhẹ đi |
| --- | ---: | ---: | ---: |
| TD-A592 | 0.324 | 0.289 | 0.0350 kg/m |
| TD-B532 | 0.33 | 0.313 | 0.0170 kg/m |
| TD-HG17 | 0.428 | 0.385 | 0.0430 kg/m |
| AM-HG06 | 0.325 | 0.305 | 0.0200 kg/m |
| TW-HG01 | 0.472 | 0.436 | 0.0360 kg/m |
| TW-HG13 | 0.936 | 0.847 | 0.0890 kg/m |

### 2.2 Dòng DB không tìm thấy trong file — 11 mã

Giữ lại như khuôn riêng, hay là cách viết cũ của một mã nào đó trong file?
Script **giữ nguyên, không đụng tới** cho tới khi có quyết định.

| Mã | Tên | kg/m | Tình trạng |
| --- | --- | ---: | --- |
| DT-BD-02_11.5X11.5X3.5 | Ắc sao | 0.219 | active |
| DT02 | Diềm ngắn bàn 190x90x74cm | 0.5137 | active |
| VEC-B40 | Diềm bàn | 0.564 | active |
| VEC-B628 | Diềm bàn | 0.432 | active |
| VEC-A708 | Chân bàn | 0.337 | active |
| VY-HG17 | Tay ghế, nan ghế | 0.311 | active |
| TW-HỘP 20x40x1.0 1 gân |  | 0.36 | active |
| TW-HỘP 20x40x1.0 |  | 0.308 | active |
| TW-HỘP 10x20x1.2 |  | 0.174 | active |
| TW-22 | Bàn CNKG và Giường nằm, bàn CN 150x90cm, nhôm gỗ | 0.431 | active |
| TW-LA22-2 | La bịt đầu khuôn B629 | 0.714 | active |

### 2.3 File ghi "Chưa xác định" mà DB đang 'active' — 16 mã

Script **GIỮ `active`**: hạ xuống `unknown` là ô chọn khuôn trên đơn mua
(lọc `status = active`) mất luôn số mã đó. Muốn bày đúng sự thật thì phải sửa
`diesRepo.search()` ở Đợt 2 trước, rồi chạy lại script với quyết định mới.

### 2.4 Sự kiện sửa khuôn không khớp mã nào — 2

HG06 · XCNHNKTHUTHONGGIA

## 3. Sẽ ghi gì khi chạy `--apply`

- **Thêm 73 mã mới** vào `technical_dies`.
- **Cập nhật 116 mã đã có**: nhóm chi tiết, dạng profile, hợp kim, nơi giữ, mã cũ, độ tin cậy, cụm trùng.
- **Ghi 43 sự kiện** vào `technical_die_events` (event_type = modified).
- **KHÔNG** đụng: `is_current`, `supplier_id`, và các dòng ở mục 2.2.
- **CHƯA** nạp 170 ảnh mặt cắt — ảnh phải đi qua `filesService` (bucket, đường dẫn, quyền), làm ở bước riêng ngay sau bước này.

Trong 73 mã mới có **58 mã trạng thái `unknown`** — đó là sự thật của file, không phải lỗi nạp.

## 4. Phân bố THEO FILE

_Là số của file, chưa trừ 16 mã giữ nguyên `active` ở mục 2.3._

| Tình trạng | Số mã |
| --- | ---: |
| active | 99 |
| unknown | 74 |
| pending | 7 |
| broken | 5 |
| replaced | 3 |
| retired | 1 |

| Nơi giữ khuôn | Số mã |
| --- | ---: |
| Tiến Đạt | 95 |
| Ynghua | 31 |
| TaiWan | 23 |
| Việt Eco | 12 |
| Miên Hua | 9 |
| Quang Minh | 9 |
| Xuân Kỳ | 4 |
| Phong Gia Phát | 2 |
| Việt Ý | 2 |
| ALANMI | 1 |
| Hoàng Gia Hà Nội | 1 |

