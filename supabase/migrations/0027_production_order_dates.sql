-- Sản xuất: thêm mốc ngày cho phiếu LSX (in trên đầu phiếu).
--
-- Mẫu LSX thật có "Ngày nhận" và "Ngày hoàn thành". Bổ sung:
--   - received_date : ngày nhận đơn để lên LSX (nhập khi phát; fallback ngày tạo đơn khi in).
--   - completed_at  : mốc báo hoàn thành LSX (service.complete set = now).
--
-- Dòng SP + thông số của LSX đã có sẵn: dùng chung sales_order_lines (BR-02) +
-- production_order_line_specs (override per dòng, từ 0014); mặc định thông số lấy
-- từ technical_products.tech_spec (0026).
--
-- RLS: không đổi (production_orders đã ENABLED, no policies từ 0014).
-- Idempotent: add column if not exists — non-destructive. Sau đó "sync types".

alter table public.production_orders
  add column if not exists received_date date,
  add column if not exists completed_at  timestamptz;
