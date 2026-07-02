-- Workspace mapping cho tái thiết kế FE theo phòng ban.
--
-- Mỗi dept thuộc 1 workspace (có thể nhiều dept cùng workspace, VD Xưởng SX + Cắt Vải).
-- Workspace 'system' dành cho admin không có dept.
--
-- Không đổi bảng users — workspace suy ra từ users → departments → workspace_id.
--
-- Apply: `npx supabase db push` hoặc paste vào SQL editor. Sau đó "sync types".

alter table public.departments
  add column if not exists workspace_id text
  check (workspace_id in (
    'sales','finance','warehouse','technical','planning',
    'qc','production','hr','exec','system'
  ));

-- Backfill từ tên dept có sẵn. Idempotent — chỉ update khi chưa có workspace_id.
update public.departments set workspace_id = case name
  when 'Bán Hàng' then 'sales'
  when 'Tài Chính Kế Toán' then 'finance'
  when 'Kho' then 'warehouse'
  when 'Kỹ Thuật' then 'technical'
  when 'Kế Hoạch Sản Xuất-cung ứng' then 'planning'
  when 'QC' then 'qc'
  when 'Xưởng Sản Xuất' then 'production'
  when 'Cắt Vải' then 'production'
  when 'Hành Chính Nhân Sự' then 'hr'
  when 'Ban Giám Đốc' then 'exec'
end
where workspace_id is null;

create index if not exists departments_workspace_idx on public.departments (workspace_id);
