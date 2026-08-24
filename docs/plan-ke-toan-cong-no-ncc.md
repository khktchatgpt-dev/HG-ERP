# Kế hoạch: Công nợ nhà cung cấp (GĐ C.1 — plan-go-live-erp)

> Soạn 23/08/2026. Trạng thái: **✅ XONG C.1 cùng ngày** — 0167 đã apply
> remote + sync types, `npm run check` sạch (1520 test), API smoke 200.
>
> Ghi nhận khi làm: remote hiện có 7 movements, KHÔNG dòng nào gắn PO/giá và
> 0 PO received — tức Kho/Cung ứng cũng CHƯA go-live dữ liệu thật. Sổ công nợ
> đang trống là ĐÚNG; phiếu nhập có giá đầu tiên được ghi là số tự chảy vào.
> Không seed số liệu tiền bạc giả vào DB thật — nghiệm thu bằng unit test
> (cấn trừ đảo, tách tiền tệ, trả trước âm, cờ thiếu giá) + smoke API.

## Nghiệp vụ & quyết định thiết kế

1. **Nợ phát sinh theo PHIẾU NHẬP KHO, không theo PO.** Căn cứ nợ là hàng ĐÃ
   NHẬN: `warehouse_movements` có `unit_cost` per dòng (0161 Kho thấy giá) +
   `po_line_id` → PO → NCC. Giá trị nhận = Σ(qty × unit_cost). PO đặt mà chưa
   nhận thì CHƯA phải nợ.
2. **Phiếu ĐẢO tự cấn trừ**: movement chiều `out` mang `po_line_id` (chỉ phiếu
   đảo/hoàn có) tính DẤU ÂM — cộng đại số là ra nợ ròng, không cần bảng nợ
   riêng. KHÔNG lưu cứng số phát sinh (cùng triết lý tồn kho = view từ
   movements).
3. **Chỉ movement có `po_line_id` + `unit_cost`** vào công nợ. Nhập không qua
   PO (kiểm kê, điều chỉnh, hoàn SX) không phải nợ NCC. PO đã nhận mà movement
   thiếu `unit_cost` → cảnh báo "phiếu chưa có giá" chứ không ra 0 im lặng.
4. **Thanh toán = bảng mới `accounting_supplier_payments`** (0167): per NCC,
   gắn PO tuỳ chọn, `amount + currency + paid_on + method/ref_no`. Còn nợ =
   phát sinh − đã trả, tách theo TIỀN TỆ (USD/VND không cộng lẫn — bài học
   0134).
5. **VAT**: `unit_cost` là giá đang ghi trên phiếu (theo giá PO). GĐ này công
   nợ theo giá phiếu as-is; tách VAT/hoá đơn đỏ để GĐ C.1b (nối
   `accounting_invoices` có sẵn) — ghi rõ trên màn.
6. **Hạn thanh toán**: `supply_suppliers.payment_terms` là TEXT tự do → GĐ này
   chỉ HIỂN THỊ terms cạnh NCC; cảnh báo đến hạn cần cột ngày có cấu trúc —
   để GĐ C.1b, đừng đoán ngày từ text.
7. **Quyền**: action mới `accounting.payable.view/manage` — rule
   `perm('accounting.member')` như invoices. Kho/Cung ứng không mở được sổ nợ.

## Việc

- Migration `0167_accounting_supplier_payments.sql` (RLS no policies,
  set_updated_at, idempotent).
- RBAC: 2 action mới.
- Module: `payables.repo.ts` (movements nhận theo NCC + CRUD payments),
  `payables.service.ts` (gộp thuần `summarizePayables` — CÓ TEST: cấn trừ
  in/out, tách tiền tệ, trừ đã trả, cờ thiếu giá).
- Routes mỏng: `GET /api/dept/accounting/payables`,
  `GET /api/dept/accounting/payables/[supplierId]`,
  `POST /api/dept/accounting/payments`, `DELETE /api/dept/accounting/payments/[id]`
  (xoá: người ghi hoặc QL — pattern sổ SX).
- UI `/finance/cong-no-ncc` (ERP kit): bảng per NCC (phát sinh / đã trả / còn
  nợ per tiền tệ, terms), bấm dòng → chi tiết per PO + lịch sử thanh toán +
  form ghi thanh toán. Nav thêm mục "Công nợ NCC".

## Ngoài phạm vi đợt này (C.1b+)

Đối chiếu hoá đơn đỏ với phiếu nhập (3-way match), hạn thanh toán có cấu trúc
+ cảnh báo đến hạn, bù trừ tiền tệ/tỷ giá, công nợ khách (C.2), in biên bản
đối chiếu công nợ.
