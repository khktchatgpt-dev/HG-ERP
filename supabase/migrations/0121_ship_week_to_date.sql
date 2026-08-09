-- Kinh doanh: tuần giao → NGÀY giao (hạn cuối tuần) trên dòng đơn.
--
-- 0120 để ship_week là text tự do ('w37.26'). Chốt lại 07/08/2026: "tuần giao"
-- thực chất là MỐC HẠN = ngày cuối của tuần đó → lưu dạng DATE (sort/cảnh báo
-- trễ được), còn nhãn tuần w37.26 suy ra từ ngày khi hiển thị/in
-- (src/lib/ship-week.ts) — không lưu chuỗi song song để khỏi lệch nhau.
--
-- ship_week chưa có dữ liệu (0/71 dòng lúc đổi) nên drop thẳng, không cần
-- chuyển đổi. RLS: không đổi (bảng đã ENABLED từ 0013).
-- Idempotent. Apply: MCP apply_migration / SQL editor. Sau đó "sync types".

alter table public.sales_order_lines
  drop column if exists ship_week;

alter table public.sales_order_lines
  add column if not exists ship_date date;
