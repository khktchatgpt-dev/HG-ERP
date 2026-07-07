-- Kỹ thuật: ảnh đại diện sản phẩm — in kèm hình trên báo giá/LSX (mẫu in thật
-- có cột Picture; gap đã ghi ở db-design-inputs-analysis.md).
--
-- image_file_id trỏ vào public.files (file ảnh đã upload theo SP). on delete
-- set null: xoá file thì SP chỉ mất ảnh đại diện, không mất SP.
--
-- RLS: không đổi posture. Apply: `npx supabase db push` hoặc SQL editor,
-- sau đó "sync types".

alter table public.technical_products
  add column if not exists image_file_id uuid
    references public.files(id) on delete set null;
