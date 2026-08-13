-- Hồ sơ cá nhân TỰ PHỤC VỤ: người dùng tự đổi mật khẩu + sửa thông tin của mình.
-- (Trước migration này mọi thứ liên quan tài khoản đều phải qua admin.)
--
-- 1) users.phone — số liên hệ, người dùng tự sửa ở /tai-khoan. Để text tự do:
--    số nội bộ/đầu số nước ngoài/nhiều số cách nhau dấu phẩy đều phải nhập được,
--    ràng buộc định dạng nằm ở tầng zod chứ không khoá cứng trong DB.
-- 2) users.must_change_password — admin tạo tài khoản hoặc đặt lại mật khẩu thì
--    bật cờ, lần đăng nhập sau bị ép đổi trước khi vào hệ thống. Cột thêm ngay
--    từ lô 1 để backend khỏi phải migrate hai lần; gate ở proxy làm ở lô 3.
-- 3) Nới check user_audit_log.action: thêm 'password_change' và 'profile_update'
--    — hai hành động do CHÍNH CHỦ làm. Bảng này sinh ra hồi 0007 chỉ để ghi thao
--    tác của admin nên constraint đang liệt kê đúng 6 giá trị; không nới thì mọi
--    lần tự đổi mật khẩu sẽ bị Postgres chặn và mất vết (userAuditRepo.insert chỉ
--    console.error rồi đi tiếp, lỗi sẽ IM LẶNG).
--
-- RLS: users / user_audit_log đã enable row level security, no policies (anon bị
-- chặn, secret key bypass) — migration này không đổi posture.
-- Idempotent: chạy lại an toàn.

alter table public.users
  add column if not exists phone text,
  add column if not exists must_change_password boolean not null default false;

alter table public.user_audit_log
  drop constraint if exists user_audit_log_action_check;

alter table public.user_audit_log
  add constraint user_audit_log_action_check check (action in (
    'create',
    'update',
    'password_reset',
    'soft_delete',
    'restore',
    'bulk_import',
    'password_change',
    'profile_update'
  ));
