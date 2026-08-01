-- VÁ PHÂN LOẠI MẪU ĐƠN CHO 2 NHÓM VẬT TƯ BỊ ĐOÁN SAI Ở 0106.
--
-- 0106 suy `po_template` từ `group_name` bằng ilike. Hai chỗ bắt nhầm:
--
-- 1. "Khuôn nhôm" (169 vật tư) → bị gán 'aluminium' vì khớp '%nhôm%'.
--    SAI BẬC TÍNH TIỀN: mua khuôn là mua BỘ KHUÔN, giá tính theo bộ. Mẫu
--    'aluminium' tính tiền = (kg/m × dài cây × số cây) × giá/kg và form BẮT
--    BUỘC có kg/m + dài cây mới cho gửi đơn — mà khuôn không có hai số đó
--    (kiểm tra: 0/169 dòng có `kg_per_m`, trong khi nhóm "Nhôm" là 252/276).
--    → 'simple' (SL × đơn giá), đúng cách phòng Cung ứng đặt khuôn.
--
--    Đây là hai thứ khác nhau dù tên gần giống: `technical_dies` là DANH MỤC
--    khuôn (tra kg/m khi đặt nhôm cây); nhóm vật tư "Khuôn nhôm" là MẶT HÀNG
--    khuôn để mua/trả tiền mở khuôn.
--
-- 2. 64 vật tư chưa khai mẫu (Mây-dây, Kính, Sơn, Hoá chất, Ngũ kim, Gỗ & ván,
--    và 2 dòng không có nhóm). Không nhóm nào trong 8 file đơn thật có mẫu
--    riêng, nên về 'simple' (SL × đơn giá) — trừ "Ngũ kim" là phụ kiện, cùng
--    loại với "Ngũ kim - phụ kiện" đã là 'accessory'.
--    Kính thực tế bán theo m²; chưa có đơn kính nào trong tập mẫu nên chưa
--    dựng mẫu riêng, để 'simple' và người dùng nhập tay.
--
-- KHÔNG sửa 0106 (đã apply, không rewrite migration đã chạy).
-- Idempotent: chỉ update theo `group_name`, chạy lại ra cùng kết quả.
-- RLS: không đổi tư thế bảng.

update public.warehouse_materials
set po_template = 'simple'
where group_name = 'Khuôn nhôm' and po_template is distinct from 'simple';

update public.warehouse_materials
set po_template = 'accessory'
where po_template is null and group_name = 'Ngũ kim';

update public.warehouse_materials
set po_template = 'simple'
where po_template is null;
