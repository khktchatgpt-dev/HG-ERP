-- Công đoạn CUỐI per chi tiết (SRS sản xuất chi tiết — thực tế "tuỳ sản phẩm
-- có các công đoạn khác nhau", user nêu 07/2026): chi tiết không qua SƠN thì
-- công đoạn cuối là NGUỘI… %HT tổng / trạng thái Hoàn thành tính theo công
-- đoạn cuối CỦA CHI TIẾT, không phải công đoạn cuối danh mục chung.
-- null = mặc định công đoạn cuối của danh mục production_stage.
--
-- RLS: bảng đã enable từ 0038 — không đổi posture. Sau apply: SYNC TYPES.

alter table public.production_order_components
  add column if not exists final_stage text;
