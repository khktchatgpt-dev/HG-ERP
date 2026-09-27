-- 0214 — KHÔI PHỤC danh sách loại tài liệu mà 0213 làm rơi.
--
-- 0213 (27/09/2026) thêm năm loại chứng từ NCC nhưng viết lại ràng buộc từ bản
-- 0150 cũ, nên LÀM RƠI năm loại 0180 đã mở: sample_photo, label, loading,
-- approval, video. Không hỏng dữ liệu (lúc áp không file nào mang năm loại đó —
-- ràng buộc mới vẫn qua), nhưng từ đó tải file theo năm loại này sẽ bị chặn.
-- Bản này ghép ĐỦ: 12 loại của 0180 (khớp `DOC_TYPES` ở src/lib/file-limits.ts)
-- + 5 loại chứng từ NCC của 0213.
--
-- Bài học: sửa ràng buộc CHECK dạng danh sách thì đọc ràng buộc ĐANG CHẠY
-- (`pg_get_constraintdef`), không chép từ migration cũ nhất tìm thấy.
--
-- RLS không đổi (files đã ENABLE từ trước). Idempotent.

alter table public.files drop constraint if exists files_doc_type_valid;
alter table public.files
  add constraint files_doc_type_valid check (
    doc_type is null
    or doc_type in (
      'drawing', 'bom', 'packing', 'assembly', 'image', 'sample_photo', 'label',
      'loading', 'cert', 'approval', 'video', 'other',
      'quote', 'po_confirm', 'contract', 'delivery_note', 'invoice'
    )
  );
