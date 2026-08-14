-- Storage: nâng file_size_limit của bucket 20MB → 50MB (khớp MAX_UPLOAD_BYTES mới).
--
-- Bối cảnh: user yêu cầu "bỏ giới hạn upload file trên hồ sơ sản phẩm"
-- (14/08/2026). Không có mức thật sự vô hạn — Storage luôn chặn ở hai tầng:
-- file_size_limit của bucket VÀ trần global của project (Settings → Storage,
-- gói Free = 50MB và không nâng được). Nên "bỏ giới hạn" ở đây = đẩy trần app
-- lên đúng bằng trần global: mọi doc_type trong @/lib/file-limits thành 50MB
-- (trước: ảnh SP 5MB, bản vẽ/lắp ráp 20MB, còn lại 10MB).
--
-- CƠ CHẾ tách trần theo doc_type GIỮ NGUYÊN, chỉ đổi số. Hiện mọi loại bằng
-- nhau nên phần chênh giữa bucket và app = 0, nhưng bước đo ở
-- filesService.finalize (storage.info() → so DOC_TYPE_MAX_BYTES → quá thì xoá
-- object + soft-delete row) VẪN CẦN: size_bytes lúc initUpload là số client tự
-- khai, client hoàn toàn có thể khai 1MB rồi PUT 500MB.
--
-- NẾU MUỐN CAO HƠN 50MB: phải lên gói Pro rồi nâng "Upload file size limit"
-- trong Dashboard TRƯỚC, sau đó mới sửa migration này + DOC_TYPE_MAX_BYTES.
-- Đặt bucket vượt trần global thì upload trả 413 dù DB nhận giá trị.
--
-- RLS: không đụng tới. App dùng secret key (service role) → bỏ qua RLS
-- storage.objects, buckets vẫn private trừ 'public' (giữ nguyên như 0031).
--
-- Idempotent: update theo id, chạy lại bao nhiêu lần cũng ra cùng kết quả.

update storage.buckets
set file_size_limit = 52428800 -- 50 MB = 50 * 1024 * 1024
where id in ('private', 'attachments', 'public');
