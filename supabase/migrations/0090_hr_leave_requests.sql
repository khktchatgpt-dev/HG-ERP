-- 0090_hr_leave_requests.sql — VÁ SCHEMA DRIFT: bảng đơn nghỉ phép.
--
-- Bảng `hr_leave_requests` đang CHẠY THẬT trên DB (có trong src/lib/database.types.ts,
-- module src/modules/dept/hr/* đọc/ghi hằng ngày) nhưng KHÔNG có migration nào tạo nó
-- trong supabase/migrations/ → `supabase db reset` sẽ dựng lại DB THIẾU bảng này và
-- làm sập toàn bộ màn Nghỉ phép. Migration này tái tạo đúng cấu trúc đang chạy.
--
-- ⚠️ KHÔNG đổi gì trên DB hiện tại: `create table if not exists` → bảng đã tồn tại nên
-- lệnh này NO-OP khi push. Tác dụng duy nhất là để dựng lại được từ đầu (reset/clone).
--
-- Nguồn tái tạo: database.types.ts (cột + nullable + default) và các union type ở
-- hr.repo.ts (LeaveType/LeaveStatus). Hai CHECK bên dưới suy từ union type trong code —
-- nếu DB thật không có ràng buộc đó thì đây là siết chặt đúng nghiệp vụ, không nới lỏng.
--
-- RLS: ENABLED, NO policies — anon bị chặn, secret key server bypass (đúng posture dự án).
-- Idempotent: create table/index if not exists; drop-then-create trigger.

create table if not exists public.hr_leave_requests (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.users(id) on delete cascade,
  leave_type    text not null default 'annual'
                  check (leave_type in ('annual', 'sick', 'unpaid', 'marriage',
                                        'funeral', 'maternity', 'other')),
  from_date     date not null,
  to_date       date not null,
  days_count    numeric(5, 1) not null check (days_count > 0),  -- cho phép nửa ngày
  reason        text,
  status        text not null default 'pending'
                  check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  approver_id   uuid references public.users(id) on delete set null,
  approver_note text,
  approved_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint hr_leave_requests_date_range_check check (to_date >= from_date)
);

-- "Đơn của tôi" (lọc theo người, mới nhất trước).
create index if not exists hr_leave_requests_user_idx
  on public.hr_leave_requests (user_id, created_at desc);

-- Màn duyệt chỉ quan tâm đơn chờ duyệt (mẫu FR-ADM-03: partial index).
create index if not exists hr_leave_requests_pending_idx
  on public.hr_leave_requests (created_at)
  where status = 'pending';

drop trigger if exists trg_hr_leave_requests_updated_at on public.hr_leave_requests;
create trigger trg_hr_leave_requests_updated_at
  before update on public.hr_leave_requests
  for each row execute function public.set_updated_at();

alter table public.hr_leave_requests enable row level security;
