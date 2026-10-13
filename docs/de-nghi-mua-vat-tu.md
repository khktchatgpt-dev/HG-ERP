# Đề nghị mua vật tư (0236)

Số hoá tờ **"Giấy đề nghị mua vật tư"** Kho vật tư đang viết tay, chụp gửi Zalo
nhóm cho lãnh đạo (ảnh 13/10/2026: anh Hào, 9 dòng hàng tiêu hao, lãnh đạo trả
lời "Ok" trong chat). Bản vẽ duyệt 13/10: https://claude.ai/artifact/6bFb19HuFtSzT8y2wqT17g
(Q1–Q9 theo đề xuất).

**Luồng (DN-0):** Nháp (Kho) → Chờ duyệt (lãnh đạo) → Đã duyệt (Cung ứng lập đơn)
→ Đang mua → Xong. Từ chối = về Nháp + lý do. Huỷ = giữ phiếu, nhãn Đã huỷ.

| Bước | Việc | Trạng thái |
| --- | --- | --- |
| Đ1 | Kho lập / sửa nháp / gửi / rút / huỷ · sổ đề nghị · in theo mẫu giấy | **XONG 13/10** — cần áp `0236` |
| Đ2 | Lãnh đạo duyệt (điện thoại + Hộp thư duyệt) · sửa SL · từ chối có lý do · thông báo | chưa làm |
| Đ3 | Cung ứng: "Đề nghị đã duyệt, chờ lập đơn" → lập đơn mẫu Phụ tùng/bảo trì (chọn hạng mục 0230), nối dòng ↔ dòng đơn | chưa làm |
| Đ4 | Nhãn "từ ĐNM" ở Hàng về · tự sang Xong khi về đủ · (Q8) nhận hàng mua lẻ N2 | chưa làm |

**Đ1 gồm:** bảng `warehouse_purchase_requests` + `_lines` (0236, RLS bật không
policy, mã `DNM-YYYY-NNNN`), quyền `warehouse.request.manage` (Kho), màn
`/warehouse/de-nghi` (sổ, rổ Kho cần làm / Chờ duyệt / Đang mua / Xong),
`/warehouse/de-nghi/moi` + `/[id]` (khuôn F: dòng có mã lấy tên + ĐVT từ danh mục,
tồn hiện tại + giá mua gần nhất từ dòng đơn thật `pricesRepo.lastPurchases`, chỉ
đơn VND; dòng chưa có mã gõ tên tự do), `/print/de-nghi/[id]` (mẫu giấy: quốc
hiệu, hai ô ký "Duyệt của lãnh đạo" · "Người đề nghị"). Luật thuần `lib/de-nghi.ts`
(vướng gửi duyệt, tổng dự kiến, ai đang giữ phiếu) dùng chung server + màn.

**Bẫy:** mã vật tư nằm trên dòng đề nghị tính là "đã dùng" (`materialsRepo.usage`
→ `de_nghi`) — chưa áp 0236 thì đếm lỗi và **chặn xoá mọi mã vật tư** (an toàn,
nhưng phải áp migration TRƯỚC khi deploy). Kiểu bảng trong `database.types.ts`
khai tay — áp xong chạy "sync types" để thay bằng bản sinh.
