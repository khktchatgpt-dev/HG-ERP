-- CHỐT ĐỊNH MỨC THEO LỆNH — số liệu quá khứ không tự đổi khi Kỹ thuật sửa BOM.
--
-- Vấn đề (thấy được bằng một dòng SQL): 0131 nối nhu cầu vật tư với ĐỊNH MỨC
-- SỐNG — `join technical_product_parts pp on pp.product_id = pol.product_id`.
-- Nghĩa là Kỹ thuật sửa định mức hôm nay thì LỆNH PHÁT THÁNG TRƯỚC tính lại
-- nhu cầu theo định mức mới: số đã mua, đã lĩnh kho, đã đối chiếu đều lệch theo.
-- Dòng SP của lệnh thì đã an toàn từ trước (0114 copy mã/tên/đóng gói/quy cách
-- vào chính dòng lệnh, có `changed_in_rev`) — chỉ còn định mức là đọc sống.
--
-- Cách chữa (rẻ nhất mà đủ): CHỤP định mức vào lệnh lúc PHÁT LỆNH, không dựng
-- bảng phiên bản sản phẩm. `production_order_boms` giữ định mức MỘT ĐƠN VỊ SP
-- (`qty_per_unit`) tại thời điểm chụp; nhu cầu vẫn = định mức × SL DÒNG LỆNH,
-- nên xưởng đổi SL sau đó vẫn tính lại đúng — chỉ ĐỊNH MỨC là đóng băng.
--
-- Gộp sẵn theo `material_code` lúc chụp (một vật tư nằm ở nhiều dòng định mức
-- thì cộng lại) — đúng thứ view cần, khỏi phải group lần nữa mỗi lần đọc.
--
-- SP thêm vào lệnh SAU khi phát (gộp đơn 0113, hoặc gán SP cho dòng chưa khớp)
-- chưa có ảnh chụp: view tự rơi về định mức sống cho riêng SP đó, và service
-- `ensureBomSnapshot` chụp bù ngay lần lưu dòng kế tiếp. Không có chuyện nhu
-- cầu biến mất vì thiếu ảnh chụp.
--
-- BACKFILL: 8 lệnh đang chạy (approved/in_progress) được chụp NGAY trong
-- migration này. Lưu ý trung thực: ảnh chụp đó là định mức HÔM NAY chứ không
-- phải định mức lúc lệnh được phát — dữ liệu đó đã mất, không dựng lại được.
-- Giá trị nằm ở chỗ từ nay trở đi chúng đứng yên.
--
-- RLS: bảng mới → enable RLS, KHÔNG policy (anon chặn, secret key server
-- bypass). View giữ `security_invoker = on`. Idempotent.
-- Danh sách cột của view KHÔNG đổi → không cần sync types cho view.

create table if not exists public.production_order_boms (
  production_order_id uuid not null references public.production_orders (id) on delete cascade,
  product_id uuid not null references public.technical_products (id) on delete cascade,
  material_code text not null,
  /** Định mức cho MỘT đơn vị SP, đã gộp theo mã vật tư. */
  qty_per_unit numeric not null,
  /** Ô "Rev." của hồ sơ SP lúc chụp — chỉ để truy vết, có thể null. */
  product_rev integer,
  snapped_at timestamptz not null default now(),
  snapped_by uuid references public.users (id) on delete set null,
  primary key (production_order_id, product_id, material_code)
);

comment on table public.production_order_boms is
  'Ảnh chụp ĐỊNH MỨC của từng SP tại thời điểm phát lệnh (0142) — nhu cầu vật tư của lệnh đọc bảng này thay vì đọc technical_product_parts sống';

create index if not exists production_order_boms_product_idx
  on public.production_order_boms (product_id);

alter table public.production_order_boms enable row level security;

-- Backfill cho các lệnh ĐÃ PHÁT. `on conflict do nothing` để chạy lại vô hại.
insert into public.production_order_boms
  (production_order_id, product_id, material_code, qty_per_unit, product_rev)
select
  pol.production_order_id,
  pol.product_id,
  pp.material_code,
  sum(pp.qty),
  max(tp.bom_rev)
from public.production_order_lines pol
join public.production_orders po on po.id = pol.production_order_id
join public.technical_product_parts pp on pp.product_id = pol.product_id
join public.technical_products tp on tp.id = pol.product_id
where po.status in ('approved', 'in_progress', 'completed')
  and pol.product_id is not null
  and pp.material_code is not null
group by pol.production_order_id, pol.product_id, pp.material_code
on conflict do nothing;

-- View nhu cầu: ưu tiên ảnh chụp, thiếu thì rơi về định mức sống.
drop view if exists public.v_lsx_material_status;

create view public.v_lsx_material_status with (security_invoker = on) as
with bom as (
  -- (1) Định mức ĐÃ CHỐT của lệnh.
  select
    s.production_order_id,
    s.product_id,
    s.material_code,
    s.qty_per_unit
  from public.production_order_boms s
  union all
  -- (2) SP chưa có ảnh chụp (lệnh nháp/chờ duyệt, hoặc SP mới thêm vào lệnh
  --     đã phát) — đọc định mức sống, đúng như trước 0142.
  select
    pol.production_order_id,
    pol.product_id,
    pp.material_code,
    sum(pp.qty)
  from public.production_order_lines pol
  join public.technical_product_parts pp on pp.product_id = pol.product_id
  where pol.product_id is not null
    and pp.material_code is not null
    and not exists (
      select 1
      from public.production_order_boms s2
      where s2.production_order_id = pol.production_order_id
        and s2.product_id = pol.product_id
    )
  group by pol.production_order_id, pol.product_id, pp.material_code
),
need as (
  select
    pol.production_order_id             as production_order_id,
    m.id                                as material_id,
    sum(b.qty_per_unit * pol.qty)       as qty_needed
  from public.production_order_lines pol
  join bom b
    on b.production_order_id = pol.production_order_id
   and b.product_id = pol.product_id
  join public.warehouse_materials m on m.code = b.material_code
  where pol.product_id is not null
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
