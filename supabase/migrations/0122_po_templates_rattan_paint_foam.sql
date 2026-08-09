-- Cung ứng: 3 MẪU ĐƠN ĐẶT HÀNG MỚI — rattan (dây mây/rope), paint (sơn/hoá
-- chất), foam (mút/xốp/ván ép).
--
-- Rà thư mục "Hợp đồng mua hàng" trên Drive Cung ứng (08/08/2026): mây 7 đơn
-- (Vipora…), sơn 6 đơn (Green Coatings…), mút-xốp 4 đơn (Hà Bắc…). Cả ba tính
-- SL × đơn giá nhưng mỗi loại một bộ điều khoản (mây: VAT 10% + bảo hành UV;
-- sơn: VAT 8% + công nợ 30 ngày + đã gồm vận chuyển; mút: công nợ 14 ngày +
-- bốc tại kho) — trước nay dồn vào mẫu 'simple' trống điều khoản, gõ tay mỗi
-- lần. Meta/điều khoản/bộ cột nằm ở code (po-template.ts + po-fields.ts).
--
-- 1) Mở check constraint po_template nhận 3 giá trị mới.
-- 2) Backfill po_template theo nhóm + tên cho vật tư đang mang 'simple'
--    ('simple' là giá trị máy gán mặc định ở 0107, chưa ai chọn tay).
--
-- RLS: không đổi. Idempotent. Apply xong KHÔNG cần sync types (text column).

alter table public.warehouse_materials
  drop constraint if exists warehouse_materials_po_template_check;

alter table public.warehouse_materials
  add constraint warehouse_materials_po_template_check
  check (po_template is null
         or po_template in ('accessory', 'aluminium', 'metal_kg', 'carton',
                            'rattan', 'paint', 'foam', 'simple'));

-- Dây mây / rope — nhóm vải-mây hoặc tên có mây/rope.
update public.warehouse_materials set po_template = 'rattan'
where po_template = 'simple'
  and (name ilike '%mây%' or name ilike '%rope%');

-- Sơn / hoá chất — theo nhóm; kèm tên cho vật tư lạc nhóm.
update public.warehouse_materials set po_template = 'paint'
where po_template = 'simple'
  and (group_name ilike '%sơn%' or group_name ilike '%hoá chất%'
       or group_name ilike '%hóa chất%'
       or name ilike 'sơn %' or name ilike '%hoá chất%' or name ilike '%hóa chất%'
       or name ilike '%dung môi%' or name ilike '%cromate%');

-- Mút / xốp / ván ép — theo nhóm mút-xốp; ván ép nằm bên nhóm gỗ nên bắt theo tên.
update public.warehouse_materials set po_template = 'foam'
where po_template = 'simple'
  and (group_name ilike '%mút%' or group_name ilike '%xốp%'
       or name ilike '%ván ép%' or name ilike '%foam%' or name ilike '%màng pe%');
