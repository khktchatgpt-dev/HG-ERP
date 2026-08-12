-- Đơn đặt hàng: DÒNG TỰ DO (không gắn vật tư kho) + cơ sở tính tiền mới + phí bản in.
--
-- Nguồn: rà bàn giao phòng Cung ứng (E:\NHÂN BÀN GIAO\A NHÂN, 12/08/2026 —
-- docs/phan-tich-cung-ung-tien-te-va-mau-don-a-nhan.md):
--   1. Đơn GỖ (Minh Đạt/Thành Đạt/Đức Toàn…) và đơn GIA CÔNG (đan mây, hàn sắt)
--      đặt theo MÃ SẢN PHẨM chứ không theo vật tư kho → `material_id` phải
--      nullable + cặp `line_name`/`line_unit` cho dòng tự gõ. Dòng tự do chỉ
--      dành cho mẫu wood/outsourcing (schema + service chặn), và KHÔNG đi vào
--      sổ kho: view supply_po_line_status lọc bỏ, nên tiến độ "về kho x/y dòng",
--      trạng thái partial/received và phiếu nhập kho không đếm các dòng này
--      (gỗ/gia công về là bán thành phẩm theo lệnh SX, không nhập kho vật tư).
--   2. XỐP đặt theo m³ (D×R×Dày → khối), GIA CÔNG tính công theo kg → nới check
--      `carton_basis` (cơ sở tính tiền từng dòng) thêm 'm3' và 'kg'.
--   3. Đơn BAO BÌ thật có cột "Bản in + công" cộng vào đơn giá/thùng
--      (giá/thùng = m² × giá/m² + bản in) → cột `print_fee`.
--
-- RLS: không tạo bảng mới — supply_purchase_order_lines đã enable RLS
-- no-policies từ 0015 (anon chặn, secret key bypass). View tạo lại giữ
-- `security_invoker = on` như 0109.

-- ── 1. Dòng tự do ────────────────────────────────────────────────────────────
alter table public.supply_purchase_order_lines
  alter column material_id drop not null;

alter table public.supply_purchase_order_lines
  add column if not exists line_name text;   -- tên hàng tự gõ (SP gỗ / món gia công)
alter table public.supply_purchase_order_lines
  add column if not exists line_unit text;   -- ĐVT của dòng tự do (cái / bộ…)

-- Dòng phải có HOẶC vật tư kho HOẶC tên tự gõ — không được trống cả hai.
alter table public.supply_purchase_order_lines
  drop constraint if exists supply_po_lines_material_or_name;
alter table public.supply_purchase_order_lines
  add constraint supply_po_lines_material_or_name
  check (material_id is not null or line_name is not null);

-- ── 2. Cơ sở tính tiền từng dòng: thêm m³ (xốp khối) và kg (gia công) ───────
alter table public.supply_purchase_order_lines
  drop constraint if exists supply_purchase_order_lines_carton_basis_check;
alter table public.supply_purchase_order_lines
  add constraint supply_purchase_order_lines_carton_basis_check
  check (carton_basis is null or carton_basis in ('ctn', 'm2', 'm3', 'kg'));

-- ── 3. Phí bản in + công của bao bì (cộng vào đơn giá/thùng) ────────────────
alter table public.supply_purchase_order_lines
  add column if not exists print_fee numeric(18, 2) check (print_fee is null or print_fee >= 0);

-- ── 4. View trạng thái dòng: BỎ dòng tự do khỏi sổ nhận hàng ────────────────
-- Cùng thân với 0109 + thêm `where l.material_id is not null`: dòng tự do không
-- nhận vào kho vật tư nên nếu để lại, đơn gỗ/gia công vĩnh viễn không bao giờ
-- đạt "đã về đủ" và cột "về kho x/y dòng" đếm sai.
create or replace view public.supply_po_line_status with (security_invoker = on) as
select
  l.id,
  l.po_id,
  l.material_id,
  l.qty_ordered,
  l.unit_price,
  l.spec,
  l.qty2,
  l.unit2,
  l.note,
  l.sort_order,
  coalesce(sum(case when mv.direction = 'in' then mv.qty + mv.qty_rejected
                    else -mv.qty end), 0)                       as qty_received,
  coalesce(sum(case when mv.direction = 'in' then mv.qty_rejected
                    else 0 end), 0)                             as qty_rejected,
  l.qty_ordered
    - coalesce(sum(case when mv.direction = 'in' then mv.qty + mv.qty_rejected
                        else -mv.qty end), 0)                   as qty_missing,
  coalesce(sum(case when mv.direction = 'in' then mv.qty2_actual
                    else -mv.qty2_actual end), 0)               as kg_received,
  max(mv.created_at) filter (where mv.direction = 'in')         as last_received_at
from public.supply_purchase_order_lines l
left join public.warehouse_movements mv
  on mv.po_line_id = l.id
where l.material_id is not null
group by l.id;
