-- 0210 — ĐIỀU CHỈNH ĐƠN MUA ĐÃ GỬI (sửa tại chỗ, không hạ về nháp).
--
-- Chủ dự án chốt 25/09/2026 (canvas thiết kế, artboard 9–9g):
--   · Đơn đã duyệt / đã gửi NCC / đang giao được SỬA TẠI CHỖ: SL, giá, thêm /
--     bỏ dòng, VAT, chiết khấu. KHÔNG hạ về nháp, KHÔNG duyệt lại.
--   · Phần chênh so với trước ghi thành PHÁT SINH lần N (tách vì giá / vì
--     lượng) để kế toán theo dõi; người duyệt chỉ nhận thông báo.
--   · Đơn đã về đủ / đã huỷ: khoá.
--
-- Hai thứ mới:
--   1) supply_po_adjustments — sổ các lần điều chỉnh, lưu vĩnh viễn (không
--      sửa, không xoá: muốn đảo thì điều chỉnh lần sau). Mỗi lần giữ ảnh chụp
--      cũ → mới của từng dòng đổi, tiền trước/sau, lý do, mốc gửi NCC.
--   2) supply_po_apply_adjustment() — ghi CẢ lần điều chỉnh trong MỘT giao
--      dịch có khoá dòng đơn. Lý do phải là hàm DB chứ không ghi từng bước ở
--      service như mọi chỗ khác: đây là tiền đã cam kết với NCC, ghi dở giữa
--      chừng (dòng đã đổi mà sổ phát sinh chưa có, hoặc ngược lại) là sổ nói
--      dối. Hàm cũng KIỂM LẠI các ràng buộc ngay dưới khoá — Kho có thể vừa
--      nhập thêm hàng trong lúc người mua đang sửa.
--
-- VÌ SAO SỬA THEO TỪNG DÒNG: `posRepo.replaceLines` (đường sửa đơn nháp) xoá
-- hết dòng rồi chèn lại. Với đơn đang chạy, cách đó xoá đợt giao
-- (supply_po_shipment_lines ON DELETE CASCADE, 0152), xoá phần chia lệnh
-- (supply_po_line_lsx, 0185) và làm phiếu nhập kho (warehouse_movements) +
-- dòng hoá đơn NCC (0188) mất liên kết (ON DELETE SET NULL). Hàm này UPDATE
-- đúng dòng theo id, chỉ INSERT dòng mới và chỉ DELETE dòng chưa có gì bám.
--
-- CẢNH BÁO BẢO TRÌ: danh sách cột ghi được của dòng đơn liệt kê TƯỜNG MINH ở
-- hai chỗ trong hàm (update + insert). Thêm cột nhập liệu mới cho dòng đơn thì
-- phải thêm cả ở đây, không thì điều chỉnh sẽ lặng lẽ bỏ qua cột đó.
--
-- RLS: bảng mới ENABLE, không policy (anon chặn, secret key bypass). Hàm
-- security invoker + thu quyền execute của anon/authenticated — chỉ server
-- (service_role) gọi. Idempotent: if not exists / create or replace / drop +
-- add constraint.

