-- 0187: SỔ CÂN ĐỐI VẬT TƯ — nhu cầu từ lệnh sản xuất đối chiếu tồn kho và đơn mua.
--
-- VÌ SAO: đây là trục mà một ERP sản xuất phải có và HG-ERP đang thiếu hẳn.
-- Người mua hiện phải tự nhớ đang thiếu gì; hệ quả đo được 09/09/2026: 142 mã
-- vật tư đang thiếu cho 15 lệnh đang chạy (510.630 đơn vị) mà KHÔNG màn hình
-- nào trong 17 màn của phòng Cung ứng hiện ra con số đó.
--
-- Toàn bộ dữ liệu để tính đã có sẵn, không phải nhập thêm gì:
--   production_order_boms  (229 dòng, định mức đã chốt theo lệnh)
--   production_order_lines (226 dòng, sản lượng + hạn giao)
--   warehouse_stock        (tồn)
--   supply_po_line_status  (qty_open — đã đặt chưa nhận)
-- Nối bằng `material_code`: đo 210/210 mã trong định mức khớp mã kho (100%).
--
-- ═══ HAI VIEW, KHÔNG PHẢI MỘT ═══
--
-- `v_supply_demand` — NHU CẦU THUẦN, một dòng cho mỗi (lệnh × mã). Không trừ
-- tồn. Dùng để trả lời "lệnh này cần những gì".
--
-- `v_supply_balance` — CÂN ĐỐI, một dòng cho mỗi MÃ, gộp mọi lệnh đang chạy.
-- Đây mới là view dùng để quyết định mua.
--
-- Tách hai cái vì một BẪY SỐ HỌC: tồn kho là của CHUNG, không chia theo lệnh.
-- Nếu trừ tồn ngay ở mức (lệnh × mã) thì mã nào phục vụ 3 lệnh sẽ được trừ tồn
-- BA LẦN, và tổng "còn thiếu" ra nhỏ hơn thực tế — tức là bảo người mua đừng
-- mua trong khi đang thiếu thật. Phải gộp nhu cầu về mã TRƯỚC rồi mới trừ tồn
-- một lần duy nhất. Chia lượng tồn cho từng lệnh là bài toán GIỮ CHỖ
-- (reservation), chưa làm ở giai đoạn này.
--
-- ═══ VÌ SAO TÁCH `qty_incoming` VÀ `qty_drafted` ═══
--
-- Đo 09/09/2026: 137 dòng đơn còn mở thì 132 nằm trên đơn NHÁP và 5 trên đơn
-- CHỜ DUYỆT — không dòng nào đã cam kết. Gộp chung thành một cột "đang về" thì
-- sai một trong hai đường:
--   · tính cả nháp  → 345.210 đơn vị chưa ai duyệt bị đếm như hàng đang trên
--                     đường, người mua yên tâm rồi không mua nữa;
--   · bỏ hẳn nháp   → cột hiện 0, người mua gõ lại một đơn đã có sẵn trong nháp.
-- Nên tách: `qty_incoming` là hàng ĐÃ CAM KẾT (duyệt trở đi), `qty_drafted` là
-- hàng ĐÃ GÕ NHƯNG CHƯA CAM KẾT. Chỉ `qty_incoming` được trừ vào còn thiếu;
-- `qty_drafted` chỉ để cảnh báo "đã có nháp rồi, đừng gõ lại".
--
-- ═══ CAVEAT ═══
--
-- · Chỉ phủ những mã CÓ `material_code` trong định mức. Đo được: 807/4.203 dòng
--   định mức có mã (19,2%); phần còn lại là chi tiết kết cấu tả bằng quy cách
--   thép, cần một bảng quy đổi quy cách → mã cây thép mua mà nghiệp vụ chưa
--   chốt (quyết định #1, docs/cung-ung-redesign.md).
-- · `need_by` lấy từ `production_order_lines.ship_date` và mới có ở 132/210
--   dòng lệnh (63%); dòng thiếu hạn trả NULL, màn hình phải xếp chúng xuống
--   cuối chứ không coi là gấp nhất.
-- · Đây là NGÀY GIAO HÀNG của lệnh, chưa trừ thời gian sản xuất. Trừ lead time
--   là bước sau, khi nghiệp vụ chốt được thời gian từng công đoạn.
--
-- RLS: view, KHÔNG phải bảng — không bật RLS trực tiếp được. Cả hai khai
-- `security_invoker = on` để chúng chạy bằng quyền NGƯỜI GỌI, tức thừa hưởng
-- đúng tư thế RLS của các bảng nguồn (bật, không policy → anon bị chặn, secret
-- key của server bypass). Không có `security_invoker` thì view chạy bằng quyền
-- người TẠO và trở thành cửa hậu vòng qua RLS.
--
-- Idempotent: `create or replace view` — chạy lại bao nhiêu lần cũng được.

-- ═══════════════════════════════════════════════════════════════════════
-- 1. NHU CẦU THUẦN — một dòng cho mỗi (lệnh × mã)
-- ═══════════════════════════════════════════════════════════════════════
create or replace view public.v_supply_demand
with (security_invoker = on) as
select
  o.id                                as production_order_id,
  o.code                              as lsx_code,
  o.status                            as lsx_status,
  upper(btrim(b.material_code))       as material_code,
  m.id                                as material_id,
  m.name                              as material_name,
  m.unit                              as unit,
  -- Định mức trên một sản phẩm × sản lượng của chính dòng lệnh đó.
  sum(b.qty_per_unit * l.qty)         as qty_needed,
  -- Hạn sớm nhất trong các dòng lệnh dùng mã này. NULL khi chưa dòng nào có
  -- hạn giao — 37% dòng lệnh đang ở tình trạng đó.
  min(l.ship_date)                    as need_by
from public.production_order_boms b
join public.production_orders o
  on o.id = b.production_order_id
join public.production_order_lines l
  on l.production_order_id = b.production_order_id
 and l.product_id          = b.product_id
left join public.warehouse_materials m
  on upper(btrim(m.code)) = upper(btrim(b.material_code))
where o.status not in ('draft', 'cancelled')
  and nullif(btrim(b.material_code), '') is not null
group by o.id, o.code, o.status, upper(btrim(b.material_code)), m.id, m.name, m.unit;

comment on view public.v_supply_demand is
  'Nhu cầu vật tư thuần theo (lệnh sản xuất × mã vật tư). KHÔNG trừ tồn — xem v_supply_balance.';

-- ═══════════════════════════════════════════════════════════════════════
-- 2. CÂN ĐỐI — một dòng cho mỗi MÃ, gộp mọi lệnh đang chạy
-- ═══════════════════════════════════════════════════════════════════════
create or replace view public.v_supply_balance
with (security_invoker = on) as
with demand as (
  select
    material_code,
    -- `max(uuid)` không tồn tại trong Postgres. Mã vật tư ↔ id là 1:1 (khoá
    -- duy nhất trên `code`) nên lấy phần tử đầu là đủ và rẻ hơn ép kiểu qua text.
    (array_agg(material_id) filter (where material_id is not null))[1] as material_id,
    max(material_name)            as material_name,
    max(unit)                     as unit,
    sum(qty_needed)               as qty_needed,
    min(need_by)                  as need_by,
    count(*)                      as lsx_count,
    -- Danh sách lệnh để màn hình hiện cột "cho lệnh nào" mà không phải truy
    -- vấn thêm vòng nữa.
    array_agg(lsx_code order by need_by nulls last, lsx_code) as lsx_codes
  from public.v_supply_demand
  group by material_code
),
po as (
  -- Gộp lượng còn mở trên đơn mua, TÁCH đã cam kết với mới là nháp.
  select
    upper(btrim(wm.code)) as material_code,
    sum(s.qty_open) filter (
      where p.status in ('approved', 'ordered', 'confirmed', 'in_transit', 'partial')
    ) as qty_incoming,
    sum(s.qty_open) filter (
      where p.status in ('draft', 'pending_approval')
    ) as qty_drafted
  from public.supply_po_line_status s
  join public.supply_purchase_orders p on p.id = s.po_id
  join public.warehouse_materials wm   on wm.id = s.material_id
  where s.qty_open > 0
  group by upper(btrim(wm.code))
)
select
  d.material_code,
  d.material_id,
  d.material_name,
  d.unit,
  d.qty_needed,
  coalesce(st.on_hand, 0)                as qty_on_hand,
  coalesce(po.qty_incoming, 0)           as qty_incoming,
  coalesce(po.qty_drafted, 0)            as qty_drafted,
  -- CÒN THIẾU. Chỉ trừ hàng ĐÃ CAM KẾT; nháp không được trừ (xem header).
  -- Kẹp sàn 0: mua dư không phải là "thiếu âm", và số âm trên cột này làm
  -- người đọc tưởng hệ thống tính sai.
  greatest(
    d.qty_needed - coalesce(st.on_hand, 0) - coalesce(po.qty_incoming, 0),
    0
  )                                      as qty_short,
  d.need_by,
  d.lsx_count,
  d.lsx_codes
from demand d
left join public.warehouse_stock st
  on upper(btrim(st.code)) = d.material_code
left join po
  on po.material_code = d.material_code;

comment on view public.v_supply_balance is
  'Sổ cân đối vật tư: cần / có / đang về (đã cam kết) / đã gõ trên nháp / còn thiếu, một dòng mỗi mã. Tồn trừ MỘT LẦN sau khi gộp nhu cầu về mã.';
