-- 0057_quote_line_qty_nullable.sql
-- Báo giá = quy cách SP + đơn giá, KHÔNG có số lượng (SL thuộc về Đơn hàng).
-- Bỏ ràng buộc NOT NULL + check(qty > 0) trên sales_quote_lines.qty để dòng báo
-- giá không cần SL. Cột vẫn giữ lại (dữ liệu cũ không mất; đơn tạo từ báo giá
-- nay nhập SL ở bước tạo đơn, không snapshot SL từ báo giá).
-- RLS: KHÔNG đổi — sales_quote_lines đã `enable row level security` không policy
-- (anon bị chặn, secret-key bypass). Chỉ nới ràng buộc cột.
-- Idempotent: drop constraint if exists + drop not null (an toàn chạy lại).

alter table public.sales_quote_lines
  alter column qty drop not null;

-- Bỏ check(qty > 0) — tên constraint do Postgres tự đặt khi tạo bảng ở 0013.
-- Dò và drop theo tên thực tế để idempotent, không phụ thuộc tên cứng.
do $$
declare
  c record;
begin
  for c in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace ns on ns.oid = rel.relnamespace
    where ns.nspname = 'public'
      and rel.relname = 'sales_quote_lines'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%qty%'
  loop
    execute format('alter table public.sales_quote_lines drop constraint %I', c.conname);
  end loop;
end $$;
