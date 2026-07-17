-- 0071_drop_material_conversion_profile.sql
-- Bỏ hẳn khái niệm "loại quy đổi" A/B/C: cột warehouse_materials.conversion_profile
-- (thêm ở 0055) không còn dùng. Form đặt vật tư & danh mục nay lái quy đổi TRỰC TIẾP
-- theo price_unit (0053): có price_unit → dòng đặt có ô SL-tính-giá nhập tay; unit2_factor
-- chỉ còn là hệ số gợi ý (sửa được). Nhãn A/B/C trên thực tế gộp B≡C nên gây khó dùng.
--
-- Chỉ DROP cột + CHECK kèm theo. GIỮ NGUYÊN price_unit, unit2_factor và
-- supply_purchase_order_lines.price_basis/qty2/unit2 (trục giá đơn-vị-kép) — không đụng.
--
-- Phụ thuộc: trong repo chỉ 0055 tham chiếu cột này; không view/trigger/policy nào dùng.
-- ⚠️ TRƯỚC KHI APPLY trên DB thực: xác nhận lại bằng Supabase MCP rằng không object nào
-- (view / trigger / policy / generated column / index) còn tham chiếu conversion_profile.
--
-- RLS: warehouse_materials đã enable row level security từ 0009 — migration này KHÔNG đổi
-- posture (chỉ drop column, anon vẫn bị chặn / secret key vẫn bypass).
-- Idempotent: drop ... if exists → chạy lại an toàn. Apply: `npx supabase db push`
-- hoặc SQL editor. Sau khi apply → SYNC TYPES (database.types.ts đã sửa tay sẵn ở commit này).

alter table public.warehouse_materials
  drop constraint if exists warehouse_materials_conversion_profile_check;

alter table public.warehouse_materials
  drop column if exists conversion_profile;
