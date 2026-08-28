-- 0174: production_components.group_code — chi tiết của lệnh biết mình thuộc
-- NHÓM VẬT TƯ nào (FRAME / WOOD / NGU_KIM / CUSHION / PACKAGING / ...).
--
-- VÌ SAO: bảng chi tiết của LSX là bản sao BOM ĐỊNH MỨC nên chứa cả vật tư mua
-- (đo 26/08/2026: 361/996 dòng là vít, bulong, nút nhựa). Tổ phôi không cắt con
-- vít, nhưng sổ sản lượng vẫn bày chúng ra để nhập — nhiễu 36% danh sách.
-- Hồ sơ SP bên Kỹ thuật ĐÃ phân nhóm (technical_product_parts.group_code); khi
-- sao sang lệnh thì bỏ lại. Migration này mang trường đó sang.
--
-- Cột để NULL được: dòng gõ tay không khớp định mức nào thì chưa có nhóm; tầng
-- ứng dụng coi null = "chưa phân nhóm", KHÔNG coi là hàng mua.
--
-- Backfill: khớp theo (product_id của dòng lệnh + tên chi tiết chuẩn hoá).
-- Đo trước khi chạy: 994/996 dòng khớp; 2 dòng còn lại để trống cho người soát.
--
-- RLS: bảng đã enable row level security (no policies) từ 0084 — không đổi.
-- Idempotent: add column if not exists + backfill chỉ ghi dòng đang null.

alter table public.production_components
  add column if not exists group_code text;

comment on column public.production_components.group_code is
  'Nhóm vật tư sao từ technical_product_parts.group_code (FRAME/WOOD/NGU_KIM/...). null = chưa phân nhóm.';

-- Lọc sổ sản lượng theo nhóm là truy vấn nóng nhất của module thống kê.
create index if not exists production_components_group_idx
  on public.production_components (production_order_id, group_code);

update public.production_components c
   set group_code = sub.g
  from (
    select c2.id,
           (select p.group_code
              from public.technical_product_parts p
             where p.product_id = l.product_id
               and lower(trim(p.part_name)) = lower(trim(c2.name))
             order by p.sort_order
             limit 1) as g
      from public.production_components c2
      join public.production_order_lines l
        on l.id = c2.production_order_line_id
  ) as sub
 where sub.id = c.id
   and sub.g is not null
   and c.group_code is null;
