-- 0227 — NGUYÊN NHÂN ĐIỀU CHỈNH ĐƠN MUA + lệnh / đơn khách mà lần điều chỉnh theo.
--
-- Chủ dự án chốt 07/10/2026 (bản vẽ "Nguyên nhân điều chỉnh đơn mua", Q1–Q5
-- theo đề xuất): khách đổi số lượng đơn hàng thì Cung ứng sửa đơn mua tại chỗ
-- (0210) — nhưng lý do chỉ là chữ gõ tự do, lịch sử không lọc / tra ngược được
-- "đơn mua nào đã sửa theo thay đổi của khách". Nay mỗi lần điều chỉnh mang:
--   1) `cause` — một trong năm nguyên nhân cố định (bắt buộc với lần mới):
--        khach_doi  Khách đổi đơn
--        ncc_doi    NCC đổi giá / điều kiện
--        ky_thuat   Kỹ thuật đổi định mức
--        nhap_sai   Nhập sai, sửa cho đúng
--        khac       Khác
--      null = bản ghi cũ chưa phân loại.
--   2) `supply_po_adjustment_lsx` — lệnh SX mà lần điều chỉnh theo. Bắt buộc ít
--      nhất một lệnh khi cause = khach_doi (Q2). Nối LỆNH chứ không nối đơn bán:
--      đơn mua gắn lệnh (supply_po_line_lsx / extra_lsx / po.production_order_id),
--      đơn bán đọc ngược từ lệnh qua sales_orders.production_order_id.
--
-- VÌ SAO HÀM BỌC (`supply_po_apply_adjustment_v2`) thay vì sửa hàm 0210: hàm
-- 0210 liệt kê tường minh ~35 cột dòng đơn ở hai chỗ; chép lại thân hàm là nguy
-- cơ lệch với bản đang chạy. Hàm bọc gọi hàm cũ rồi ghi nguyên nhân + lệnh trong
-- CÙNG một giao dịch — hỏng bước nào thì cả lần điều chỉnh không ghi.
--
-- RLS: bảng mới ENABLE, không policy (anon chặn, secret key bypass). Hàm
-- security invoker + chỉ service_role được execute. Idempotent: if not exists /
-- create or replace / drop + add constraint.

-- ── 1) Cột nguyên nhân ──────────────────────────────────────────────────────
alter table public.supply_po_adjustments
  add column if not exists cause text;

alter table public.supply_po_adjustments
  drop constraint if exists supply_po_adjustments_cause_check;
alter table public.supply_po_adjustments
  add constraint supply_po_adjustments_cause_check
  check (cause is null or cause in ('khach_doi', 'ncc_doi', 'ky_thuat', 'nhap_sai', 'khac'));

-- ── 2) Lệnh mà lần điều chỉnh theo ──────────────────────────────────────────
create table if not exists public.supply_po_adjustment_lsx (
  adjustment_id       uuid not null
                      references public.supply_po_adjustments(id) on delete cascade,
  production_order_id uuid not null
                      references public.production_orders(id) on delete cascade,
  primary key (adjustment_id, production_order_id)
);

-- Tra ngược từ lệnh: "đơn mua nào đã điều chỉnh theo lệnh này" (bước 2, Q5).
create index if not exists supply_po_adjustment_lsx_lsx_idx
  on public.supply_po_adjustment_lsx (production_order_id);

alter table public.supply_po_adjustment_lsx enable row level security;

-- ── 3) Hàm bọc: điều chỉnh + nguyên nhân + lệnh, một giao dịch ──────────────
create or replace function public.supply_po_apply_adjustment_v2(
  p_po_id      uuid,
  p_base_seq   int,
  p_actor      uuid,
  p_reason     text,
  p_updates    jsonb,
  p_inserts    jsonb,
  p_delete_ids uuid[],
  p_splits     jsonb,
  p_header     jsonb,
  p_record     jsonb,
  p_cause      text,
  p_lsx_ids    uuid[]
)
returns int
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_seq int;
  v_bad text;
begin
  if p_cause is null or p_cause not in ('khach_doi', 'ncc_doi', 'ky_thuat', 'nhap_sai', 'khac') then
    raise exception 'PO_ADJ: Chọn nguyên nhân điều chỉnh';
  end if;
  if p_cause = 'khach_doi' and coalesce(cardinality(p_lsx_ids), 0) = 0 then
    raise exception 'PO_ADJ: Khách đổi đơn — chọn lệnh / đơn khách mà lần điều chỉnh này theo';
  end if;
  select string_agg(x::text, ', ') into v_bad
  from unnest(coalesce(p_lsx_ids, '{}'::uuid[])) x
  where not exists (select 1 from public.production_orders o where o.id = x);
  if v_bad is not null then
    raise exception 'PO_ADJ: Lệnh không tồn tại (%)', v_bad;
  end if;

  v_seq := public.supply_po_apply_adjustment(
    p_po_id, p_base_seq, p_actor, p_reason, p_updates, p_inserts,
    p_delete_ids, p_splits, p_header, p_record
  );

  update public.supply_po_adjustments a
  set cause = p_cause
  where a.po_id = p_po_id and a.seq = v_seq;

  insert into public.supply_po_adjustment_lsx (adjustment_id, production_order_id)
  select a.id, x
  from public.supply_po_adjustments a
  cross join (select distinct unnest(coalesce(p_lsx_ids, '{}'::uuid[])) as x) l
  where a.po_id = p_po_id and a.seq = v_seq
  on conflict do nothing;

  return v_seq;
end;
$$;

revoke all on function public.supply_po_apply_adjustment_v2(uuid, int, uuid, text, jsonb, jsonb, uuid[], jsonb, jsonb, jsonb, text, uuid[])
  from public, anon, authenticated;
grant execute on function public.supply_po_apply_adjustment_v2(uuid, int, uuid, text, jsonb, jsonb, uuid[], jsonb, jsonb, jsonb, text, uuid[])
  to service_role;
