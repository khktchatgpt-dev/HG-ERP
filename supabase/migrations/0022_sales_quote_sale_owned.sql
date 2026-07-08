-- Báo giá là HỒ SƠ RIÊNG CỦA SALES — bỏ khâu Giám đốc duyệt.
--
-- Vòng đời rút gọn: draft → sent (sale tự "Chốt & gửi khách"). Không còn
-- pending/approved/rejected. Đơn hàng do sale tự tạo từ báo giá đã `sent` để
-- lưu và làm mốc phát Lệnh sản xuất (LSX). Quy tắc cổng nằm ở service
-- (quotes.service.assertSent), không ràng ở DB.
--
-- An toàn: sales_quotes đang TRỐNG khi migration này ra đời nên đổi
-- check-constraint không cần backfill.
--
-- Cột approved_by / approved_at / rejected_reason GIỮ LẠI (nullable, không còn
-- dùng) để không phá repo/type hiện có — dọn sau nếu cần. RLS không đổi
-- (đã ENABLED, no policies từ 0013). Idempotent — chạy lại an toàn.

-- 1) Nới check status: chỉ còn draft / sent.
alter table public.sales_quotes
  drop constraint if exists sales_quotes_status_check;
alter table public.sales_quotes
  add constraint sales_quotes_status_check
  check (status in ('draft', 'sent'));

-- 2) Đổi index phục vụ lọc: cũ lọc status='pending' (màn duyệt GĐ, không còn) →
--    mới lọc status='sent' (chọn báo giá đã chốt để tạo đơn).
drop index if exists public.sales_quotes_status_idx;
create index if not exists sales_quotes_status_idx
  on public.sales_quotes (status) where status = 'sent';
