-- 0242_hr_teams.sql — Danh mục tổ / bộ phận của Nhân sự (chủ dự án chốt 18/10/2026).
--
-- Trước đây bộ phận của nhân viên là chữ gõ tự do (hr_employees.team) và cách tính công
-- khoá theo chính chữ đó (hr_team_calc_rules.team). Bảng lương có 23 bộ phận (Bảo Vệ,
-- Tài Xế, Tổ Hoàn Thiện Xưởng 2…) KHÁC danh mục departments của ERP (dùng phân quyền
-- workspace) — nên tổ Nhân sự là danh mục RIÊNG, không nhét vào departments:
--   hr_teams           một dòng mỗi tổ / bộ phận: tên, cách tính công (khung | ngày, thay
--                      hr_team_calc_rules), và department_id TUỲ CHỌN trỏ sang tổ sản xuất
--                      trong departments — cầu nối để sau này ghép giờ công với sổ sản lượng
--                      (production_entries.team_department_id). Nạp sẵn khớp đúng tên.
--   hr_employees.team_id  khoá ngoại tới hr_teams.
--
-- CHUYỂN TIẾP: cột chữ hr_employees.team GIỮ LẠI, vì bản đang chạy trên main còn ghi/đọc
-- nó. Trigger giữ hai bên khớp nhau: ghi `team` (chữ) → tự tạo tổ nếu chưa có + gán
-- team_id; đổi tên tổ ở hr_teams → đổi chữ ở mọi nhân viên của tổ. Bỏ cột chữ ở một
-- migration sau khi mã nguồn đọc hết qua team_id.
--
-- hr_team_calc_rules (0241) bị bỏ sau khi chép cách tính sang hr_teams.
--
-- RLS: ENABLE, KHÔNG policy → khoá publishable bị chặn, server dùng khoá bí mật.

create table if not exists public.hr_teams (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(trim(name)) between 1 and 120),
  calc_mode text not null default 'khung' check (calc_mode in ('khung', 'ngay')),
  department_id uuid references public.departments (id) on delete set null,
  active boolean not null default true,
  updated_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_hr_teams_updated_at on public.hr_teams;
create trigger trg_hr_teams_updated_at before update on public.hr_teams
  for each row execute function public.set_updated_at();

alter table public.hr_employees
  add column if not exists team_id uuid references public.hr_teams (id) on delete set null;
create index if not exists hr_employees_team_id_idx on public.hr_employees (team_id);

-- Nạp tổ từ chữ đang có ở nhân viên.
insert into public.hr_teams (name)
select distinct trim(team) from public.hr_employees
where team is not null and trim(team) <> ''
on conflict (name) do nothing;

-- Chép cách tính từ 0241 rồi bỏ bảng cũ.
do $$
begin
  if to_regclass('public.hr_team_calc_rules') is not null then
    insert into public.hr_teams (name, calc_mode)
    select trim(team), calc_mode from public.hr_team_calc_rules
    on conflict (name) do update set calc_mode = excluded.calc_mode;
    drop table public.hr_team_calc_rules;
  end if;
end $$;

-- Cầu nối sang tổ sản xuất: chỉ khi trùng đúng tên (Tổ Phôi, Tổ Sơn Sắt, Kho…).
update public.hr_teams t set department_id = d.id
from public.departments d
where t.department_id is null and d.name = t.name;

update public.hr_employees e set team_id = t.id
from public.hr_teams t
where e.team_id is null and t.name = trim(e.team);

-- Ghi chữ `team` → gán team_id (tạo tổ nếu là tên mới). Ghi team_id → chép tên sang chữ.
create or replace function public.hr_employees_sync_team()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' or new.team is distinct from old.team then
    if new.team is null or trim(new.team) = '' then
      new.team := null;
      new.team_id := null;
    else
      new.team := trim(new.team);
      insert into public.hr_teams (name) values (new.team) on conflict (name) do nothing;
      select id into new.team_id from public.hr_teams where name = new.team;
    end if;
  elsif new.team_id is distinct from old.team_id then
    select name into new.team from public.hr_teams where id = new.team_id;
  end if;
  return new;
end $$;

drop trigger if exists trg_hr_employees_sync_team on public.hr_employees;
create trigger trg_hr_employees_sync_team before insert or update of team, team_id
  on public.hr_employees for each row execute function public.hr_employees_sync_team();

-- Đổi tên tổ → chữ ở nhân viên đổi theo.
create or replace function public.hr_teams_rename_sync()
returns trigger language plpgsql set search_path = public as $$
begin
  update public.hr_employees set team = new.name where team_id = new.id;
  return new;
end $$;

drop trigger if exists trg_hr_teams_rename_sync on public.hr_teams;
create trigger trg_hr_teams_rename_sync after update of name on public.hr_teams
  for each row when (old.name is distinct from new.name)
  execute function public.hr_teams_rename_sync();

alter table public.hr_teams enable row level security;
