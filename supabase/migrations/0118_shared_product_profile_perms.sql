-- 0118: Hồ sơ sản phẩm thành khu DÙNG CHUNG — mở quyền sửa cho Bán hàng + GĐ.
--
-- Vì sao: chủ dự án chốt 07/08/2026 — thư viện/hồ sơ SP trước nằm trong
-- workspace Kỹ thuật (`/technical/products`), phòng khác muốn tra cứu phải có
-- quyền xem chéo workspace. Nay trang chuyển sang khu dùng chung `/products`
-- (`src/app/(shared)`): MỌI người đăng nhập XEM được, chỉ **Kỹ thuật, Bán hàng,
-- Giám đốc** SỬA được, còn lại chỉ xem.
--
-- Phần XEM không cần migration: hai action `technical.product.view` /
-- `technical.bom.view` trong registry `src/modules/core/rbac/actions.ts` đã là
-- PUBLIC từ đầu — cái chặn chỉ là route nằm dưới layout workspace Kỹ thuật.
--
-- Phần SỬA thì luật cũ chặn oan hai vai, nên migration này vá ma trận:
--   * Giám đốc  có 'technical.edit' nhưng KHÔNG có 'technical.bom.edit'
--     → thêm, để sửa được cả tab Định mức.
--   * Bán hàng  có 'technical.bom.edit' nhưng KHÔNG có 'technical.edit'
--     → thêm, để sửa được hồ sơ (mã/tên/thông số/đóng gói/tài liệu).
-- Kèm theo, registry đổi luật từ `technical.member AND technical.edit` sang một
-- permission mỗi tầng ('technical.edit' cho hồ sơ, 'technical.bom.edit' cho
-- định mức) — nếu không thì Giám đốc vẫn bị chặn vì thiếu 'technical.member'.
--
-- KHÔNG nới cho ai khác: ba permission liên quan chỉ được seed cho
-- technical_staff / sales_staff / director. Phòng Kho, Kế toán, Cung ứng, Xưởng…
-- không có → chỉ xem. Mẫu showroom ('technical.sample.*') vẫn gác
-- 'technical.member' nên vẫn là việc riêng của Kỹ thuật.
--
-- Không có permission key MỚI (chỉ thêm dòng grant), nên từ vựng ở 0073 đủ dùng.
--
-- RLS: không đổi posture — roles/role_permissions đã enable RLS không policy từ
-- 0073 (anon bị chặn, secret key bypass).
-- Idempotent: insert ... on conflict do nothing; chạy lại vô hại.
-- Apply: `npx supabase db push` hoặc dán vào SQL editor. Không cần sync types
-- (không đổi schema).

insert into public.role_permissions (role_id, permission_key)
select r.id, v.pkey
from (values
  -- Bán hàng sửa hồ sơ SP (đã có technical.bom.edit từ 0073).
  ('sales_staff', 'technical.edit'),
  -- Giám đốc sửa định mức (đã có technical.edit từ 0073).
  ('director', 'technical.bom.edit')
) as v(rkey, pkey)
join public.roles r on r.key = v.rkey
on conflict do nothing;
