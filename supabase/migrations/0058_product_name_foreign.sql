-- 0058_product_name_foreign.sql
-- Đổi tên cột technical_products.name_de → name_foreign.
--
-- Lý do: tên hàng theo cách gọi của KHÁCH không chỉ có tiếng Đức (0026 đặt tên
-- theo khách MERXX là khách Đức). Một trường chung dùng được mọi ngôn ngữ —
-- Đức/Anh/Pháp… tuỳ khách. Dữ liệu cũ giữ nguyên (chỉ rename, không mất gì).
--
-- shipping_mark VẪN là cột riêng — đó là ký mã hiệu in trên thùng, khác với tên
-- hàng; LSX in 2 cột tách biệt.
--
-- RLS: không đổi (technical_products đã ENABLED, no policies từ 0012).
-- Idempotent: chỉ rename khi cột cũ còn và cột mới chưa có → chạy lại an toàn.
-- Apply: `npx supabase db push` hoặc SQL editor. Sau đó "sync types".

do $$
begin
  if exists (
        select 1 from information_schema.columns
        where table_schema = 'public'
          and table_name = 'technical_products'
          and column_name = 'name_de'
      )
     and not exists (
        select 1 from information_schema.columns
        where table_schema = 'public'
          and table_name = 'technical_products'
          and column_name = 'name_foreign'
      )
  then
    alter table public.technical_products rename column name_de to name_foreign;
  end if;
end $$;
