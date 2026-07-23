-- 0082_production_stages_packing.sql
-- Thêm 2 công đoạn cuối chuyền còn thiếu: BAO BÌ + TEM NHÃN.
--
-- Bối cảnh: xưởng có chuỗi cuối "… lắp ráp → BAO BÌ → TEM NHÃN → đóng gói →
-- hoàn thiện". 'dong_goi' (đóng gói) + 'hoan_thien' (hoàn thiện) đã seed ở 0072;
-- còn thiếu 'bao_bi' và 'tem_nhan' như CÔNG ĐOẠN riêng để đưa vào lộ trình
-- per-SP + ghi sản lượng / kanban tổ như mọi công đoạn khác.
--
-- Đây chỉ là danh mục CÔNG ĐOẠN (catalog_items type='production_stage'), KHÔNG
-- phải nghiệp vụ đóng gói/kiện riêng. Lộ trình lưu CODE (0063) nên đổi sort_order
-- chỉ đổi cách bày, không đụng lệnh đang chạy.
--
-- Lưu ý: code 'bao_bi' cũng tồn tại ở type='material_group' (0011) — khác `type`
-- nên không đụng nhau (unique theo (type, code)).
--
-- RLS: catalog_items giữ posture từ 0011. Idempotent: insert on conflict do
-- nothing + update sort_order (đặt lại cùng giá trị an toàn khi chạy lại).
-- Apply: `npx supabase db push` / SQL editor. Danh mục mềm — về sau thêm/ẩn
-- công đoạn qua /admin/catalogs, không cần migration.

-- 1) Thêm 2 công đoạn mới.
insert into public.catalog_items (type, code, label, sort_order) values
  ('production_stage', 'bao_bi',   'Bao bì',   10),
  ('production_stage', 'tem_nhan', 'Tem nhãn', 11)
on conflict (type, code) do nothing;

-- 2) Chuẩn hoá thứ tự mặc định 13 công đoạn (chèn bao_bi/tem_nhan trước đóng gói).
update public.catalog_items as c set sort_order = v.ord
from (values
  ('phoi', 1), ('han', 2), ('nguoi', 3), ('mai', 4), ('son', 5),
  ('moc', 6), ('dan', 7), ('may', 8), ('lap_rap', 9),
  ('bao_bi', 10), ('tem_nhan', 11), ('dong_goi', 12), ('hoan_thien', 13)
) as v(code, ord)
where c.type = 'production_stage' and c.code = v.code;
