-- Đánh giá NCC (Vendor Master M5) — điểm CHẤM TAY (hybrid).
--
-- KPI giao hàng (tổng PO / hoàn tất / đang trễ) TỰ TÍNH live từ dữ liệu PO,
-- không lưu. Ở đây chỉ lưu phần người mua CHẤM TAY: điểm chất lượng/dịch vụ/giá
-- (1–5), số lần khiếu nại, và mốc đánh giá. Xếp hạng A/B/C/D dùng cột `rating`
-- đã có (0046). Lịch sử đánh giá theo kỳ = để sau (bảng riêng nếu cần).
--
-- Cột nullable → an toàn. RLS kế thừa. Idempotent.

alter table public.supply_suppliers
  add column if not exists quality_score  smallint,
  add column if not exists service_score  smallint,
  add column if not exists price_score    smallint,
  add column if not exists complaint_count int not null default 0,
  add column if not exists evaluated_at   timestamptz,
  add column if not exists evaluated_by   uuid references public.users(id) on delete set null;

alter table public.supply_suppliers drop constraint if exists supply_suppliers_scores_check;
alter table public.supply_suppliers
  add constraint supply_suppliers_scores_check
  check (
    (quality_score is null or quality_score between 1 and 5) and
    (service_score is null or service_score between 1 and 5) and
    (price_score   is null or price_score   between 1 and 5)
  );
