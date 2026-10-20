-- LÝ DO XUẤT CÓ MÃ — `warehouse_docs.reason_code`.
--
-- VÌ SAO. Lý do xuất quyết định TIỀN ĐI VỀ ĐÂU: cấp cho sản xuất vào giá thành
-- lệnh, sửa máy / dùng nội bộ là chi phí chung, huỷ là tổn thất. Ô chữ tự do
-- (`reason`) không nhóm được — hai người gõ "cấp SX" và "xuất cho tổ phôi" là
-- cùng một việc mà báo cáo đếm thành hai loại, và kế toán cuối kỳ phải đọc từng
-- phiếu đoán ý. Đây đúng việc SAP dùng movement type để làm (261 / 201 / 551).
--
-- `reason` GIỮ NGUYÊN, không thay: mã nói LOẠI, chữ nói CHI TIẾT ("hỏng do ẩm
-- kho B"). Bỏ ô chữ là mất phần duy nhất người sau đọc hiểu được.
--
-- KHÔNG ĐẶT CHECK CONSTRAINT, cùng lối với `doc_counters.kind` (0011): thêm một
-- lý do mới là sửa danh sách ở `lib/ly-do-xuat.ts`, không phải chạy migration.
-- Zod ở biên API giữ hàng rào, và tầng hiển thị trả về chính mã khi gặp mã lạ
-- nên dữ liệu cũ không làm vỡ màn.
--
-- RLS: `warehouse_docs` đã bật RLS không policy — thêm cột không đổi tư thế đó.

alter table public.warehouse_docs
  add column if not exists reason_code text;

create index if not exists warehouse_docs_reason_code_idx
  on public.warehouse_docs (reason_code)
  where reason_code is not null;

comment on column public.warehouse_docs.reason_code is
  'Mã lý do xuất (lib/ly-do-xuat.ts): sx · bu-hao · sua-may · mau · noi-bo · huy · khac. Null = phiếu cũ hoặc không phải phiếu xuất. Cột `reason` giữ phần diễn giải tự do.';
