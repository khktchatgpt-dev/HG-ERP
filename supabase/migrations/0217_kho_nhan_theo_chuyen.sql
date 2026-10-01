-- 0217 — KHO NHẬN THEO CHUYẾN (bước 3 của đợt giao nhận, chủ dự án duyệt 01/10/2026).
--
-- 1) Chuyến hàng (0216) ghi thêm lúc XE TỚI XƯỞNG: Kho đếm kiện so biên nhận.
--    `arrived_at/arrived_by` đã có; thêm số kiện thực nhận, kết quả đếm (đủ /
--    thiếu kiện / có kiện hư) và ghi chú. Thiếu hoặc hư thì BẮT ghi chú: đó là
--    câu Cung ứng cầm đi khiếu nại chành.
-- 2) Phiếu nhập Kho mang số chuyến (`warehouse_docs.trip_id`) — biết phiếu nào
--    nhận từ xe nào. On delete set null: phiếu là sự thật kế toán, chuyến chỉ là
--    thông tin vận chuyển.
--
-- Kg cân thực (`warehouse_movements.qty2_actual`) đã có cột từ trước nhưng chưa
-- màn nào ghi — bước này bắt đầu ghi, không cần đổi cột.
--
-- RLS: không đổi (hai bảng đã ENABLE, không policy). Idempotent.

alter table public.supply_trips
  add column if not exists arrived_packages integer
    check (arrived_packages is null or arrived_packages >= 0),
  add column if not exists arrived_check text
    check (arrived_check is null or arrived_check in ('du', 'thieu', 'hu')),
  add column if not exists arrived_note text;

alter table public.supply_trips drop constraint if exists supply_trips_arrived_note_chk;
alter table public.supply_trips add constraint supply_trips_arrived_note_chk check (
  arrived_check is null or arrived_check = 'du' or length(btrim(coalesce(arrived_note, ''))) >= 3
);

alter table public.warehouse_docs
  add column if not exists trip_id uuid references public.supply_trips(id) on delete set null;

create index if not exists warehouse_docs_trip_idx on public.warehouse_docs (trip_id) where trip_id is not null;