-- ── 1) Sổ điều chỉnh ────────────────────────────────────────────────────────
create table if not exists public.supply_po_adjustments (
  id               uuid primary key default gen_random_uuid(),
  po_id            uuid not null
                   references public.supply_purchase_orders(id) on delete cascade,
  -- Lần điều chỉnh thứ mấy của đơn (1, 2, …). unique (po_id, seq) là hàng rào
  -- cuối chống hai người áp dụng chen nhau.
  seq              int not null check (seq >= 1),
  reason           text not null check (length(btrim(reason)) >= 5),
  created_by       uuid references public.users(id) on delete set null,
  created_at       timestamptz not null default now(),
  -- Trạng thái đơn lúc điều chỉnh — để biết đã sửa khi NCC đang làm hay chưa gửi.
  po_status        text not null,
  currency         text not null default 'VND',
  -- Tiền trước / sau (tiền hàng sau chiết khấu chưa tính; VAT; tổng thanh toán).
  subtotal_before  numeric(18, 2) not null,
  subtotal_after   numeric(18, 2) not null,
  discount_before  numeric(18, 2) not null default 0,
  discount_after   numeric(18, 2) not null default 0,
  vat_before       numeric(18, 2) not null,
  vat_after        numeric(18, 2) not null,
  total_before     numeric(18, 2) not null,
  total_after      numeric(18, 2) not null,
  -- PHÁT SINH tiền hàng tách hai phần: vì giá + vì lượng = subtotal_after − subtotal_before.
  delta_by_price   numeric(18, 2) not null default 0,
  delta_by_qty     numeric(18, 2) not null default 0,
  -- Ảnh chụp từng dòng đổi: [{kind, line_id, code, name, unit, qty_before,
  -- qty_after, price_before, price_after, amount_before, amount_after,
  -- by_price, by_qty, fields[]}] — đọc lại được dù dòng sau này bị sửa tiếp.
  lines            jsonb not null default '[]'::jsonb,
  -- Đổi ở đầu đơn (VAT, chiết khấu): {vat_rate:[cũ,mới], discount_amount:[cũ,mới]}.
  header_changes   jsonb,
  -- Mốc "đã gửi NCC bản điều chỉnh" (chốt Q4 25/09). null = chưa tới NCC.
  sent_at          timestamptz,
  sent_by          uuid references public.users(id) on delete set null,
  sent_note        text,
  unique (po_id, seq)
);

create index if not exists supply_po_adjustments_po_idx
  on public.supply_po_adjustments (po_id, seq);
-- Đơn còn bản điều chỉnh chưa gửi NCC — cho hộp thư / nhắc việc.
create index if not exists supply_po_adjustments_unsent_idx
  on public.supply_po_adjustments (po_id)
  where sent_at is null;

alter table public.supply_po_adjustments enable row level security;

