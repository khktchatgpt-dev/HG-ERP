-- 0119: Lệnh sản xuất ghi nhận NGƯỜI LẬP LỆNH (production_orders.created_by).
--
-- Vì sao: chủ dự án hỏi 07/08/2026 "tạo LSX / tạo đơn đã ghi người tạo chưa".
-- Đơn hàng thì có (`sales_orders.created_by`), LỆNH SX thì KHÔNG — bảng chỉ có
-- `issued_by`, và cột đó bị GHI ĐÈ ở `lsxService.resubmit()` (gửi duyệt lại sau
-- khi GĐ từ chối). Nên nếu A lập lệnh, GĐ từ chối, B sửa rồi gửi lại thì A biến
-- mất khỏi hồ sơ, không còn chỗ nào truy ra người lập.
--
-- Sau migration này hai cột nói hai việc khác nhau:
--   created_by — NGƯỜI LẬP lệnh. Ghi một lần lúc tạo, không bao giờ đổi.
--   issued_by  — người GỬI DUYỆT lần gần nhất. Vẫn ghi đè ở resubmit (đúng ý
--                nghĩa của nó) và vẫn là đích nhận thông báo duyệt/từ chối.
--
-- Backfill: `created_by := issued_by` cho các lệnh đã có — với lệnh chưa từng
-- resubmit thì issued_by CHÍNH LÀ người lập, nên đây là suy luận an toàn nhất
-- từ dữ liệu sẵn có. Lệnh nhập bằng script (issued_by null) vẫn để trống; phần
-- gán cho sale1/sale2 làm riêng bằng `scripts/backfill-sales-owner.mjs` vì đó là
-- dữ liệu riêng của công ty, không thuộc lược đồ.
--
-- KHÔNG đụng mẫu in (`src/app/print/*`) — chủ dự án chốt chỉ hiện ở màn quản lý.
--
-- RLS: không đổi posture — production_orders đã enable RLS không policy từ 0014.
-- Idempotent: add column if not exists + backfill có điều kiện is null.
-- Apply: `npx supabase db push` hoặc SQL editor. Sau đó chạy "sync types".

alter table public.production_orders
  add column if not exists created_by uuid references public.users (id) on delete set null;

comment on column public.production_orders.created_by is
  'Người LẬP lệnh — ghi một lần lúc tạo, không đổi. Khác issued_by (người gửi duyệt lần gần nhất, bị ghi đè khi gửi duyệt lại).';

-- Lệnh cũ: người gửi duyệt đầu tiên chính là người lập (chưa lệnh nào resubmit).
update public.production_orders
   set created_by = issued_by
 where created_by is null
   and issued_by is not null;

create index if not exists production_orders_created_by_idx
  on public.production_orders (created_by);
