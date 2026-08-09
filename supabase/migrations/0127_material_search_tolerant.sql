-- 0127: TÌM VẬT TƯ KHÔNG DẤU (như 0098 đã làm cho sản phẩm).
--
-- Ô tìm vật tư của form đặt hàng dùng ilike CÓ phân biệt dấu: nhân viên đang
-- vội gõ "vit 4x15" (không dấu — kiểu gõ thật) là trắng tay dù danh mục có
-- "Vít 4x15". Với 13k mã, đây là ma sát mỗi-phút-một-lần (bất cập #3, 09/08).
--
-- Cùng công thức 0098: cột generated `search_text` hạ thường + bỏ dấu (hàm
-- immutable_unaccent đã tạo ở 0098), gộp mã + tên + barcode + quy cách + nhóm
-- phụ; chỉ mục trigram GIN. App AND từng từ khoá bằng ilike trên cột này.
--
-- RLS: không tạo bảng mới, không đổi tư thế (bảng đã enable RLS không policy).
-- Idempotent: add column if not exists / create index if not exists.

alter table public.warehouse_materials
  add column if not exists search_text text
  generated always as (
    public.immutable_unaccent(
      lower(
        coalesce(code, '') || ' ' ||
        coalesce(name, '') || ' ' ||
        coalesce(barcode, '') || ' ' ||
        coalesce(spec, '') || ' ' ||
        coalesce(sub_group, '')
      )
    )
  ) stored;

create index if not exists warehouse_materials_search_trgm_idx
  on public.warehouse_materials using gin (search_text public.gin_trgm_ops);
