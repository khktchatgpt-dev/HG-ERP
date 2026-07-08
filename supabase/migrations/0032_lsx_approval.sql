-- Sản xuất: thêm bước Giám đốc DUYỆT LSX (Sales phát → GĐ duyệt → Cung ứng đặt vật tư).
--
-- Trước: phát LSX vào thẳng 'issued'. Nay LSX có bước duyệt:
--   pending_approval → approved → in_progress → completed  (+ rejected).
-- Đơn hàng thêm trạng thái trung gian 'lsx_pending' (đã phát LSX, chờ GĐ duyệt).
--
-- production_orders đang TRỐNG → đổi check-constraint không cần backfill.
-- RLS không đổi. Idempotent. Sau đó "sync types".

-- production_orders: trạng thái duyệt LSX ------------------------------------
alter table public.production_orders
  drop constraint if exists production_orders_status_check;
alter table public.production_orders
  add constraint production_orders_status_check
  check (status in ('pending_approval', 'approved', 'in_progress', 'completed', 'rejected'));
alter table public.production_orders alter column status set default 'pending_approval';

alter table public.production_orders
  add column if not exists approved_by uuid references public.users(id) on delete set null,
  add column if not exists approved_at timestamptz,
  add column if not exists rejected_reason text;

-- Màn duyệt của GĐ (lọc LSX chờ duyệt nhanh)
create index if not exists production_orders_pending_idx
  on public.production_orders (status) where status = 'pending_approval';

-- sales_orders: thêm trạng thái 'lsx_pending' --------------------------------
alter table public.sales_orders
  drop constraint if exists sales_orders_status_check;
alter table public.sales_orders
  add constraint sales_orders_status_check
  check (status in ('confirmed', 'lsx_pending', 'lsx_issued', 'in_production',
                    'completed', 'delivered', 'cancelled'));
