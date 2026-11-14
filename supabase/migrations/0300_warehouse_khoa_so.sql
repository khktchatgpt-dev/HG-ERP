-- 0300: KHOÁ SỔ KHO THEO KỲ ĐÃ CHỐT + MỞ LẠI + NHẬT KÝ (B3, bản vẽ chốt kỳ
-- https://claude.ai/artifact/6mgaRUw38AvLwCS1199P73 khung 5–6, Q2/Q6 duyệt 13/11/2026).
--
-- 1. `warehouse_period_log` — MỘT dòng cho mỗi lần chốt / mở lại một tháng. Chỉ
--    chèn, không sửa. Mở lại BẮT lý do ≥ 10 ký tự (zod kiểm trước, DB chặn sau).
-- 2. `warehouse_close_periods` (0297) ghi thêm dòng nhật ký 'close' cho mỗi tháng.
-- 3. `warehouse_reopen_period` — Kế toán trưởng mở lại ĐÚNG tháng chốt mới nhất
--    (Q6: mở từng tháng, từ mới nhất lùi về): ghi nhật ký rồi xoá bản chốt
--    (bản chốt theo mã đi theo, on delete cascade). Ngày khoá lùi về cuối tháng trước.
-- 4. Trigger trên `warehouse_docs` — CHẶN mọi phiếu có ngày chứng từ ≤ ngày khoá
--    (= `den` của tháng chốt mới nhất): thêm phiếu, đổi ngày phiếu, và duyệt
--    (pending → posted) phiếu kiểm kê nằm trong kỳ đã khoá. Một chỗ chặn cho MỌI
--    đường ghi (nhận theo đơn ở Kho lẫn Cung ứng, ngoài đơn, hoàn kho, nhập đề nghị,
--    xuất, cập nhật số thực tế, kiểm kê). Đảo / điều chỉnh phiếu cũ vẫn được: phiếu
--    mới mang ngày hôm nay (cột doc_date mặc định current_date). Sửa số phiếu NCC,
--    người giao, ghi chú không đụng doc_date nên không vướng.
--    Lỗi mang dạng `KHO_KHOA|<ngày khoá>|<dd/mm/yyyy chốt>|<tên người chốt>` — mã
--    TS (`stock.repo`) dịch thành câu người đọc được.
--
-- Chưa chốt tháng nào thì trigger không làm gì (đo 14/11: 0 tháng chốt) — áp trước
-- khi mã lên main vẫn an toàn.
--
-- RLS: enable row level security, KHÔNG policy — anon bị chặn, khoá bí mật (server)
-- bypass, như mọi bảng khác. Hàm security invoker; chỉ service_role được gọi.
-- Idempotent.

create table if not exists public.warehouse_period_log (
  id uuid primary key default gen_random_uuid(),
  thang date not null check (extract(day from thang) = 1),
  action text not null check (action in ('close', 'reopen')),
  reason text,
  actor_id uuid references public.users(id) on delete set null,
  -- Giá trị tồn cuối của tháng lúc chốt / lúc mở lại — nhật ký nói được "khoá số nào".
  gt_ton_cuoi numeric,
  created_at timestamptz not null default now(),
  constraint warehouse_period_log_reopen_reason
    check (action <> 'reopen' or (reason is not null and length(trim(reason)) >= 10))
);

create index if not exists warehouse_period_log_created_idx
  on public.warehouse_period_log (created_at desc);

alter table public.warehouse_period_log enable row level security;

-- ── 2. Chốt: như 0297, thêm dòng nhật ký cho mỗi tháng ───────────────────────
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

    insert into public.warehouse_period_log (thang, action, actor_id, gt_ton_cuoi)
    values ((m->>'thang')::date, 'close', p_actor, (m->>'gt_ton_cuoi')::numeric);

    v_n := v_n + 1;
  end loop;

  return v_n;
end;
$$;

revoke execute on function public.warehouse_close_periods(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.warehouse_close_periods(uuid, jsonb) to service_role;

-- ── 3. Mở lại tháng chốt mới nhất ────────────────────────────────────────────
create or replace function public.warehouse_reopen_period(
  p_actor  uuid,
  p_thang  date,
  p_reason text
) returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_ma date;
  v_id uuid;
  v_gt numeric;
begin
  if p_reason is null or length(trim(p_reason)) < 10 then
    raise exception 'KHO_CHOT: ghi lý do mở lại (ít nhất 10 ký tự)';
  end if;

  lock table public.warehouse_periods in share row exclusive mode;

  select max(thang) into v_ma from public.warehouse_periods;
  if v_ma is null then
    raise exception 'KHO_CHOT: sổ kho chưa chốt tháng nào';
  end if;
  if p_thang is distinct from v_ma then
    raise exception 'KHO_CHOT: chỉ mở lại được tháng chốt mới nhất (%) — mở từ tháng mới nhất lùi về',
      to_char(v_ma, 'MM/YYYY');
  end if;

  select id, gt_ton_cuoi into v_id, v_gt from public.warehouse_periods where thang = v_ma;

  insert into public.warehouse_period_log (thang, action, reason, actor_id, gt_ton_cuoi)
  values (v_ma, 'reopen', trim(p_reason), p_actor, v_gt);

  -- Bản chốt theo mã (warehouse_period_costs) xoá theo, on delete cascade (0297).
  delete from public.warehouse_periods where id = v_id;
end;
$$;

revoke execute on function public.warehouse_reopen_period(uuid, date, text) from public, anon, authenticated;
grant execute on function public.warehouse_reopen_period(uuid, date, text) to service_role;

-- ── 4. Chặn ghi phiếu vào kỳ đã khoá ─────────────────────────────────────────
create or replace function public.warehouse_docs_khoa_so()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_den date;
  v_luc timestamptz;
  v_ten text;
  v_chan boolean := false;
begin
  select p.den, p.closed_at, u.name
    into v_den, v_luc, v_ten
  from public.warehouse_periods p
  left join public.users u on u.id = p.closed_by
  order by p.thang desc
  limit 1;

  if v_den is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    v_chan := new.doc_date <= v_den;
  else
    v_chan :=
      (new.doc_date is distinct from old.doc_date
        and (new.doc_date <= v_den or old.doc_date <= v_den))
      or (new.status is distinct from old.status
        and new.status = 'posted'
        and new.doc_date <= v_den);
  end if;

  if v_chan then
    raise exception 'KHO_KHOA|%|%|%',
      to_char(v_den, 'YYYY-MM-DD'),
      to_char(v_luc at time zone 'Asia/Ho_Chi_Minh', 'DD/MM/YYYY'),
      coalesce(v_ten, '');
  end if;

  return new;
end;
$$;

drop trigger if exists warehouse_docs_khoa_so on public.warehouse_docs;
create trigger warehouse_docs_khoa_so
  before insert or update of doc_date, status on public.warehouse_docs
  for each row execute function public.warehouse_docs_khoa_so();
