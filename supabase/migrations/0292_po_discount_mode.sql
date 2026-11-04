-- 0292_po_discount_mode.sql — Chiết khấu đơn mua theo % hoặc số tiền, trừ trước hay sau VAT
-- (bản vẽ https://claude.ai/artifact/F59xofEqsgJhLTAyvPUxsC duyệt 04/11/2026, Q1–Q6 theo đề xuất).
--
-- Vì sao: PO-2026-0242 (keo Epoxy, NCC Ngôi Sao Châu Á) — NCC trừ "chiết khấu 3% tiền vỏ lon"
-- TRÊN TỔNG ĐÃ GỒM VAT (45.800.000 → phải trả 44.426.000). ERP chỉ có một ô số tiền trừ TRƯỚC
-- VAT, ghi 1.374.000 vào đó ra 44.316.282 (lệch 109.718 đ). Đo 04/11: 0/199 đơn có chiết khấu,
-- nên đổi cách tính không làm lệch số đơn cũ nào.
--
-- Ba cột mới trên supply_purchase_orders (giữ discount_amount = số tiền đã trừ, để công nợ /
-- hộp ký đọc thẳng; khi có discount_percent thì % THẮNG và tiền tính lại — `poMoney`):
--   discount_percent    numeric(6,3)  null  — gõ theo %; null = gõ số tiền
--   discount_after_vat  boolean       false — true = trừ trên tổng thanh toán, VAT không giảm
--   discount_note       text          null  — lý do ("tiền vỏ lon hỗ trợ"), in lên phiếu
--
-- RLS: không tạo bảng mới — supply_purchase_orders đã bật RLS không policy, giữ nguyên.
-- Cột thêm có mặc định = cách tính cũ, mã trên main chưa đọc → áp TRƯỚC khi mã lên main không
-- đổi hành vi gì (mã mới SELECT các cột này nên phải áp trước). Chạy lại nhiều lần an toàn.

alter table public.supply_purchase_orders
  add column if not exists discount_percent numeric(6, 3),
  add column if not exists discount_after_vat boolean not null default false,
  add column if not exists discount_note text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'supply_purchase_orders_discount_percent_check'
  ) then
    alter table public.supply_purchase_orders
      add constraint supply_purchase_orders_discount_percent_check
      check (discount_percent is null or (discount_percent >= 0 and discount_percent <= 100));
  end if;
end $$;

comment on column public.supply_purchase_orders.discount_percent is
  'Chiết khấu theo % (0292). Có thì thắng discount_amount; tiền tính lại theo poMoney.';
comment on column public.supply_purchase_orders.discount_after_vat is
  'true = chiết khấu trừ trên tổng thanh toán (sau VAT), VAT không giảm (0292).';
comment on column public.supply_purchase_orders.discount_note is
  'Lý do chiết khấu, in lên phiếu (0292).';
