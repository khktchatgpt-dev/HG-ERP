-- 0080_po_line_status_returns.sql — Trả hàng NCC (hoàn thiện nghiệp vụ ⑤)
--
-- View supply_po_line_status (BR-08) tính thêm HÀNG TRẢ NCC: movement
-- direction='out' gắn po_line_id (phiếu xuất kind='issue', ref_type='po')
-- TRỪ vào qty_received → qty_missing tăng lại → PO 'received' quay về
-- 'partial' (NCC giao bù). Không thêm bảng/enum mới: trả NCC = phiếu xuất
-- 02-VT bình thường, dấu vết nằm ở po_line_id + direction.
--
--   qty_received = Σ nhập (đạt + QC loại) − Σ xuất trả   (cùng po_line_id)
--   qty_missing  = đặt − qty_received
--
-- RLS: view giữ security_invoker = on. Idempotent: create or replace.

create or replace view public.supply_po_line_status with (security_invoker = on) as
select
  l.id,
  l.po_id,
  l.material_id,
  l.qty_ordered,
  l.unit_price,
  l.spec,
  l.qty2,
  l.unit2,
  l.note,
  l.sort_order,
  coalesce(sum(case when mv.direction = 'in' then mv.qty + mv.qty_rejected
                    else -mv.qty end), 0)                       as qty_received,
  coalesce(sum(case when mv.direction = 'in' then mv.qty_rejected
                    else 0 end), 0)                             as qty_rejected,
  l.qty_ordered
    - coalesce(sum(case when mv.direction = 'in' then mv.qty + mv.qty_rejected
                        else -mv.qty end), 0)                   as qty_missing
from public.supply_purchase_order_lines l
left join public.warehouse_movements mv
  on mv.po_line_id = l.id
group by l.id;
