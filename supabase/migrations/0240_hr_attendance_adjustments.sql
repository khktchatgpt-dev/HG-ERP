-- 0240_hr_attendance_adjustments.sql — Điều chỉnh chấm công (có duyệt).
--
-- Bản vẽ DieuChinh.dc.html, chủ dự án duyệt câu 22–25 (17/10/2026):
--   · Lượt máy (hr_attendance_logs) BẤT BIẾN — điều chỉnh là một LỚP RIÊNG đặt lên trên.
--   · Ba loại: bổ sung lượt quẹt (quên quẹt, máy hỏng…), nghỉ có lý do (phép, ốm,
--     việc riêng có báo, công tác, không lương), bỏ qua một lượt (quẹt nhầm/hộ).
--   · Nhân sự nhập → người có quyền `hr.attendance.adjust_decide` duyệt. Chỉ điều chỉnh
--     ĐÃ DUYỆT mới vào bảng công; chờ duyệt thì hiện (viền gạch đứt) nhưng chưa tính.
--   · Không xoá: rút lại = 'cancelled', từ chối = 'rejected' — giữ dấu vết ai/khi nào.
--
-- RLS: ENABLED, NO policies — anon bị chặn, khoá bí mật phía server bỏ qua (posture dự án).
-- Idempotent: create … if not exists, drop-then-create trigger, insert on conflict do nothing.

create table if not exists public.hr_attendance_adjustments (
  id            uuid primary key default gen_random_uuid(),
  employee_id   uuid not null references public.hr_employees (id) on delete cascade,
  work_date     date not null,
  kind          text not null check (kind in ('add_punch', 'leave', 'ignore_punch')),
  -- add_punch: giờ bổ sung; ignore_punch: giờ của lượt máy bị bỏ qua (giờ VN).
  punch_time    time,
  -- add_punch: lượt này là vào hay ra (chỉ để người đọc hiểu; tính công dùng giờ).
  punch_dir     text check (punch_dir in ('in', 'out')),
  leave_type    text check (leave_type in ('annual', 'sick', 'personal', 'business_trip', 'unpaid')),
  reason        text not null,
  evidence      text,
  status        text not null default 'pending'
                  check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  created_by    uuid references public.users (id) on delete set null,
  decided_by    uuid references public.users (id) on delete set null,
  decided_at    timestamptz,
  decide_note   text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint hr_attendance_adjustments_shape check (
    (kind = 'add_punch' and punch_time is not null and leave_type is null)
    or (kind = 'ignore_punch' and punch_time is not null and leave_type is null)
    or (kind = 'leave' and leave_type is not null and punch_time is null)
  )
);

create index if not exists hr_attendance_adjustments_date_idx
  on public.hr_attendance_adjustments (work_date);
create index if not exists hr_attendance_adjustments_emp_idx
  on public.hr_attendance_adjustments (employee_id, work_date);
create index if not exists hr_attendance_adjustments_pending_idx
  on public.hr_attendance_adjustments (created_at)
  where status = 'pending';

drop trigger if exists trg_hr_attendance_adjustments_updated_at on public.hr_attendance_adjustments;
create trigger trg_hr_attendance_adjustments_updated_at
  before update on public.hr_attendance_adjustments
  for each row execute function public.set_updated_at();

alter table public.hr_attendance_adjustments enable row level security;

-- Quyền DUYỆT điều chỉnh — tách khỏi hr.leave.decide (đơn nghỉ của người dùng hệ thống).
-- Chưa có vai "trưởng phòng Nhân sự": cấp cho director + admin; gán thêm qua màn Phân quyền.
insert into public.permissions (key, label, domain, sort_order)
values ('hr.attendance.adjust_decide', 'Duyệt điều chỉnh chấm công', 'hr', 75)
on conflict (key) do nothing;

insert into public.role_permissions (role_id, permission_key)
select r.id, 'hr.attendance.adjust_decide'
from public.roles r
where r.key in ('director', 'admin')
on conflict do nothing;
