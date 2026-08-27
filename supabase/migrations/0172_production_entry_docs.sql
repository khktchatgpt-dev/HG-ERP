-- 0172: PHIẾU BÁO SẢN LƯỢNG (PBS) — chứng từ hoá sổ số liệu sản xuất.
-- User chốt 25/08: nhập liệu theo mẫu ERP thật — mỗi lượt Ghi sổ = MỘT PHIẾU
-- có số hiệu (đánh số qua next_doc_code('PBS'), khuôn 0164), in được để tổ
-- trưởng ký đối chiếu với tờ báo giấy; xoá là xoá NGUYÊN PHIẾU.
--   1. Bảng header `production_entry_docs`: 1 phiếu = (lệnh × công đoạn × tổ ×
--      ngày × lượt ghi); dòng của phiếu là production_entries.
--   2. `production_entries.doc_id` — bản ghi cũ (trước PBS) giữ NULL, coi là
--      "bản ghi lẻ"; on delete set null để lỡ xoá header không mất số sản lượng
--      (xoá phiếu ĐÚNG CÁCH đi qua service: xoá entries trước rồi mới xoá header).
-- RLS: enable, không policy (anon chặn, secret key server bypass) — chuẩn chung.
-- Idempotent: if not exists toàn bộ, chạy lại an toàn.

create table if not exists public.production_entry_docs (
  id                  uuid primary key default gen_random_uuid(),
  doc_no              text not null,
  production_order_id uuid not null references public.production_orders (id) on delete cascade,
  stage               text not null,
  team_department_id  uuid references public.departments (id) on delete set null,
  entry_date          date not null,
  note                text,
  created_by          uuid references public.users (id) on delete set null,
  created_at          timestamptz not null default now()
);

create unique index if not exists idx_pbs_doc_no
  on public.production_entry_docs (doc_no);
create index if not exists idx_pbs_lsx
  on public.production_entry_docs (production_order_id);
create index if not exists idx_pbs_date
  on public.production_entry_docs (entry_date);

comment on table public.production_entry_docs is
  'Header phiếu báo sản lượng (PBS, 0172) — 1 phiếu = 1 lượt Ghi sổ của thống kê; dòng phiếu ở production_entries.doc_id';

alter table public.production_entries
  add column if not exists doc_id uuid references public.production_entry_docs (id) on delete set null;
create index if not exists idx_pe_doc on public.production_entries (doc_id);

alter table public.production_entry_docs enable row level security;
