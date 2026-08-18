-- 0153 — PNK nối ĐỢT GIAO (docs/plan-po-giao-nhan.md GĐ2).
--
-- Kho nhận hàng theo đợt NCC đã hẹn (0152): phiếu nhập ghi rõ nhận cho đợt nào
-- để (1) form prefill đúng số NCC chở hôm nay thay vì toàn bộ phần thiếu cả
-- đơn, (2) đối chiếu NCC-giao / thực-nhận / chênh theo từng đợt, (3) đợt tự
-- chuyển 'received' khi các dòng của nó nhận đủ.
--
-- NULL = phiếu không theo đợt (NCC giao đột xuất, đơn cũ trước 0152, mua ngoài)
-- — flow cũ chạy y nguyên, không ép. `on delete set null`: xoá đợt không được
-- kéo đổ chứng từ kho — phiếu là sự thật kế toán, đợt chỉ là kế hoạch.
--
-- RLS: bảng warehouse_docs đã bật từ 0017, thêm cột không đổi tư thế.
-- Idempotent.

alter table public.warehouse_docs
  add column if not exists shipment_id uuid
    references public.supply_po_shipments(id) on delete set null;

create index if not exists warehouse_docs_shipment_idx
  on public.warehouse_docs (shipment_id)
  where shipment_id is not null;
