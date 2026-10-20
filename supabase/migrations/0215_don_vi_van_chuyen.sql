-- 0215 — ĐƠN VỊ VẬN CHUYỂN tách khỏi NCC; phiếu phí có HÌNH THỨC, người thu
-- gõ tự do, và AI TRẢ (chi hộ chờ hoàn).
--
-- Chủ dự án chốt 28/09/2026 (artboard 13 bản 2):
--   · Nhà xe KHÔNG chung với nhà cung cấp — có menu/danh mục/hồ sơ riêng. Dưới
--     CSDL vẫn cùng bảng `supply_suppliers` (sổ 331 và phiếu chi đã chạy trên
--     supplier_id) nhưng cờ `is_carrier` tách hẳn ở tầng đọc: mọi truy vấn
--     danh mục NCC loại `is_carrier`, ô chọn NCC lúc soạn đơn không có nhà xe.
--   · Ngoài nhà xe còn ship lẻ (Grab, Ahamove, shipper…) và NCC tự giao →
--     `transport_mode`. Ship lẻ gõ tên + SĐT ngay trên phiếu (`payee_name`,
--     `payee_phone`), không cần hồ sơ; chỉ lưu vào danh mục khi dùng lặp.
--   · Kế toán trả là chính; Cung ứng đôi khi chi trước → `paid_by/paid_on/
--     paid_method` = đã trả tại chỗ, phiếu KHÔNG vào sổ 331 mà vào dải "Chi hộ
--     chờ hoàn"; Kế toán hoàn thì ghi `reimbursed_*`. Hai sổ tách nhau để
--     không trả hai lần.
--   · Trả THEO CHUYẾN: mỗi phiếu là một khoản, đến hạn ngay ngày phiếu.
--
-- Ràng buộc: chưa trả thì người thu PHẢI có trong danh mục (không thì Kế toán
-- không biết trả ai); đã trả tại chỗ thì đủ ba ô ai/ngày/bằng gì.
--
-- RLS: hai bảng đã enable RLS, không policy (0211) — không đổi. Hàm thay thế
-- giữ security invoker + thu quyền execute của anon/authenticated. Idempotent.

-- ── 1) Đơn vị vận chuyển trong danh mục ─────────────────────────────────────
alter table public.supply_suppliers
  add column if not exists is_carrier   boolean not null default false,
  add column if not exists carrier_kind text
    check (carrier_kind is null or carrier_kind in ('nha_xe', 'tai_xe_le')),
  -- Hình thức trả mặc định của đơn vị (CK / tiền mặt) — mồi cho phiếu chi.
  add column if not exists pay_method   text
    check (pay_method is null or pay_method in ('ck', 'tien_mat'));

-- Nhà xe đã thêm trước 0215 (loại "Vận chuyển", không đặt hàng) đổi cờ.
update public.supply_suppliers
   set is_carrier = true, carrier_kind = coalesce(carrier_kind, 'nha_xe')
 where type = 'Vận chuyển' and is_carrier = false;

create index if not exists supply_suppliers_carrier_idx
  on public.supply_suppliers (is_carrier) where is_carrier;

-- ── 2) Phiếu phí: hình thức, người thu tự do, ai trả ─────────────────────────
alter table public.supply_po_costs
  add column if not exists transport_mode text not null default 'nha_xe'
    check (transport_mode in ('nha_xe', 'ship_le', 'ncc')),
  add column if not exists payee_name     text,
  add column if not exists payee_phone    text,
  add column if not exists paid_by        uuid references public.users(id) on delete set null,
  add column if not exists paid_on        date,
  add column if not exists paid_method    text
    check (paid_method is null or paid_method in ('tien_mat', 'ck_ca_nhan')),
  add column if not exists reimbursed_at  timestamptz,
  add column if not exists reimbursed_by  uuid references public.users(id) on delete set null,
  add column if not exists reimburse_note text;

alter table public.supply_po_costs alter column payee_supplier_id drop not null;

alter table public.supply_po_costs drop constraint if exists supply_po_costs_payee_chk;
alter table public.supply_po_costs add constraint supply_po_costs_payee_chk check (
  payee_supplier_id is not null or length(btrim(coalesce(payee_name, ''))) >= 2
);

alter table public.supply_po_costs drop constraint if exists supply_po_costs_paid_chk;
alter table public.supply_po_costs add constraint supply_po_costs_paid_chk check (
  (paid_by is null and paid_on is null and paid_method is null
     and reimbursed_at is null and reimbursed_by is null)
  or (paid_by is not null and paid_on is not null and paid_method is not null)
);

