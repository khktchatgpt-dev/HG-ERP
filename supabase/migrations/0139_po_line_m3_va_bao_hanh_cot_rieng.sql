-- Trả nợ 2 ca "mượn cột" nguy hiểm nhất trên dòng đơn đặt (đợt 3 cải thiện
-- vật tư — docs/vat-tu-ke-hoach-cai-thien-thiet-ke.md).
--
-- Vì sao: supply_purchase_order_lines tái dùng cột của mẫu khác cho rẻ, hai ca
-- SỐ ĐỔI CẢ ĐƠN VỊ theo mẫu:
--   · weight_per_unit  = kg/đơn vị (mẫu inox/sắt) NHƯNG = m³/SP (mẫu gỗ 0134)
--     — đổi mẫu một dòng gỗ sang inox là 0.045 m³ được đọc thành 0.045 kg;
--   · finish           = màu/bề mặt (kim loại/gỗ) NHƯNG = BẢO HÀNH (mẫu mro)
-- Báo cáo cộng theo cột các dòng này là cộng m³ vào kg mà không gì cảnh báo.
-- Tách cột đúng nghĩa; các ca mượn cột dạng text còn lại giữ, đã ghi ở
-- PO_SHARED_FIELD_MEANING (src/lib/po-fields.ts).
--
-- Backfill theo template của đầu đơn — thời điểm áp DB CHƯA có đơn nào
-- (supply_purchase_orders rỗng 13/08/2026) nên gần như no-op, để đây phòng máy
-- khác áp muộn khi đã có đơn thật.
--
-- RLS: bảng đã enable RLS no-policies từ 0106 (anon chặn, secret key bypass) —
-- thêm cột không đổi tư thế. Idempotent.

alter table public.supply_purchase_order_lines
  add column if not exists m3_per_unit numeric,
  add column if not exists warranty_text text;

comment on column public.supply_purchase_order_lines.m3_per_unit is
  'm³ mỗi SP — mẫu gỗ (trước 0139 mượn weight_per_unit; cột đó nay chỉ còn nghĩa kg/đơn vị)';
comment on column public.supply_purchase_order_lines.warranty_text is
  'Bảo hành — mẫu MRO (trước 0139 mượn finish; cột đó nay chỉ còn nghĩa màu/bề mặt)';

update public.supply_purchase_order_lines l
set m3_per_unit = l.weight_per_unit, weight_per_unit = null
from public.supply_purchase_orders po
where po.id = l.po_id and po.template = 'wood'
  and l.weight_per_unit is not null and l.m3_per_unit is null;

update public.supply_purchase_order_lines l
set warranty_text = l.finish, finish = null
from public.supply_purchase_orders po
where po.id = l.po_id and po.template = 'mro'
  and l.finish is not null and l.warranty_text is null;
