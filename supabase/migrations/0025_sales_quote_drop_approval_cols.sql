-- Kinh doanh: dọn cột chết trên báo giá (đã bỏ khâu duyệt từ 0022).
--
-- 0022 đổi vòng đời báo giá thành draft → sent (sale tự chốt, không qua Giám đốc).
-- Ba cột duyệt approved_by / approved_at / rejected_reason cùng luồng cũ không
-- còn dùng — 0022 giữ lại tạm và hẹn dọn sau. Migration này drop chúng.
--
-- ⚠ PHÁ HUỶ (drop column): chỉ chạy khi chắc không còn dữ liệu duyệt cần giữ.
--    sales_quotes chưa từng dùng luồng duyệt (bỏ trước khi có data) nên an toàn.
--    Vì destructive, hãy áp THỦ CÔNG (SQL editor / `npx supabase db push`),
--    không để tự động.
--
-- RLS: không đổi. Idempotent: drop column if exists — chạy lại an toàn.
-- Sau khi áp: "sync types".

alter table public.sales_quotes
  drop column if exists approved_by,
  drop column if exists approved_at,
  drop column if exists rejected_reason;
