-- 0229 — MỤC ĐÍCH CỦA ĐƠN MUA NGOÀI LỆNH (11/10/2026)
--
-- Đơn mua không gắn lệnh sản xuất (production_order_id null, 0076) chỉ mang
-- một nhãn chung "Ngoài lệnh (mua bù tồn)". Đo 11/10: 7/147 đơn ngoài lệnh và
-- KHÔNG đơn nào là bù tồn thuần — mua trước cho đơn khách chưa ra lệnh (IBIZA,
-- PHIPPS), khuôn mẫu, đơn của lệnh niên độ cũ… Lý do nằm lẫn trong ghi chú hoặc
-- bị dán vào TÊN dòng hàng ("Đơn hàng IBIZA tháng 10 — Thép tấm…").
--
-- Hai cột chữ, gõ tự do kèm gợi ý (không bảng danh mục — loại mục đích nhiều
-- và nở dần, chủ dự án chốt 11/10):
--   standalone_purpose — LOẠI việc: "Khuôn mẫu", "Đơn khách chưa ra lệnh"…
--                        Bắt buộc ở cửa gửi duyệt khi đơn ngoài lệnh (service).
--   standalone_ref     — ghi rõ cho ai / việc gì: "PHIPPS", "LSX 07+08/25-26 Merxx".
-- Đơn theo lệnh để null cả hai.
--
-- RLS: bảng đã bật RLS không policy từ 0015 — anon bị chặn, khoá bí mật đi qua.
-- Thêm cột không đổi tư thế đó.

alter table public.supply_purchase_orders
  add column if not exists standalone_purpose text,
  add column if not exists standalone_ref text;

alter table public.supply_purchase_orders
  drop constraint if exists supply_purchase_orders_standalone_purpose_len;
alter table public.supply_purchase_orders
  add constraint supply_purchase_orders_standalone_purpose_len
  check (standalone_purpose is null or char_length(standalone_purpose) <= 120);

alter table public.supply_purchase_orders
  drop constraint if exists supply_purchase_orders_standalone_ref_len;
alter table public.supply_purchase_orders
  add constraint supply_purchase_orders_standalone_ref_len
  check (standalone_ref is null or char_length(standalone_ref) <= 200);

comment on column public.supply_purchase_orders.standalone_purpose is
  'Mục đích đơn NGOÀI LỆNH (0229) — loại việc, gõ tự do kèm gợi ý. Null với đơn theo lệnh.';
comment on column public.supply_purchase_orders.standalone_ref is
  'Ghi rõ cho ai / việc gì của đơn ngoài lệnh (0229) — tên khách, lệnh cũ, mã khuôn.';
