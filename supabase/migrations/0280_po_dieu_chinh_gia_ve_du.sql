-- 0280 — ĐIỀU CHỈNH GIÁ ĐƠN MUA ĐÃ VỀ ĐỦ (định giá lại phiếu nhập kho theo).
--
-- Chủ dự án duyệt 28/10/2026 (bản vẽ https://claude.ai/artifact/Rmv42NNZNrK2Thqb7Axezx,
-- Q1–Q6 theo đề xuất). Ca thật: PO-2026-0109 (Minh Thắng) về đủ 09/10 qua
-- PNK-2026-0117, cuối tháng NCC đối chiếu công nợ báo giá khác — Cung ứng không
-- sửa được: 0210 khoá đơn 'received', lời khoá chỉ sang "đối chiếu hoá đơn" mà
-- hệ thống chưa có tờ hoá đơn NCC nào. Đo 28/10: 126/193 đơn đang Về đủ.
--
-- Luật (Q1–Q5):
--   · CHỈ đổi đơn giá từng dòng + thuế suất / chiết khấu đầu đơn. Không SL,
--     không thêm / bỏ dòng — lệch số lượng là việc của Kho.
--   · Mọi dòng phiếu nhập / trả NCC gắn với dòng đơn đổi giá được ĐỊNH GIÁ LẠI
--     trong CÙNG giao dịch: unit_cost = round(tiền dòng ÷ SL đặt, 2) — đúng công
--     thức `poLineUnitCosts` lúc ghi phiếu. Công nợ theo hàng nhận
--     (`payables.repo`) và giá trị tồn (`giaTriTon`) đều tính lúc đọc từ cột này
--     nên tự ra số mới. Số lượng, ngày phiếu không đụng tới.
--   · Dòng đã lên hoá đơn NCC: không đổi giá ở đây (hai sổ công nợ sẽ lệch).
--   · Nguyên nhân bắt buộc (một trong năm của 0227). Không bật "chưa gửi NCC":
--     NCC chính là bên báo giá — sent_at đóng dấu ngay.
--
-- Đơn chưa về đủ vẫn đi `supply_po_apply_adjustment_v2` (0227) như cũ.
--
-- RLS: không thêm bảng. Hàm security invoker, thu quyền execute của anon /
-- authenticated — chỉ server (service_role) gọi. Idempotent: create or replace.

