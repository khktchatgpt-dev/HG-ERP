-- 0059_files_doc_type.sql
-- Phân loại file trong hồ sơ (rõ ràng thay vì một danh sách phẳng).
--
-- Trước đây mọi file gắn vào SP đổ chung 1 rổ "Tài liệu kỹ thuật" — không biết
-- đâu là bản vẽ, đâu là BOM, đâu là hướng dẫn lắp ráp. Thêm `doc_type` để tách
-- mục rõ ràng ở cả lúc XEM lẫn lúc UPLOAD.
--
--   drawing  — bản vẽ kỹ thuật (CAD/PDF)
--   bom      — file BOM / bảng định mức (Excel)
--   assembly — hướng dẫn lắp ráp
--   image    — ảnh sản phẩm (1 ảnh được đặt làm ảnh đại diện qua image_file_id)
--   cert     — chứng chỉ / test report (FSC, BSCI, kiểm nghiệm…)
--   other    — khác
--
-- NULL = file cũ chưa phân loại → UI xếp vào "Khác". Không mất dữ liệu.
-- Cột dùng chung cho mọi parent (không riêng product) — sau này quote/PO tái dùng.
--
-- RLS: không đổi (files đã ENABLED, no policies từ 0006).
-- Idempotent: add column if not exists + drop/create lại constraint.
-- Apply: `npx supabase db push` hoặc SQL editor. Sau đó "sync types".

alter table public.files
  add column if not exists doc_type text;

alter table public.files drop constraint if exists files_doc_type_valid;
alter table public.files
  add constraint files_doc_type_valid check (
    doc_type is null
    or doc_type in ('drawing', 'bom', 'assembly', 'image', 'cert', 'other')
  );

-- Lọc file theo loại trong 1 hồ sơ (vd bản vẽ của 1 SP).
create index if not exists files_product_doc_type_idx
  on public.files (product_id, doc_type)
  where product_id is not null and deleted_at is null;
