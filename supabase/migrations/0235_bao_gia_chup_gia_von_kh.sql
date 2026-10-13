-- Kinh doanh: BÁO GIÁ chụp thêm GIÁ VỐN KH + TIỀN TỆ lúc chào (13/10/2026).
--
-- Vì sao: 0225 chụp `plan_price_snapshot` = technical_products.plan_price, tức
-- GIÁ BÁN KH (FOB kế hoạch, ĐÃ gồm lợi nhuận), nhưng màn báo giá gọi nó là
-- "Giá thành" và tính "Lãi" = (giá chào − FOB) / giá chào. Chào đúng giá đã tính
-- → báo lãi 0%; hạ giá mà vẫn còn lãi → báo lỗ. Nay tách hai số theo bộ tên chốt
-- 13/10 (lib/sale-price.ts):
--
--   sales_quote_lines.plan_cost_snapshot     : GIÁ VỐN KH lúc chào = trực tiếp +
--                                              chi phí chung (0220). Null khi SP
--                                              chỉ có FOB, chưa bóc tách.
--   sales_quote_lines.plan_currency_snapshot : tiền tệ của hai số chụp — chỉ so
--                                              lãi khi cùng tiền tệ với báo giá.
--   sales_quote_lines.plan_price_snapshot    : GIỮ NGUYÊN cột, đổi nghĩa trong
--                                              chú thích thành GIÁ BÁN KH (vốn dĩ
--                                              nó đã là số đó).
--
-- Dòng chụp trước 0235 có plan_currency_snapshot null → màn đọc số HIỆN TẠI
-- thay vì ghép số chụp cũ với giá vốn hiện tại. Không backfill: chỉ 6 báo giá.
--
-- RLS: không tạo bảng, không đổi tư thế (sales_quote_lines ENABLED, no policies
-- từ 0013). Idempotent. Apply: SQL editor / supabase db push. Sau đó "sync types".

alter table public.sales_quote_lines
  add column if not exists plan_cost_snapshot numeric(18, 2)
    check (plan_cost_snapshot is null or plan_cost_snapshot >= 0),
  add column if not exists plan_currency_snapshot char(3);

comment on column public.sales_quote_lines.plan_price_snapshot is
  'GIÁ BÁN KH (FOB kế hoạch = giá vốn + lãi, 0220) chụp lúc chào (0225; đổi tên nghĩa 0235).';
comment on column public.sales_quote_lines.plan_cost_snapshot is
  'GIÁ VỐN KH (trực tiếp + chi phí chung, 0220) chụp lúc chào — lãi thực = (giá chào − số này) / giá chào (0235).';
comment on column public.sales_quote_lines.plan_currency_snapshot is
  'Tiền tệ của plan_price_snapshot / plan_cost_snapshot lúc chụp; null = dòng chụp trước 0235 (0235).';
