-- 0171: Gia công ngoài gắn CÔNG ĐOẠN.
-- Sổ Excel thật (TỔNG TĐ SX): sheet GIA CÔNG TTP/VINH là một "tổ" thực hiện
-- MỘT công đoạn, và cột "Gia công" của sheet `quan li` nằm TRONG từng khối
-- công đoạn — tức số NHẬN VỀ từ gia công phải cộng vào "SL đã làm" của đúng
-- công đoạn. Thêm cột `stage` (code catalog production_stage, text tự do như
-- production_entries.stage). NULL = bản ghi cũ chưa gắn công đoạn — vẫn nằm
-- trong sổ gia công nhưng KHÔNG cộng vào công đoạn nào ở sổ tổng.
-- RLS: bảng đã enable row level security (no policies) từ 0084 — không đổi
-- tư thế (anon bị chặn, secret key server bypass).
alter table public.production_outsource_entries
  add column if not exists stage text;
