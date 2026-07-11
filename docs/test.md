giamdoc.test@hg.com	Manager · Ban Giám Đốc	Ban Giám đốc (/exec)	Duyệt/từ chối BG + PO, phát LSX, cập nhật tiến độ, xem chéo mọi phòng (read-only)
kinhdoanh.test@hg.com	NV · Bán Hàng	Sales (/sales)	Khách hàng, lập báo giá, gửi duyệt, tạo đơn từ BG duyệt, sửa đơn
kythuat.test@hg.com	QL · Kỹ Thuật	Kỹ thuật (/technical)	Tạo/sửa SP, BOM, upload file, đặt ảnh đại diện, nhân bản mẫu
cungung.test@hg.com	NV · Kế Hoạch SX-cung ứng	Kế hoạch - Cung ứng (/planning)	Thêm NCC, tạo PO từ LSX, gửi NCC (sau khi GĐ duyệt)
thukho.test@hg.com	QL · Kho	Kho (/warehouse)	Danh mục vật tư, phiếu nhập/xuất, in 01-VT/02-VT, quét mã
totruong.test@hg.com	NV · Xưởng Sản Xuất	Sản xuất (/production)	Xem lệnh đang chạy (card lớn), cập nhật giai đoạn, xác nhận nhận VT, báo hoàn thành — KHÔNG duyệt/tạo PO/lập phiếu kho. Mật khẩu: test1234

DEMO XƯỞNG (seed 07/2026, trên LSX-2026-0001 — mở bằng totruong.test hoặc cungung.test):
- Bảng chi tiết: 7 dòng / 2 SP (Bàn Tilos nhôm + Ghế Paxos) — có dòng "KHUNG MẶT BÀN" công đoạn cuối = Sơn (đã 100% Hoàn thành), "CHÂN TRƯỚC" cuối = Hàn (đã Hoàn thành), "GIẰNG TỰA" cố tình thiếu ĐM + hệ số cây (demo cột "—" + cảnh báo)
- Sổ sản lượng: 15 dòng từ 08→11/07 (có phế phẩm, kg, máy/màu) — xem tổng hợp thiếu/dư/%HT/đồng bộ trong chi tiết LSX + /production/board (thử Xuất Excel CSV)
- Gia công ngoài: TAY+TỰA → "Gia công TTP" (giao 2 đợt 300+100, nhận 250 hỏng 5 → thiếu 150, 63%), KHUNG MÊ → "Gia công Vinh" (giao 200 chưa nhận)