create or replace function public.supply_po_reprice_received(
  p_po_id     uuid,
  p_base_seq  int,
  p_actor     uuid,
  p_reason    text,
  p_cause     text,
  -- [{id, unit_price}] — CHỈ các dòng đổi giá.
  p_prices    jsonb,
  -- {vat_rate?, discount_amount?} — khoá vắng mặt = không đổi.
  p_header    jsonb,
  -- Phần còn lại của bản ghi supply_po_adjustments (tiền, ảnh chụp dòng…), như 0210.
  p_record    jsonb
)
returns jsonb
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
  if p_cause is null or p_cause not in ('khach_doi', 'ncc_doi', 'ky_thuat', 'nhap_sai', 'khac') then
    raise exception 'PO_ADJ: Chọn nguyên nhân điều chỉnh';
  end if;

  select po.status into v_status
  from public.supply_purchase_orders po
  where po.id = p_po_id
  for update;
  if not found then
    raise exception 'PO_ADJ: Đơn đặt không tồn tại';
  end if;
  if v_status <> 'received' then
    raise exception 'PO_ADJ: Đơn đang ở bước "%" — điều chỉnh giá sau nhập kho chỉ dành cho đơn đã về đủ', v_status;
  end if;

  select coalesce(max(a.seq), 0) into v_seq
  from public.supply_po_adjustments a
  where a.po_id = p_po_id;
  if v_seq <> coalesce(p_base_seq, 0) then
    raise exception 'PO_ADJ_STALE: Đơn vừa được điều chỉnh (lần %) trong lúc bạn đang sửa — tải lại đơn rồi sửa tiếp', v_seq;
  end if;

  -- Dòng phải thuộc đúng đơn này.
  select string_agg(x.id::text, ', ') into v_bad
  from (select (p->>'id')::uuid as id from jsonb_array_elements(coalesce(p_prices, '[]'::jsonb)) p) x
  where not exists (
    select 1 from public.supply_purchase_order_lines l
    where l.id = x.id and l.po_id = p_po_id
  );
  if v_bad is not null then
    raise exception 'PO_ADJ: Dòng không thuộc đơn này (%)', v_bad;
  end if;

  -- Giá phải là số dương.
  if exists (
    select 1 from jsonb_array_elements(coalesce(p_prices, '[]'::jsonb)) p
    where (p->>'unit_price') is null or (p->>'unit_price')::numeric <= 0
  ) then
    raise exception 'PO_ADJ: Đơn giá mới phải lớn hơn 0';
  end if;

  -- Dòng đã lên hoá đơn NCC: sửa ở hoá đơn (Q4).
  select string_agg(distinct coalesce(m.code, l.line_name, '?'), ', ') into v_bad
  from jsonb_array_elements(coalesce(p_prices, '[]'::jsonb)) p
  join public.supply_purchase_order_lines l on l.id = (p->>'id')::uuid
  left join public.warehouse_materials m on m.id = l.material_id
  where exists (select 1 from public.accounting_supplier_invoice_lines il where il.po_line_id = l.id);
  if v_bad is not null then
    raise exception 'PO_ADJ: Dòng % đã lên hoá đơn NCC — sửa giá ở hoá đơn trong Tài chính, hoặc nhờ Kế toán huỷ hoá đơn rồi điều chỉnh ở đây', v_bad;
  end if;

  -- ── ghi ──
  update public.supply_purchase_order_lines l
  set unit_price = (p->>'unit_price')::numeric
  from jsonb_array_elements(coalesce(p_prices, '[]'::jsonb)) p
  where l.id = (p->>'id')::uuid and l.po_id = p_po_id;

  update public.supply_purchase_orders po set
    vat_rate = case when p_header ? 'vat_rate'
                    then (p_header->>'vat_rate')::numeric else po.vat_rate end,
    discount_amount = case when p_header ? 'discount_amount'
                           then (p_header->>'discount_amount')::numeric else po.discount_amount end
  where po.id = p_po_id;

  -- Định giá lại phiếu nhập / trả của các dòng đổi giá (cùng công thức poLineUnitCosts).
  update public.warehouse_movements mv
  set unit_cost = round(
        (case when l.price_basis = 'unit2' then coalesce(l.qty2, 0) else l.qty_ordered end)
        * l.unit_price / l.qty_ordered, 2)
  from public.supply_purchase_order_lines l
  where mv.po_line_id = l.id
    and l.id in (select (p->>'id')::uuid from jsonb_array_elements(coalesce(p_prices, '[]'::jsonb)) p)
    and l.qty_ordered > 0
    and l.unit_price > 0;
  get diagnostics v_n = row_count;

  insert into public.supply_po_adjustments (
    po_id, seq, reason, cause, created_by, po_status, currency,
    subtotal_before, subtotal_after, discount_before, discount_after,
    vat_before, vat_after, total_before, total_after,
    delta_by_price, delta_by_qty, lines, header_changes,
    sent_at, sent_by, sent_note
  ) values (
    p_po_id, v_seq + 1, btrim(p_reason), p_cause, p_actor, v_status,
    coalesce(p_record->>'currency', 'VND'),
    (p_record->>'subtotal_before')::numeric, (p_record->>'subtotal_after')::numeric,
    coalesce((p_record->>'discount_before')::numeric, 0),
    coalesce((p_record->>'discount_after')::numeric, 0),
    (p_record->>'vat_before')::numeric, (p_record->>'vat_after')::numeric,
    (p_record->>'total_before')::numeric, (p_record->>'total_after')::numeric,
    coalesce((p_record->>'delta_by_price')::numeric, 0),
    0,
    coalesce(p_record->'lines', '[]'::jsonb),
    p_record->'header_changes',
    now(), p_actor,
    'Điều chỉnh giá sau nhập kho — đã thống nhất với NCC qua đối chiếu công nợ'
  );

  return jsonb_build_object('seq', v_seq + 1, 'revalued', v_n);
end;
$$;

revoke all on function public.supply_po_reprice_received(uuid, int, uuid, text, text, jsonb, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.supply_po_reprice_received(uuid, int, uuid, text, text, jsonb, jsonb, jsonb)
  to service_role;
