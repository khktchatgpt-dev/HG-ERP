# Đề nghị mua vật tư (0236)

Số hoá tờ **"Giấy đề nghị mua vật tư"** Kho vật tư đang viết tay, chụp gửi Zalo
nhóm cho lãnh đạo (ảnh 13/10/2026: anh Hào, 9 dòng hàng tiêu hao, lãnh đạo trả
lời "Ok" trong chat). Bản vẽ duyệt 13/10: https://claude.ai/artifact/6bFb19HuFtSzT8y2wqT17g
(Q1–Q9 theo đề xuất).

**Luồng (DN-0):** Nháp (Kho) → Chờ duyệt (lãnh đạo) → Đã duyệt (Cung ứng lập đơn)
→ Đang mua → Xong. Từ chối = về Nháp + lý do. Huỷ = giữ phiếu, nhãn Đã huỷ.

| Bước | Việc | Trạng thái |
| --- | --- | --- |
| Đ1 | Kho lập / sửa nháp / gửi / rút / huỷ · sổ đề nghị · in theo mẫu giấy | **XONG 13/10** — 0236 + 0231 ĐÃ ÁP (MCP), types đã sync, thử trọn luồng trên DB thật |
| Đ2 | Lãnh đạo duyệt (điện thoại + Hộp ký) · sửa SL · từ chối có lý do · thông báo | **XONG 13/10** — 0237 ĐÃ ÁP (MCP) |
| Đ3 | **Kho tự mua** (đổi 13/10, không qua Cung ứng): "Nhập hàng đã mua" trên phiếu đã duyệt — PNK N2 có đơn giá thật, nơi mua, số hoá đơn; gắn / tạo mã dòng chưa có mã; nhập nhiều lần | chờ duyệt bản vẽ v3 |
| Đ4 | Đếm đã nhập / duyệt · tự sang Xong khi đủ · Chốt xong có lý do khi thiếu | chưa làm |

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

**Đ2 gồm:** quyền `warehouse.request.approve` (= người duyệt đơn mua, Q1); màn
duyệt `/duyet/de-nghi/[id]` ở KHU DÙNG CHUNG (người chỉ duyệt đơn mua không vào
được `/exec`; mở từ thông báo trên điện thoại) — mỗi dòng một khối chữ cho 390px,
sửa số duyệt từng dòng, Duyệt / Từ chối (bắt lý do), hai nút lớn ở đáy trên điện
thoại, góc trên phải trên máy tính, khung đọc 900px; Hộp ký (`signBox`) có loại
"Đề nghị mua" (ký nhanh được, không cờ giá trị lớn — chưa cam kết chi); thông báo
`dnm_submitted` (người duyệt) · `dnm_approved` (người đề nghị + trưởng phòng Cung
ứng) · `dnm_rejected` (người đề nghị, kèm lý do), mỗi thông báo mang `href` mở
thẳng phiếu (trang thông báo + chuông nay mở được chứng từ, không chỉ việc). Không
tự duyệt phiếu mình đề nghị (trừ admin).
