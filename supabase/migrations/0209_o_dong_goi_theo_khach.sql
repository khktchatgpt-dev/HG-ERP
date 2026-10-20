-- 0209: Ô ĐÓNG GÓI — quy cách đóng và số kiện.
--
-- Chủ dự án chốt 19/09/2026: mọi sản phẩm tính theo CÁI trong sản xuất, còn
-- **đóng gói thì tuỳ khách** — có loại đóng riêng từng cái, có loại đóng chung
-- cả bộ.
--
-- VÌ SAO KHÔNG ĐƯA "KIỆN" VÀO THANG ĐẾM SẢN XUẤT. Thang đếm hiện có ba bậc:
-- chi tiết (phôi) → cụm (hàn→sơn) → cái (lắp ráp→hoàn thiện). Kiện KHÔNG phải
-- bậc thứ tư: cùng một cái ghế, khách A yêu cầu đóng riêng thì ra 1 kiện, khách
-- B gộp bốn ghế một kiện thì 4 cái mới ra 1 kiện — con số phụ thuộc YÊU CẦU
-- KHÁCH chứ không phụ thuộc việc xưởng làm được bao nhiêu. Nhét nó vào chuỗi
-- phôi→hàn→sơn là trộn hai loại đơn vị vào một trục.
--
-- Đối chiếu ERP (19/09): ba trong bốn hệ KHÔNG có đơn vị đo riêng theo công
-- đoạn; lời giải chung của họ là tách cấp, và đóng gói là một tầng riêng
-- (handling unit / package). Chỉ SAP có Operation UoM, và đó là thứ đã cân
-- nhắc rồi loại — xem header 0207.
--
-- NÊN: kiện là THUỘC TÍNH CỦA LƯỢT ĐÓNG GÓI, khai bằng đúng cơ chế ô-riêng-
-- theo-công-đoạn vừa dựng ở 0207. Không bảng mới, không sửa một dòng mã nào.
--
-- CHƯA LÀM (và đừng làm sớm): bảng quy cách đóng gói cố định theo
-- (khách × sản phẩm) để khỏi gõ lại mỗi lượt và để Sales biết trước số kiện mà
-- báo giá cước. Chỉ dựng khi xưởng thật sự thấy phiền vì gõ lại — hiện chưa có
-- lượt đóng gói nào chạy thật để biết điều đó.
--
-- RLS: không đổi posture (production_stage_fields đã enable từ 0207).
-- Idempotent: insert on conflict do nothing.

insert into public.production_stage_fields
  (stage_code, field_key, label, kind, options, sort_order) values
  ('dong_goi', 'quy_cach_dong', 'Quy cách đóng', 'select',
     '["Đóng riêng từng cái", "Đóng chung cả bộ", "Theo yêu cầu riêng"]'::jsonb, 60),
  -- Số kiện thực tế đóng được trong lượt ghi. Để người dùng khai chứ KHÔNG suy
  -- từ số cái: tỷ lệ cái→kiện đổi theo khách, và một lượt có thể đóng dở.
  ('dong_goi', 'so_kien', 'Số kiện', 'number', null, 61)
on conflict (stage_code, field_key) do nothing;
