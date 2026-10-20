-- 0239 — ĐỀ NGHỊ MUA · Đ7: VAT TỪNG DÒNG, PHÍ VẬN CHUYỂN, LỜI DẶN KHI DUYỆT (14/10/2026)
--
-- Tờ giấy anh Hào có cột VAT + Vận chuyển; phiếu trên hệ thống chỉ ghi "chưa VAT,
-- chưa vận chuyển" nên lãnh đạo không thấy tổng thật phải chi (bản vẽ vòng 4
-- https://claude.ai/artifact/Tu7kTTCUPr2aALmAZ2g18b, Q18). Chủ dự án 14/10: trong
-- MỘT phiếu có dòng có VAT, dòng không VAT (tiệm không xuất hoá đơn) → VAT đặt
-- theo DÒNG, không theo phiếu.
--
--   warehouse_purchase_request_lines.vat_rate   — % VAT của dòng; 0 = không VAT.
--   warehouse_purchase_requests.shipping_fee    — phí vận chuyển dự kiến cả phiếu (VND).
--   warehouse_purchase_requests.approve_note    — lời lãnh đạo dặn Kho khi duyệt
--                                                 (VD "que hàn chờ PO-0174, không mua").
--
-- Dòng cũ (0 phiếu thật lúc áp) nhận vat_rate = 0, shipping_fee = 0.
-- RLS: không thêm bảng — hai bảng đã bật RLS không policy từ 0236. Idempotent.

alter table public.warehouse_purchase_request_lines
  add column if not exists vat_rate numeric(5,2) not null default 0
    check (vat_rate >= 0 and vat_rate <= 100);

alter table public.warehouse_purchase_requests
  add column if not exists shipping_fee numeric(14,2) not null default 0
    check (shipping_fee >= 0),
  add column if not exists approve_note text
    check (approve_note is null or char_length(approve_note) <= 1000);
