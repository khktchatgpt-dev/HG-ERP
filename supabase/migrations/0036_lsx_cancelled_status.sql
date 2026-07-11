-- Huỷ đơn hàng khép chuỗi (plan-order-lsx-lifecycle P3):
--  1. production_orders.status thêm 'cancelled' — đơn huỷ giữa chừng kéo LSX
--     dừng theo (service ordersService.cancel cascade; PO chưa gửi NCC tự huỷ,
--     PO đã gửi NCC chỉ notify — không đụng cam kết với NCC).
--  2. production_progress.action thêm 'cancelled' — log dòng "Đơn hàng huỷ: <lý do>"
--     vào timeline tiến độ của LSX (không mất vết).
--
-- RLS: cả 2 bảng đã enable RLS không policy từ 0014 (blocked-anon /
-- bypass-secret) — migration này không đổi posture.
-- Apply: `npx supabase db push` hoặc SQL editor. Không cần sync types
-- (chỉ đổi check constraint, không đổi cột).

alter table public.production_orders
  drop constraint if exists production_orders_status_check;
alter table public.production_orders
  add constraint production_orders_status_check
  check (status in ('pending_approval', 'approved', 'in_progress',
                    'completed', 'rejected', 'cancelled'));

alter table public.production_progress
  drop constraint if exists production_progress_action_check;
alter table public.production_progress
  add constraint production_progress_action_check
  check (action in ('start', 'done', 'received', 'cancelled'));
