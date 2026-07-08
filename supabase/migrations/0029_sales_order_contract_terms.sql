-- Kinh doanh: thêm điều khoản xuất khẩu trên đơn hàng (Sales Contract Article 3/5).
--
-- Bổ sung sales_orders (theo mẫu hợp đồng thật):
--   - qty_tolerance_pct : dung sai SL/tiền ± % (Art 3.1, vd 10)
--   - partial_shipment  : cho giao từng phần (Art 3.2) — null = chưa nêu
--   - transhipment      : cho chuyển tải (Art 3.3)
--   - port_of_loading   : cảng xếp (Art 3.4, vd 'Quy Nhon Port - Vietnam')
--   - port_of_discharge : cảng dỡ (Art 3.5, vd 'Hamburg Port - Germany')
--   - payment_method    : phương thức TT (Art 5, vd 'By T/T')
--   - required_docs     : chứng từ yêu cầu (mỗi dòng 1 mục — text tự do)
--
-- RLS: không đổi (sales_orders đã ENABLED, no policies từ 0013).
-- Idempotent: add column if not exists — non-destructive. Sau đó "sync types".

alter table public.sales_orders
  add column if not exists qty_tolerance_pct numeric(5, 2),
  add column if not exists partial_shipment  boolean,
  add column if not exists transhipment      boolean,
  add column if not exists port_of_loading   text,
  add column if not exists port_of_discharge text,
  add column if not exists payment_method    text,
  add column if not exists required_docs     text;
