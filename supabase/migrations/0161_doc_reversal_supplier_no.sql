-- 0161 — PHIẾU ĐẢO + SỐ CHỨNG TỪ NCC (plan-kho-nhap-xuat-go-live K1 + K3).
--
-- K1: gõ nhầm 1.000 thay vì 100 mà KHÔNG có đường sửa/huỷ — sổ lệch tới kỳ
-- kiểm kê và mất dấu vì sao. Chuẩn sổ kho: không sửa đè, không xoá — lập PHIẾU
-- ĐẢO ghi ngược toàn bộ movement của phiếu gốc. `reversal_of_doc_id` trỏ phiếu
-- gốc (một chiều — chiều "bị đảo bởi" suy khi đọc); phiếu đảo của PNK là phiếu
-- XUẤT và ngược lại, KHÔNG thêm kind mới. Mỗi phiếu chỉ đảo một lần, phiếu đảo
-- không đảo tiếp — service enforce.
--
-- K3: xe giao nào cũng kèm phiếu giao/hoá đơn CÓ SỐ của NCC — chìa khoá đối
-- chiếu 3 chiều với kế toán; trước giờ phải nhét vào ghi chú tự do.
--
-- RLS: bảng đã enable từ 0017. Idempotent. Apply xong sync types.

alter table public.warehouse_docs
  add column if not exists reversal_of_doc_id uuid
    references public.warehouse_docs(id) on delete set null,
  add column if not exists supplier_doc_no text;

create index if not exists warehouse_docs_reversal_idx
  on public.warehouse_docs (reversal_of_doc_id)
  where reversal_of_doc_id is not null;
