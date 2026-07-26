-- Kỹ thuật: THƯ VIỆN SẢN PHẨM tách khỏi danh mục khách hàng của Kinh doanh.
--
-- Bối cảnh: form tạo/sửa SP đang bắt chọn khách từ dropdown đổ ra từ
-- `sales_customers` (FK `customer_id`, 0012). Muốn tạo SP cho một khách chưa có
-- hồ sơ thì phải sang Kinh doanh tạo khách trước — Kỹ thuật không cần ràng buộc
-- đó. Từ nay Kỹ thuật GÕ TỰ DO tên khách/nhóm vào `customer_name`.
--
-- Thay đổi:
--   1. Thêm cột `customer_name text` — nhãn tự do, KHÔNG FK, null = mẫu chung.
--   2. Backfill từ `sales_customers.name` cho các SP đang có `customer_id`, để
--      thư viện không mất nhãn nhóm sau khi đổi.
--   3. Index trgm + btree(lower) phục vụ tìm/lọc/nhóm theo nhãn.
--   4. Function `technical_product_customer_names()` — danh sách nhãn đã dùng
--      (kèm số SP) đổ vào ô gợi ý khi gõ + dropdown lọc, thay vì kéo cả bảng.
--
-- GIỮ NGUYÊN `customer_id`: Kinh doanh vẫn dùng nó để chia rổ "của khách này /
-- mẫu chung / khách khác" trong form báo giá (QuoteForm). Kỹ thuật không còn
-- ghi vào cột đó; đường tạo nhanh SP từ báo giá (createQuick) vẫn set cả hai.
--
-- RLS: KHÔNG đổi — technical_products đã ENABLE, no policies (anon chặn, server
-- secret key bypass). Function security invoker + search_path='' (chuẩn Supabase).
-- Idempotent: add column/index if not exists, create or replace, backfill có
-- điều kiện `customer_name is null` nên chạy lại không đè dữ liệu người dùng gõ.
-- Apply: `npx supabase db push` hoặc SQL editor. Sau đó "sync types".

alter table public.technical_products
  add column if not exists customer_name text;

comment on column public.technical_products.customer_name is
  'Nhãn khách/nhóm do Kỹ thuật gõ tự do (không FK). null = mẫu chung.';

-- Backfill: giữ nguyên nhãn nhóm hiện có của các SP đã gắn khách.
update public.technical_products p
   set customer_name = c.name
  from public.sales_customers c
 where p.customer_id = c.id
   and p.customer_name is null;

create index if not exists technical_products_customer_name_idx
  on public.technical_products (lower(customer_name))
  where customer_name is not null;

create index if not exists technical_products_customer_name_trgm
  on public.technical_products using gin (customer_name gin_trgm_ops)
  where customer_name is not null;

-- Nhãn đã dùng + số SP: đổ vào datalist gợi ý và dropdown lọc.
create or replace function public.technical_product_customer_names()
returns table (
  customer_name  text,
  product_count  bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select p.customer_name, count(*)::bigint
    from public.technical_products p
   where p.is_active
     and p.customer_name is not null
     and btrim(p.customer_name) <> ''
   group by p.customer_name
   order by p.customer_name
$$;
