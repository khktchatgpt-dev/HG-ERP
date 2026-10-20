-- 0221: GIỮ NHẬT KÝ SỬA KHI XOÁ MÃ VẬT TƯ (05/10/2026, bản vẽ Bản 11 · V2).
--
-- Vì sao: từ nay cả phòng Cung ứng xoá được mã CHƯA DÙNG Ở ĐÂU (action
-- `warehouse.material.retire`, service chặn mã đã dùng). 0177 để khoá ngoại
-- `warehouse_material_changes.material_id` là ON DELETE CASCADE — xoá mã là
-- mất luôn sổ vết của nó, kể cả dòng "ai xoá, lúc nào" service vừa ghi ngay
-- trước khi xoá. Câu "mã CN1256 đi đâu rồi?" khi đó không ai trả lời được.
--
-- Đổi thành ON DELETE SET NULL + cho `material_id` nhận NULL. Dòng vết còn
-- lại vẫn đọc được nhờ `material_code` (0177 đã chép mã sẵn vào từng dòng).
--
-- KHÔNG đổi dữ liệu nào: chỉ nới ràng buộc. Chạy lại an toàn (idempotent):
-- `drop not null` lặp không lỗi; khoá ngoại bỏ-rồi-tạo theo tên.
--
-- RLS: giữ nguyên (bật, KHÔNG policy — anon bị chặn, secret key đi vòng).

alter table public.warehouse_material_changes
  alter column material_id drop not null;

alter table public.warehouse_material_changes
  drop constraint if exists warehouse_material_changes_material_id_fkey;

alter table public.warehouse_material_changes
  add constraint warehouse_material_changes_material_id_fkey
  foreign key (material_id) references public.warehouse_materials (id) on delete set null;

-- Tra vết theo mã khi bản ghi vật tư đã xoá (material_id = NULL).
create index if not exists warehouse_material_changes_code_idx
  on public.warehouse_material_changes (material_code, created_at desc);
