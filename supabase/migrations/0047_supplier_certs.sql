-- Chứng chỉ nhà cung cấp (Vendor Master M3) — ISO/IATF/HACCP/GMP/FDA/CE/RoHS/REACH…
--
-- Theo yêu cầu: KHÔNG theo dõi ngày hết hạn (bỏ expires_at + cảnh báo).
-- Mỗi NCC nhiều chứng chỉ; sửa = xoá + thêm lại (đơn giản, có vết created_by).
--
-- RLS: ENABLE, no policies (anon chặn, secret-key server bypass) — như mọi bảng.
-- Idempotent: create if not exists.

create table if not exists public.supplier_certs (
  id          uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.supply_suppliers(id) on delete cascade,
  cert_type   text not null,   -- ISO 9001, ISO 14001, IATF 16949, HACCP, GMP, FDA, CE, RoHS, REACH, Khác
  cert_no     text,
  issued_on   date,
  note        text,
  created_by  uuid references public.users(id) on delete set null,
  created_at  timestamptz not null default now()
);

create index if not exists supplier_certs_supplier_idx
  on public.supplier_certs (supplier_id);

alter table public.supplier_certs enable row level security;
