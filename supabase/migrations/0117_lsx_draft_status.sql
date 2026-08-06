-- 0117: Thêm trạng thái 'draft' (NHÁP) cho lệnh sản xuất production_orders.
--
-- Vì sao: chủ dự án chốt 06/08/2026 — quy trình cũ sai nhịp. Tạo lệnh là bắn
-- thẳng sang GĐ duyệt (pending_approval) RỒI Sales mới vào màn soạn dòng tách
-- đợt xuất / điền spec; nghĩa là GĐ nhận phiếu khi nội dung còn dang dở, và
-- mỗi lần Sales sửa tiếp lại thành một bản chỉnh sửa nữa.
--
-- Nay: tạo lệnh = NHÁP, Sales soạn dòng + sửa đầu lệnh thoải mái, bấm "Gửi GĐ
-- duyệt" (draft → pending_approval) mới notify người duyệt và mới đẩy các đơn
-- sang 'lsx_pending'. Cùng cơ chế đã áp cho đơn đặt vật tư ở 0116.
--
-- Dữ liệu cũ: mọi lệnh hiện có đã qua bước phát nên KHÔNG đụng tới — chỉ nới
-- ràng buộc để nhận thêm giá trị mới.
--
-- RLS: bảng đã bật RLS không policy từ 0002 (anon bị chặn, secret key bypass)
-- — migration này không đổi tư thế đó.
-- Idempotent: drop constraint if exists rồi add lại; chạy lại vô hại.

alter table public.production_orders
  drop constraint if exists production_orders_status_check;
alter table public.production_orders
  add constraint production_orders_status_check
  check (status in ('draft', 'pending_approval', 'approved', 'in_progress',
                    'completed', 'rejected', 'cancelled'));
