-- TRẠNG THÁI HỒ SƠ SP: từ cột SINH → cột THẬT, có nút cập nhật (user chốt 13/08/2026).
--
-- 0144 làm `lifecycle` là cột sinh, suy từ 4 tín hiệu cũ (bom_status / mẫu /
-- khoá / ngừng dùng). User dùng thử rồi bác: "vẫn đang giữ các trạng thái cũ,
-- tôi cần theo lộ trình trạng thái mới và có phần để cập nhật trạng thái".
--
-- Đúng — suy ra từ cờ cũ nghĩa là màn hình vẫn phải bày cả 4 cờ đó, và không ai
-- chuyển trạng thái được một cách trực tiếp. Nay:
--
--   · `lifecycle` là CỘT THẬT, người có quyền tự chuyển:
--       draft → review → approved → production → discontinued (lùi lại được,
--       bắt ghi lý do — xem `productsService.setLifecycle`).
--   · Mỗi lần chuyển ghi một dòng vào `technical_product_revisions`
--     (action 'status') nên tab Lịch sử có luôn vết ai chuyển, khi nào, vì sao.
--   · Các cờ cũ KHÔNG bị bỏ rơi, chúng được ĐỒNG BỘ theo trạng thái để mọi màn
--     hình đang đọc chúng vẫn đúng (service lo, không phải trigger):
--       discontinued  ⇄ is_active = false
--       approved/production ⇄ sample_confirmed_* (mốc "chốt mẫu với khách")
--     `bom_status` giữ nguyên nghĩa TIẾN ĐỘ VẼ của Kỹ thuật (khác trạng thái hồ
--     sơ), `locked_at` giữ nguyên nghĩa KHOÁ SỬA — chuyển sang "đang sản xuất"
--     KHÔNG tự khoá, vì khoá là quyết định riêng của Kỹ thuật/Giám đốc.
--
-- `drop expression` (PG13+) biến cột sinh thành cột thường và GIỮ NGUYÊN giá trị
-- đang có — nên 738 SP không mất trạng thái nào, không cần backfill lại.
--
-- RLS: không tạo bảng mới. Idempotent (dùng if exists / not exists khắp nơi).

-- 1) Cột sinh → cột thường, giữ giá trị.
alter table public.technical_products
  alter column lifecycle drop expression if exists;

alter table public.technical_products
  alter column lifecycle set default 'draft';

update public.technical_products set lifecycle = 'draft' where lifecycle is null;

alter table public.technical_products
  alter column lifecycle set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'technical_products_lifecycle_check'
  ) then
    alter table public.technical_products
      add constraint technical_products_lifecycle_check
      check (lifecycle in ('draft', 'review', 'approved', 'production', 'discontinued'));
  end if;
end $$;

-- 2) Vết lần chuyển gần nhất ngay trên hồ sơ (lịch sử đầy đủ ở bảng revisions).
alter table public.technical_products
  add column if not exists lifecycle_at timestamptz,
  add column if not exists lifecycle_by uuid references public.users (id) on delete set null;

comment on column public.technical_products.lifecycle is
  'TRẠNG THÁI hồ sơ SP (0145) — draft/review/approved/production/discontinued; đổi qua nút "Cập nhật trạng thái", mỗi lần ghi một dòng technical_product_revisions';

-- 3) Lịch sử phiên bản nhận thêm loại 'status' (0143 chỉ có lock/unlock).
alter table public.technical_product_revisions
  drop constraint if exists technical_product_revisions_action_check;

alter table public.technical_product_revisions
  add constraint technical_product_revisions_action_check
  check (action in ('lock', 'unlock', 'status'));

-- Dòng 'status' KHÔNG chốt bản mới nên nhiều dòng cùng một `rev` — bỏ ràng buộc
-- unique(product_id, rev, action) cũ, thay bằng ràng buộc chỉ áp cho lock/unlock.
alter table public.technical_product_revisions
  drop constraint if exists technical_product_revisions_product_id_rev_action_key;

create unique index if not exists technical_product_revisions_lock_unique
  on public.technical_product_revisions (product_id, rev, action)
  where action in ('lock', 'unlock');
