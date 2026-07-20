-- 0068_production_day_locks.sql
-- CHỐT SỔ MỀM theo TỔ + NGÀY (sổ sản lượng 07/2026): tồn tại dòng = tổ đã
-- chốt sổ ngày đó; mở khoá = xoá dòng (chỉ admin/manager). Sau khi chốt,
-- outputs.service chặn ghi thêm + xoá bản ghi của (tổ, ngày) — KỂ CẢ admin
-- (đúng ngữ nghĩa chốt sổ: muốn sửa phải mở khoá trước, có vết ai mở).
--
-- Không có trạng thái nháp/duyệt chữ ký (user chốt "chốt mềm" 07/2026);
-- không bắn notification — nếu sau cần thêm event `production.day.locked`.
--
-- RLS: ENABLED, no policies — anon chặn, secret key bypass (chuẩn dự án).
-- Idempotent. Apply: `npx supabase db push`. Sau đó "sync types".

create table if not exists public.production_day_locks (
  id                 uuid primary key default gen_random_uuid(),
  team_department_id uuid not null
                       references public.departments(id) on delete cascade,
  entry_date         date not null,
  locked_by          uuid references public.users(id) on delete set null,
  locked_at          timestamptz not null default now(),
  unique (team_department_id, entry_date)
);

alter table public.production_day_locks enable row level security;

-- Sổ toàn xưởng đọc theo NGÀY (index 0039 dẫn bằng production_order_id).
create index if not exists production_output_entries_date_idx
  on public.production_output_entries (entry_date, team_department_id);
