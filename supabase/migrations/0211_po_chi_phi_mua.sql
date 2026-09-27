-- 0211 — PHIẾU CHI PHÍ MUA HÀNG (phí vận chuyển / bốc xếp / phí khác của đơn mua).
--
-- Chủ dự án chốt 26/09/2026:
--   · Cả hai kiểu người thu: NCC tính phí ngay trên đơn, HOẶC nhà xe thu riêng
--     (dữ liệu thật: 8 đơn giao tới "Nhà xe Hùng Vịnh, QL 1A, Q12" — hàng NCC
--     gửi ra bãi xe, nhà xe chở về xưởng). Cả hai là MỘT loại phiếu, khác nhau
--     ở người nhận tiền (`payee_supplier_id`): NCC của đơn hoặc nhà xe (nhà xe
--     khai như một NCC trong danh mục).
--   · CHƯA cộng vào giá vốn vật tư nhập kho — phí nằm riêng cho Kế toán theo
--     đơn / lệnh / tháng, cùng cách "phát sinh" của điều chỉnh đơn (0210). Giá
--     nhập kho (warehouse_movements.unit_cost) KHÔNG đổi.
--   · Một chuyến xe chở hàng nhiều đơn = MỘT phiếu gắn nhiều đơn; tiền chia
--     theo tiền hàng mỗi đơn (`lib/po-cost.ts`, thuần, có test). Phần chia
--     GHI CỨNG vào bảng phân bổ lúc lập — đơn điều chỉnh về sau không làm sổ
--     phí cũ tự đổi.
--   · Ghi lúc hàng về / có hoá đơn (số THỰC TẾ), không có ô dự kiến lúc đặt.
--
-- Không xoá, chỉ ĐẢO (nguyên lý 4 của docs/tieu-chi-workflow-erp.md): phiếu
-- ghi sai thì huỷ kèm lý do (`voided_*`), rồi lập phiếu đúng.
--
-- Ghi phiếu + phân bổ đi qua hàm `supply_po_cost_create` — MỘT giao dịch.
-- Phiếu có mà phân bổ không có là tiền không thuộc đơn nào: sổ nói dối.
--
-- RLS: hai bảng ENABLE, không policy (anon chặn, secret key bypass). Hàm
-- security invoker + thu quyền execute của anon/authenticated. Idempotent.

-- ── 1) Phiếu chi phí ────────────────────────────────────────────────────────
create table if not exists public.supply_po_costs (
  id                 uuid primary key default gen_random_uuid(),
  -- Người NHẬN tiền: NCC của đơn, hoặc nhà xe / đơn vị bốc xếp (khai trong
  -- danh mục NCC). Không xoá NCC đang có phiếu.
  payee_supplier_id  uuid not null
                     references public.supply_suppliers(id) on delete restrict,
  kind               text not null default 'van_chuyen'
                     check (kind in ('van_chuyen', 'boc_xep', 'khac')),
  -- Ngày phát sinh (ngày hàng về / ngày trên hoá đơn nhà xe).
  cost_date          date not null,
  -- Số hoá đơn / số phiếu của nhà xe — để Kế toán đối chiếu.
  doc_no             text,
  currency           text not null default 'VND',
  -- Tiền CHƯA VAT; VAT tính theo thuế suất riêng của phí (nhà xe hay 8%/10%,
  -- có khi không hoá đơn = 0).
  amount             numeric(18, 2) not null check (amount > 0),
  vat_rate           numeric(5, 2) check (vat_rate is null or (vat_rate >= 0 and vat_rate <= 100)),
  vat_amount         numeric(18, 2) not null default 0 check (vat_amount >= 0),
  total              numeric(18, 2) not null check (total > 0),
  note               text,
  created_by         uuid references public.users(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  voided_at          timestamptz,
  voided_by          uuid references public.users(id) on delete set null,
  void_reason        text,
  constraint supply_po_costs_void_chk check (
    (voided_at is null and voided_by is null and void_reason is null)
    or (voided_at is not null and length(btrim(coalesce(void_reason, ''))) >= 5)
  )
);

create index if not exists supply_po_costs_payee_idx
  on public.supply_po_costs (payee_supplier_id, cost_date desc);
create index if not exists supply_po_costs_date_idx
  on public.supply_po_costs (cost_date desc);

drop trigger if exists supply_po_costs_updated_at on public.supply_po_costs;
create trigger supply_po_costs_updated_at
  before update on public.supply_po_costs
  for each row execute function public.set_updated_at();

alter table public.supply_po_costs enable row level security;

-- ── 2) Phân bổ phiếu cho từng đơn ───────────────────────────────────────────
create table if not exists public.supply_po_cost_allocations (
  id        uuid primary key default gen_random_uuid(),
  cost_id   uuid not null references public.supply_po_costs(id) on delete cascade,
  -- Đơn đã có phí thì không xoá được (đơn đã gửi vốn cũng không xoá được —
  -- chỉ nháp mới xoá, mà nháp không nhận phí).
  po_id     uuid not null references public.supply_purchase_orders(id) on delete restrict,
  -- Tiền hàng của đơn lúc chia (gốc tính tỷ lệ) — giữ lại để bày phép chia.
  base      numeric(18, 2) not null check (base >= 0),
  -- Phần phí của đơn này, CHƯA VAT. Σ amount của một phiếu = phiếu.amount.
  amount    numeric(18, 2) not null check (amount >= 0),
  unique (cost_id, po_id)
);

create index if not exists supply_po_cost_allocations_po_idx
  on public.supply_po_cost_allocations (po_id);

alter table public.supply_po_cost_allocations enable row level security;

-- ── 3) Ghi phiếu + phân bổ trong MỘT giao dịch ──────────────────────────────
-- p_cost:   {payee_supplier_id, kind, cost_date, doc_no, currency, amount,
--            vat_rate, vat_amount, total, note}
-- p_allocs: [{po_id, base, amount}, …] — service đã chia (lib/po-cost.ts).
-- Hàm KIỂM LẠI: Σ phân bổ = tiền phiếu, đơn tồn tại và không ở nháp / chờ
-- duyệt / đã huỷ, cùng tiền tệ với phiếu.
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

  -- Khoá các đơn TRƯỚC khi kiểm, để không ai huỷ đơn chen giữa lúc kiểm và lúc ghi.
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
    payee_supplier_id, kind, cost_date, doc_no, currency,
    amount, vat_rate, vat_amount, total, note, created_by
  ) values (
    (p_cost->>'payee_supplier_id')::uuid,
    coalesce(p_cost->>'kind', 'van_chuyen'),
    (p_cost->>'cost_date')::date,
    nullif(btrim(coalesce(p_cost->>'doc_no', '')), ''),
    v_cur,
    v_amount,
    (p_cost->>'vat_rate')::numeric,
    coalesce((p_cost->>'vat_amount')::numeric, 0),
    (p_cost->>'total')::numeric,
    nullif(btrim(coalesce(p_cost->>'note', '')), ''),
    p_actor
  ) returning id into v_id;

  insert into public.supply_po_cost_allocations (cost_id, po_id, base, amount)
  select v_id, (a->>'po_id')::uuid, (a->>'base')::numeric, (a->>'amount')::numeric
    from jsonb_array_elements(p_allocs) a;

  return v_id;
end;
$$;

revoke execute on function public.supply_po_cost_create(uuid, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.supply_po_cost_create(uuid, jsonb, jsonb) to service_role;
