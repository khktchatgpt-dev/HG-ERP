-- XÁC NHẬN MẪU trên hồ sơ sản phẩm (user chốt 13/08/2026).
--
-- Vấn đề: 0140 chỉ có hai nấc "khoá / không khoá". Nhưng đời thật của một hồ sơ
-- SP có một mốc đứng TRƯỚC chuyện chốt bản: mẫu đã được xác nhận hay chưa. Lúc
-- mẫu còn đang đi tới đi lui với khách, hồ sơ đương nhiên còn sửa — không ai
-- khoá; xác nhận mẫu xong, chỉnh nốt thông tin rồi mới tính chuyện chốt.
--
-- Mô hình user chốt — NHẸ NHẤT có thể:
--   · Chỉ MỘT cờ hai trạng thái: chưa xác nhận mẫu / đã xác nhận mẫu.
--   · ĐỘC LẬP với khoá hồ sơ: đây là NHÃN TIẾN TRÌNH, không phải nội dung hồ
--     sơ. Xác nhận mẫu KHÔNG tự khoá, và hồ sơ chưa xác nhận mẫu vẫn khoá được
--     (khoá vẫn là thứ chặn sửa, y như 0140). Vì thế bật/tắt cờ này KHÔNG đi
--     qua `assertUnlocked` — xem `productsService.confirmSample`.
--   · Ai bấm: Kỹ thuật + Bán hàng + Giám đốc (khách duyệt mẫu qua Sale, nhưng
--     KT thường là người cầm mẫu) — action `technical.product.confirm_sample`.
--
--   `sample_confirmed_at/by` — ai xác nhận, lúc nào; `sample_note` — ghi chú
--   kèm (VD: "khách duyệt qua mail 12/08, đổi màu sơn ghi trong hồ sơ").
--
-- KHÔNG dùng lại `showroom_sample`: đó là cờ "có mẫu vật lý ở showroom", chuyện
-- khác hẳn.
--
-- RLS: technical_products đã enable RLS no-policies từ 0012 (anon chặn, secret
-- key server bypass) — thêm cột không đổi tư thế. Idempotent.

alter table public.technical_products
  add column if not exists sample_confirmed_at timestamptz,
  add column if not exists sample_confirmed_by uuid references public.users (id) on delete set null,
  add column if not exists sample_note text;

comment on column public.technical_products.sample_confirmed_at is
  'Mốc XÁC NHẬN MẪU (0141) — nhãn tiến trình, độc lập với locked_at; null = chưa xác nhận';
comment on column public.technical_products.sample_note is
  'Ghi chú kèm lần xác nhận mẫu gần nhất (khách duyệt kiểu gì, kèm điều kiện gì)';

-- Lọc nhanh "đã xác nhận mẫu" + đếm cho StatsBar thư viện SP.
create index if not exists technical_products_sample_confirmed_idx
  on public.technical_products (sample_confirmed_at)
  where sample_confirmed_at is not null;
