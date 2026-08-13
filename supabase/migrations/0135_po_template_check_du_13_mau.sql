-- Nới check `supply_purchase_orders.template` nhận ĐỦ 13 mẫu — sửa lỗi tiềm ẩn.
--
-- Vì sao: 0106 tạo cột template với check inline chỉ 5 giá trị (accessory,
-- aluminium, metal_kg, carton, simple). Các đợt thêm mẫu sau đó (0122 rattan/
-- paint/foam, 0123 chemical, 0129 mro, 0134 wood/glass/outsourcing) đều chỉ nới
-- check của `warehouse_materials.po_template` mà QUÊN check trên header đơn —
-- tạo đơn với 8 mẫu mới là DB từ chối thẳng ("violates check constraint
-- supply_purchase_orders_template_check"). Lộ ra khi smoke test 0134 chèn đơn
-- mẫu wood (12/08/2026); các mẫu 0122+ trước giờ chưa ai tạo đơn thật nên chưa
-- ai vấp.
--
-- Danh sách khớp PO_TEMPLATES trong src/lib/po-template.ts — thêm mẫu mới là
-- phải nới CẢ HAI check (bài học ghi ở đây).
--
-- RLS: không đổi. Idempotent. Không cần sync types (cột text).

alter table public.supply_purchase_orders
  drop constraint if exists supply_purchase_orders_template_check;

alter table public.supply_purchase_orders
  add constraint supply_purchase_orders_template_check
  check (template in ('accessory', 'aluminium', 'metal_kg', 'carton',
                      'rattan', 'paint', 'chemical', 'foam',
                      'glass', 'wood', 'outsourcing', 'mro', 'simple'));

-- Danh mục vật tư: nới cùng nhịp cho 3 mẫu 0134 (0129 đã có tới 'mro').
alter table public.warehouse_materials
  drop constraint if exists warehouse_materials_po_template_check;

alter table public.warehouse_materials
  add constraint warehouse_materials_po_template_check
  check (po_template is null
         or po_template in ('accessory', 'aluminium', 'metal_kg', 'carton',
                            'rattan', 'paint', 'chemical', 'foam',
                            'glass', 'wood', 'outsourcing', 'mro', 'simple'));
