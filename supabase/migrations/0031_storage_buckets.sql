-- Storage: tạo 3 bucket app dùng (files.schema FILE_BUCKETS).
--
-- Trước đây chưa tạo bucket nào → mọi upload (ảnh SP, file đơn/báo giá/LSX, tài
-- liệu kỹ thuật) lỗi 500 "The related resource does not exist" tại
-- createSignedUploadUrl. Tạo bucket để upload/download (qua signed URL) hoạt động.
--
--   - private     : file nội bộ (không public) — tải qua signed URL.
--   - attachments : mặc định của app (ảnh SP, file chứng từ) — private, signed URL.
--   - public      : chỉ ảnh, truy cập công khai.
--
-- App truy cập Storage bằng secret key (service role) → BỎ QUA RLS storage.objects,
-- nên không cần policy. Giới hạn 10MB (khớp MAX_UPLOAD_BYTES ở API).
-- Idempotent: on conflict do nothing.

insert into storage.buckets (id, name, public, file_size_limit)
values
  ('private', 'private', false, 10485760),
  ('attachments', 'attachments', false, 10485760),
  ('public', 'public', true, 10485760)
on conflict (id) do nothing;
