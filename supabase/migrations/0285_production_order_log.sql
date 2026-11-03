-- 0285: production_order_log — NHẬT KÝ LỆNH SẢN XUẤT (T3 "Soát thay đổi", 02/11/2026).
--
-- Vì sao: lệnh không giữ số cũ. Đầu lệnh chỉ có cột hiện tại; dòng lệnh chỉ có
-- `changed_in_rev` (đổi ở bản nào, không biết đổi gì). 5 lần sửa lệnh thật
-- (05/08 → 05/10) đều nạp bằng SCRIPT nên không qua đường báo nào. Cung ứng cần
-- biết: ngày xuất / mốc vật tư dời bao nhiêu, SP nào đổi SL / bị thêm / bỏ,
-- quy cách (sơn, gỗ, kính, nệm, mây) đổi gì — để sửa đơn mua đã đặt.
-- Bản vẽ https://claude.ai/artifact/FgRYhTxeBoK3JWH6HcRAqE (bản 2, Q2), duyệt 02/11.
--
-- KHÔNG ghi vào `production_order_changes` (0224) như bản vẽ ghi lúc đầu: bảng đó
-- đang được màn Lịch sử của lệnh (Sale) đọc và bày MỌI dòng — trigger ghi vào đó
-- thì màn đang chạy hiện dòng thô, trùng với sự kiện "Đổi đầu lệnh" / "Bản phát
-- lại" app vẫn tự ghi. Bảng riêng này chỉ trang Soát thay đổi đọc.
--
-- Ghi bằng TRIGGER: màn lệnh, đồng bộ theo đơn, script nạp file — mọi đường ghi
-- đều đi qua. CHỈ ghi khi lệnh đang chạy (approved / in_progress) — sửa lúc còn
-- nháp / chờ duyệt không phải "thay đổi sau khi Cung ứng đã mua".
--
--   Đầu lệnh (`line_id` null, chỉ UPDATE): ship_date, materials_due_at, priority,
--   và status KHI vào / ra trạng thái huỷ (approved → in_progress → completed là
--   vòng đời thường, không ghi).
--   Dòng lệnh (`line_id` = id dòng, INSERT / UPDATE / DELETE): product_id,
--   product_code, qty, unit, specs, ship_date. Sửa mà không đụng trường nào
--   trong danh sách → KHÔNG ghi.
--   `before` / `after`: ảnh chụp các trường trên (null cho thêm / xoá).
--
-- KHÔNG có cột người sửa: production_orders / production_order_lines không có
-- `updated_by`, DB không tự biết ai sửa. Trang soát đối chiếu với sự kiện app
-- ghi (0224 + revised_by / revised_at) theo giờ; không khớp = "không ghi người"
-- (thường là script).
--
-- KHÔNG FK ở production_order_id / line_id: dòng có thể đã bị xoá — chính lúc đó
-- nhật ký mới cần; FK còn làm HỎNG việc xoá lệnh (xoá dây chuyền dòng → trigger
-- chèn nhật ký trỏ vào lệnh đang xoá → kiểm FK cuối câu lệnh đánh trượt cả lượt
-- xoá — đúng bẫy đã gặp ở 0284).
--
-- AN TOÀN: lỗi trong trigger bị NUỐT (raise warning) — ghi nhật ký hỏng không
-- được làm hỏng lượt lưu lệnh.
--
-- RLS: enable row level security, KHÔNG policy (anon chặn, secret key bypass).
-- Idempotent.

create table if not exists public.production_order_log (
  id                  uuid primary key default gen_random_uuid(),
  production_order_id uuid not null,
  line_id             uuid,
  action              text not null check (action in ('insert', 'update', 'delete')),
  before              jsonb,
  after               jsonb,
  changed_fields      text[] not null default '{}',
  -- clock_timestamp(), KHÔNG now(): now() là giờ BẮT ĐẦU giao dịch nên mọi
  -- bản ghi của một lượt lưu / một script trùng giờ, không xếp được thứ tự.
  changed_at          timestamptz not null default clock_timestamp()
);
alter table public.production_order_log
  alter column changed_at set default clock_timestamp();

