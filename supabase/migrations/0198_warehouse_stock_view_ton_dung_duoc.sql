-- 0198 — `warehouse_stock`: DƯỚI MỨC tính trên hàng DÙNG ĐƯỢC, và tìm KHÔNG DẤU.
--
-- Hai việc cùng chạm một view nên đi một lượt (sổ §5.3 + §5.5). Không gộp thêm
-- gì khác: đổi nền tính của `is_low` là đổi HÀNH VI MỘT CRON, và việc đó phải
-- nằm trong một migration gọi đúng tên nó.
--
-- ── 1. `is_low` chuyển từ `on_hand` sang `qty_ok` ──────────────────────────
--
-- 0194 CỐ Ý giữ `on_hand` và ghi lý do: `is_low` là ngưỡng ĐẶT LẠI HÀNG, và
-- 0160 chốt BA NƠI phải đồng nhất (view + cron 0159 + `notifyLowStock` ở
-- service). Đổi một nơi mà quên hai nơi kia thì màn Tồn kho tô đỏ một tập,
-- email quét sáng gửi một tập khác, và không ai tin cái nào.
--
-- Lập luận đổi: câu `is_low` trả lời là "tôi có đủ chưa để khỏi phải mua".
-- 200 cây nhôm đang KHOÁ chờ trả NCC nằm trong `on_hand` nhưng không mua thay
-- được — đếm chúng vào là hứa hộ nhà kho một thứ nó không giao nổi, đúng cái
-- bẫy mà `qty_ok` sinh ra để tránh. Hàng CHỜ KIỂM cũng vậy.
--
-- CẢ BA NƠI ĐỔI CÙNG LƯỢT: view (dưới) · `sweep_supply_alerts` (dưới, ĐÚNG
-- MỘT mệnh đề so sánh, phần còn lại chép nguyên văn 0159) · `notifyLowStock`
-- ở `stock.service.ts` (cùng commit).
--
-- HỆ QUẢ ĐO ĐƯỢC HÔM NAY: BẰNG KHÔNG. Tồn đang là 0 trên cả 13.229 mã (phiếu
-- KK-2026-0004 đưa về 0 để nạp lại) và chưa dòng nào mang trạng thái khác
-- 'ok'. Đây đúng là lúc rẻ nhất để đổi — sau khi nạp tồn thật thì cùng thay
-- đổi này làm một tập mã đang yên lặng bỗng nhảy vào danh sách cần mua, giữa
-- lúc không ai biết vì sao.
--
-- ── 2. `search_text` — gõ "vit" phải ra "vít" ──────────────────────────────
--
-- Bảng `warehouse_materials` có cột generated `search_text` (0127: hạ thường +
-- bỏ dấu) nhưng view không mang nó ra, nên màn Tồn kho lọc bằng `code`/`name`
-- CÓ DẤU. Người gõ không dấu — bàn phím Việt tắt là thói quen của cả xưởng —
-- và màn trả rỗng dù mã có thật.
--
-- Chỉ MANG CỘT RA, không tính lại gì: nó là generated column trên bảng gốc,
-- chi phí bằng 0, và index gin đã có sẵn từ 0127.
--
-- RLS: view giữ `security_invoker = on` (0194) nên kế thừa tư thế của bảng gốc
-- — thay view không đổi ai đọc được gì.

create or replace view public.warehouse_stock with (security_invoker = on) as
select
  m.id            as material_id,
  m.code,
  m.name,
  m.unit,
  m.group_name,
  m.min_stock,
  m.shelf_location,
  m.is_active,
  coalesce(
    sum(case mv.direction when 'in' then mv.qty when 'out' then -mv.qty else 0 end),
    0
  )               as on_hand,
  -- DƯỚI MỨC đo trên hàng DÙNG ĐƯỢC (0198) — xem đầu file.
  (m.min_stock > 0 and coalesce(sum(case when mv.stock_status = 'ok'
    then case mv.direction when 'in' then mv.qty when 'out' then -mv.qty else 0 end
    else 0 end), 0) < m.min_stock) as is_low,
  coalesce(sum(case when mv.stock_status = 'ok'
    then case mv.direction when 'in' then mv.qty when 'out' then -mv.qty else 0 end
    else 0 end), 0) as qty_ok,
  coalesce(sum(case when mv.stock_status = 'qc'
    then case mv.direction when 'in' then mv.qty when 'out' then -mv.qty else 0 end
    else 0 end), 0) as qty_qc,
  coalesce(sum(case when mv.stock_status = 'blocked'
    then case mv.direction when 'in' then mv.qty when 'out' then -mv.qty else 0 end
    else 0 end), 0) as qty_blocked,
  -- CỘT CUỐI CÙNG, có chủ ý: `create or replace view` chỉ cho THÊM cột ở
  -- cuối, chèn vào giữa thì Postgres từ chối (42P16) và phải drop view —
  -- kéo theo mọi view/grant phụ thuộc. Thứ tự xấu hơn, rủi ro thấp hơn.
  m.search_text
