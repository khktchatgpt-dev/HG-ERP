-- Vật tư khai nhanh từ form đơn đặt: cờ "CHỜ KHO RÀ" + ghi vết người khai.
--
-- Vì sao: nút "Khai vật tư mới" trong form soạn đơn phục vụ ca NCC chào hàng
-- mới ngay lúc đặt — người khai đang vội, hay bỏ qua cảnh báo tên gần giống và
-- khai thiếu barem/nhóm phụ. Chặn cứng thì kẹt việc đặt hàng (0124 đã chặn mức
-- "chắc chắn" rồi); thả trôi thì mã rác/trùng tích dần như đợt phải chạy
-- materials-dedupe.mjs gộp 277 mã. Lối giữa: vật tư khai từ form đơn mang cờ
-- `needs_review` — Kho có bộ lọc "Chờ Kho rà" trong danh mục, rà xong (đối
-- chiếu trùng, bổ sung barem/kệ/mã vạch) thì gỡ cờ. `created_by` để Kho biết
-- hỏi ai khi tên/quy cách khai không rõ.
--
-- Đi cùng đợt TÁCH FORM theo nghiệp vụ (12/08/2026): form danh mục Kho chỉ còn
-- trường Kho quản (nhận dạng/phân loại/tồn trữ/kệ/mã vạch), trường mua hàng
-- (NCC mặc định, VAT, giá tham chiếu, cách NCC báo giá) chỉ hiện ở màn Cung ứng
-- — đối xứng với việc Cung ứng không thấy mảng Tồn trữ từ trước.
--
-- RLS: không tạo bảng mới — warehouse_materials đã enable RLS no-policies
-- (anon chặn, secret key bypass). Idempotent.

alter table public.warehouse_materials
  add column if not exists needs_review boolean not null default false;

alter table public.warehouse_materials
  add column if not exists created_by uuid references public.users(id) on delete set null;

-- Bộ lọc "Chờ Kho rà" quét cột boolean trên 13k dòng — index một phần đủ dùng.
create index if not exists warehouse_materials_needs_review_idx
  on public.warehouse_materials (needs_review) where needs_review;
