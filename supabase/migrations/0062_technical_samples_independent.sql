-- 0062_technical_samples_independent.sql
-- Mẫu showroom được đứng độc lập, không bắt buộc gắn sản phẩm trong thư viện.
--
-- 0061 buộc mỗi mẫu phải trỏ 1 SP (`product_id not null`). Thực tế showroom nội
-- thất trưng nhiều hiện vật KHÔNG phải SP của mình: mẫu vật liệu/hoàn thiện (gỗ,
-- veneer, sơn, vải, phụ kiện), mẫu đối thủ mua về nghiên cứu, prototype chưa lên
-- catalog. Ép chúng đẻ một SP rác trong thư viện chỉ để có `product_id` sẽ làm
-- bẩn danh mục SP thật (vốn dùng cho báo giá/BOM/LSX).
--
-- Cách xử lý: thêm cột `kind` phân loại hiện vật. Chỉ `kind='product'` gắn SP;
-- các loại còn lại tự khai `name`/`category`/`source` của chính mẫu.
--
--   product    SP của mình trong thư viện     → product_id BẮT BUỘC, name để null
--   material   mẫu vật liệu/hoàn thiện          → product_id NULL, name bắt buộc
--   reference  mẫu đối thủ / tham khảo          → product_id NULL, name bắt buộc
--   prototype  mẫu thử chưa có mã SP            → product_id NULL, name bắt buộc
--
-- Tên/ảnh hiển thị: mẫu gắn SP kế thừa tên+ảnh SP như cũ; mẫu độc lập dùng `name`
-- riêng và ảnh 4 góc của chính nó (không có ảnh SP để fallback).
--
-- Dữ liệu cũ: mọi mẫu hiện có đều có product_id → `kind` default 'product' khớp
-- ràng buộc mới, không cần backfill.
--
-- RLS: bảng đã ENABLED no policies từ 0061, không đổi.
-- Idempotent: add column if not exists, drop column not-null (no-op nếu đã nullable),
-- drop+add lại check constraint. Apply: `npx supabase db push`. Sau đó "sync types".

-- ── 1. Phân loại hiện vật + field riêng cho mẫu độc lập ──────────────────────
alter table public.technical_samples
  add column if not exists kind text not null default 'product'
    check (kind in ('product', 'material', 'reference', 'prototype')),
  add column if not exists name     text,   -- tên riêng khi không gắn SP
  add column if not exists category text,   -- nhóm riêng (loại vật liệu, hãng đối thủ…)
  add column if not exists source   text;   -- hãng/nguồn: mẫu đối thủ, nơi mua

-- ── 2. product_id hết bắt buộc ───────────────────────────────────────────────
-- Giữ nguyên FK on delete restrict (0061): còn mẫu gắn SP thì vẫn cấm xoá SP.
alter table public.technical_samples
  alter column product_id drop not null;

-- ── 3. Ràng buộc hình dạng: đúng loại nào thì phải khai đủ loại đó ────────────
-- product  → có product_id (tên lấy từ SP);   khác → không product_id, có tên riêng.
alter table public.technical_samples drop constraint if exists sample_parent_shape;
alter table public.technical_samples
  add constraint sample_parent_shape check (
    (kind = 'product'  and product_id is not null) or
    (kind <> 'product' and product_id is null and name is not null)
  );

create index if not exists technical_samples_kind_idx
  on public.technical_samples (kind);
