-- Storage: bật allowed_mime_types cho 3 bucket — TẦNG CHẶN ĐỘC LẬP với app.
--
-- Bối cảnh (15/08/2026): allowlist kiểu file tới nay chỉ nằm ở mã ứng dụng
-- (`ALLOWED_MIME` trong @/lib/file-limits, gác ở files.service). Nghĩa là toàn
-- bộ việc chặn dựa vào MỘT tầng duy nhất; ứng dụng hở một chỗ là Storage nhận
-- tuốt, vì bucket đang để `allowed_mime_types = null` (nhận mọi thứ).
--
-- Đáng nói hơn: client PUT thẳng lên Storage bằng signed upload URL, và
-- content-type của lần PUT đó KHÔNG bắt buộc trùng với mime đã khai lúc init.
-- Sau bản này Storage tự từ chối PUT có content-type ngoài danh sách.
--
-- Danh sách phải KHỚP `ALLOWED_MIME`. Lệch nhau thì upload chết ở tầng Storage
-- với lỗi khó đọc, nên sửa một bên là phải sửa bên kia — có test canh
-- (file-signature.test.ts giữ hai allowlist nói cùng một điều).
--
-- image/svg+xml CỐ Ý KHÔNG có: SVG chạy được <script> và signed URL trỏ thẳng
-- host Supabase. Kho có đúng 0 file SVG lúc bỏ nên không mất dữ liệu nào.
--
-- Bucket 'public' chỉ chứa ảnh đại diện (png/jpeg/webp — xem account.schema),
-- nên siết riêng, chặt hơn hai bucket kia.
--
-- RLS: không đụng. Idempotent: update theo id. KHÔNG ảnh hưởng file đã có —
-- allowed_mime_types chỉ soát lúc upload mới.

update storage.buckets
set allowed_mime_types = array[
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
  'application/json',
  'application/zip'
]
where id in ('private', 'attachments');

update storage.buckets
set allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp']
where id = 'public';
