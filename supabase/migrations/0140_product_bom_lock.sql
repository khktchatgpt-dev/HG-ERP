-- KHOÁ HỒ SƠ SẢN PHẨM + chốt FILE BOM ĐANG DÙNG (user chốt 13/08/2026).
--
-- Vấn đề: Kỹ thuật đang cập nhật BOM; sắp tới mỗi SP sẽ có nhiều file BOM qua
-- các lần sửa, mà không có dấu hiệu nào nói bản nào là bản ĐÚNG. Người mua /
-- xưởng / kế toán mở hồ sơ ra không biết dùng file nào.
--
-- Mô hình user chốt (nhẹ, KHÔNG có bước duyệt hai người):
--   · `bom_checked_at/by`  — Kỹ thuật TỰ đánh dấu "BOM đã qua kiểm tra".
--   · `bom_file_id`        — file BOM ĐANG DÙNG của hồ sơ; UI làm nổi bật hẳn,
--                            các file BOM khác lùi về "bản cũ".
--   · `locked_at/by/note`  — KHOÁ hồ sơ: Kỹ thuật + Giám đốc khoá được, và MỞ
--                            LẠI được khi phát sinh (ghi vết lý do mở).
--     Khoá là khoá TOÀN BỘ hồ sơ SP (user chốt) — mọi trường + bảng định mức,
--     enforce ở service `assertUnlocked`.
--   · `unlocked_at/by/reason` — vết lần mở khoá gần nhất, để sau còn truy.
--
-- KHÔNG dùng lại `bom_status` (none/drawing/done): đó là nhãn tiến độ vẽ, ai
-- sửa cũng được, không mang nghĩa "bản này dùng được".
--
-- RLS: technical_products đã enable RLS no-policies từ 0012 (anon chặn, secret
-- key server bypass) — thêm cột không đổi tư thế. Idempotent.

alter table public.technical_products
  add column if not exists bom_checked_at timestamptz,
  add column if not exists bom_checked_by uuid references public.users (id) on delete set null,
  add column if not exists bom_file_id uuid references public.files (id) on delete set null,
  add column if not exists locked_at timestamptz,
  add column if not exists locked_by uuid references public.users (id) on delete set null,
  add column if not exists lock_note text,
  add column if not exists unlocked_at timestamptz,
  add column if not exists unlocked_by uuid references public.users (id) on delete set null,
  add column if not exists unlock_reason text;

comment on column public.technical_products.bom_file_id is
  'File BOM ĐANG DÙNG của hồ sơ — UI làm nổi bật; file BOM khác là bản cũ';
comment on column public.technical_products.locked_at is
  'Hồ sơ đã khoá: mọi sửa đổi (thuộc tính + định mức + file) bị chặn cho tới khi mở khoá';

-- Lọc nhanh "hồ sơ đã khoá" trên danh sách SP.
create index if not exists technical_products_locked_idx
  on public.technical_products (locked_at)
  where locked_at is not null;
