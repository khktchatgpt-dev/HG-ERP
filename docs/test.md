giamdoc.test@hg.com	Manager · Ban Giám Đốc	Ban Giám đốc (/exec)	Duyệt/từ chối BG + PO + LSX (duyệt LSX ngay tại /exec/lsx), cập nhật giai đoạn/báo hoàn thành, xem chéo mọi phòng — KHÔNG nhập sản lượng (siết 07/2026: chỉ bộ phận SX ghi sổ)
kinhdoanh.test@hg.com	NV · Bán Hàng	Sales (/sales)	Khách hàng, lập báo giá, gửi duyệt, tạo đơn từ BG duyệt, sửa đơn, phát LSX (+ Xem trước bản in LSX có watermark trước khi phát)
kythuat.test@hg.com	QL · Kỹ Thuật	Kỹ thuật (/technical)	Tạo/sửa SP, BOM, upload file, đặt ảnh đại diện, nhân bản mẫu, mẫu showroom (kể cả mẫu độc lập: vật liệu/đối thủ/prototype)
kehoachsx.test@hg.com	NV · Kế Hoạch Sản Xuất	Kế hoạch - Cung ứng (/planning)	ĐỊNH HÌNH sản xuất (/production/shaping): bảng chi tiết cụm/định mức + lộ trình giai đoạn per SP, lưu lộ trình mặc định cho SP — KHÔNG tạo PO, KHÔNG nhập sản lượng
cungung.test@hg.com	NV · Cung Ứng - Mua Hàng	Kế hoạch - Cung ứng (/planning)	Thêm NCC, tạo PO từ LSX, gửi NCC (sau khi GĐ duyệt), theo dõi hàng về/phiếu kho — KHÔNG định hình, KHÔNG nhập sản lượng/tiến độ (tách vai 07/2026)
thukho.test@hg.com	QL · Kho	Kho (/warehouse)	Danh mục vật tư, phiếu nhập/xuất, in 01-VT/02-VT, quét mã
totruong.test@hg.com	NV · Xưởng Sản Xuất	Sản xuất (/production)	Lệnh đang chạy (card lớn), nhập sản lượng/gia công ngoài, cập nhật giai đoạn, xác nhận nhận VT, báo hoàn thành — KHÔNG định hình, KHÔNG duyệt/tạo PO/lập phiếu kho
thongke.phoi@hoanggia.de	NV · Tổ Phôi	Sản xuất (/production)	Thống kê tổ: menu "Nhập sản lượng" → công đoạn TỰ CHỌN THEO TỔ (Phôi), sổ tự gắn tên tổ; xoá được bản ghi mình nhập nhầm. Tương tự: thongke.han / thongke.nguoi / thongke.sonsat / thongke.sonnhom / thongke.may / thongke.codien (@hoanggia.de)

DEMO XƯỞNG (seed 07/2026, trên LSX-2026-0001 — mở bằng totruong.test hoặc thongke.*; cungung.test giờ chỉ xem):
- Bảng chi tiết: 7 dòng / 2 SP (Bàn Tilos nhôm + Ghế Paxos) — có dòng "KHUNG MẶT BÀN" công đoạn cuối = Sơn (đã 100% Hoàn thành), "CHÂN TRƯỚC" cuối = Hàn (đã Hoàn thành), "GIẰNG TỰA" cố tình thiếu ĐM + hệ số cây (demo cột "—" + cảnh báo)
- Lộ trình giai đoạn: 4/4 SP đã chốt Phôi→Hàn→Sơn→Hoàn thiện (bỏ Mài) — sổ chặn nhập giai đoạn ngoài lộ trình, ma trận/bảng tổng hiện "—" ở Mài
- Sổ sản lượng: 15 dòng từ 08→11/07 (có phế phẩm, kg, máy/màu, ghi chú) — xem sổ nhóm theo ngày + tổng kết + lọc + Xuất CSV ở màn "Nhập sản lượng" hoặc tab Sản lượng của LSX; bảng chi tiết đang KHOÁ (banner 🔒 vì đã có sổ)
- Gia công ngoài: TAY+TỰA → "Gia công TTP" (giao 2 đợt 300+100, nhận 250 hỏng 5 → thiếu 150, 63%), KHUNG MÊ → "Gia công Vinh" (giao 200 chưa nhận)
- Định hình (kehoachsx.test): /production/shaping → LSX-2026-0001 — bảng chi tiết khối-per-SP; thử bỏ chip "Sơn" rồi Lưu để thấy chặn mâu thuẫn công đoạn cuối; bỏ "Hàn" → chặn vì đã có sản lượng
- TÁCH VAI XƯỞNG (07/2026 đợt 2): thongke.* login → menu gọn (Lệnh đang chạy / Việc của tổ / Nhập sản lượng / Gia công ngoài); /production/team = Kanban thẻ LSX×công đoạn TỔ MÌNH (khoá đúng công đoạn; giamdoc.test/admin vào thì có picker chọn tổ) — Bắt đầu/Xong công đoạn → tổ kế tiếp trên lộ trình + GĐ nhận chuông "bàn giao công đoạn"; trong thẻ có cut-list KH/TT + ô "Báo sự cố" → hiện panel đỏ ở /production/progress (giamdoc bấm "Đã xử lý" → người báo nhận chuông); admin gán tổ↔công đoạn ở /admin/departments (mục "Công đoạn phụ trách", chỉ tổ workspace production)

MK chung mọi tài khoản test: Test@1234
