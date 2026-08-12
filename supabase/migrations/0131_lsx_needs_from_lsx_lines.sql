-- Cung ứng: nhu cầu vật tư của lệnh lấy dòng SP từ CHÍNH LỆNH, không vòng qua đơn.
--
-- Bối cảnh: `v_lsx_material_status` là đường duy nhất đưa ĐỊNH MỨC hồ sơ sản
-- phẩm (technical_product_parts) tới màn soạn đơn đặt vật tư — nó cộng
-- `định mức × SL` của MỌI sản phẩm trong lệnh rồi gộp theo vật tư, đúng lối mua
-- của Cung ứng (một con ốc dùng ở 4 SP thì đặt một lần cho cả 4).
--
-- 0113 dựng view lấy dòng SP theo đường `production_orders → sales_orders →
-- sales_order_lines`. Ngay sau đó 0114 cho LỆNH bảng dòng SP của riêng nó
-- (`production_order_lines`, sửa được: thêm/bớt/đổi SL, gán SP cho dòng chưa
-- khớp). Từ đó hai nguồn có thể lệch nhau, mà mọi chỗ khác trong hệ thống —
-- bảng chi tiết, thống kê, phiếu in — đều đã đọc dòng của lệnh. Nhu cầu vật tư
-- đi đường cũ là tính theo con số Sales chốt lúc đầu, không phải con số xưởng
-- thực làm.
--
-- Đổi lại: `need` đọc thẳng `production_order_lines`. Bỏ luôn hai join sales_*
-- nên lệnh gộp nhiều đơn (0113) cũng không còn nguy cơ nhân đôi dòng.
--
-- Không đổi: danh sách cột, nhánh `issued`, và cách nối định mức với kho bằng
-- `warehouse_materials.code = technical_product_parts.material_code` —
-- material_code cố ý để text tự do (0092: danh mục kho là của phòng khác).
-- Dòng định mức gõ sai mã vẫn im lặng rơi khỏi nhu cầu; form định mức nay gắn
-- cờ "chưa khớp danh mục" ngay lúc nhập để chặn từ đầu.
--
-- RLS: không tạo bảng mới, view giữ `security_invoker = on` (thừa kế tư thế
-- enable-no-policies của các bảng nguồn — anon chặn, secret key bypass).
-- Idempotent: drop view if exists → create.
-- Không cần sync types: danh sách cột giữ nguyên.

drop view if exists public.v_lsx_material_status;

create view public.v_lsx_material_status with (security_invoker = on) as
with need as (
  select
    pol.production_order_id             as production_order_id,
    m.id                                as material_id,
    sum(pp.qty * pol.qty)               as qty_needed
  from public.production_order_lines pol
  join public.technical_product_parts pp on pp.product_id = pol.product_id
  join public.warehouse_materials m on m.code = pp.material_code
  where pol.product_id is not null
    and pp.material_code is not null
  group by pol.production_order_id, m.id
),
issued as (
  select
    mv.production_order_id,
    mv.material_id,
    sum(mv.qty) as qty_issued
  from public.warehouse_movements mv
  where mv.direction = 'out'
    and mv.production_order_id is not null
  group by mv.production_order_id, mv.material_id
)
select
  coalesce(n.production_order_id, i.production_order_id) as production_order_id,
  coalesce(n.material_id, i.material_id)                 as material_id,
  m.code                                                 as material_code,
  m.name                                                 as material_name,
  m.unit                                                 as unit,
  coalesce(n.qty_needed, 0)                              as qty_needed,
  coalesce(i.qty_issued, 0)                              as qty_issued,
  coalesce(n.qty_needed, 0) - coalesce(i.qty_issued, 0)  as qty_remaining
from need n
full join issued i
  on i.production_order_id = n.production_order_id
 and i.material_id = n.material_id
join public.warehouse_materials m on m.id = coalesce(n.material_id, i.material_id);
