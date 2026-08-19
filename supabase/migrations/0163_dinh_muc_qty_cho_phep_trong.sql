-- ĐỊNH MỨC: cho phép dòng CHƯA CÓ SỐ LƯỢNG.
--
-- Vì sao: rất nhiều biểu mẫu BOM bỏ trống hẳn cột "Số lượng" — file
-- `BOM_MERXX_Ghế Xếp Chồng Tilos.xlsx` trống cả 11/11 dòng khung. Trước đây
-- `qty not null` buộc luồng "Tạo SP từ file BOM" phải VỨT những dòng đó đi, tức
-- mất sạch tên chi tiết · mã khuôn · ba kích thước mà máy đã đọc đúng, chỉ vì
-- thiếu một ô. User chốt 19/08/2026: giữ dòng lại, SL điền sau ở tab Định mức.
--
-- Ràng buộc `check (qty > 0)` GIỮ NGUYÊN và vẫn đúng: trong SQL `null > 0` là
-- null, mà CHECK chỉ chặn khi biểu thức trả FALSE — nên null lọt qua còn 0 và
-- số âm vẫn bị chặn. Không phải sửa gì thêm.
--
-- HỆ QUẢ phải biết: dòng thiếu SL KHÔNG được tính vào nhu cầu vật tư. View
-- `v_lsx_material_status` vốn dùng `sum(pp.qty * pol.qty)` — `sum` tự bỏ qua
-- null nên kết quả không sai, nhưng im lặng. Bản này thêm `pp.qty is not null`
-- vào mệnh đề where để ý đồ nằm rõ trong SQL chứ không phải một hiệu ứng phụ
-- của hàm tổng; tầng UI cảnh báo riêng cho người dùng.
--
-- RLS: không tạo bảng/view mới ngoài việc dựng lại view sẵn có — giữ nguyên
-- `security_invoker = on` và tư thế enable-no-policies của các bảng nguồn.
-- Idempotent: `drop ... if exists` + `alter column` là thao tác lặp lại được.
-- Sau khi áp: chạy "sync types" để `qty` thành nullable trong database.types.ts.

alter table public.technical_product_parts
  alter column qty drop not null;

comment on column public.technical_product_parts.qty is
  'Số lượng / 1 SP. NULL = file BOM chưa ghi, người dùng điền sau — dòng đó không vào nhu cầu vật tư.';

/* ── Dựng lại v_lsx_material_status — CHÉP NGUYÊN bản 0142, chỉ thêm một
 *    điều kiện. Không viết lại từ trí nhớ: lệch một dòng là hỏng nhu cầu vật
 *    tư của Cung ứng mà không ai thấy ngay. ─────────────────────────────── */

drop view if exists public.v_lsx_material_status;

create view public.v_lsx_material_status with (security_invoker = on) as
with bom as (
  -- (1) Định mức ĐÃ CHỐT của lệnh.
  select
    s.production_order_id,
    s.product_id,
    s.material_code,
    s.qty_per_unit
  from public.production_order_boms s
  union all
  -- (2) SP chưa có ảnh chụp (lệnh nháp/chờ duyệt, hoặc SP mới thêm vào lệnh
  --     đã phát) — đọc định mức sống, đúng như trước 0142.
  select
    pol.production_order_id,
    pol.product_id,
    pp.material_code,
    sum(pp.qty)
  from public.production_order_lines pol
  join public.technical_product_parts pp on pp.product_id = pol.product_id
  where pol.product_id is not null
    and pp.material_code is not null
    -- 0163: dòng định mức CHƯA CÓ số lượng thì không tính vào nhu cầu vật tư.
    -- `sum` vốn tự bỏ qua null; viết ra đây để ý đồ nằm trong SQL chứ không ẩn
    -- trong hành vi của hàm tổng.
    and pp.qty is not null
    and not exists (
      select 1
      from public.production_order_boms s2
      where s2.production_order_id = pol.production_order_id
        and s2.product_id = pol.product_id
    )
  group by pol.production_order_id, pol.product_id, pp.material_code
),
need as (
  select
    pol.production_order_id             as production_order_id,
    m.id                                as material_id,
    sum(b.qty_per_unit * pol.qty)       as qty_needed
  from public.production_order_lines pol
  join bom b
    on b.production_order_id = pol.production_order_id
   and b.product_id = pol.product_id
  join public.warehouse_materials m on m.code = b.material_code
  where pol.product_id is not null
  group by pol.production_order_id, m.id
),
issued as (
  select
    mv.production_order_id,
    mv.material_id,
    sum(mv.qty) as qty_issued
  from public.warehouse_movements mv
  where mv.direction = 'out'
    and mv.production_order_id is not null
  group by mv.production_order_id, mv.material_id
)
select
  coalesce(n.production_order_id, i.production_order_id) as production_order_id,
  coalesce(n.material_id, i.material_id)                 as material_id,
  m.code                                                 as material_code,
  m.name                                                 as material_name,
  m.unit                                                 as unit,
  coalesce(n.qty_needed, 0)                              as qty_needed,
  coalesce(i.qty_issued, 0)                              as qty_issued,
  coalesce(n.qty_needed, 0) - coalesce(i.qty_issued, 0)  as qty_remaining
from need n
full join issued i
  on i.production_order_id = n.production_order_id
 and i.material_id = n.material_id
join public.warehouse_materials m on m.id = coalesce(n.material_id, i.material_id);
