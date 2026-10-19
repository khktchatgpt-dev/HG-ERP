-- 0250_hr_contracts.sql — Hợp đồng lao động + giấy tờ nhân viên (Hồ sơ nhân viên B3, bản vẽ lượt 2
-- duyệt 19/10/2026; Q2 lượt 1: không lập mẫu in hợp đồng, chỉ lưu bản đã ký).
--
--   hr_contracts     mỗi hợp đồng một dòng: số HĐ, loại (probation = thử việc · fixed = xác định
--                    thời hạn · indefinite = không xác định thời hạn), từ ngày – đến ngày (bắt buộc
--                    trừ indefinite), chức danh + mức lương GHI TRÊN HĐ, file scan (files.id).
--                    Tình trạng (đang hiệu lực / sắp hết hạn / hết hạn) SUY từ ngày — không cột.
--                    Ghi nhầm thì huỷ (cancelled_at + lý do), không xoá.
--   files.hr_employee_id  giấy tờ của một nhân viên (CCCD 2 mặt, bằng cấp, sơ yếu, khám sức khoẻ,
--                    scan hợp đồng). Đọc / ghi chỉ qua quyền hr.employee.private (files.service).
--   files_doc_type_valid  thêm hr_contract, hr_id_card, hr_degree, hr_cv, hr_health, hr_other.
--                    Danh sách gốc lấy từ ràng buộc ĐANG CHẠY (pg_get_constraintdef 19/10), bài
--                    học 0214.
--
-- RLS: hr_contracts bật, không policy (anon bị chặn, khoá bí mật đi qua); files không đổi.

create table if not exists public.hr_contracts (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.hr_employees (id) on delete cascade,
  contract_no text,
  kind text not null check (kind in ('probation', 'fixed', 'indefinite')),
  start_date date not null,
  end_date date,
  job_title text,
  salary numeric(14, 2) check (salary is null or salary >= 0),
  note text,
  file_id uuid references public.files (id) on delete set null,
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  cancelled_at timestamptz,
  cancelled_by uuid references public.users (id) on delete set null,
  cancel_reason text,
  constraint hr_contracts_end_after_start check (end_date is null or end_date >= start_date),
  constraint hr_contracts_end_required check (kind = 'indefinite' or end_date is not null)
);
create index if not exists hr_contracts_emp_idx
  on public.hr_contracts (employee_id, start_date desc);
create index if not exists hr_contracts_end_idx
  on public.hr_contracts (end_date) where cancelled_at is null;

drop trigger if exists trg_hr_contracts_updated_at on public.hr_contracts;
create trigger trg_hr_contracts_updated_at before update on public.hr_contracts
  for each row execute function public.set_updated_at();

alter table public.hr_contracts enable row level security;

alter table public.files
  add column if not exists hr_employee_id uuid references public.hr_employees (id) on delete cascade;
create index if not exists files_hr_employee_idx
  on public.files (hr_employee_id) where hr_employee_id is not null;

alter table public.files drop constraint if exists files_doc_type_valid;
alter table public.files
  add constraint files_doc_type_valid check (
    doc_type is null
    or doc_type in (
      'drawing', 'bom', 'packing', 'assembly', 'image', 'sample_photo', 'label',
      'loading', 'cert', 'approval', 'video', 'other',
      'quote', 'po_confirm', 'contract', 'delivery_note', 'invoice',
      'hr_contract', 'hr_id_card', 'hr_degree', 'hr_cv', 'hr_health', 'hr_other'
    )
  );
