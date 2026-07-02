-- File metadata for Supabase Storage uploads.
--
-- Files live in Supabase Storage buckets (private | attachments | public);
-- this table holds the metadata + polymorphic ownership so we can list,
-- enforce permissions, and cascade-clean rows when their parent goes away.
--
-- RLS is ENABLED with NO policies — anon/publishable key blocked, server
-- (SUPABASE_SECRET_KEY) bypasses. Storage buckets enforce their own posture
-- (private/attachments: no public read; public: read-only).
--
-- Apply: `npx supabase db push` or paste into the SQL editor.
-- After applying, ask Claude to "sync types".

create table if not exists public.files (
  id           uuid primary key default gen_random_uuid(),
  bucket       text not null check (bucket in ('private', 'attachments', 'public')),
  path         text not null,
  filename     text not null,
  mime_type    text not null,
  size_bytes   bigint not null check (size_bytes >= 0),
  checksum     text,                                                     -- sha256 hex, optional
  owner_id     uuid references public.users(id) on delete set null,      -- who uploaded
  -- Polymorphic parent: at most one of these is set. Enforced by check below.
  task_id      uuid references public.tasks(id) on delete cascade,
  comment_id   uuid references public.task_comments(id) on delete cascade,
  customer_id  uuid references public.sales_customers(id) on delete set null,
  invoice_id   uuid references public.accounting_invoices(id) on delete cascade,
  product_id   uuid references public.technical_products(id) on delete set null,
  created_at   timestamptz not null default now(),
  finalized_at timestamptz,                                               -- set after client confirms upload
  deleted_at   timestamptz,                                               -- soft-delete; storage object purged separately
  unique (bucket, path),
  -- Exactly 0 or 1 parent ref set
  constraint files_one_parent check (
    (case when task_id     is null then 0 else 1 end) +
    (case when comment_id  is null then 0 else 1 end) +
    (case when customer_id is null then 0 else 1 end) +
    (case when invoice_id  is null then 0 else 1 end) +
    (case when product_id  is null then 0 else 1 end) <= 1
  )
);

create index if not exists files_owner_idx       on public.files (owner_id)    where deleted_at is null;
create index if not exists files_task_idx        on public.files (task_id)     where task_id     is not null and deleted_at is null;
create index if not exists files_comment_idx     on public.files (comment_id)  where comment_id  is not null and deleted_at is null;
create index if not exists files_customer_idx    on public.files (customer_id) where customer_id is not null and deleted_at is null;
create index if not exists files_invoice_idx     on public.files (invoice_id)  where invoice_id  is not null and deleted_at is null;
create index if not exists files_product_idx     on public.files (product_id)  where product_id  is not null and deleted_at is null;
create index if not exists files_unfinalized_idx on public.files (created_at)  where finalized_at is null and deleted_at is null;

alter table public.files enable row level security;
