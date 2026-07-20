-- 0065_production_incidents.sql
-- Sổ SỰ CỐ xưởng (tách vai SX 07/2026): tổ báo hỏng máy/thiếu vật tư/lỗi ngay
-- trên thẻ việc; quản đốc (admin/manager) thấy danh sách đang mở ở màn Tiến độ
-- và bấm "Đã xử lý". Notification qua event bus (production.incident.*).
--
-- production_order_id / stage / department_id đều nullable: sự cố có thể chung
-- toàn xưởng (hỏng máy nén khí) không gắn lệnh nào; FK set null để xoá
-- lệnh/phòng không mất lịch sử sự cố.
--
-- RLS: ENABLED, no policies — anon bị chặn, secret key server bypass (chuẩn
-- dự án). Idempotent. Apply: `npx supabase db push`. Sau đó "sync types".

create table if not exists public.production_incidents (
  id                  uuid primary key default gen_random_uuid(),
  production_order_id uuid references public.production_orders(id) on delete set null,
  stage               text,                                  -- code catalog production_stage
  department_id       uuid references public.departments(id) on delete set null,
  reported_by         uuid references public.users(id) on delete set null,
  message             text not null,
  status              text not null default 'open' check (status in ('open', 'resolved')),
  resolved_by         uuid references public.users(id) on delete set null,
  resolved_at         timestamptz,
  created_at          timestamptz not null default now()
);

create index if not exists production_incidents_status_idx
  on public.production_incidents (status, created_at desc);

alter table public.production_incidents enable row level security;
