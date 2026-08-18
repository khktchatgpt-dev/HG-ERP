-- 0159 — CẢNH BÁO TỰ ĐỘNG hằng ngày (P3.2 + P4.2 backlog ③, quy-trinh-lsx-cung-ung-kho).
--
-- BỐI CẢNH: cảnh báo "PO quá hẹn" chỉ hiện trên UI khi có người mở màn; tồn
-- dưới min chỉ báo tại thời điểm xuất kho/kiểm kê — vật tư âm thầm cạn giữa hai
-- lần xuất thì không ai hay. Chọn pg_cron (không phải quét-khi-login: cookie 7
-- ngày nên login hiếm; cron chạy cả khi không ai mở app).
--
-- THIẾT KẾ — sweep_supply_alerts() chạy 00:00 UTC = 07:00 VN (đầu giờ sáng):
--   1. PO quá hẹn  → báo ĐÍCH DANH người phụ trách, 1 thông báo/đơn/ngày (po_late).
--   2. GĐ/quản lý  → MỘT thông báo GỘP "N đơn quá hẹn" (đỡ spam từng đơn).
--   3. Tồn < min   → MỘT thông báo GỘP "N vật tư dưới min" cho Cung ứng + GĐ/QL
--                    (wh_stock_low — cùng type với cảnh báo lúc xuất kho).
--   Chống lặp: NOT EXISTS thông báo cùng loại/cùng người/cùng nội dung TRONG NGÀY.
--
-- Đây là INSERT THẲNG bảng notifications từ SQL (ngoài event bus) — chấp nhận
-- cho cron; đổi nội dung thì create or replace function, không cần migration số mới.
-- RLS: pg_cron chạy role postgres, bypass RLS như secret key. Idempotent:
-- cron.schedule cùng jobname là UPSERT.

create extension if not exists pg_cron;

-- Type mới cho thông báo PO quá hẹn (constraint mở rộng như 0155/0158).
alter table public.notifications
  drop constraint if exists notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check
  check (type in ('assigned','reassigned','status_changed','submitted',
                  'approved','rejected','commented','due_soon','overdue',
                  'quote_submitted','quote_approved','quote_rejected',
                  'wh_receipt','wh_stock_low','wh_return',
                  'wh_stocktake_pending','wh_stocktake_approved','wh_stocktake_rejected',
                  'po_submitted','po_approved','po_rejected',
                  'po_withdrawn','po_reassigned','po_closed_short','po_late',
                  'lsx_submitted','lsx_approved','lsx_rejected',
                  'order_changed','order_cancelled',
                  'stage_handoff','incident_reported','incident_resolved'));

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
  select count(*) into v_low
  from warehouse_stock st
  join warehouse_materials m on m.id = st.material_id
  where m.is_active and m.min_stock > 0 and st.on_hand < m.min_stock;
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

-- 00:00 UTC = 07:00 VN. cron.schedule cùng jobname = upsert, chạy lại an toàn.
select cron.schedule('hg-supply-alerts', '0 0 * * *',
                     'select public.sweep_supply_alerts()');
