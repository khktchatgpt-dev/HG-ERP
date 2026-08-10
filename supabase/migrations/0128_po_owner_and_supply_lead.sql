-- Tách quyền PO theo NGƯỜI PHỤ TRÁCH + vai Trưởng phòng Cung ứng.
-- (Thiết kế: docs/po-quy-trinh-phan-quyen.md, kế hoạch: docs/po-phan-quyen-plan.md)
--
-- 1) supply_purchase_orders.assigned_to — người phụ trách đơn (mặc định = người
--    tạo, backfill cho đơn cũ). Quyền GHI xét theo cột này để BÀN GIAO được khi
--    NV vắng/nghỉ; created_by giữ nguyên làm vết "ai tạo".
-- 2) Nới check approval_events.action: thêm 'submitted'/'withdrawn'/'reassigned'
--    — audit các mốc gửi duyệt / rút về nháp / bàn giao (trước chỉ approved/rejected).
-- 3) Seed RBAC: permission `supply.lead` + vai `supply_lead` (Trưởng phòng CƯ).
--    KHÔNG tự gán user nào — admin gán tay ở /admin/permissions (chốt 6.6).
--
-- RLS: các bảng đụng tới đã ENABLE, no policies (anon chặn, secret key bypass)
-- — không đổi posture. Idempotent, chạy lại an toàn.

-- 1) Người phụ trách đơn
alter table public.supply_purchase_orders
  add column if not exists assigned_to uuid references public.users(id) on delete set null;

update public.supply_purchase_orders
  set assigned_to = created_by
  where assigned_to is null and created_by is not null;

create index if not exists supply_purchase_orders_assigned_to_idx
  on public.supply_purchase_orders (assigned_to);

-- 2) Audit thêm mốc vòng đời (ngoài duyệt/từ chối)
alter table public.approval_events
  drop constraint if exists approval_events_action_check;
alter table public.approval_events
  add constraint approval_events_action_check
  check (action in ('approved', 'rejected', 'submitted', 'withdrawn', 'reassigned'));

-- 3) Seed RBAC: quyền + vai Trưởng phòng Cung ứng
insert into public.permissions (key, label, domain, sort_order) values
  ('supply.lead', 'Trưởng phòng Cung ứng — thao tác mọi PO', 'supply', 42)
on conflict (key) do nothing;

insert into public.roles (key, label, description, is_system, sort_order) values
  ('supply_lead', 'Trưởng phòng Cung ứng',
   'Thao tác mọi đơn đặt vật tư của phòng, bàn giao đơn giữa nhân viên.', false, 16)
on conflict (key) do nothing;

insert into public.role_permissions (role_id, permission_key)
select r.id, p.key
from public.roles r
cross join (values ('supply.member'), ('supply.lead')) as p(key)
where r.key = 'supply_lead'
on conflict do nothing;
