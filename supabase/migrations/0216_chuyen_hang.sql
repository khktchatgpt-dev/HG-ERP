-- 0216 — CHUYẾN HÀNG: hàng đã rời NCC, đang trên xe nào, bao giờ về kho.
--
-- Bối cảnh (chủ dự án duyệt 01/10/2026, canvas "Cung ứng · Hàng về" bản 2):
-- hàng về xưởng Gia Lai theo 4 cách; với cách "gửi chành xe ở TP.HCM" và "HG
-- thuê xe đi lấy", từ lúc hàng rời NCC tới lúc tới cổng không có chỗ nào ghi —
-- 0/97 đơn từng ở trạng thái đang vận chuyển. Một chuyến chở được nhiều đơn của
-- nhiều NCC.
--
-- CHUYẾN KHÔNG MANG TIỀN (chủ dự án chốt 01/10): chuyến chỉ để NHẬN BIẾT đơn
-- nào về kho lúc nào. Phí vận chuyển là phần RIÊNG để thống kê chi phí
-- (`supply_po_costs`, 0211/0215) — hai thứ sống độc lập.
--
-- Trạng thái KHÔNG lưu cột: "đã về kho" suy từ phiếu nhập của Kho
-- (`lib/chuyen-hang.ts`), chỉ lưu các mốc do người ghi: gửi, tới, huỷ. Không
-- xoá chuyến, chỉ huỷ kèm lý do. Trạng thái ĐƠN MUA không đổi khi ghi chuyến —
-- vòng đời đơn vẫn do phiếu nhập quyết (refreshStatusFromReceipts).
--
-- Mã chuyến CH-YYYY-NNNN cấp qua next_doc_code('CH') (0011/0164).
--
-- RLS: ENABLE, không policy — anon chặn, secret key (server) bypass. Idempotent.

create table if not exists public.supply_trips (
  id             uuid primary key default gen_random_uuid(),
  code           text not null unique,
  -- chanh: NCC gửi chành xe · xe_thue: HG thuê xe đi lấy · ncc_cho: NCC tự chở, báo ngày tới
  mode           text not null check (mode in ('chanh', 'xe_thue', 'ncc_cho')),
  -- Tên chành / nhà xe gõ tự do (gợi ý từ danh mục đơn vị vận chuyển + câu nơi
  -- giao trên đơn); carrier_id chỉ gắn khi chọn đúng một đơn vị trong danh mục.
  carrier_name   text not null check (length(btrim(carrier_name)) >= 2),
  carrier_id     uuid references public.supply_suppliers(id) on delete set null,
  receipt_no     text,
  sent_on        date not null,
  eta            date,
  packages       integer check (packages is null or packages > 0),
  package_unit   text,
  weight_kg      numeric(12, 2) check (weight_kg is null or weight_kg > 0),
  note           text,
  arrived_at     timestamptz,
  arrived_by     uuid references public.users(id) on delete set null,
  cancelled_at   timestamptz,
  cancelled_by   uuid references public.users(id) on delete set null,
  cancel_reason  text,
  created_by     uuid references public.users(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint supply_trips_eta_chk check (eta is null or eta >= sent_on),
  constraint supply_trips_cancel_chk check (
    cancelled_at is null or length(btrim(coalesce(cancel_reason, ''))) >= 3
  )
);

create index if not exists supply_trips_sent_on_idx on public.supply_trips (sent_on desc);

drop trigger if exists supply_trips_set_updated_at on public.supply_trips;
create trigger supply_trips_set_updated_at
  before update on public.supply_trips
  for each row execute function public.set_updated_at();

alter table public.supply_trips enable row level security;

-- Đơn đi trong chuyến. Một đơn có thể nằm ở nhiều chuyến (giao làm nhiều lần).
create table if not exists public.supply_trip_pos (
  trip_id     uuid not null references public.supply_trips(id) on delete cascade,
  po_id       uuid not null references public.supply_purchase_orders(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (trip_id, po_id)
);

create index if not exists supply_trip_pos_po_idx on public.supply_trip_pos (po_id);

alter table public.supply_trip_pos enable row level security;
