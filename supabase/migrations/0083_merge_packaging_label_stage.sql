-- 0083_merge_packaging_label_stage.sql
-- Gộp 'bao_bi' + 'tem_nhan' (thêm ở 0082) thành MỘT công đoạn duy nhất:
-- 'bao_bi' = "Bao bì & tem nhãn". Xưởng làm bao bì + dán tem trong cùng một
-- khâu, không tách tổ riêng → 1 công đoạn.
--
-- 'tem_nhan' vừa thêm ở 0082, CHƯA có lộ trình SP nào tham chiếu → xoá an toàn
-- (lộ trình lưu CODE dạng text, không FK). Chuỗi cuối còn 12 công đoạn:
-- … lắp ráp → bao bì & tem nhãn → đóng gói → hoàn thiện.
--
-- Idempotent. Apply: `npx supabase db push` / SQL editor.

update public.catalog_items
  set label = 'Bao bì & tem nhãn'
  where type = 'production_stage' and code = 'bao_bi';

delete from public.catalog_items
  where type = 'production_stage' and code = 'tem_nhan';

-- Chuẩn hoá lại thứ tự (bỏ tem_nhan): 12 công đoạn.
update public.catalog_items as c set sort_order = v.ord
from (values
  ('phoi', 1), ('han', 2), ('nguoi', 3), ('mai', 4), ('son', 5),
  ('moc', 6), ('dan', 7), ('may', 8), ('lap_rap', 9),
  ('bao_bi', 10), ('dong_goi', 11), ('hoan_thien', 12)
) as v(code, ord)
where c.type = 'production_stage' and c.code = v.code;
