-- 0196 — Kệ GỢI Ý mặc định cho vật tư, suy từ nhóm.
--
-- BỐI CẢNH. Sau 0193, `warehouse_materials.shelf_location` đổi nghĩa: nó không
-- còn là "hàng đang nằm đâu" (nơi thật giờ là `bin_id` trên từng dòng sổ) mà là
-- KỆ GỢI Ý MẶC ĐỊNH — điền sẵn lúc cất hàng, sửa được.
--
-- Đo 15/09/2026: 5 trên 13.229 mã có điền. Nghĩa là màn Cất hàng phải bắt thủ
-- kho chọn tay trong 13 khu cho TỪNG DÒNG, kể cả những dòng mà nhóm vật tư đã
-- nói thừa chỗ để. Gợi ý theo nhóm biến việc thường ngày thành một cú xác nhận.
--
-- CHỈ ĐIỀN Ô ĐANG TRỐNG. `where shelf_location is null or btrim(...) = ''` —
-- 5 mã người dùng đã tự khai giữ nguyên. Ghi đè chúng bằng một suy luận từ
-- nhóm là đổi thứ ai đó biết chắc lấy thứ máy đoán.
--
-- ĐÂY LÀ GỢI Ý, KHÔNG PHẢI SỰ THẬT — nó không đụng một dòng sổ nào, không đổi
-- tồn, không đổi nơi hàng đang nằm. Sai thì sửa ở màn danh mục vật tư, hoặc cứ
-- chọn kệ khác lúc cất.
--
-- Nhóm "Dịch vụ - gia công - vận chuyển" (239 mã) KHÔNG có kệ: không có gì để cất.
--
-- RLS: không đụng. Idempotent (chạy lại chỉ điền tiếp ô còn trống).

update public.warehouse_materials m
set shelf_location = v.bin
from (values
  ('Nhôm định hình - tấm',                'NHOM-A'),
  ('Sắt thép - tôn - tấm',                'SAT-B'),
  ('Inox',                                'SAT-B'),
  ('Bu lông - vít - đinh - liên kết',     'PK-C'),
  ('Phụ kiện nội thất',                   'PK-C'),
  ('Mút - xốp - nệm - gòn',               'NEM-D'),
  ('Vải - da - chỉ - phụ liệu may',       'VAI-E'),
  ('Dây mây - vật liệu đan',              'MAY-F'),
  ('Sơn - keo - hoá chất',                'SON-G'),
  ('Dầu - nhớt - mỡ bôi trơn',            'SON-G'),
  ('Bao bì - đóng gói - tem nhãn',        'BB-H'),
  ('Gỗ - ván - chi tiết gỗ mua ngoài',    'GO-K'),
  ('Kính - mica - nhựa tấm',              'GO-K'),
  ('Cơ khí - vòng bi - khuôn',            'CK-L'),
  ('Ống - van - khí nén - thủy lực',      'CK-L'),
  ('Dụng cụ cầm tay - lưỡi mũi - nhám',   'DC-M'),
  ('Vật tư hàn - cắt',                    'DC-M'),
  ('Điện - chiếu sáng - điều khiển',      'DIEN-N'),
  ('Máy móc - thiết bị',                  'DIEN-N'),
  ('Văn phòng - nội bộ - bảo hộ',         'VP-P')
) as v(grp, bin)
where m.group_name = v.grp
  and (m.shelf_location is null or btrim(m.shelf_location) = '');
