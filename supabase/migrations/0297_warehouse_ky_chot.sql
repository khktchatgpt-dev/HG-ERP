-- 0297 — CHỐT KỲ SỔ KHO (B2, 13/11/2026; bản vẽ
-- https://claude.ai/artifact/6mgaRUw38AvLwCS1199P73, Q1–Q6 duyệt).
--
-- Mỗi tháng chốt = MỘT dòng `warehouse_periods` + MỘT bản chốt theo mã
-- (`warehouse_period_costs`): đơn giá bình quân gia quyền cả tháng + tồn đầu /
-- nhập / xuất / tồn cuối (SL + tiền) — đúng hàng `dungNxt` (src/lib/kho-nxt.ts)
-- tính lúc chốt. KHÔNG sửa dòng sổ `warehouse_movements`: giá xuất đọc từ bản
-- chốt. Ngày khoá = `den` của tháng chốt mới nhất.
--
-- Q6: chốt tháng M khi tháng trước còn mở thì chốt luôn các tháng đó, mỗi tháng
-- một bản chốt — `warehouse_close_periods(actor, months)` ghi cả lượt trong MỘT
-- giao dịch. Tháng đã chốt hoặc đã có tháng SAU nó chốt → raise, cả lượt huỷ.
-- Chặn ghi lùi + mở lại + nhật ký là B3 (bảng riêng); ở B2 hai bảng này chỉ chèn.
--
-- Quyền mới `warehouse.period.close` gieo cho vai `chief_accountant` (0260) — Q2:
-- Kế toán trưởng chốt. Gán người vào vai là dữ liệu (màn Phân quyền).
--
-- RLS: hai bảng enable row level security, KHÔNG policy — anon bị chặn, khoá bí
-- mật (server) bypass. Hàm security invoker, chỉ service_role được gọi.
-- Idempotent: if not exists / create or replace / on conflict do nothing.

create table if not exists public.warehouse_periods (
  id uuid primary key default gen_random_uuid(),
  -- Ngày đầu tháng chốt (2026-10-01).
  thang date not null unique,
  -- Ngày khoá = ngày cuối tháng (2026-10-31).
  den date not null,
  closed_at timestamptz not null default now(),
  closed_by uuid references public.users(id) on delete set null,
  -- Tóm tắt lúc chốt (hộp "Sẽ ghi vào bản chốt") — để nhật ký không phải cộng lại.
  dong_xuat integer not null default 0,
  dong_kk_thua integer not null default 0,
  gt_xuat numeric,
  gt_ton_cuoi numeric,
  -- Lưu ý người chốt đã tích (Q3): [{ "key": "lenh:2026-10", "text": "13 / 15 lệnh …" }].
  luu_y jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint warehouse_periods_dau_thang check (extract(day from thang) = 1),
  constraint warehouse_periods_den_trong_thang
    check (den >= thang and den < (thang + interval '1 month')::date)
);

drop trigger if exists warehouse_periods_set_updated_at on public.warehouse_periods;
create trigger warehouse_periods_set_updated_at
  before update on public.warehouse_periods
  for each row execute function public.set_updated_at();

alter table public.warehouse_periods enable row level security;

create table if not exists public.warehouse_period_costs (
  id uuid primary key default gen_random_uuid(),
  period_id uuid not null references public.warehouse_periods(id) on delete cascade,
  -- Mã đã có dòng sổ thì không xoá được (materialsRepo.usage) — restrict cho chắc.
  material_id uuid not null references public.warehouse_materials(id) on delete restrict,
  ton_dau numeric not null,
  -- { mua, hoan, kkThua, nhapKhac } / { choLenh, kkThieu, xuatKhac } — cột của Báo cáo tháng.
  nhap jsonb not null,
  xuat jsonb not null,
  ton_cuoi numeric not null,
  -- Bình quân gia quyền cả tháng; null = mã chưa lần nhập nào có giá.
  don_gia numeric,
  gt_dau numeric,
  gt_nhap numeric,
  gt_xuat numeric,
  gt_cuoi numeric,
  -- Phép tính đơn giá nguyên văn { tu, mau, kieu }; null = lấy lại bình quân tháng trước.
  bq jsonb,
  thieu_gia integer not null default 0,
  lan_mua integer not null default 0,
  thieu_ty_gia integer not null default 0,
  phat_sinh boolean not null default false,
  created_at timestamptz not null default now(),
  unique (period_id, material_id)
);

create index if not exists warehouse_period_costs_material_idx
  on public.warehouse_period_costs (material_id);

alter table public.warehouse_period_costs enable row level security;

create or replace function public.warehouse_close_periods(
  p_actor  uuid,
  p_months jsonb
) returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  m     jsonb;
  v_id  uuid;
  v_n   integer := 0;
  v_ma  date;
begin
  if jsonb_typeof(p_months) is distinct from 'array' or jsonb_array_length(p_months) = 0 then
    raise exception 'KHO_CHOT: không có tháng nào để chốt';
  end if;

  -- Hai người bấm Chốt cùng lúc: người sau chờ, rồi vấp kiểm "đã chốt" bên dưới.
  lock table public.warehouse_periods in share row exclusive mode;

  for m in
    select value from jsonb_array_elements(p_months) order by value->>'thang'
  loop
    select max(thang) into v_ma from public.warehouse_periods;
    if v_ma is not null and v_ma >= (m->>'thang')::date then
      raise exception 'KHO_CHOT: tháng % đã chốt (sổ đã chốt đến tháng %)',
        to_char((m->>'thang')::date, 'MM/YYYY'), to_char(v_ma, 'MM/YYYY');
    end if;

    insert into public.warehouse_periods (
      thang, den, closed_by, dong_xuat, dong_kk_thua, gt_xuat, gt_ton_cuoi, luu_y
    ) values (
      (m->>'thang')::date,
      (m->>'den')::date,
      p_actor,
      coalesce((m->>'dong_xuat')::integer, 0),
      coalesce((m->>'dong_kk_thua')::integer, 0),
      (m->>'gt_xuat')::numeric,
      (m->>'gt_ton_cuoi')::numeric,
      coalesce(m->'luu_y', '[]'::jsonb)
    ) returning id into v_id;

    insert into public.warehouse_period_costs (
      period_id, material_id, ton_dau, nhap, xuat, ton_cuoi, don_gia,
      gt_dau, gt_nhap, gt_xuat, gt_cuoi, bq, thieu_gia, lan_mua, thieu_ty_gia, phat_sinh
    )
    select
      v_id,
      (r->>'material_id')::uuid,
      (r->>'ton_dau')::numeric,
      r->'nhap',
      r->'xuat',
      (r->>'ton_cuoi')::numeric,
      (r->>'don_gia')::numeric,
      (r->>'gt_dau')::numeric,
      (r->>'gt_nhap')::numeric,
      (r->>'gt_xuat')::numeric,
      (r->>'gt_cuoi')::numeric,
      case when jsonb_typeof(r->'bq') = 'object' then r->'bq' end,
      coalesce((r->>'thieu_gia')::integer, 0),
      coalesce((r->>'lan_mua')::integer, 0),
      coalesce((r->>'thieu_ty_gia')::integer, 0),
      coalesce((r->>'phat_sinh')::boolean, false)
    from jsonb_array_elements(coalesce(m->'rows', '[]'::jsonb)) r;

    v_n := v_n + 1;
  end loop;

  return v_n;
end;
$$;

revoke execute on function public.warehouse_close_periods(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.warehouse_close_periods(uuid, jsonb) to service_role;

insert into public.permissions (key, label, domain, sort_order)
values ('warehouse.period.close', 'Chốt kỳ sổ kho (ghi bản chốt giá xuất từng tháng)', 'warehouse', 59)
on conflict (key) do nothing;

insert into public.role_permissions (role_id, permission_key)
select r.id, 'warehouse.period.close'
from public.roles r
where r.key = 'chief_accountant'
on conflict do nothing;
