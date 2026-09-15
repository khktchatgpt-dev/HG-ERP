-- 0191: NỚI `qty2` CỦA DÒNG ĐƠN MUA TỪ 4 LÊN 6 SỐ LẺ.
--
-- Vì sao cần: `supply_purchase_order_lines.qty2` là "tổng đơn vị tính giá" của
-- dòng — tổng kg với nhôm/sắt, tổng m² với kính/bao bì, tổng m³ với gỗ/xốp — và
-- tiền dòng = qty2 × đơn giá (`src/lib/po-line.ts`). Cột đang là numeric(14,4).
--
-- Bốn số lẻ đủ cho kg và m², nhưng KHÔNG đủ cho m³: m³ là đại lượng bé mà đơn
-- giá lại lớn. Đơn thật 05 HG/ĐT (Đức Toàn Phú Tài, LSX 05/26-27 - MX, ngày
-- 03/08/2026): 100 ghế × 0,0063988 m³ = 0,63988 m³ × $1.500/m³ = $959,82 đúng
-- như đơn NCC. Cột cắt còn 0,6399 nên hệ thống in ra $959,85 — lệch 3 cent với
-- hoá đơn, và đối chiếu ba bên sẽ kêu.
--
-- Đo ngày 15/09/2026 trên dữ liệu thật: 26 dòng của 12 đơn mua đang lệch, từ
-- −$0,07 đến +$0,07. Tất cả còn ở nháp hoặc chờ duyệt, chưa dòng nào có hoá đơn
-- hay đợt giao, nên tính lại là an toàn.
--
-- ⭐ CHỈ NỚI, KHÔNG THU HẸP: numeric(14,4) → numeric(18,6). Mọi giá trị đang có
-- đều vào lọt, Postgres không phải ghi lại bảng theo kiểu mất dữ liệu. Phần
-- nguyên nới từ 10 lên 12 chữ số để tổng kg của đơn nhôm lớn vẫn còn chỗ.
--
-- Đi kèm ở tầng mã: `deriveLine()` trong `src/lib/po-template.ts` đổi round4 →
-- round6 cho nhánh gỗ và xốp (nhánh kg/m² giữ 4 lẻ, không cần đổi).
--
-- RLS: bảng đã bật row level security không policy từ 0053, migration này chỉ
-- đổi kiểu cột nên tư thế bảo mật giữ nguyên. View dựng lại vẫn mang
-- `security_invoker = on` như bản cũ.
--
-- BẪY: Postgres không cho đổi kiểu cột đang có view đọc tới — view
-- `supply_po_line_status` (0077, đối chiếu SL đặt với SL đã nhận kho) tuyển cả
-- `qty2`. Phải bỏ view, đổi kiểu, rồi dựng lại y nguyên định nghĩa cũ.
--
-- SAU KHI CHẠY: nhớ "sync types" để `src/lib/database.types.ts` khớp lại, nếu
-- không `next build` sẽ đỏ trên Vercel.

-- Bỏ theo đúng thứ tự phụ thuộc: v_supply_balance (0187) đọc
-- supply_po_line_status (0077), view này lại đọc cột qty2. Không ai đọc
-- v_supply_balance nên dừng ở hai tầng.
drop view if exists public.v_supply_balance;
drop view if exists public.supply_po_line_status;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'supply_purchase_order_lines'
      and column_name = 'qty2'
      and (numeric_precision, numeric_scale) is distinct from (18, 6)
  ) then
    alter table public.supply_purchase_order_lines
      alter column qty2 type numeric(18, 6);
  end if;
end $$;

