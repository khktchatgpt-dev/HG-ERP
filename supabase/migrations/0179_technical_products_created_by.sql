-- 0179 — Hồ sơ SP: ai là NGƯỜI TẠO
--
-- LÀM GÌ: thêm `technical_products.created_by uuid references users(id)` và
-- gán toàn bộ hồ sơ đang có cho Kỹ thuật bản vẽ (kythuat1@hoanggia.de).
--
-- VÌ SAO: hồ sơ SP chỉ ghi `created_at`, không ghi ai lập. Ô gần nhất là
-- `owner_id` ("Người phụ trách", 0144) nhưng đó là ô GÕ TAY, đổi lúc nào cũng
-- được và bàn giao xong là mất dấu người lập; hơn nữa nó chỉ được điền tự động
-- ở đúng một đường tạo (Tạo từ file BOM) — 12/779 hồ sơ có giá trị. Cần một cột
-- BẤT BIẾN riêng để trả lời "hồ sơ này ai làm", tách khỏi "giờ ai chịu trách
-- nhiệm".
--
-- `on delete set null` chứ không `cascade`: xoá một tài khoản không được kéo
-- theo hồ sơ sản phẩm. Mất tên người tạo còn hơn mất hồ sơ.
--
-- BACKFILL: 779 hồ sơ hiện có đều do Kỹ thuật lập (giai đoạn nạp dữ liệu từ
-- Excel/BKVT), nên gán hết cho Lê Tú Thức — người đang giữ vai Kỹ thuật bản vẽ.
-- Tra theo EMAIL chứ không ghim uuid để câu lệnh đọc được và chạy đúng ở mọi
-- môi trường. Tài khoản đó không tồn tại thì `update` khớp 0 dòng và migration
-- vẫn chạy xong — cột để null, không phải lỗi.
--
-- `owner_id` cũng được bồi cùng lúc và CHỈ ở chỗ đang trống: 12 hồ sơ đã có
-- người phụ trách thật thì giữ nguyên, không đè.
--
-- RLS: `technical_products` đã bật RLS không policy từ migration tạo bảng —
-- thêm cột không đụng tới tư thế đó. Không tạo bảng/view mới.

alter table public.technical_products
  add column if not exists created_by uuid references public.users (id) on delete set null;

comment on column public.technical_products.created_by is
  'Người LẬP hồ sơ — server tự ghi lúc tạo, không nhận từ input, không sửa được. Khác owner_id (người phụ trách hiện tại, đổi được).';

update public.technical_products p
set created_by = u.id
from public.users u
where u.email = 'kythuat1@hoanggia.de'
  and p.created_by is null;

update public.technical_products p
set owner_id = u.id
from public.users u
where u.email = 'kythuat1@hoanggia.de'
  and p.owner_id is null;
