-- 0279: MUA TRÊN SÀN TMĐT (Shopee, Lazada, TikTok Shop…) — dùng lại ĐƠN MUA, không đẻ chứng từ mới.
--
-- Đo 26/10/2026: 0 NCC / đơn / phiếu nhập / đề nghị mua nào nhắc shopee, lazada,
-- tiki, online, mua lẻ, tiền mặt — mua sàn đang nằm NGOÀI ERP hoàn toàn. User chốt
-- cùng ngày: chỉ Cung ứng mua sàn; vẫn qua GĐ duyệt (không ngưỡng miễn); trả bằng
-- TK/thẻ công ty, nhân viên ứng, hoặc COD; không bắt hoá đơn GTGT nhưng thiếu thì
-- phải đánh dấu; hàng LUÔN qua Kho.
--
-- Mỗi con số MỘT nguồn (không cột suy ra):
--   * "Đơn này mua trên sàn" = NCC của đơn là sàn → `supply_suppliers.is_marketplace`.
--     Không thêm cột kênh trên đơn: hai nơi cùng nói một điều là hai nơi lệch nhau.
--   * Mã đơn sàn → `supply_purchase_orders.supplier_doc_no` (cột số tờ NCC đang có).
--   * Đã trả trước bao nhiêu / hoàn lại bao nhiêu → dòng `accounting_supplier_payments`
--     gắn `po_id`; KHÔNG có cột prepaid_amount trên đơn.
--   * "Đã có hoá đơn" → có hoá đơn NCC (0188) nối dòng đơn; chỉ lưu điều KHÔNG suy ra
--     được: đơn này KHÔNG có hoá đơn và vì sao (`invoice_waived_reason`).
--
-- Thêm:
--   1) supply_suppliers.is_marketplace — hồ sơ NCC là một SÀN (một hồ sơ mỗi sàn).
--   2) supply_purchase_orders.marketplace_shop / marketplace_tracking_no — tên shop
--      (gõ tự do, shop đổi theo từng lần mua) và mã vận đơn để Kho khớp kiện.
--   3) supply_purchase_orders.invoice_waived_reason — có chữ = đơn không có hoá đơn GTGT.
--   4) accounting_supplier_payments.kind ('payment' | 'refund') — sàn hoàn tiền khi
--      shop huỷ / trả hàng. Giữ check amount > 0: dấu nằm ở `kind`, không ở số.
--   5) accounting_supplier_payments.paid_by_user_id + reimbursed_at — nhân viên ứng
--      tiền riêng và lúc công ty đã hoàn ứng cho người đó.
--
-- RLS: không đổi (chỉ thêm cột vào bảng đã enable RLS, không policy). Idempotent.
-- Apply xong: sync types (`src/lib/database.types.ts`).

alter table public.supply_suppliers
  add column if not exists is_marketplace boolean not null default false;

comment on column public.supply_suppliers.is_marketplace is
  'Hồ sơ là một SÀN TMĐT (Shopee, Lazada…) — đơn của NCC này là đơn mua trên sàn (0278)';

alter table public.supply_purchase_orders
  add column if not exists marketplace_shop text
    check (marketplace_shop is null or char_length(marketplace_shop) <= 200),
  add column if not exists marketplace_tracking_no text
    check (marketplace_tracking_no is null or char_length(marketplace_tracking_no) <= 100),
  add column if not exists invoice_waived_reason text
    check (invoice_waived_reason is null or char_length(invoice_waived_reason) <= 500);

comment on column public.supply_purchase_orders.marketplace_shop is
  'Đơn mua trên sàn: tên shop bán (gõ tự do) — NCC của đơn là hồ sơ sàn (0278)';
comment on column public.supply_purchase_orders.marketplace_tracking_no is
  'Đơn mua trên sàn: mã vận đơn để Kho khớp kiện (0278)';
comment on column public.supply_purchase_orders.invoice_waived_reason is
  'Có chữ = đơn KHÔNG có hoá đơn GTGT, kèm lý do; trống = cần hoá đơn (0278)';

alter table public.accounting_supplier_payments
  add column if not exists kind text not null default 'payment'
    check (kind in ('payment', 'refund')),
  add column if not exists paid_by_user_id uuid
    references public.users(id) on delete set null,
  add column if not exists reimbursed_at timestamptz;

comment on column public.accounting_supplier_payments.kind is
  'payment = trả NCC; refund = NCC/sàn hoàn tiền về (trừ vào số đã trả). amount luôn > 0 (0278)';
comment on column public.accounting_supplier_payments.paid_by_user_id is
  'Nhân viên ứng tiền riêng trả hộ (mua sàn) — trống = công ty trả (0278)';
comment on column public.accounting_supplier_payments.reimbursed_at is
  'Lúc công ty đã hoàn ứng cho paid_by_user_id; trống mà có paid_by = còn nợ nhân viên (0278)';

-- (po_id đã có index `accounting_supplier_payments_po_idx` từ 0167.)
create index if not exists accounting_supplier_payments_unreimbursed_idx
  on public.accounting_supplier_payments (paid_by_user_id)
  where paid_by_user_id is not null and reimbursed_at is null;
