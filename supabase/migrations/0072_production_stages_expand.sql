-- 0072_production_stages_expand.sql
-- Mở rộng danh mục CÔNG ĐOẠN sản xuất (catalog_items type='production_stage').
--
-- Bối cảnh: xưởng thực tế nhiều công đoạn hơn 5 cái seed ở 0011 (phôi/hàn/sơn/
-- mài/hoàn thiện). File theo dõi thật + dải SP (khung nhôm/sắt/inox, mây nhựa,
-- nệm vải, gỗ keo) cho thấy còn: Nguội (làm sạch mối hàn), Mộc (gia công gỗ),
-- Đan (mây/nhựa/dây), May (nệm/bọc), Lắp ráp, Đóng gói. Tách Sắt/Nhôm KHÔNG
-- phải công đoạn — do TỔ đảm nhận (phần tổ↔công đoạn ở 0064). Gia công ngoài
-- là cờ trên bản ghi, không phải công đoạn.
--
-- Mỗi loại SP đi LUỒNG RIÊNG (thứ tự khác nhau) — lộ trình per-SP quyết định
-- chuỗi thật; sort_order dưới đây chỉ là THỨ TỰ MẶC ĐỊNH khi bày danh mục.
--
-- Không đụng bản ghi lệnh đang chạy: chỉ thêm code mới + cập nhật sort_order
-- (lộ trình lưu CODE, không lưu số thứ tự — đổi sort_order chỉ đổi cách bày).
--
-- RLS: catalog_items giữ nguyên posture từ 0011. Idempotent: insert on conflict
-- do nothing + update sort_order (đặt lại cùng giá trị an toàn khi chạy lại).
-- Apply: `npx supabase db push` hoặc SQL editor. Danh mục mềm — về sau thêm/ẩn
-- công đoạn qua màn admin, không cần migration.

-- 1) Thêm 6 công đoạn mới (giữ nguyên 5 mã cũ).
insert into public.catalog_items (type, code, label, sort_order) values
  ('production_stage', 'nguoi',    'Nguội',              3),
  ('production_stage', 'moc',      'Mộc (gia công gỗ)',  6),
  ('production_stage', 'dan',      'Đan (mây/nhựa)',     7),
  ('production_stage', 'may',      'May (nệm/bọc)',      8),
  ('production_stage', 'lap_rap',  'Lắp ráp',            9),
  ('production_stage', 'dong_goi', 'Đóng gói',           10)
on conflict (type, code) do nothing;

-- 2) Chuẩn hoá thứ tự mặc định của cả 11 công đoạn (idempotent).
update public.catalog_items as c set sort_order = v.ord
from (values
  ('phoi', 1), ('han', 2), ('nguoi', 3), ('mai', 4), ('son', 5),
  ('moc', 6), ('dan', 7), ('may', 8), ('lap_rap', 9), ('dong_goi', 10),
  ('hoan_thien', 11)
) as v(code, ord)
where c.type = 'production_stage' and c.code = v.code;
