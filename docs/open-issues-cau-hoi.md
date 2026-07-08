# 12 câu hỏi cần Hoàng Gia chốt (Open Issues OI-01…12)

Gửi: Ban Giám đốc / trưởng các phòng. Mỗi câu đã ghi sẵn **hệ thống đang chạy
thế nào** — nếu đồng ý với cách đang chạy thì chỉ cần tick ✔, không phát sinh
việc; nếu chọn khác, cột "Nếu đổi" cho biết khối lượng.

| # | Câu hỏi | Hệ thống ĐANG chạy (mặc định) | Nếu chọn khác |
|---|---|---|---|
| **OI-01** | Công nợ theo dõi **theo từng đơn hàng** hay **tổng theo đối tác**? | Chưa làm (GĐ2). Dữ liệu đã đủ để làm theo cả 2 cách | Không ảnh hưởng GĐ1 — quyết trước khi làm phân hệ Kế toán |
| **OI-02** | Có cần **đa tiền tệ + tỷ giá** (quy đổi USD↔VND trên báo cáo)? | Bán ghi USD, mua ghi VND, **không quy đổi**. Mỗi chứng từ giữ nguyên tệ | Thêm bảng tỷ giá + cột quy đổi — làm được không đập gì |
| **OI-03** | Thanh toán của khách: có cần lưu **từng lần thu tiền** (cọc → giao)? | Mới lưu %cọc + điều khoản trên đơn/hợp đồng để in | GĐ2: thêm bảng phiếu thu gắn đơn |
| **OI-04** | Có **NCC nước ngoài / nhập khẩu** (thuế + phí nhập cộng vào giá vật tư)? | PO nhận VND/USD; chưa có phí nhập khẩu | GĐ2: thêm cột phí phân bổ vào giá vật tư |
| **OI-05** | Có cần tính **giá thành / lời-lỗ theo đơn hàng**? | Chưa tính. Đã chừa sẵn: giá bán (đơn), giá mua (PO), `unit_cost` trên phiếu kho | GĐ2: thêm view tính — không đổi cấu trúc |
| **OI-06** | **Danh mục / mẫu hợp đồng** doanh nghiệp dùng những loại nào? (DN hứa cung cấp) | Có sẵn khung Sale Contract in từ đơn hàng; loại hợp đồng để trống trong danh mục dùng chung | Gửi mẫu → thêm vào danh mục + dựng bản in tương ứng |
| **OI-07** | Có **đồng bộ ERP ↔ MISA** không, hay chạy độc lập? | Chạy độc lập, ERP không hạch toán/hoá đơn/thuế | Nếu đồng bộ: cần bàn riêng phạm vi + API MISA |
| **OI-08** | **Kiểm kê kho** có cần trong giai đoạn này không? | Chưa có màn kiểm kê; DB đã sẵn (loại phiếu KK + điều chỉnh tồn) | Có → build form đếm thực tế + phiếu chênh lệch (~0.5 ngày) |
| **OI-09** | **Điều chuyển vật tư** giữa vị trí kệ có cần **phiếu in** không, hay chỉ sửa vị trí trên danh mục? | Sửa vị trí kệ trực tiếp trên danh mục vật tư; chưa có phiếu DCK | Có → build phiếu điều chuyển in được (~0.5 ngày, DB sẵn) |
| **OI-10** | Đơn đặt NCC có **ĐVT kép** (cây↔kg, tấm↔m²): đơn giá tính theo ĐVT nào là chuẩn? | Nhập cả 2 số (SL đặt + SL quy đổi) dạng tự do; **đơn giá × SL đặt** ra thành tiền; quy cách ghi text | Nếu muốn đơn giá theo ĐVT phụ (đ/kg): đổi công thức thành tiền (~nhỏ) |
| **OI-11** | Spec sản xuất in trên LSX (màu dây/nệm/sơn, đóng gói): **ai nhập, ở bước nào** — Sales lúc tạo đơn hay Kế hoạch lúc phát LSX? | DB có chỗ chứa (bảng spec per dòng LSX); **form nhập chưa mở** vì chờ câu trả lời này | Trả lời xong → mở form đúng chỗ (~0.5 ngày) + bản in LSX |
| **OI-12** | Xác nhận: **bán USD / mua VND, KHÔNG quy đổi tỷ giá** trong giai đoạn 1? | Đang chạy đúng như vậy (theo mẫu in thật) | Nếu sai → cho biết thực tế để chỉnh mặc định |

## Trả lời nhanh (dành cho DN)

Chỉ cần trả lời dạng: `OI-08: Có` / `OI-09: Không cần phiếu` / `OI-11: Kế hoạch
nhập lúc phát LSX`… Các câu không trả lời = giữ mặc định đang chạy.

**3 câu ảnh hưởng ngay đến việc build tiếp:** OI-08, OI-09, OI-11 (tổng ~1–1.5
ngày công nếu đều "Có"). Các câu còn lại thuộc phân hệ Kế toán GĐ2.
