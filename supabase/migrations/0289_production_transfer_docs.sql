-- 0289_production_transfer_docs.sql — PHIẾU GIAO TỔ (PGT) hai nhịp: giao → nhận.
-- B4 của docs/san-xuat-cau-hinh-thiet-ke.md §3.4 (duyệt 03/11/2026).
--
-- Hôm nay `production_transfers` (0090) là dòng rời "giao VÀO tổ / trả lại",
-- 0 dòng, 0 màn, và không có nhịp "tổ nhận xác nhận" — nên "tồn tại công đoạn"
-- và "khả dụng cho công đoạn sau" là MỘT số. Chép SAP (chuyển kho WIP hai
-- bước) + Odoo (done quantity ≠ demand thì bắt lý do):
--
--   1. Header `production_transfer_docs`: 1 phiếu = tổ giao lập (from) → tổ
--      nhận xác nhận (to). Số hiệu PGT-2026-0001 qua next_doc_code('PGT').
--        status  'da_giao'  tổ giao đã gửi, tổ nhận chưa xác nhận → huỷ được
--                'da_nhan'  tổ nhận đã xác nhận (received_qty từng dòng) → KHÔNG
--                           sửa, chỉ ĐẢO bằng phiếu ngược (reverses_doc_id)
--                'da_huy'   huỷ khi chưa nhận, cancel_reason bắt buộc (service)
--      Phiếu ĐẢO: from/to hoán đổi (hàng đi ngược), `reverses_doc_id` trỏ phiếu
--      gốc, sinh ra ở trạng thái da_nhan luôn (là bút toán sửa, không ai phải
--      xác nhận lần hai). Năm con số coi phiếu đảo là SỐ ÂM của phiếu gốc
--      (src/lib/wip-numbers.ts transferTotals).
--   2. `production_transfers` thêm doc_id · received_qty · diff_reason. Dòng
--      của phiếu giao = direction 'issue', stage = to_stage, team = to_team
--      (đúng nghĩa cũ "giao vào tổ để làm công đoạn stage" — cảnh báo
--      teamWipShortageWarning giữ nguyên). Dòng của phiếu đảo = direction
--      'return' trên cùng (stage, team) của phiếu gốc.
--      Dòng rời không doc_id (0090) vẫn hợp lệ — sổ cũ không đổi nghĩa.
--   3. Mẫu chứng từ 'PGT' vào doc_templates (đánh số theo năm, pad 4).
--
-- Xoá: không. Huỷ = trạng thái; sai sau khi nhận = đảo. Lệnh xoá thì cascade.
-- RLS: ENABLE, không policy — anon chặn, server secret key bypass (chuẩn chung).
-- Idempotent: if not exists / add column if not exists / on conflict do nothing.
-- Apply xong: "sync types" (database.types.ts đã vá tay kèm migration).

create table if not exists public.production_transfer_docs (
  id                  uuid primary key default gen_random_uuid(),
  doc_no              text not null,
  production_order_id uuid not null
    references public.production_orders (id) on delete cascade,
  from_stage          text not null,
  from_team_id        uuid references public.departments (id) on delete set null,
  to_stage            text not null,
  to_team_id          uuid references public.departments (id) on delete set null,
  entry_date          date not null,
  status              text not null default 'da_giao'
    check (status in ('da_giao', 'da_nhan', 'da_huy')),
  note                text,
  cancel_reason       text,
  reverses_doc_id     uuid references public.production_transfer_docs (id) on delete set null,
  created_by          uuid references public.users (id) on delete set null,
  created_at          timestamptz not null default now(),
  received_by         uuid references public.users (id) on delete set null,
  received_at         timestamptz,
  constraint production_transfer_docs_stage_differ check (from_stage <> to_stage)
);

create unique index if not exists idx_pgt_doc_no
  on public.production_transfer_docs (doc_no);
create index if not exists idx_pgt_lsx
  on public.production_transfer_docs (production_order_id, entry_date desc);
create index if not exists idx_pgt_to_team
  on public.production_transfer_docs (to_team_id, status);
create index if not exists idx_pgt_from_team
  on public.production_transfer_docs (from_team_id, status);

comment on table public.production_transfer_docs is
  'Phiếu giao tổ (PGT, 0289) — hai nhịp giao → nhận; dòng ở production_transfers.doc_id; sửa sau khi nhận = phiếu đảo';

alter table public.production_transfers
  add column if not exists doc_id uuid
    references public.production_transfer_docs (id) on delete cascade,
  add column if not exists received_qty numeric(14, 2) check (received_qty >= 0),
  add column if not exists diff_reason text;
create index if not exists idx_pt_doc on public.production_transfers (doc_id);

alter table public.production_transfer_docs enable row level security;

insert into public.doc_templates
  (kind, label, prefix, pattern, seq_pad, reset_scope, title_vi, title_en,
   national_heading, form_no, signatures, default_terms)
values
  ('PGT', 'Phiếu giao tổ (bán thành phẩm)', 'PGT', '{prefix}-{yyyy}-{seq}', 4, 'year',
   'PHIẾU GIAO TỔ', 'INTERNAL TRANSFER NOTE', false, null,
   '[{"role":"Tổ giao","hint":"ký, ghi rõ họ tên"},{"role":"Tổ nhận","hint":"ký, ghi rõ họ tên"},{"role":"Thống kê","hint":"ký, ghi rõ họ tên"}]'::jsonb,
   '')
on conflict (kind) do nothing;
