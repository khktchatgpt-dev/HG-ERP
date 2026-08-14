-- THÔNG TIN CHUNG của hồ sơ SP (mục A tài liệu): TRẠNG THÁI vòng đời + NGƯỜI PHỤ TRÁCH.
--
-- Đối chiếu mục A với hồ sơ hiện có: mã / tên / tên theo khách / loại SP / danh
-- mục / khách hàng / ngày tạo đều đã có; "Phiên bản" là bản #N của 0143. Chỉ
-- thiếu đúng hai thứ — và hai thứ đó khác hẳn nhau về cách làm:
--
-- 1) NGƯỜI PHỤ TRÁCH (`owner_id`) — dữ liệu thật, phải có cột, người dùng gõ.
--
-- 2) TRẠNG THÁI (Draft → Review → Approved → Production → Discontinued) —
--    KHÔNG làm thành cột gõ tay. Hồ sơ SP đã có sẵn 4 tín hiệu trạng thái, mỗi
--    cái có người chịu trách nhiệm và có nút riêng: `bom_status` (Kỹ thuật vẽ),
--    `sample_confirmed_at` (0141 — chốt mẫu với khách), `locked_at` (0140 — chốt
--    bản cho xưởng dùng), `is_active` (ngừng dùng). Thêm cột trạng thái thứ 5
--    gõ tay là mời gọi mâu thuẫn: hồ sơ ghi "Draft" trong khi đã khoá và xưởng
--    đang chạy — ai đọc cũng không biết tin cái nào.
--
--    Nên `lifecycle` là CỘT SINH (generated always … stored): suy thẳng từ 4 tín
--    hiệu đó theo thứ tự ưu tiên dưới đây. Không thao tác mới, không lệch được,
--    và vẫn lọc/đánh index như cột thường.
--
--      discontinued  ← is_active = false        (ngừng dùng, đè mọi thứ khác)
--      production    ← locked_at is not null    (bản đã chốt, xưởng dùng bản này)
--      approved      ← sample_confirmed_at      (mẫu chốt với khách, hồ sơ chưa khoá)
--      review        ← bom_status = 'done'      (đã vẽ xong, đang rà / chờ chốt mẫu)
--      draft         ← còn lại                  (chưa có BOM hoặc đang vẽ)
--
--    Muốn đổi trạng thái thì bấm đúng nút của tín hiệu đó — đó cũng là điều
--    người dùng đang làm sẵn. `src/lib/product-lifecycle.ts` giữ bản TS y hệt
--    (có test) để UI khỏi phải chờ round-trip DB mới biết nhãn.
--
-- RLS: technical_products đã enable RLS no-policies từ 0012 — thêm cột không
-- đổi tư thế. Idempotent.

alter table public.technical_products
  add column if not exists owner_id uuid references public.users (id) on delete set null;

alter table public.technical_products
  add column if not exists lifecycle text generated always as (
    case
      when is_active = false then 'discontinued'
      when locked_at is not null then 'production'
      when sample_confirmed_at is not null then 'approved'
      when bom_status = 'done' then 'review'
      else 'draft'
    end
  ) stored;

comment on column public.technical_products.owner_id is
  'Người phụ trách hồ sơ SP (0144) — người trả lời khi hồ sơ có vấn đề';
comment on column public.technical_products.lifecycle is
  'CỘT SINH (0144): trạng thái vòng đời suy từ is_active/locked_at/sample_confirmed_at/bom_status — không ghi trực tiếp được';

create index if not exists technical_products_lifecycle_idx
  on public.technical_products (lifecycle);

create index if not exists technical_products_owner_idx
  on public.technical_products (owner_id)
  where owner_id is not null;