-- Chưa trả → Kế toán phải biết trả cho ai: người thu phải có trong danh mục.
alter table public.supply_po_costs drop constraint if exists supply_po_costs_unpaid_payee_chk;
alter table public.supply_po_costs add constraint supply_po_costs_unpaid_payee_chk check (
  paid_by is not null or payee_supplier_id is not null
);

create index if not exists supply_po_costs_chi_ho_idx
  on public.supply_po_costs (paid_by) where paid_by is not null and reimbursed_at is null;

-- ── 3) Hàm ghi phiếu — nhận thêm các khoá mới ────────────────────────────────
-- p_cost thêm: transport_mode, payee_name, payee_phone, paid_by, paid_on,
-- paid_method. Kiểm lại như 0211 (Σ phân bổ, đơn nhận phí được, cùng tiền tệ);
-- ràng buộc ai-trả / người-thu do check constraint của bảng canh.
create or replace function public.supply_po_cost_create(
  p_actor  uuid,
  p_cost   jsonb,
  p_allocs jsonb
) returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_id     uuid;
  v_amount numeric(18, 2) := (p_cost->>'amount')::numeric;
  v_cur    text := coalesce(nullif(p_cost->>'currency', ''), 'VND');
  v_sum    numeric(18, 2);
  v_bad    text;
begin
  if jsonb_typeof(p_allocs) is distinct from 'array' or jsonb_array_length(p_allocs) = 0 then
    raise exception 'PO_COST: phiếu phải gắn ít nhất một đơn';
  end if;

  select coalesce(sum((a->>'amount')::numeric), 0) into v_sum
    from jsonb_array_elements(p_allocs) a;
  if v_sum <> v_amount then
    raise exception 'PO_COST: tổng phân bổ % khác tiền phiếu %', v_sum, v_amount;
  end if;

  perform 1 from public.supply_purchase_orders
   where id in (select (a->>'po_id')::uuid from jsonb_array_elements(p_allocs) a)
   for update;

  select string_agg(coalesce(po.code, a->>'po_id'), ', ') into v_bad
    from jsonb_array_elements(p_allocs) a
    left join public.supply_purchase_orders po on po.id = (a->>'po_id')::uuid
   where po.id is null
      or po.status in ('draft', 'pending_approval', 'cancelled')
      or po.currency <> v_cur;
  if v_bad is not null then
    raise exception 'PO_COST: đơn không nhận phí được (nháp / chờ duyệt / đã huỷ / khác tiền tệ): %', v_bad;
  end if;

  insert into public.supply_po_costs (
    payee_supplier_id, payee_name, payee_phone, transport_mode,
    kind, cost_date, doc_no, currency,
    amount, vat_rate, vat_amount, total, note,
    paid_by, paid_on, paid_method, created_by
  ) values (
    nullif(p_cost->>'payee_supplier_id', '')::uuid,
    nullif(btrim(coalesce(p_cost->>'payee_name', '')), ''),
    nullif(btrim(coalesce(p_cost->>'payee_phone', '')), ''),
    coalesce(nullif(p_cost->>'transport_mode', ''), 'nha_xe'),
    coalesce(p_cost->>'kind', 'van_chuyen'),
    (p_cost->>'cost_date')::date,
    nullif(btrim(coalesce(p_cost->>'doc_no', '')), ''),
    v_cur,
    v_amount,
    (p_cost->>'vat_rate')::numeric,
    coalesce((p_cost->>'vat_amount')::numeric, 0),
    (p_cost->>'total')::numeric,
    nullif(btrim(coalesce(p_cost->>'note', '')), ''),
    nullif(p_cost->>'paid_by', '')::uuid,
    nullif(p_cost->>'paid_on', '')::date,
    nullif(p_cost->>'paid_method', ''),
    p_actor
  ) returning id into v_id;

  insert into public.supply_po_cost_allocations (cost_id, po_id, base, amount)
  select v_id, (a->>'po_id')::uuid, (a->>'base')::numeric, (a->>'amount')::numeric
    from jsonb_array_elements(p_allocs) a;

  return v_id;
exception
  when check_violation then
    raise exception 'PO_COST: phiếu không hợp lệ — chưa trả thì người thu phải có trong danh mục; đã trả tại chỗ thì phải đủ người trả / ngày / hình thức (%)', sqlerrm;
end;
$$;

revoke execute on function public.supply_po_cost_create(uuid, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.supply_po_cost_create(uuid, jsonb, jsonb) to service_role;
