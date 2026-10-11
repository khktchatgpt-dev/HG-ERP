-- 0230 — HẠNG MỤC NGOÀI SẢN XUẤT (12/10/2026, B2 bản vẽ Đầu đơn mua)
--
-- Đơn mua nào cũng trả lời "mua cho việc gì": một lệnh sản xuất, HOẶC một hạng
-- mục ngoài sản xuất — "Xây dựng văn phòng", "Dự trữ kho", "Khuôn mẫu 2026"…
-- Trước đây đơn ngoài lệnh chỉ có hai ô chữ (0229 standalone_purpose/ref):
-- không tạo được một việc rồi gom nhiều đơn vào, không có dự toán, không biết
-- việc đó đã tiêu bao nhiêu.
--
--   supply_projects            — một hạng mục: mã HM-YYYY-NNNN (next_doc_code('HM')),
--                                tên, loại (gõ tự do kèm gợi ý — lib/po-muc-dich),
--                                dự toán tuỳ chọn (chỉ để theo dõi, không chặn),
--                                người phụ trách, mở / đóng.
--   supply_purchase_orders.project_id — đơn ngoài lệnh thuộc hạng mục nào.
--                                Đơn theo lệnh để null (service ép). Xoá hạng mục
--                                đã có đơn bị chặn (on delete restrict).
--
-- Hạng mục KHÔNG có vòng duyệt: chỉ open / closed. Đóng = không chọn được cho
-- đơn mới; đơn cũ giữ nguyên. Cột 0229 giữ lại (dữ liệu cũ), không ghi mới.
--
-- RLS: bật, không policy — anon bị chặn, khoá bí mật (server) đi qua. Idempotent.

create table if not exists public.supply_projects (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  name        text not null check (char_length(btrim(name)) between 2 and 200),
  kind        text not null check (char_length(btrim(kind)) between 2 and 120),
  budget      numeric(18, 2) check (budget is null or budget >= 0),
  currency    text not null default 'VND' check (char_length(currency) = 3),
  owner_id    uuid references public.users(id) on delete set null,
  status      text not null default 'open' check (status in ('open', 'closed')),
  note        text check (note is null or char_length(note) <= 2000),
  closed_at   timestamptz,
  closed_by   uuid references public.users(id) on delete set null,
  created_by  uuid references public.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists supply_projects_status_idx on public.supply_projects (status, created_at desc);

drop trigger if exists supply_projects_set_updated_at on public.supply_projects;
create trigger supply_projects_set_updated_at
  before update on public.supply_projects
  for each row execute function public.set_updated_at();

alter table public.supply_projects enable row level security;

alter table public.supply_purchase_orders
  add column if not exists project_id uuid
    references public.supply_projects(id) on delete restrict;

create index if not exists supply_purchase_orders_project_idx
  on public.supply_purchase_orders (project_id) where project_id is not null;

comment on table public.supply_projects is
  'Hạng mục ngoài sản xuất (0230) — đơn mua ngoài lệnh thuộc về đây. Mã HM-YYYY-NNNN.';
comment on column public.supply_purchase_orders.project_id is
  'Hạng mục ngoài sản xuất của đơn ngoài lệnh (0230). Null với đơn theo lệnh.';
