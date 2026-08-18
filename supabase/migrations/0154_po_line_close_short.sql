-- 0154 — CHỐT PHẦN THIẾU trên dòng đơn đặt (docs/plan-cung-ung-kho-hoan-thien.md GĐ A).
--
-- BỐI CẢNH: NCC giao 98/100 rồi báo "hết hàng, không giao nữa" là chuyện thường.
-- Trước 0154 không có đường ghi lại quyết định ấy: refreshStatusFromReceipts đòi
-- MỌI dòng qty_missing ≤ 0 nên đơn kẹt 'partial' vĩnh viễn, phần thiếu vẫn đè
-- lên "đã đặt" của đề xuất mua (không giục mua chỗ khác), đơn rác ở "Hàng sắp
-- về" và màn Nhập kho.
--
-- THIẾT KẾ: Cung ứng (người phụ trách đơn — luật 0128) tuyên bố "phần còn lại
-- không về nữa" trên TỪNG DÒNG, kèm lý do. KHÔNG sửa số đã nhận (BR-08 giữ
-- nguyên chủ quyền sổ kho); chỉ đổi cách TÍNH "còn chờ về":
--
--   qty_missing  GIỮ NGUYÊN NGHĨA — thiếu THẬT so với đặt (đối chiếu, in ấn).
--   qty_open     MỚI — phần còn CHỜ VỀ: = max(qty_missing, 0), riêng dòng đã
--                chốt thiếu = 0. Mọi chỗ hỏi "còn chờ bao nhiêu" (trạng thái
--                đơn, đề xuất mua, prefill PNK, Hàng sắp về) đọc cột này.
--
-- View giữ NGUYÊN thân 0134 (kg_received, last_received_at, lọc dòng tự do) +
-- 2 cột MỚI Ở CUỐI (create or replace chỉ được thêm cột cuối).
--
-- RLS: bảng đã enable từ trước, view giữ security_invoker = on. Idempotent.
-- Apply: SQL editor / MCP apply_migration (CLI lỗi IPv6) → chạy skill sync-types.

alter table public.supply_purchase_order_lines
  add column if not exists closed_short_at     timestamptz,
  add column if not exists closed_short_by     uuid references public.users(id) on delete set null,
  add column if not exists closed_short_reason text;

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
                        else -mv.qty end), 0)                   as qty_missing,
  coalesce(sum(case when mv.direction = 'in' then mv.qty2_actual
                    else -mv.qty2_actual end), 0)               as kg_received,
  max(mv.created_at) filter (where mv.direction = 'in')         as last_received_at,
  l.closed_short_at,
  greatest(
    case when l.closed_short_at is not null then 0
         else l.qty_ordered
                - coalesce(sum(case when mv.direction = 'in' then mv.qty + mv.qty_rejected
                                    else -mv.qty end), 0)
    end, 0)                                                     as qty_open
from public.supply_purchase_order_lines l
left join public.warehouse_movements mv
  on mv.po_line_id = l.id
where l.material_id is not null
group by l.id;
