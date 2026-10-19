-- 0247 — KẾ TOÁN XEM KHU KHO (Báo cáo Nhập–Xuất–Tồn, Kho đợt 2 · B6, 19/10/2026).
--
-- Bản vẽ B6 duyệt Q4 theo đề xuất: ai vào được khu Kho đều xem được cột tiền
-- của báo cáo, CỘNG Kế toán và BGĐ. BGĐ (director) đã có `workspace.view.warehouse`
-- từ 0086; vai `accounting_staff` chưa có nên không mở được /warehouse/bao-cao.
--
-- Quyền này chỉ cho VÀO XEM khu Kho: mọi thao tác ghi (nhập/xuất/kiểm kê/danh
-- mục) vẫn bị service chặn theo phòng Kho (`memberEdit('warehouse.member', …)`),
-- giống cách Cung ứng (supply_staff) và Kế hoạch (planner) đang xem.
--
-- RLS: không thêm bảng. Idempotent (`on conflict do nothing`).

insert into public.role_permissions (role_id, permission_key)
select r.id, 'workspace.view.warehouse'
from public.roles r
where r.key = 'accounting_staff'
on conflict do nothing;
