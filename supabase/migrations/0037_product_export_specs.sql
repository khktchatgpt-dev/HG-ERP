-- Thông tin SP nội thất xuất khẩu (DN yêu cầu 07/2026): hàng chủ yếu là bàn /
-- ghế / bộ / sofa, thiên hướng xuất khẩu nên cần thêm:
--   hs_code        — mã HS khai hải quan
--   origin_country — xuất xứ (Made in Vietnam…)
--   material       — chất liệu chính tóm tắt (khung nhôm + mây nhựa, gỗ teak…)
--   max_load_kg    — tải trọng tối đa (ghế/bàn chịu được)
--   assembly       — nguyên chiếc (assembled) / tháo rời KD (knock-down)
--   set_contents   — cấu thành bộ dạng text ("1 bàn + 6 ghế") — bộ là 1 SP
--                    riêng có BOM tổng; quan hệ set-item tường minh để GĐ sau
-- NW/GW per carton nằm trong jsonb `packing` (nw_kg/gw_kg) — không cần cột.
--
-- RLS: bảng technical_products đã enable RLS không policy từ 0012 — không đổi.
-- Apply: `npx supabase db push` hoặc SQL editor. Sau đó SYNC TYPES (có cột mới).

alter table public.technical_products
  add column if not exists hs_code        text,
  add column if not exists origin_country text,
  add column if not exists material       text,
  add column if not exists max_load_kg    numeric(10, 2) check (max_load_kg >= 0),
  add column if not exists assembly       text check (assembly in ('assembled', 'kd')),
  add column if not exists set_contents   text;
