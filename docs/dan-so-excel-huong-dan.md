# Dán sổ Excel — hướng dẫn cho thống kê

Màn: **Thống kê sản xuất → Ghi sổ hằng ngày → Dán sổ Excel** (`/thongke/dan-so`).
Dùng để nạp số CŨ và số HẰNG NGÀY từ tờ công đoạn trong sổ Excel (PHÔI · HÀN · NGUỘI · SƠN).

## Mỗi lần dán (mỗi tờ một lần)

1. Chọn **Lệnh**, **Công đoạn**, **Tổ** đúng với tờ định dán. Tờ SƠN không ghi tổ — chọn đúng tổ sơn đã làm.
2. Trong Excel, bôi cả vùng từ **hàng tiêu đề** (có chữ "Tên chi tiết") xuống hết, Ctrl+C.
3. Bấm vào ô vàng, Ctrl+V, bấm **Xem trước**. Chưa ghi gì cho tới khi bấm **Ghi**.
4. Soi lưới: mỗi nhóm là một mã SP (có tên SP). Cột "Tình trạng" cho biết từng dòng:
   - **Khớp** / **Khớp cụm** (Hàn, Nguội, Sơn đếm theo CỤM) — ổn.
   - **chia n đợt** — mã SP tách nhiều đợt giao, số được lấp theo thứ tự đợt (đợt sớm đủ trước).
   - **Thêm mới** — chi tiết chưa có trên lệnh, sẽ thêm vào bảng chi tiết.
   - **Lệnh khác — bỏ qua** — mã SP không thuộc lệnh đang chọn (tờ Excel gộp nhiều lệnh). Bình thường.
   - **Gần khớp** → bấm *nhận* (đúng là chi tiết đó) hoặc *thêm mới* (là chi tiết khác).
   - **Chọn cụm…** → chọn cụm của lệnh cho cụm trong file; chọn một lần là áp cho mọi dòng cùng cụm.
   - Ô đỏ chữ sai (không phải số) → bấm *bỏ*, rồi nhờ người giữ file sửa lại ô đó.
5. Khi thanh trên báo **Sẵn sàng ghi**, bấm **Ghi**. **Đợi tới khi hiện "Đã ghi"** — cả tờ có thể mất vài phút. Đừng bấm Ghi lần nữa, đừng đóng trang.
6. Kiểm: **Sổ công đoạn → Tổng theo mã SP** (cần · đã làm · còn thiếu theo từng mã).

## Dán hằng ngày

Dán lại **cả tờ** mỗi ngày được: ô đã có số đúng bằng số dán thì bỏ qua, chỉ ghi ô mới. Ô đã có số **khác** thì KHÔNG ghi đè (màn báo "khác") — sửa ở **Sổ theo ngày**.

## Cần biết

- Phiếu tạo từ đây là **phiếu nhập bù**: không có giờ công nên **không vào màn Năng suất**. Muốn có giờ công thì ghi bằng **Ghi sản lượng**.
- Ngày đã **chốt sổ** của tổ không ghi được; ngày chưa tới thì chặn.
- Cột "Tổng cần" trong file chỉ để đối chiếu, không ghi vào hệ thống.
- Mỗi phiếu mở được ở **Sổ theo ngày** để sửa tới khi chốt sổ ngày.
- Chưa dán được: các tờ riêng theo tổ (HÀN KHOÁN – Tổ Lâm/Sự/Huy…), tờ GIA CÔNG, công đoạn Lắp ráp / Đóng gói.
