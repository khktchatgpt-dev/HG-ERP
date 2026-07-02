-- Sales department: customer master.
--
-- First per-department module. Convention:
--   - table name prefixed with `sales_` so department tables don't collide
--   - RLS enabled with no policies — server bypasses via secret key, app enforces perms.

create table if not exists public.sales_customers (
  id            uuid primary key default gen_random_uuid(),
  code          text unique,                            -- mã KH tự đặt
  name          text not null check (char_length(name) between 1 and 200),
  email         text,
  phone         text,
  address       text,
  notes         text,
  owner_id      uuid references public.users(id) on delete set null,  -- sales phụ trách
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists sales_customers_owner_idx
  on public.sales_customers (owner_id) where is_active;
create index if not exists sales_customers_name_idx
  on public.sales_customers (lower(name));

drop trigger if exists trg_sales_customers_updated_at on public.sales_customers;
create trigger trg_sales_customers_updated_at
  before update on public.sales_customers
  for each row execute function public.set_updated_at();

alter table public.sales_customers enable row level security;