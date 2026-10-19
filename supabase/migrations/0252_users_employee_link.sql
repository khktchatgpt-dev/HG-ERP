-- 0252_users_employee_link.sql — Nhân viên là gốc, tài khoản ERP gắn vào (bản vẽ duyệt 19/10/2026,
-- Q1–Q5 theo đề xuất).
--
-- ĐỔI SỐ 19/10/2026 khi gộp main: file này viết ra với số 0247 và ĐÃ ÁP lên DB dưới tên đó;
-- main cũng có 0247_ke_toan_xem_kho.sql nên đổi tên file sang 0252 cho khỏi trùng số. Nội dung
-- giữ nguyên, idempotent — chạy lại không đổi gì.
--
-- Trước đây ERP giữ HAI danh sách người không nối nhau: `users` (tài khoản, trang Admin) và
-- `hr_employees` (Nhân sự, chấm công, lương). Tài xế không có tài khoản thì Admin không biết
-- người đó tồn tại; 7 người có tài khoản mà Nhân sự không có. Nay:
--   users.employee_id   tài khoản CÁ NHÂN trỏ đúng một nhân viên; mỗi nhân viên tối đa một tài
--                       khoản (unique). Để trống được trong lúc dọn dữ liệu — màn Admin báo
--                       "chưa gắn người".
--   users.account_kind  'person' | 'shared' — tài khoản dùng chung (Thống kê Tổ …, Quản trị
--                       viên) không gắn người (Q1); users.shared_holder ghi ai đang cầm.
-- Ràng buộc chạy ở DB (không trông vào màn):
--   • Nhân viên đánh dấu nghỉ việc → tài khoản gắn với họ tự khoá + ghi nhật ký 'auto_lock' (Q2).
--   • Mở / gắn tài khoản vào nhân viên đã nghỉ việc → bị chặn, câu lỗi nói cách gỡ.
-- Thêm hành động nhật ký: 'link', 'auto_lock'.
--
-- RLS: không đổi (users đã bật từ 0001; hr_employees từ 0232).

alter table public.users
  add column if not exists employee_id uuid references public.hr_employees (id) on delete set null;
alter table public.users
  add column if not exists account_kind text not null default 'person'
    check (account_kind in ('person', 'shared'));
alter table public.users add column if not exists shared_holder text;

create unique index if not exists users_employee_id_uidx
  on public.users (employee_id) where employee_id is not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'users_shared_no_employee') then
    alter table public.users
      add constraint users_shared_no_employee
      check (account_kind = 'person' or employee_id is null);
  end if;
end $$;

alter table public.user_audit_log drop constraint if exists user_audit_log_action_check;
alter table public.user_audit_log add constraint user_audit_log_action_check check (action = any (array[
  'create', 'update', 'password_reset', 'soft_delete', 'restore', 'bulk_import',
  'password_change', 'profile_update', 'link', 'auto_lock'
]));

-- Nhân viên nghỉ việc → khoá tài khoản gắn với họ.
create or replace function public.hr_employees_lock_account()
returns trigger language plpgsql set search_path = public as $$
begin
  if old.active and not new.active then
    insert into public.user_audit_log (target_user_id, actor_id, action, before, after, reason)
    select u.id, null, 'auto_lock', jsonb_build_object('is_active', true),
           jsonb_build_object('is_active', false), 'Nhân viên ' || new.code || ' nghỉ việc'
    from public.users u
    where u.employee_id = new.id and u.is_active;
    update public.users set is_active = false where employee_id = new.id and is_active;
  end if;
  return new;
end $$;

drop trigger if exists trg_hr_employees_lock_account on public.hr_employees;
create trigger trg_hr_employees_lock_account after update of active on public.hr_employees
  for each row execute function public.hr_employees_lock_account();

-- Không mở / gắn tài khoản đang mở vào nhân viên đã nghỉ việc.
create or replace function public.users_guard_employee()
returns trigger language plpgsql set search_path = public as $$
declare
  nv record;
begin
  if new.employee_id is not null and new.is_active and new.deleted_at is null then
    select code, full_name, active into nv from public.hr_employees where id = new.employee_id;
    if found and not nv.active then
      raise exception 'Nhân viên % · % đã nghỉ việc — Nhân sự đánh dấu đi làm lại trước khi mở tài khoản',
        nv.code, nv.full_name using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_users_guard_employee on public.users;
create trigger trg_users_guard_employee before insert or update of is_active, employee_id on public.users
  for each row execute function public.users_guard_employee();
