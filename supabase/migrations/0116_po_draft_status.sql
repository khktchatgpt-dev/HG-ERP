-- 0116: Thêm trạng thái 'draft' (NHÁP) cho đơn đặt vật tư supply_purchase_orders.
--
-- Vì sao: chủ dự án chốt 05/08/2026 — tạo đơn = LƯU NHÁP, phòng Cung ứng xem
-- lại / sửa / xoá thoải mái trong chi tiết đơn rồi mới bấm "Gửi GĐ duyệt"
-- (draft → pending_approval, lúc đó mới notify người duyệt). Trước đây tạo là
-- vào thẳng pending_approval (đặc tả 4.3 cũ, không có bước nháp).
--
-- RLS: bảng đã bật RLS không policy từ 0015 (anon bị chặn, secret key bypass)
-- — migration này không đổi tư thế đó.
-- Idempotent: drop constraint if exists rồi add lại; chạy lại vô hại.

alter table public.supply_purchase_orders
  drop constraint if exists supply_purchase_orders_status_check;
alter table public.supply_purchase_orders
  add constraint supply_purchase_orders_status_check
  check (status in ('draft', 'pending_approval', 'approved', 'ordered',
                    'confirmed', 'in_transit', 'partial', 'received', 'cancelled'));
