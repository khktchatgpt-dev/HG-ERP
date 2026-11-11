-- 0295: NHẬT KÝ CHỐT / MỞ KHOÁ SỔ NGÀY (11/11/2026, bản vẽ Sổ ngày & chốt sổ
-- https://claude.ai/artifact/QSwyPC46SM81EEQfJiAycT, Q5 duyệt).
--
-- `production_day_locks` (0068) là khoá MỀM: tồn tại dòng = đã chốt, mở khoá =
-- xoá dòng, nên vết "ai mở, vì sao" biến mất cùng dòng — docs/san-xuat-quy-
-- trinh-vai-tro.md ghi đây là lỗ hổng ("mở khoá không bắt lý do"). Bảng này
-- ghi thêm MỘT dòng cho mỗi lần chốt / mở khoá; mở khoá BẮT lý do (≥ 5 ký tự,
-- kiểm ở zod, DB chỉ bắt not-null khi action = unlock). Chỉ chèn, không sửa.
--
-- RLS: enable row level security, KHÔNG policy — anon bị chặn, khoá bí mật
-- (server) bypass, như mọi bảng khác. Idempotent.
-- Mã đọc/ghi bảng này nuốt lỗi khi bảng chưa có (áp sau mã lên main vẫn chạy).

create table if not exists public.production_day_lock_log (
  id uuid primary key default gen_random_uuid(),
  team_department_id uuid not null references public.departments(id) on delete cascade,
  entry_date date not null,
  action text not null check (action in ('lock', 'unlock')),
  reason text,
  actor_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint production_day_lock_log_unlock_reason
    check (action <> 'unlock' or (reason is not null and length(trim(reason)) >= 5))
);

create index if not exists production_day_lock_log_team_date_idx
  on public.production_day_lock_log (team_department_id, entry_date, created_at desc);

alter table public.production_day_lock_log enable row level security;
