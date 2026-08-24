-- 0170: DỰNG LẠI unique cho production_jobs — vá regression của 0165.
--
-- 0165 drop cột order_line_id cũ đã KÉO THEO unique constraint chứa nó
-- (unique 0084 là (production_order_id, order_line_id, stage); 0114 thêm cột
-- mới nhưng KHÔNG dựng unique mới). Hậu quả: jobsRepo.replaceForLine upsert
-- `ON CONFLICT (production_order_id, production_order_line_id, stage)` chết
-- "no unique or exclusion constraint matching" → lưu kế hoạch 500.
-- Bắt được nhờ test UI thật 23/08/2026 — unit test mock repo không lộ.
--
-- RLS: không đổi. Idempotent: create unique index if not exists.

create unique index if not exists production_jobs_lsx_line_stage_key
  on production_jobs (production_order_id, production_order_line_id, stage);