-- Dựng lại view y nguyên định nghĩa cũ (0077), chỉ khác là nó đọc cột đã nới.
create or replace view public.supply_po_line_status
with (security_invoker = on) as
select
  l.id, l.po_id, l.material_id, l.qty_ordered, l.unit_price, l.spec, l.qty2,
  l.unit2, l.note, l.sort_order,
  coalesce(sum(case when mv.direction = 'in' then mv.qty + mv.qty_rejected
                    else -mv.qty end), 0::numeric) as qty_received,
  coalesce(sum(case when mv.direction = 'in' then mv.qty_rejected
                    else 0::numeric end), 0::numeric) as qty_rejected,
  l.qty_ordered - coalesce(sum(case when mv.direction = 'in' then mv.qty + mv.qty_rejected
                                    else -mv.qty end), 0::numeric) as qty_missing,
  coalesce(sum(case when mv.direction = 'in' then mv.qty2_actual
                    else -mv.qty2_actual end), 0::numeric) as kg_received,
  max(mv.created_at) filter (where mv.direction = 'in') as last_received_at,
  l.closed_short_at,
  greatest(
    case when l.closed_short_at is not null then 0::numeric
         else l.qty_ordered - coalesce(sum(case when mv.direction = 'in' then mv.qty + mv.qty_rejected
                                               else -mv.qty end), 0::numeric)
    end, 0::numeric) as qty_open
from public.supply_purchase_order_lines l
left join public.warehouse_movements mv on mv.po_line_id = l.id
where l.material_id is not null
group by l.id;

-- Dựng lại tầng hai y nguyên định nghĩa cũ (0187).
create or replace view public.v_supply_balance
with (security_invoker = on) as
with demand as (
  select
    d.material_code,
    (array_agg(d.material_id) filter (where d.material_id is not null))[1] as material_id,
    max(d.material_name) as material_name,
    max(d.unit) as unit,
    sum(d.qty_needed) as qty_needed,
    min(d.need_by) as need_by,
    count(*) as lsx_count,
    array_agg(d.lsx_code order by d.need_by, d.lsx_code) as lsx_codes
  from public.v_supply_demand d
  group by d.material_code
), po as (
  select
    upper(btrim(wm.code)) as material_code,
    sum(s.qty_open) filter (where p.status = any (array['approved','ordered','confirmed','in_transit','partial'])) as qty_incoming,
    sum(s.qty_open) filter (where p.status = any (array['draft','pending_approval'])) as qty_drafted
  from public.supply_po_line_status s
  join public.supply_purchase_orders p on p.id = s.po_id
  join public.warehouse_materials wm on wm.id = s.material_id
  where s.qty_open > 0::numeric
  group by upper(btrim(wm.code))
)
select
  d.material_code, d.material_id, d.material_name, d.unit, d.qty_needed,
  coalesce(st.on_hand, 0::numeric) as qty_on_hand,
  coalesce(po.qty_incoming, 0::numeric) as qty_incoming,
  coalesce(po.qty_drafted, 0::numeric) as qty_drafted,
  greatest(d.qty_needed - coalesce(st.on_hand, 0::numeric) - coalesce(po.qty_incoming, 0::numeric), 0::numeric) as qty_short,
  d.need_by, d.lsx_count, d.lsx_codes
from demand d
left join public.warehouse_stock st on upper(btrim(st.code)) = d.material_code
left join po on po.material_code = d.material_code;

comment on column public.supply_purchase_order_lines.qty2 is
  'Tổng đơn vị tính giá của dòng (kg / m² / m³ / lít) — tiền dòng = qty2 × unit_price khi price_basis = ''unit2''. Sáu số lẻ vì m³ bé mà đơn giá/m³ lớn (0191).';

-- Tính lại cho các dòng gỗ đang bị cắt số lẻ. Chỉ đụng đơn CHƯA nhận hàng và
-- chưa có hoá đơn — đơn đã nhận thì con số phải khớp chứng từ đã ký, sửa ở đây
-- là làm lệch đối chiếu ba bên.
update public.supply_purchase_order_lines l
set qty2 = round(l.qty_ordered * l.m3_per_unit, 6)
from public.supply_purchase_orders po
where po.id = l.po_id
  and l.price_basis = 'unit2'
  and l.m3_per_unit is not null
  and l.m3_per_unit > 0
  and l.qty2 is distinct from round(l.qty_ordered * l.m3_per_unit, 6)
  and po.status in ('draft', 'pending_approval')
  and not exists (
    select 1 from public.accounting_supplier_invoice_lines il where il.po_line_id = l.id
  )
  and not exists (
    select 1 from public.supply_po_shipment_lines sl where sl.po_line_id = l.id
  );
