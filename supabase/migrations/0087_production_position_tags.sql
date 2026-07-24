-- 0087_production_position_tags.sql — NHÃN VỊ TRÍ trong xưởng (tách UI, KHÔNG quyền).
--
-- User chốt (07/2026): tách UI cho nhân viên Sản xuất theo vị trí (thống kê /
-- tổ trưởng / tổ viên) nhưng KHÔNG tách quyền. Cơ chế: 2 role "nhãn" — KHÔNG
-- gắn permission nào (ma trận quyền giữ nguyên 0084/0085/0086); UI đọc nhãn để
-- chọn màn rơi vào + mục menu + nút hiển thị:
--
--   production_stat    Thống kê xưởng — rơi vào Sổ số liệu; menu Sổ + Định hình.
--   production_leader  Tổ trưởng      — rơi vào Việc của tổ; menu gọn 1 mục.
--   (member không nhãn = tổ viên/chưa phân — GIỮ giao diện đầy đủ như hiện tại
--    để không khoá nhầm ai; admin gán nhãn dần ở /admin/permissions.)
--
-- Gán sẵn (source='manual' — cầu sync không đụng): các tài khoản thống kê tổ
-- `thongke.%@hoanggia.de` → production_stat; `totruong.test@hg.com` → leader.
--
-- RLS: không đổi. Idempotent: on conflict do nothing. Apply: `npx supabase db
-- push` / SQL editor. Không cần sync types.

insert into public.roles (key, label, description, is_system, sort_order) values
  ('production_stat',   'Thống kê xưởng (nhãn UI)',
   'Nhãn vị trí — KHÔNG cấp quyền. UI: rơi vào Sổ số liệu, menu Sổ + Định hình.', true, 19),
  ('production_leader', 'Tổ trưởng (nhãn UI)',
   'Nhãn vị trí — KHÔNG cấp quyền. UI: rơi vào Việc của tổ, menu tối giản.', true, 20)
on conflict (key) do nothing;

-- Gán nhãn cho tài khoản vị trí sẵn có.
insert into public.user_roles (user_id, role_id, source)
select u.id, r.id, 'manual'
from public.users u
join public.roles r on r.key = 'production_stat'
where u.email like 'thongke.%@hoanggia.de' and u.is_active
on conflict do nothing;

insert into public.user_roles (user_id, role_id, source)
select u.id, r.id, 'manual'
from public.users u
join public.roles r on r.key = 'production_leader'
where u.email = 'totruong.test@hg.com'
on conflict do nothing;
