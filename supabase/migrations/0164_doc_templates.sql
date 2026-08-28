-- MẪU CHỨNG TỪ: quy tắc ĐÁNH SỐ + khuôn MẪU IN của từng loại phiếu.
--
-- Trước migration này:
--   · `next_doc_code(kind)` (0011) ghép chết `KIND-YYYY-NNNN`, reset theo năm;
--   · tiêu đề phiếu, quốc hiệu, mẫu số TT200 và tên các cột chữ ký gõ thẳng
--     trong JSX của 6 trang in.
-- Kế toán đổi tiền tố đầu năm hay công ty đổi người ký đều phải sửa code rồi
-- deploy. Từ nay hai thứ đó là DỮ LIỆU, sửa ở /admin/doc-templates.
--
-- Thay đổi:
--   1. Bảng `doc_templates` (khoá = mã loại chứng từ) + seed 8 loại bằng ĐÚNG
--      giá trị đang chạy — áp migration KHÔNG làm đổi một mã hay một tờ giấy nào.
--   2. `next_doc_code()` viết lại: đọc khuôn từ bảng, tự rơi về mặc định cũ nếu
--      loại đó chưa khai (không có hàng ⇒ hành vi y hệt 0011).
--   3. Cột `doc_counters.year` NAY LÀ "KỲ": 2026 (reset năm) · 202608 (reset
--      tháng) · 0 (không reset). Dữ liệu cũ toàn năm nên không phải sửa gì.
--   4. Đếm theo giờ VIỆT NAM chứ không UTC. Bản cũ dùng `now()` (UTC): phiếu lập
--      lúc 05:00 ngày 01/01/2026 giờ VN vẫn còn là 2025 bên UTC ⇒ cấp mã mang
--      năm cũ và ăn vào bộ đếm năm cũ.
--
-- RLS: `doc_templates` ENABLE, không policy (anon chặn, server secret key bypass)
-- — cùng tư thế mọi bảng khác. Hàm `security invoker`, `search_path=''`.
-- Idempotent: create table/index if not exists, insert on conflict do nothing,
-- create or replace function. Chạy lại an toàn.
-- Apply: `npx supabase db push` hoặc dán vào SQL editor. Sau đó "sync types".

create table if not exists public.doc_templates (
  kind             text primary key,
  label            text not null,

  -- ── Đánh số ──────────────────────────────────────────────────────────────
  -- prefix null = loại này KHÔNG dùng bộ đếm chung (LSX đếm theo từng khách).
  prefix           text,
  pattern          text not null default '{prefix}-{yyyy}-{seq}',
  seq_pad          int  not null default 4 check (seq_pad between 1 and 10),
  reset_scope      text not null default 'year'
                     check (reset_scope in ('year', 'month', 'never')),

  -- ── Mẫu in ───────────────────────────────────────────────────────────────
  title_vi         text not null,
  title_en         text,
  national_heading boolean not null default true,
  form_no          text,                                  -- "01-VT" (TT200)
  signatures       jsonb not null default '[]'::jsonb,     -- [{role, hint}]
  default_terms    text not null default '',

  updated_at       timestamptz not null default now(),
  updated_by       uuid references public.users (id) on delete set null
);

comment on table public.doc_templates is
  'Quy tắc đánh số + khuôn mẫu in của từng loại chứng từ (0164). Mặc định trong code: src/lib/doc-templates.ts';
comment on column public.doc_templates.pattern is
  'Ô thay thế: {prefix} {yyyy} {yy} {mm} {seq}. Phải khớp formatDocCode() bên TS.';
comment on column public.doc_counters.year is
  'KỲ của bộ đếm: 2026 (reset năm) · 202608 (reset tháng) · 0 (không reset).';

alter table public.doc_templates enable row level security;

drop trigger if exists set_updated_at on public.doc_templates;
create trigger set_updated_at before update on public.doc_templates
  for each row execute function public.set_updated_at();

-- ── Seed: ĐÚNG hành vi đang chạy ───────────────────────────────────────────
insert into public.doc_templates
  (kind, label, prefix, pattern, seq_pad, reset_scope,
   title_vi, title_en, national_heading, form_no, signatures, default_terms)
