-- Mẫu đơn "Tem nhãn / in ấn" (`label`) + cột riêng KIỂU IN / GIA CÔNG trên dòng đơn.
--
-- Vì sao (12/10/2026): ~440 mã tem / nhãn / thẻ treo / decal / sổ HDLR nằm chung
-- nhóm "Bao bì - đóng gói - tem nhãn" (mẫu nhóm = carton) nên đơn tem nhãn mở ra
-- bộ cột Cách mở / Pcs-thùng / Lọt lòng — vô nghĩa với tờ đơn nhãn. Đơn thật thì
-- ghi thông tin in lộn chỗ: Hiệp Hưng nhét "in offset, cán màng mờ 2 mặt, đục
-- lỗ" vào TÊN và "Couche 300" vào Quy cách (PO-2026-0089/0106); Tân Vinh để quy
-- cách in sổ HDLR trong Ghi chú (PO-2026-0158). Mẫu mới: Chất liệu · Kích thước ·
-- Kiểu in / gia công · SL đơn hàng · Đm/sp.
--
-- Cột `print_spec` MỚI chứ không mượn `finish`: po-fields.ts chốt từ 0139 "không
-- mượn thêm — mẫu mới cần trường mới thì thêm cột DB đúng nghĩa".
--
-- Ba việc, cùng một nhịp (bài học 0135: thêm mẫu là phải nới CẢ HAI check):
--   1) cột print_spec trên supply_purchase_order_lines;
--   2) nới check template trên header đơn + po_template của danh mục vật tư;
--   3) hàm điều chỉnh đơn 0210 chép thêm print_spec — hàm liệt kê tường minh
--      từng cột, thiếu là điều chỉnh đơn tem nhãn đã duyệt làm MẤT kiểu in.
--      Thân hàm chép NGUYÊN VĂN bản đang chạy trên DB (pg_get_functiondef,
--      12/10/2026), chỉ thêm print_spec vào hai danh sách cột update/insert.
--
-- RLS: bảng đã enable RLS no-policies từ 0106 (anon chặn, secret key bypass) —
-- thêm cột không đổi tư thế. Hàm vẫn security invoker, chỉ service_role execute.
-- Idempotent: add column if not exists, drop + add constraint, create or replace.
-- Sau khi áp: sync types (cột mới).

-- ── 1) Cột kiểu in ─────────────────────────────────────────────────────────
alter table public.supply_purchase_order_lines
  add column if not exists print_spec text;

comment on column public.supply_purchase_order_lines.print_spec is
  'Kiểu in / gia công — mẫu Tem nhãn (vd "Offset 4 màu 2 mặt, cán màng mờ, đục lỗ")';

-- ── 2) Nới check mẫu ───────────────────────────────────────────────────────
alter table public.supply_purchase_orders
  drop constraint if exists supply_purchase_orders_template_check;

alter table public.supply_purchase_orders
  add constraint supply_purchase_orders_template_check
  check (template in ('accessory', 'aluminium', 'metal_kg', 'carton',
                      'rattan', 'paint', 'chemical', 'foam',
                      'glass', 'wood', 'outsourcing', 'mro', 'label', 'simple'));

alter table public.warehouse_materials
  drop constraint if exists warehouse_materials_po_template_check;

alter table public.warehouse_materials
  add constraint warehouse_materials_po_template_check
  check (po_template is null
         or po_template in ('accessory', 'aluminium', 'metal_kg', 'carton',
                            'rattan', 'paint', 'chemical', 'foam',
                            'glass', 'wood', 'outsourcing', 'mro', 'label', 'simple'));

-- ── 3) Hàm điều chỉnh đơn chép thêm print_spec ─────────────────────────────
create or replace function public.supply_po_apply_adjustment(
  p_po_id uuid, p_base_seq integer, p_actor uuid, p_reason text,
  p_updates jsonb, p_inserts jsonb, p_delete_ids uuid[], p_splits jsonb,
  p_header jsonb, p_record jsonb
)
returns integer
language plpgsql
security invoker
set search_path to ''
as $function$
declare
  v_status text;
  v_seq    int;
  v_bad    text;
  v_n      int;