comment on table public.production_order_log is
  'Nhật ký lệnh SX (0285) — trigger ghi đổi đầu lệnh (ngày xuất, mốc vật tư, ưu tiên, huỷ) và dòng lệnh (SP, SL, quy cách) khi lệnh đang chạy, cũ → mới';

create index if not exists production_order_log_lsx_idx
  on public.production_order_log (production_order_id, changed_at);

alter table public.production_order_log enable row level security;

-- ── Đầu lệnh ─────────────────────────────────────────────────────────────
create or replace function public.production_order_log_header()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  cot   constant text[] := array['ship_date', 'materials_due_at', 'priority'];
  truoc jsonb;
  sau   jsonb;
  doi   text[] := '{}';
  c     text;
begin
  begin
    if old.status not in ('approved', 'in_progress', 'cancelled') then
      return null;
    end if;
    select jsonb_object_agg(k, v) into truoc
      from jsonb_each(to_jsonb(old)) e(k, v)
      where k = any(cot) or k = 'status';
    select jsonb_object_agg(k, v) into sau
      from jsonb_each(to_jsonb(new)) e(k, v)
      where k = any(cot) or k = 'status';
    foreach c in array cot loop
      if (truoc -> c) is distinct from (sau -> c) then
        doi := doi || c;
      end if;
    end loop;
    if (old.status = 'cancelled') <> (new.status = 'cancelled') then
      doi := doi || 'status'::text;
    end if;
    if array_length(doi, 1) is null then
      return null;
    end if;
    insert into public.production_order_log
      (production_order_id, line_id, action, before, after, changed_fields)
    values (new.id, null, 'update', truoc, sau, doi);
  exception when others then
    raise warning 'production_order_log_header: %', sqlerrm;
  end;
  return null;
end;
$$;

drop trigger if exists production_order_log_header on public.production_orders;
create trigger production_order_log_header
  after update on public.production_orders
  for each row execute function public.production_order_log_header();

-- ── Dòng lệnh ────────────────────────────────────────────────────────────
create or replace function public.production_order_log_line()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  cot   constant text[] := array['product_id', 'product_code', 'qty', 'unit', 'specs', 'ship_date'];
  truoc jsonb;
  sau   jsonb;
  doi   text[] := '{}';
  c     text;
  lenh  uuid;
  tt    text;
begin
  begin
    lenh := case when tg_op = 'DELETE' then old.production_order_id else new.production_order_id end;
    select status into tt from public.production_orders where id = lenh;
    if tt is null or tt not in ('approved', 'in_progress') then
      return null;
    end if;
    if tg_op <> 'INSERT' then
      select jsonb_object_agg(k, v) into truoc
        from jsonb_each(to_jsonb(old)) e(k, v)
        where k = any(cot);
    end if;
    if tg_op <> 'DELETE' then
      select jsonb_object_agg(k, v) into sau
        from jsonb_each(to_jsonb(new)) e(k, v)
        where k = any(cot);
    end if;
    if tg_op = 'UPDATE' then
      foreach c in array cot loop
        if (truoc -> c) is distinct from (sau -> c) then
          doi := doi || c;
        end if;
      end loop;
      if array_length(doi, 1) is null then
        return null;
      end if;
    end if;
    insert into public.production_order_log
      (production_order_id, line_id, action, before, after, changed_fields)
    values (
      lenh,
      case when tg_op = 'DELETE' then old.id else new.id end,
      lower(tg_op),
      truoc,
      sau,
      doi
    );
  exception when others then
    raise warning 'production_order_log_line: %', sqlerrm;
  end;
  return null;
end;
$$;

drop trigger if exists production_order_log_line on public.production_order_lines;
create trigger production_order_log_line
  after insert or update or delete on public.production_order_lines
  for each row execute function public.production_order_log_line();
