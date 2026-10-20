-- 0212 — DÒNG HOÁ ĐƠN NCC TRỎ VỀ PHẦN PHÍ MUA HÀNG NÓ ĐÒI (0211).
--
-- Chủ dự án chốt 26/09/2026 (bước 3 phí vận chuyển):
--   · Phiếu phí trả NHÀ XE → vào thẳng sổ 331 (phiếu là chứng từ của nhà xe).
--   · Phiếu phí mà người nhận là NCC CỦA ĐƠN → KHÔNG vào sổ thẳng; chờ hoá đơn
--     NCC. Nằm ở dải "Ngoài sổ" và được MỒI thành một dòng khi lập hoá đơn NCC.
--
-- Cột mới nối dòng hoá đơn với đúng phần phí của một đơn
-- (`supply_po_cost_allocations`). Không có nó thì không biết phần phí nào đã
-- được NCC đòi — dải "Ngoài sổ" sẽ đếm mãi, hoặc lần lập hoá đơn sau lại mồi
-- lần nữa → nợ hai lần. Dòng hàng vẫn nối qua `po_line_id` như cũ; một dòng chỉ
-- trỏ MỘT trong hai (hàng hoặc phí).
--
-- on delete set null: phần phí không bao giờ bị xoá (phiếu chỉ HUỶ, 0211); nếu
-- có dọn dữ liệu thử thì dòng hoá đơn vẫn còn, chỉ mất liên kết.
--
-- RLS: bảng đã ENABLE từ 0188, cột mới không đổi tư thế. Idempotent.

alter table public.accounting_supplier_invoice_lines
  add column if not exists po_cost_allocation_id uuid
    references public.supply_po_cost_allocations(id) on delete set null;

create index if not exists accounting_supplier_invoice_lines_cost_alloc_idx
  on public.accounting_supplier_invoice_lines (po_cost_allocation_id)
  where po_cost_allocation_id is not null;

alter table public.accounting_supplier_invoice_lines
  drop constraint if exists accounting_supplier_invoice_lines_hang_hoac_phi;
alter table public.accounting_supplier_invoice_lines
  add constraint accounting_supplier_invoice_lines_hang_hoac_phi
    check (po_line_id is null or po_cost_allocation_id is null);