values
  ('BG', 'Báo giá', 'BG', '{prefix}-{yyyy}-{seq}', 4, 'year',
   'BÁO GIÁ', 'QUOTATION', false, null,
   '[{"role":"KHÁCH HÀNG / CUSTOMER","hint":"Ký, ghi rõ họ tên, đóng dấu"},
     {"role":"NGƯỜI LẬP / PREPARED BY","hint":"Ký, ghi rõ họ tên"},
     {"role":"GIÁM ĐỐC / DIRECTOR","hint":"Ký, ghi rõ họ tên, đóng dấu"}]'::jsonb, ''),

  ('DH', 'Đơn hàng bán / hợp đồng', 'DH', '{prefix}-{yyyy}-{seq}', 4, 'year',
   -- Hợp đồng bán in theo khuôn riêng (Article 1-9), không có khối ký dùng chung.
   'SALES CONTRACT', null, false, null, '[]'::jsonb, ''),

  ('PO', 'Đơn đặt hàng (mua vật tư)', 'PO', '{prefix}-{yyyy}-{seq}', 4, 'year',
   'ĐƠN ĐẶT HÀNG', 'PURCHASE ORDER', true, null,
   '[{"role":"XÁC NHẬN CỦA NHÀ CUNG CẤP","hint":"Ký, ghi rõ họ tên, đóng dấu"},
     {"role":"{signer_role}","hint":"Ký, ghi rõ họ tên","slot":"creator"},
     {"role":"{company}","hint":"Ký tên, đóng dấu"}]'::jsonb, ''),

  ('LSX', 'Lệnh sản xuất', null, '{seq}/{yy} - {customer}', 2, 'year',
   'LỆNH SẢN XUẤT', 'PRODUCTION ORDER', true, null,
   '[{"role":"Người lập"},{"role":"Trưởng phòng kế hoạch"},{"role":"Giám Đốc"}]'::jsonb, ''),

  ('PNK', 'Phiếu nhập kho', 'PNK', '{prefix}-{yyyy}-{seq}', 4, 'year',
   'PHIẾU NHẬP KHO', null, false, '01-VT',
   '[{"role":"Người lập phiếu","hint":"Ký, ghi rõ họ tên","slot":"creator"},
     {"role":"Người giao hàng","hint":"Ký, ghi rõ họ tên","slot":"counterparty"},
     {"role":"Thủ kho","hint":"Ký, ghi rõ họ tên"},
     {"role":"Kế toán trưởng","hint":"Ký, ghi rõ họ tên"}]'::jsonb, ''),

  ('PXK', 'Phiếu xuất kho', 'PXK', '{prefix}-{yyyy}-{seq}', 4, 'year',
   'PHIẾU XUẤT KHO', null, false, '02-VT',
   '[{"role":"Người lập phiếu","hint":"Ký, ghi rõ họ tên","slot":"creator"},
     {"role":"Người nhận hàng","hint":"Ký, ghi rõ họ tên","slot":"counterparty"},
     {"role":"Thủ kho","hint":"Ký, ghi rõ họ tên"},
     {"role":"Kế toán trưởng","hint":"Ký, ghi rõ họ tên"}]'::jsonb, ''),

  ('KK', 'Biên bản kiểm kê', 'KK', '{prefix}-{yyyy}-{seq}', 4, 'year',
   'BIÊN BẢN KIỂM KÊ VẬT TƯ', null, false, '05-VT',
   '[{"role":"Người kiểm kê (lập biên bản)","hint":"Ký, ghi rõ họ tên","slot":"creator"},
     {"role":"Thủ kho","hint":"Ký, ghi rõ họ tên"},
     {"role":"Quản lý Kho (duyệt)","hint":"Ký, ghi rõ họ tên","slot":"approver"},
     {"role":"Kế toán trưởng","hint":"Ký, ghi rõ họ tên"}]'::jsonb, ''),

  ('DCK', 'Phiếu điều chuyển kho', 'DCK', '{prefix}-{yyyy}-{seq}', 4, 'year',
   'PHIẾU ĐIỀU CHUYỂN KHO', null, false, null,
   '[{"role":"Người lập phiếu","hint":"Ký, ghi rõ họ tên"},
     {"role":"Thủ kho xuất","hint":"Ký, ghi rõ họ tên"},
     {"role":"Thủ kho nhận","hint":"Ký, ghi rõ họ tên"}]'::jsonb, ''),

  -- Hai loại CHỈ có đánh số, chưa có trang in (thư viện mẫu showroom).
  ('MS', 'Mẫu showroom', 'MS', '{prefix}-{yyyy}-{seq}', 4, 'year',
   'MẪU SHOWROOM', null, false, null, '[]'::jsonb, ''),
  ('PM', 'Phiếu mượn mẫu', 'PM', '{prefix}-{yyyy}-{seq}', 4, 'year',
   'PHIẾU MƯỢN MẪU', null, false, null, '[]'::jsonb, '')
on conflict (kind) do nothing;

-- ── Cấp mã kế tiếp: đọc khuôn từ bảng, đếm nguyên tử trong doc_counters ────
create or replace function public.next_doc_code(p_kind text)
returns text
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  -- Mặc định = hành vi 0011, dùng khi loại chứng từ chưa khai trong bảng.
  v_prefix  text := p_kind;
  v_pattern text := '{prefix}-{yyyy}-{seq}';
  v_pad     int  := 4;
  v_reset   text := 'year';
  v_now     timestamptz := timezone('Asia/Ho_Chi_Minh', now());
  v_period  int;
  v_no      int;
  v_code    text;
  t         record;
begin
  select prefix, pattern, seq_pad, reset_scope
    into t
    from public.doc_templates
   where kind = p_kind;

  if found then
    v_prefix  := coalesce(t.prefix, p_kind);
    v_pattern := coalesce(t.pattern, v_pattern);
    v_pad     := coalesce(t.seq_pad, v_pad);
    v_reset   := coalesce(t.reset_scope, v_reset);
  end if;

  v_period := case v_reset
    when 'month' then extract(year from v_now)::int * 100 + extract(month from v_now)::int
    when 'never' then 0
    else extract(year from v_now)::int
  end;

  insert into public.doc_counters as c (kind, year, last_no)
  values (p_kind, v_period, 1)
  on conflict (kind, year)
  do update set last_no = c.last_no + 1
  returning c.last_no into v_no;

  v_code := v_pattern;
  v_code := replace(v_code, '{prefix}', v_prefix);
  v_code := replace(v_code, '{yyyy}',   to_char(v_now, 'YYYY'));
  v_code := replace(v_code, '{yy}',     to_char(v_now, 'YY'));
  v_code := replace(v_code, '{mm}',     to_char(v_now, 'MM'));
  v_code := replace(v_code, '{seq}',    lpad(v_no::text, v_pad, '0'));
  return v_code;
end;
$$;
