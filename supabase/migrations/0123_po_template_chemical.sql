-- Cung ứng: TÁCH mẫu HOÁ CHẤT khỏi mẫu sơn (rà đủ 18 đơn thật 08/08/2026).
--
-- Đọc trọn thư mục "Hợp đồng mua hàng" (6 mây, 5 sơn, 1 hoá chất, 4 mút/ván,
-- + 2 đã đọc trước): hoá chất Kiệm Tâm CÙNG kg × giá với sơn nhưng khác hẳn
-- điều khoản — công nợ chuyển khoản 30 ngày sau nhận hàng + hoá đơn GTGT
-- (sơn: trả trước), vận chuyển bên bán / dỡ hàng bên mua tách bạch, giao 2-3
-- ngày (sơn: chạy theo kế hoạch báo trước 5-7 ngày). Gộp chung một mẫu là in
-- sai điều khoản cho một trong hai loại.
--
-- 1) Mở check constraint nhận 'chemical'.
-- 2) Chuyển vật tư hoá chất đang mang 'paint' (backfill 0122) sang 'chemical'
--    theo tên — nhóm 'Sơn - dầu - keo - hoá chất' chứa lẫn cả hai loại.
--
-- RLS: không đổi. Idempotent. Không cần sync types (text column).

alter table public.warehouse_materials
  drop constraint if exists warehouse_materials_po_template_check;

alter table public.warehouse_materials
  add constraint warehouse_materials_po_template_check
  check (po_template is null
         or po_template in ('accessory', 'aluminium', 'metal_kg', 'carton',
                            'rattan', 'paint', 'chemical', 'foam', 'simple'));

update public.warehouse_materials set po_template = 'chemical'
where po_template = 'paint'
  and (name ilike '%hoá chất%' or name ilike '%hóa chất%'
       or name ilike '%cromate%' or name ilike '%thụ động%'
       or name ilike '%dung môi%' or name ilike '%tẩy dầu%'
       or name ilike '%phosphat%' or name ilike '%nano ph%');
