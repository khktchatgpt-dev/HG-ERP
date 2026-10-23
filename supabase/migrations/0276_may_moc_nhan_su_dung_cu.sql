-- 0276 — Nhân sự giao / thu hồi dụng cụ cầm tay (khu /may-moc/dung-cu).
--
-- Demo "MOCA Tài sản" giao việc này cho Nhân sự: dụng cụ cấp theo NGƯỜI, gắn với
-- lúc vào làm và lúc nghỉ việc, mà ngày nghỉ đọc từ Hồ sơ nhân viên do Nhân sự giữ
-- — cảnh báo "Đã nghỉ chưa trả" là việc của Nhân sự. 0270 chỉ cấp cho Kho + GĐ;
-- chủ dự án chốt 23/10/2026: THÊM Nhân sự, GIỮ Kho (Kho vẫn là người đưa / nhận đồ
-- thật). Chỉ thêm một dòng quyền cho vai `hr_staff`, không đổi bảng nào.
--
-- RLS: không tạo bảng / view mới — `role_permissions` giữ nguyên tư thế 0270 (ENABLE,
-- không policy; khoá bí mật của server bỏ qua). Idempotent: `on conflict do nothing`.

insert into public.role_permissions (role_id, permission_key)
select r.id, 'assets.tools'
from public.roles r
where r.key = 'hr_staff'
on conflict do nothing;
