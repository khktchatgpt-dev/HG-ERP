-- GỘP VỀ MỘT LOẠI ĐỊNH MỨC DUY NHẤT (user chốt 27/07/2026).
--
-- Trước migration này hệ thống có HAI bảng định mức song song:
--   1. technical_bom_lines   (0012) — khoá ngoại sang warehouse_materials
--   2. technical_product_parts (0092) — tự mô tả bằng quy cách, KHÔNG gắn kho
-- 0092 cố ý giữ bảng cũ ("phần cung ứng để nguyên, tính sau") vì view
-- v_lsx_material_status đang đọc nó. Nay xử lý nốt phần đó.
--
-- KIỂM TRA TRƯỚC KHI XOÁ (27/07/2026 trên DB thật):
--   technical_bom_lines      = 0 dòng   → xoá không mất dữ liệu
--   technical_product_parts  = 1315 dòng / 48 SP → GIỮ NGUYÊN, migration
--                              này KHÔNG có lệnh nào đụng vào bảng đó
--   warehouse_materials      = 7 vật tư (dữ liệu mẫu)
--
-- Việc này gồm 2 thay đổi:
--   1. drop bảng technical_bom_lines
--   2. viết lại view v_lsx_material_status để vế "cần bao nhiêu" lấy từ
--      technical_product_parts thay vì bảng cũ
--
-- NỐI SANG KHO BẰNG MÃ TEXT, KHÔNG PHẢI KHOÁ NGOẠI. Định mức là thông tin
-- riêng của sản phẩm (quyết định của user), nên nó chỉ mang `material_code`
-- dạng text tự sinh từ quy cách (vd 'VT-AL-HOP-25x50'). View nối sang kho bằng
-- `warehouse_materials.code = technical_product_parts.material_code`.
--
-- HỆ QUẢ CÓ CHỦ Ý: vật tư nào chưa có trong danh mục kho thì KHÔNG xuất hiện ở
-- view này. Đúng bản chất — view phục vụ việc xuất/giữ tồn kho, mà thứ không có
-- trong kho thì không xuất kho được. Nhu cầu mua của những vật tư đó đọc thẳng
-- từ technical_product_parts theo quy cách, không qua view.
--
-- RLS: không tạo bảng mới. View giữ `security_invoker = on` như bản cũ.
-- Idempotent: drop ... if exists + create or replace view.

-- ── 1. Bỏ bảng định mức cũ gắn kho ─────────────────────────────────────────
-- Phải drop view TRƯỚC vì nó phụ thuộc bảng (postgres chặn drop bảng còn view).
drop view if exists public.v_lsx_material_status;
drop table if exists public.technical_bom_lines;

-- ── 2. Nhu cầu vật tư theo LSX, tính từ định mức mới ────────────────────────
create or replace view public.v_lsx_material_status with (security_invoker = on) as
with need as (
  select
    po.id                    as production_order_id,
    m.id                     as material_id,
    sum(pp.qty * ol.qty)     as qty_needed
  from public.production_orders po
  join public.sales_order_lines ol
    on ol.order_id = po.sales_order_id
  join public.technical_product_parts pp
    on pp.product_id = ol.product_id
  -- nối bằng MÃ TEXT, không phải khoá ngoại — xem đầu file
  join public.warehouse_materials m
    on m.code = pp.material_code
  where pp.material_code is not null
  group by po.id, m.id
),
issued as (
  select
    mv.production_order_id,
    mv.material_id,
    sum(mv.qty) as qty_issued
  from public.warehouse_movements mv
  where mv.direction = 'out' and mv.production_order_id is not null
  group by mv.production_order_id, mv.material_id
)
select
  coalesce(n.production_order_id, i.production_order_id) as production_order_id,
  coalesce(n.material_id, i.material_id)                 as material_id,
  m.code                                                 as material_code,
  m.name                                                 as material_name,
  m.unit,
  coalesce(n.qty_needed, 0)                              as qty_needed,
  coalesce(i.qty_issued, 0)                              as qty_issued,
  coalesce(n.qty_needed, 0) - coalesce(i.qty_issued, 0)  as qty_remaining
from need n
full outer join issued i
  on i.production_order_id = n.production_order_id and i.material_id = n.material_id
join public.warehouse_materials m
  on m.id = coalesce(n.material_id, i.material_id);
