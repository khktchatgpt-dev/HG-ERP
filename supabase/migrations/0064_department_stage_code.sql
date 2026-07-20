-- 0064_department_stage_code.sql
-- Ràng buộc chính thức TỔ ↔ CÔNG ĐOẠN (đóng OI-14, tách vai SX 07/2026).
--
-- Trước giờ công đoạn của tổ bị ĐOÁN qua tên phòng (stage-for-dept.ts: "Tổ
-- Hàn" → han) — mong manh khi đổi tên. Thêm cột stage_code trên departments:
-- code catalog production_stage (0011). null = chưa gán → fallback vẫn đoán
-- theo tên trong giai đoạn chuyển tiếp; admin gán ở /admin/departments.
--
-- Không FK sang catalog_items (code không phải unique key riêng — cùng lý do
-- 0063 để jsonb route); service validate code ∈ catalog khi update.
--
-- RLS: không đổi (departments đã enable, no policies — anon chặn, secret key
-- bypass). Idempotent. Apply: `npx supabase db push`. Sau đó "sync types".

alter table public.departments
  add column if not exists stage_code text;
