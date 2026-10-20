# Kho · Bước 3 — Tồn kho

Viết 16/09/2026, sau khi Bước 1 (nhập theo đơn) và Bước 2 (xuất theo thực tế
lấy) dựng xong. Cùng luật: một màn, 0 migration, dữ liệu thật từ commit đầu,
mỗi việc một commit có cách kiểm.

**Việc này gần như không có nghiệp vụ mới.** `stockService.listStockPage` đã
làm sẵn tất cả: lọc và phân trang Ở SERVER, tìm KHÔNG DẤU, bảy rổ có số đếm
cùng bộ lọc, và cột `available` = dùng được − giữ cho lệnh. Bước 3 là **dựng
lại giao diện** trên logic đang chạy, không viết service, không migration.

---

## 1. Câu hỏi nghiệp vụ

| Vai | Câu hỏi | Trả lời ở đâu |
| --- | --- | --- |
| Thủ kho | Mã này còn bao nhiêu, để kệ nào? | **Tồn kho** — ô tìm |
| Thủ kho / quản lý kho | Mã nào **cần tôi động vào** (sắp hết, đang khoá, chờ kiểm)? | chip rổ |
| Tổ trưởng SX | Lệnh tôi cần mã này, kho còn dùng được bao nhiêu? | cột Dùng được / Còn dùng |
| Cung ứng | (đã có) `/planning/stock` — góc nhìn người mua | không dựng lại |

Màn này **không** trả lời "đến ngày xưởng cần thì còn bao nhiêu" (tồn dự
kiến). Đó là câu của một màn khác, chưa xếp đợt.

## 2. Phạm vi — một màn, một route đọc

### 2.1 `/warehouse/ton` — Tồn kho · Khuôn C

**Bảy rổ**, mỗi rổ một câu hỏi, đếm bằng chính hàm màn dùng:

| Rổ | Nghĩa | Mặc định |
| --- | --- | --- |
| **Đang có tồn** | `on_hand > 0` | ✓ |
| Dưới mức | `is_low` (ngưỡng đặt lại hàng) | |
| Hết dùng được | `qty_ok = 0` — còn hàng chờ kiểm vẫn là hết với người đi cấp | |
| Chờ kiểm | `qty_qc > 0` | |
| Khoá | `qty_blocked > 0` | |
| Thiếu cho lệnh | `available < 0` — đã hứa nhiều hơn số có | |
| Cả danh mục | ghi rõ **13.229** để không ai tưởng bị giấu hàng | |

**Sáu cột lượng** — đây là ruột của màn:

| Cột | Nghĩa |
| --- | --- |
| **Dùng được** | cấp đi được ngay (`qty_ok`) |
| Chờ kiểm | đã nhận, chưa được dùng |
| Khoá | hỏng / sai quy cách, chờ quyết |
| Giữ cho lệnh | đã hứa cho LSX đã duyệt |
| **Còn dùng** | Dùng được − Giữ; **âm = đã hứa nhiều hơn số có** |
| Kệ gợi ý | `shelf_location` (5/13.229 mã có khai) |

Tìm (không dấu), lọc nhóm, rổ, trang — **tất cả trên URL**, gửi link ra đúng
danh sách đó. Chân bảng nói tổng KHÔNG gồm gì.

Hành động trên dòng: **Xuất** (mở `/warehouse/xuat` với mã điền sẵn). Không
có ô nào gõ được số tồn — tồn chỉ đổi qua phiếu.

### 2.2 Không route API mới

Trang là server component, gọi thẳng `stockService.listStockPage`. Ô tìm
vật tư của form xuất đã có route riêng (`stock/ton?ids=`).

## 3. Số thật hôm nay — màn sẽ gần như rỗng

| Phép đo 16/09/2026 | Số |
| --- | ---: |
| Mã trong danh mục | 13.229 |
| **Mã có tồn ≠ 0** | **1** (ACQ0003, 5 Cái) |
| Mã chờ kiểm / khoá | 0 / 0 |
| Mã khai ngưỡng tối thiểu | 5 |

Nên **trạng thái rỗng của từng rổ quan trọng ngang bảng**: rỗng vì kho chưa
nhập hàng khác hẳn rỗng vì lọc quá tay, và câu thứ nhất phải chỉ sang Hàng
về. Đây cũng là lý do rổ mặc định là "Đang có tồn" chứ không phải cả danh
mục: 13.229 dòng gần như toàn số 0 là một bức tường vô nghĩa.

## 4. Thứ tự thi công — 3 việc

| # | Việc | Kiểm bằng |
| --- | --- | --- |
| 1 | Artboard + kế hoạch (bản này) | chủ dự án duyệt trên canvas |
| 2 | Màn `/warehouse/ton` + mục nav | chip đếm khớp số bấm ra; F5 giữ lọc; 1 mã có tồn hiện đúng 5 |
| 3 | Nút Xuất trên dòng → form xuất điền sẵn mã | bấm từ tồn sang xuất, mã đã ở lưới |

## 5. Cố ý chưa làm

Tồn dự kiến theo thời gian · hồ sơ một vật tư (Khuôn E) · tồn theo kệ · xuất
Excel · sổ phiếu trong khu Kho (đang mượn `/planning/docs`) · kiểm kê.