begin
  select po.status into v_status
  from public.supply_purchase_orders po
  where po.id = p_po_id
  for update;
  if not found then
    raise exception 'PO_ADJ: Đơn đặt không tồn tại';
  end if;
  if v_status not in ('approved', 'ordered', 'confirmed', 'in_transit', 'partial') then
    raise exception 'PO_ADJ: Đơn đang ở bước "%" — chỉ điều chỉnh được đơn đã duyệt, đã gửi hoặc đang giao', v_status;
  end if;

  select coalesce(max(a.seq), 0) into v_seq
  from public.supply_po_adjustments a
  where a.po_id = p_po_id;
  if v_seq <> coalesce(p_base_seq, 0) then
    raise exception 'PO_ADJ_STALE: Đơn vừa được điều chỉnh (lần %) trong lúc bạn đang sửa — tải lại đơn rồi sửa tiếp', v_seq;
  end if;

  select string_agg(x.id::text, ', ') into v_bad
  from (
    select (u->>'id')::uuid as id from jsonb_array_elements(coalesce(p_updates, '[]'::jsonb)) u
    union all
    select d from unnest(coalesce(p_delete_ids, '{}'::uuid[])) d
  ) x
  where not exists (
    select 1 from public.supply_purchase_order_lines l
    where l.id = x.id and l.po_id = p_po_id
  );
  if v_bad is not null then
    raise exception 'PO_ADJ: Dòng không thuộc đơn này (%)', v_bad;
  end if;

  select string_agg(distinct coalesce(m.code, l.line_name, '?'), ', ') into v_bad
  from public.supply_purchase_order_lines l
  left join public.warehouse_materials m on m.id = l.material_id
  where l.id = any(coalesce(p_delete_ids, '{}'::uuid[]))
    and (
      exists (select 1 from public.warehouse_movements mv where mv.po_line_id = l.id)
      or exists (select 1 from public.accounting_supplier_invoice_lines il where il.po_line_id = l.id)
      or exists (
        select 1 from public.supply_po_shipment_lines sl
        join public.supply_po_shipments s on s.id = sl.shipment_id
        where sl.po_line_id = l.id and s.status in ('planned', 'arrived')
      )
    );
  if v_bad is not null then
    raise exception 'PO_ADJ: Không bỏ được dòng % — đã có hàng về, đã lên hoá đơn hoặc đang nằm trong đợt giao. Dùng "Chốt thiếu" hoặc gỡ khỏi đợt giao trước', v_bad;
  end if;

  select string_agg(format('%s (đặt %s, đã nhận %s)', coalesce(m.code, l.line_name, '?'), u.qty_ordered, r.qty_received), '; ') into v_bad
  from jsonb_populate_recordset(null::public.supply_purchase_order_lines, coalesce(p_updates, '[]'::jsonb)) u
  join public.supply_purchase_order_lines l on l.id = u.id
  left join public.warehouse_materials m on m.id = l.material_id
  join lateral (
    select coalesce(sum(case when mv.direction = 'in' then mv.qty + mv.qty_rejected
                             else -mv.qty end), 0) as qty_received
    from public.warehouse_movements mv
    where mv.po_line_id = u.id
  ) r on true
  where u.qty_ordered < r.qty_received - 1e-9;
  if v_bad is not null then
    raise exception 'PO_ADJ: Đặt thấp hơn số đã nhận: % — NCC không giao nữa thì dùng "Chốt thiếu"', v_bad;
  end if;

  select string_agg(format('%s (đặt %s, đợt giao đã hẹn %s)', coalesce(m.code, l.line_name, '?'), u.qty_ordered, p.planned), '; ') into v_bad
  from jsonb_populate_recordset(null::public.supply_purchase_order_lines, coalesce(p_updates, '[]'::jsonb)) u
  join public.supply_purchase_order_lines l on l.id = u.id
  left join public.warehouse_materials m on m.id = l.material_id
  join lateral (
    select coalesce(sum(sl.qty), 0) as planned
    from public.supply_po_shipment_lines sl
    join public.supply_po_shipments s on s.id = sl.shipment_id
    where sl.po_line_id = u.id and s.status in ('planned', 'arrived')
  ) p on true
  where u.qty_ordered < p.planned - 1e-9;
  if v_bad is not null then
    raise exception 'PO_ADJ: Đặt thấp hơn tổng đợt giao: % — sửa đợt giao ở tab Giao & nhận hàng trước', v_bad;
  end if;

  delete from public.supply_purchase_order_lines l
  where l.id = any(coalesce(p_delete_ids, '{}'::uuid[])) and l.po_id = p_po_id;

  update public.supply_purchase_order_lines l set
    (material_id, line_name, line_unit, qty_ordered, unit_price, price_basis,
     spec, qty2, unit2, note, sort_order, material_grade, dm_per_sp,
     qty_demand, qty_on_hand, die_code, weight_per_m, bar_length_m,
     dimension_text, finish, weight_per_unit, m3_per_unit, warranty_text,
     print_spec,
     open_style, pcs_per_ctn, inner_l_mm, inner_w_mm, inner_h_mm, area_m2,
     price_per_m2, print_fee, carton_basis, pack_size, pack_unit, unit2_per_unit)
  = (u.material_id, u.line_name, u.line_unit, u.qty_ordered, u.unit_price,
     coalesce(u.price_basis, 'unit'), u.spec, u.qty2, u.unit2, u.note,
     u.sort_order, u.material_grade, u.dm_per_sp, u.qty_demand, u.qty_on_hand,
     u.die_code, u.weight_per_m, u.bar_length_m, u.dimension_text, u.finish,
     u.weight_per_unit, u.m3_per_unit, u.warranty_text,
     u.print_spec,
     u.open_style,
     u.pcs_per_ctn, u.inner_l_mm, u.inner_w_mm, u.inner_h_mm, u.area_m2,
     u.price_per_m2, u.print_fee, u.carton_basis, u.pack_size, u.pack_unit,
     u.unit2_per_unit)
  from jsonb_populate_recordset(null::public.supply_purchase_order_lines, coalesce(p_updates, '[]'::jsonb)) u
  where l.id = u.id and l.po_id = p_po_id;

  insert into public.supply_purchase_order_lines
    (po_id, material_id, line_name, line_unit, qty_ordered, unit_price,
     price_basis, spec, qty2, unit2, note, sort_order, material_grade,
     dm_per_sp, qty_demand, qty_on_hand, die_code, weight_per_m, bar_length_m,
     dimension_text, finish, weight_per_unit, m3_per_unit, warranty_text,
     print_spec,
     open_style, pcs_per_ctn, inner_l_mm, inner_w_mm, inner_h_mm, area_m2,
     price_per_m2, print_fee, carton_basis, pack_size, pack_unit, unit2_per_unit)
  select
     p_po_id, u.material_id, u.line_name, u.line_unit, u.qty_ordered,
     u.unit_price, coalesce(u.price_basis, 'unit'), u.spec, u.qty2, u.unit2,
     u.note, u.sort_order, u.material_grade, u.dm_per_sp, u.qty_demand,
     u.qty_on_hand, u.die_code, u.weight_per_m, u.bar_length_m,
     u.dimension_text, u.finish, u.weight_per_unit, u.m3_per_unit,
     u.warranty_text,
     u.print_spec,
     u.open_style, u.pcs_per_ctn, u.inner_l_mm, u.inner_w_mm,
     u.inner_h_mm, u.area_m2, u.price_per_m2, u.print_fee, u.carton_basis,
     u.pack_size, u.pack_unit, u.unit2_per_unit
  from jsonb_populate_recordset(null::public.supply_purchase_order_lines, coalesce(p_inserts, '[]'::jsonb)) u;

  select count(*) into v_n
  from public.supply_purchase_order_lines l
  where l.po_id = p_po_id;
  if v_n = 0 then
    raise exception 'PO_ADJ: Đơn phải còn ít nhất một dòng — muốn bỏ cả đơn thì dùng "Huỷ đơn"';
  end if;

  delete from public.supply_po_line_lsx x
  where x.line_id in (
    select (u->>'id')::uuid from jsonb_array_elements(coalesce(p_updates, '[]'::jsonb)) u
  );
  insert into public.supply_po_line_lsx (line_id, production_order_id, qty)
  select
    coalesce(
      (s->>'line_id')::uuid,
      (select l.id from public.supply_purchase_order_lines l
       where l.po_id = p_po_id and l.sort_order = (s->>'sort_order')::int
       limit 1)
    ),
    (s->>'production_order_id')::uuid,
    (s->>'qty')::numeric
  from jsonb_array_elements(coalesce(p_splits, '[]'::jsonb)) s;

  update public.supply_purchase_orders po set
    vat_rate = case when p_header ? 'vat_rate'
                    then (p_header->>'vat_rate')::numeric else po.vat_rate end,
    discount_amount = case when p_header ? 'discount_amount'
                           then (p_header->>'discount_amount')::numeric else po.discount_amount end
  where po.id = p_po_id;

  insert into public.supply_po_adjustments (
    po_id, seq, reason, created_by, po_status, currency,
    subtotal_before, subtotal_after, discount_before, discount_after,
    vat_before, vat_after, total_before, total_after,
    delta_by_price, delta_by_qty, lines, header_changes
  ) values (
    p_po_id, v_seq + 1, btrim(p_reason), p_actor, v_status,
    coalesce(p_record->>'currency', 'VND'),
    (p_record->>'subtotal_before')::numeric, (p_record->>'subtotal_after')::numeric,
    coalesce((p_record->>'discount_before')::numeric, 0),
    coalesce((p_record->>'discount_after')::numeric, 0),
    (p_record->>'vat_before')::numeric, (p_record->>'vat_after')::numeric,
    (p_record->>'total_before')::numeric, (p_record->>'total_after')::numeric,
    coalesce((p_record->>'delta_by_price')::numeric, 0),
    coalesce((p_record->>'delta_by_qty')::numeric, 0),
    coalesce(p_record->'lines', '[]'::jsonb),
    p_record->'header_changes'
  );

  return v_seq + 1;
end;
$function$;

revoke all on function public.supply_po_apply_adjustment(uuid, int, uuid, text, jsonb, jsonb, uuid[], jsonb, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.supply_po_apply_adjustment(uuid, int, uuid, text, jsonb, jsonb, uuid[], jsonb, jsonb, jsonb)
  to service_role;