-- ── 2) Ghi một lần điều chỉnh, nguyên tử ────────────────────────────────────
--
-- p_updates / p_inserts: mảng dòng đã DẪN XUẤT xong ở service (qty2, unit2,
--   price_basis theo deriveLine) — hàm không tính tiền, chỉ ghi và kiểm.
--   p_updates mỗi phần tử phải có `id`; p_inserts mỗi phần tử có `sort_order`.
-- p_delete_ids: dòng bỏ khỏi đơn.
-- p_splits: phần chia SL theo lệnh [{line_id | sort_order, production_order_id, qty}]
--   — ghi lại cho MỌI dòng trong p_updates + p_inserts (xoá cũ, chèn mới).
-- p_header: {vat_rate?, discount_amount?} — khoá vắng mặt = không đổi.
-- p_record: phần còn lại của bản ghi supply_po_adjustments (tiền, ảnh chụp dòng…).
--
-- Lỗi nghiệp vụ ném với tiền tố 'PO_ADJ:' (service dịch thành 400) hoặc
-- 'PO_ADJ_STALE:' (đơn vừa có người điều chỉnh chen trước → 409).
create or replace function public.supply_po_apply_adjustment(
  p_po_id      uuid,
  p_base_seq   int,
  p_actor      uuid,
  p_reason     text,
  p_updates    jsonb,
  p_inserts    jsonb,
  p_delete_ids uuid[],
  p_splits     jsonb,
  p_header     jsonb,
  p_record     jsonb
)
returns int
language plpgsql
volatile
security invoker
set search_path = ''
as $$
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

  -- Dòng sửa / bỏ phải thuộc đúng đơn này.
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

  -- Bỏ dòng: không được có hàng đã nhập/trả, không nằm trên hoá đơn NCC,
  -- không nằm trong đợt giao còn sống.
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

  -- SL mới không thấp hơn số đã nhận (cùng phép tính với supply_po_line_status).
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

  -- SL mới không thấp hơn tổng các đợt giao còn sống của dòng.
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

  -- ── ghi ──
  delete from public.supply_purchase_order_lines l
  where l.id = any(coalesce(p_delete_ids, '{}'::uuid[])) and l.po_id = p_po_id;

  update public.supply_purchase_order_lines l set
    (material_id, line_name, line_unit, qty_ordered, unit_price, price_basis,
     spec, qty2, unit2, note, sort_order, material_grade, dm_per_sp,
     qty_demand, qty_on_hand, die_code, weight_per_m, bar_length_m,
     dimension_text, finish, weight_per_unit, m3_per_unit, warranty_text,
     open_style, pcs_per_ctn, inner_l_mm, inner_w_mm, inner_h_mm, area_m2,
     price_per_m2, print_fee, carton_basis, pack_size, pack_unit, unit2_per_unit)
  = (u.material_id, u.line_name, u.line_unit, u.qty_ordered, u.unit_price,
     coalesce(u.price_basis, 'unit'), u.spec, u.qty2, u.unit2, u.note,
     u.sort_order, u.material_grade, u.dm_per_sp, u.qty_demand, u.qty_on_hand,
     u.die_code, u.weight_per_m, u.bar_length_m, u.dimension_text, u.finish,
     u.weight_per_unit, u.m3_per_unit, u.warranty_text, u.open_style,
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
     open_style, pcs_per_ctn, inner_l_mm, inner_w_mm, inner_h_mm, area_m2,
     price_per_m2, print_fee, carton_basis, pack_size, pack_unit, unit2_per_unit)
  select
     p_po_id, u.material_id, u.line_name, u.line_unit, u.qty_ordered,
     u.unit_price, coalesce(u.price_basis, 'unit'), u.spec, u.qty2, u.unit2,
     u.note, u.sort_order, u.material_grade, u.dm_per_sp, u.qty_demand,
     u.qty_on_hand, u.die_code, u.weight_per_m, u.bar_length_m,
     u.dimension_text, u.finish, u.weight_per_unit, u.m3_per_unit,
     u.warranty_text, u.open_style, u.pcs_per_ctn, u.inner_l_mm, u.inner_w_mm,
     u.inner_h_mm, u.area_m2, u.price_per_m2, u.print_fee, u.carton_basis,
     u.pack_size, u.pack_unit, u.unit2_per_unit
  from jsonb_populate_recordset(null::public.supply_purchase_order_lines, coalesce(p_inserts, '[]'::jsonb)) u;

  -- Đơn phải còn ít nhất một dòng.
  select count(*) into v_n
  from public.supply_purchase_order_lines l
  where l.po_id = p_po_id;
  if v_n = 0 then
    raise exception 'PO_ADJ: Đơn phải còn ít nhất một dòng — muốn bỏ cả đơn thì dùng "Huỷ đơn"';
  end if;

  -- Phần chia theo lệnh: ghi lại cho mọi dòng sửa + dòng mới.
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

  -- Đầu đơn: chỉ đổi khoá có mặt.
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
$$;

revoke all on function public.supply_po_apply_adjustment(uuid, int, uuid, text, jsonb, jsonb, uuid[], jsonb, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.supply_po_apply_adjustment(uuid, int, uuid, text, jsonb, jsonb, uuid[], jsonb, jsonb, jsonb)
  to service_role;

-- ── 3) Thông báo: + 'po_adjusted' (bản 0201 + một giá trị) ───────────────────
alter table public.notifications
  drop constraint if exists notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check
  check (type in ('assigned','reassigned','status_changed','submitted',
                  'approved','rejected','commented','due_soon','overdue',
                  'quote_submitted','quote_approved','quote_rejected',
                  'wh_receipt','wh_stock_low','wh_return','wh_doc_reversed',
                  'wh_stocktake_pending','wh_stocktake_approved','wh_stocktake_rejected',
                  'po_submitted','po_approved','po_rejected',
                  'po_withdrawn','po_reopened','po_reassigned','po_closed_short','po_late',
                  'po_adjusted',
                  'lsx_submitted','lsx_approved','lsx_rejected',
                  'lsx_orders_changed','lsx_revised',
                  'order_changed','order_cancelled',
                  'stage_handoff','incident_reported','incident_resolved'));