from public.warehouse_materials m
left join public.warehouse_movements mv on mv.material_id = m.id
group by m.id;

-- ── Cron quét sáng: CHÉP NGUYÊN VĂN 0159, đổi ĐÚNG một mệnh đề ──────────────
--
-- Hàm này làm BA việc (PO quá hẹn đích danh · gộp cho GĐ/QL · tồn dưới min).
-- `create or replace` là ghi đè cả hàm, nên phải chép đủ cả ba — viết lại từ
-- trí nhớ chỉ phần thứ ba là lặng lẽ xoá mất hai cảnh báo kia.
create or replace function public.sweep_supply_alerts()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_late int;
  v_low  int;
begin
  -- ── 1. PO quá hẹn → người phụ trách, đích danh từng đơn ────────────────────
  insert into notifications (user_id, type, payload)
  select coalesce(po.assigned_to, po.created_by),
         'po_late',
         jsonb_build_object('title',
           po.code || ' — quá hẹn giao ' || to_char(po.expected_at, 'DD/MM')
                   || ' (' || s.name || ')')
  from supply_purchase_orders po
  join supply_suppliers s on s.id = po.supplier_id
  where po.status in ('ordered', 'confirmed', 'in_transit', 'partial')
    and po.expected_at is not null
    and po.expected_at < current_date
    and coalesce(po.assigned_to, po.created_by) is not null
    and not exists (
      select 1 from notifications n
      where n.type = 'po_late'
        and n.user_id = coalesce(po.assigned_to, po.created_by)
        and n.payload->>'title' like po.code || ' — quá hẹn%'
        and n.created_at >= current_date
    );

  -- ── 2. GĐ/quản lý: một thông báo GỘP ───────────────────────────────────────
  select count(*) into v_late
  from supply_purchase_orders po
  where po.status in ('ordered', 'confirmed', 'in_transit', 'partial')
    and po.expected_at is not null
    and po.expected_at < current_date;
  if v_late > 0 then
    insert into notifications (user_id, type, payload)
    select u.id, 'po_late',
           jsonb_build_object('title',
             'Quét sáng: ' || v_late || ' đơn đặt vật tư quá hẹn giao')
    from users u
    where u.is_active and u.role in ('admin', 'manager')
      and not exists (
        select 1 from notifications n
        where n.type = 'po_late' and n.user_id = u.id
          and n.payload->>'title' like 'Quét sáng:%'
          and n.created_at >= current_date
      );
  end if;

  -- ── 3. Tồn dưới min: một thông báo GỘP cho Cung ứng + GĐ/QL ────────────────
  -- ĐỔI DUY NHẤT Ở ĐÂY (0198): `st.on_hand` → `st.qty_ok`.
  select count(*) into v_low
  from warehouse_stock st
  join warehouse_materials m on m.id = st.material_id
  where m.is_active and m.min_stock > 0 and st.qty_ok < m.min_stock;
  if v_low > 0 then
    insert into notifications (user_id, type, payload)
    select u.id, 'wh_stock_low',
           jsonb_build_object('title',
             'Quét sáng: ' || v_low || ' vật tư dưới tồn tối thiểu — xem Kho › Tồn kho')
    from users u
    left join departments d on d.id = u.department_id
    where u.is_active
      and (u.role in ('admin', 'manager')
           or d.name in ('Kế Hoạch Sản Xuất-cung ứng', 'Cung Ứng - Mua Hàng'))
      and not exists (
        select 1 from notifications n
        where n.type = 'wh_stock_low' and n.user_id = u.id
          and n.payload->>'title' like 'Quét sáng:%'
          and n.created_at >= current_date
      );
  end if;
end $$;
