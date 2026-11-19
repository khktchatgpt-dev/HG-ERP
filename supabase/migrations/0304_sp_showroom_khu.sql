-- 0304_sp_showroom_khu.sql
-- Vị trí mẫu trong showroom ghi THẲNG trên hồ sơ SP (phiếu 101026 của PKD; bản
-- vẽ thẻ treo duyệt 19/11/2026, câu Q7). Trước đó vị trí chỉ nằm trong Ghi chú
-- ("Showroom: B2.") vì file Excel PKD rà showroom có cột riêng mà DB chưa có chỗ.
--
--   showroom_zone  — khu: A1, A2, B1, B2, C, K1, K2 (null = chưa ghi). In ở dải
--                    đầu thẻ treo; dùng cho Excel bản đồ vị trí.
--   showroom_shelf — dãy kệ, gõ tự do ("Kệ 3 – tầng 2"); chỉ có nghĩa ở A1/A2.
--
-- Dữ liệu: CHÉP khu từ dòng "Showroom: XX." trong Ghi chú (25 SP ghi 19/11).
-- KHÔNG xoá dòng đó khỏi Ghi chú ở migration này — mã đọc cột mới chưa lên main;
-- xoá trước là người dùng mất vị trí (bẫy "DB đi trước code" 26/10).
--
-- RLS: technical_products đã ENABLED no-policies từ 0012 — không đổi.
-- Idempotent: add column if not exists; ràng buộc drop-if-exists rồi add; update
-- chỉ chạm dòng còn trống khu.

alter table public.technical_products
  add column if not exists showroom_zone text,
  add column if not exists showroom_shelf text;

alter table public.technical_products
  drop constraint if exists technical_products_showroom_zone_check;
alter table public.technical_products
  add constraint technical_products_showroom_zone_check
  check (showroom_zone is null or showroom_zone in ('A1', 'A2', 'B1', 'B2', 'C', 'K1', 'K2'));

alter table public.technical_products
  drop constraint if exists technical_products_showroom_shelf_len;
alter table public.technical_products
  add constraint technical_products_showroom_shelf_len
  check (showroom_shelf is null or char_length(showroom_shelf) <= 60);

update public.technical_products
set showroom_zone = upper(substring(notes from 'Showroom:\s*(A1|A2|B1|B2|C|K1|K2)\M'))
where showroom_zone is null
  and notes ~ 'Showroom:\s*(A1|A2|B1|B2|C|K1|K2)\M';
