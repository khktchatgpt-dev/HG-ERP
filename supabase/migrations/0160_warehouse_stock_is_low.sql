-- 0160 — warehouse_stock: thêm cột IS_LOW để lọc "tồn thấp" bằng SQL.
--
-- BỐI CẢNH (hoàn thiện Kho 16/08/2026): `low_only` của stockRepo.list lọc Ở
-- CLIENT trên kết quả fetch — mà PostgREST trần 1000 dòng/lượt, danh mục 13k mã
-- → vật tư dưới min nằm ngoài 1000 mã đầu theo alphabet KHÔNG BAO GIỜ về tới
-- client. Dashboard/quét sáng đếm đúng (SQL) còn màn Tồn kho ?low=1 lại rỗng.
--
-- is_low = có đặt mức tối thiểu (min_stock > 0) VÀ tồn tụt dưới mức — cùng
-- điều kiện với sweep_supply_alerts (0159) và notifyLowStock, đồng nhất 3 nơi.
-- View giữ nguyên thân 0010 + 1 cột CUỐI (create or replace chỉ thêm cột cuối).
--
-- RLS: security_invoker = on như cũ. Idempotent. Apply xong sync types.

create or replace view public.warehouse_stock with (security_invoker = on) as
select
  m.id            as material_id,
  m.code,
  m.name,
  m.unit,
  m.group_name,
  m.min_stock,
  m.shelf_location,
  m.is_active,
  coalesce(
    sum(case mv.direction when 'in' then mv.qty when 'out' then -mv.qty else 0 end),
    0
  )               as on_hand,
  (m.min_stock > 0 and coalesce(
    sum(case mv.direction when 'in' then mv.qty when 'out' then -mv.qty else 0 end),
    0
  ) < m.min_stock) as is_low
from public.warehouse_materials m
left join public.warehouse_movements mv on mv.material_id = m.id
group by m.id;
