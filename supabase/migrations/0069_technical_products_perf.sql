-- Kỹ thuật: tối ưu hiệu suất THƯ VIỆN SẢN PHẨM (technical_products) — P2/P3.
--
-- Bối cảnh: màn thư viện làm việc nhiều với data (list/search/lọc + StatsBar).
-- Các điểm chưa tối ưu và cách xử lý trong migration này:
--   1. SEARCH: repo dùng `ILIKE '%q%'` trên name/code/customer_item_code. Leading
--      wildcard KHÔNG dùng được btree `lower(name)` cũ → seq scan tăng tuyến tính.
--      → thêm GIN pg_trgm cho cả 3 cột (dùng được cho %q%).
--   2. FK image_file_id chưa có covering index (Supabase advisor:
--      unindexed_foreign_keys) → thêm index (partial, chỉ khi có ảnh).
--   3. SORT: list `order by created_at desc` chưa có index → thêm.
--   4. INDEX THỪA: `technical_products_code_idx` trùng unique `code_key`; và
--      `technical_bom_lines_product_idx` bị composite unique (product_id, material_id)
--      phủ (product_id là cột dẫn) → drop cả 2 để bớt chi phí ghi.
--   5. StatsBar đang chạy 5 HEAD-count riêng (5 lần quét bảng / lần tải) → thêm
--      function `technical_product_counts()` gộp về 1 query / 1 lần quét.
--
-- RLS: KHÔNG đổi — technical_products/technical_bom_lines đã ENABLE, no policies
-- (anon chặn, server secret key bypass). Function security invoker + search_path=''
-- (chuẩn Supabase, tránh search_path injection; server gọi bằng secret key nên
-- vẫn bypass RLS như mọi truy cập khác).
-- Idempotent: extension/index if not exists, drop if exists, create or replace.
-- Apply: `npx supabase db push` hoặc SQL editor. Sau đó "sync types".

create extension if not exists pg_trgm;

-- 1. Trigram GIN cho tìm kiếm con chuỗi (ILIKE %q%).
create index if not exists technical_products_name_trgm
  on public.technical_products using gin (name gin_trgm_ops);
create index if not exists technical_products_code_trgm
  on public.technical_products using gin (code gin_trgm_ops);
create index if not exists technical_products_item_code_trgm
  on public.technical_products using gin (customer_item_code gin_trgm_ops)
  where customer_item_code is not null;

-- 2. FK image_file_id (partial — phần lớn SP có ảnh, nhưng vẫn bỏ NULL cho gọn).
create index if not exists technical_products_image_file_idx
  on public.technical_products (image_file_id)
  where image_file_id is not null;

-- 3. Sort mặc định của list.
create index if not exists technical_products_created_idx
  on public.technical_products (created_at desc);

-- 4. Bỏ index thừa (unique đã phủ).
drop index if exists public.technical_products_code_idx;
drop index if exists public.technical_bom_lines_product_idx;

-- 5. Gộp 5 head-count StatsBar → 1 query 1 scan.
create or replace function public.technical_product_counts()
returns table (
  total        bigint,
  active       bigint,
  bom_none     bigint,
  bom_drawing  bigint,
  bom_done     bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    count(*)::bigint,
    count(*) filter (where is_active)::bigint,
    count(*) filter (where bom_status = 'none')::bigint,
    count(*) filter (where bom_status = 'drawing')::bigint,
    count(*) filter (where bom_status = 'done')::bigint
  from public.technical_products
$$;
