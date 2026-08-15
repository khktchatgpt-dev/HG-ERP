-- Hồ sơ SP: thêm loại tài liệu 'packing' — QUY CÁCH ĐÓNG GÓI / KÍCH THƯỚC.
--
-- Bối cảnh (15/08/2026): Kỹ thuật giữ bản đóng gói + kích thước SP dưới dạng
-- file PowerPoint (mỗi slide một SP, có ảnh minh hoạ cách xếp thùng). MIME
-- PowerPoint VỐN ĐÃ nằm trong allowlist (files.schema ALLOWED_MIME từ 0006), tức
-- upload được từ trước — nhưng không có mục nào để xếp, nên nó rơi vào "Khác" và
-- nằm lẫn với tài liệu tạp. Bản này mở một ngăn riêng cho nó.
--
-- Vòng đời doc_type sau bản này (xem 0059 cho gốc):
--   drawing · bom · packing ← MỚI · assembly · image · cert · other
--
-- Trần dung lượng: 50MB như mọi tài liệu không phải ảnh (xem @/lib/file-limits) —
-- file PowerPoint nhiều ảnh dễ vượt 20MB, siết nhỏ là chặn đúng thứ cần lưu.
--
-- RLS: không đổi (files đã ENABLED, no policies từ 0006).
-- Idempotent: drop/create lại constraint — chạy lại an toàn.
-- Sau khi áp: "sync types" (doc_type là text nên type không đổi, nhưng giữ nếp).

alter table public.files drop constraint if exists files_doc_type_valid;
alter table public.files
  add constraint files_doc_type_valid check (
    doc_type is null
    or doc_type in ('drawing', 'bom', 'packing', 'assembly', 'image', 'cert', 'other')
  );
