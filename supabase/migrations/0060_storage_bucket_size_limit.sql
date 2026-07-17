-- Storage: nâng file_size_limit của bucket 10MB → 20MB (khớp MAX_UPLOAD_BYTES mới).
--
-- Bối cảnh: giới hạn upload chuyển từ một mức phẳng 10MB sang tách theo doc_type
-- (@/lib/file-limits DOC_TYPE_MAX_BYTES): ảnh SP 5MB, bản vẽ/hướng dẫn lắp ráp
-- 20MB, còn lại 10MB. Quyết định là KHÔNG nén ảnh khi upload — bản vẽ là dữ liệu
-- gốc, nén mất chi tiết — nên bản vẽ scan A3 300dpi cần trần cao hơn 10MB cũ.
--
-- CẢNH BÁO: file_size_limit chỉ có MỘT giá trị cho cả bucket, không tách theo
-- doc_type được. Nâng lên 20MB tức là trần cứng của MỌI loại thành 20MB, kể cả
-- ảnh SP (chỉ được phép 5MB). Phần chênh đó KHÔNG do Storage giữ mà do
-- filesService.finalize: nó gọi storage.info() đo dung lượng THẬT của object rồi
-- so với DOC_TYPE_MAX_BYTES, quá thì xoá object + soft-delete row. Sở dĩ phải đo
-- lại vì size_bytes lúc initUpload là số client tự khai, không tin được.
-- => Nếu bỏ bước đo ở finalize, giới hạn theo loại chỉ còn là gợi ý UI.
--
-- RLS: không đụng tới. App dùng secret key (service role) → bỏ qua RLS
-- storage.objects, buckets vẫn private trừ 'public' (giữ nguyên như 0031).
--
-- Idempotent: update theo id, chạy lại bao nhiêu lần cũng ra cùng kết quả.

update storage.buckets
set file_size_limit = 20971520 -- 20 MB = 20 * 1024 * 1024
where id in ('private', 'attachments', 'public');
