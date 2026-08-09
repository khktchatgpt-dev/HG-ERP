-- 0125: MỘT ĐƠN ĐẶT GỘP NHIỀU LSX (supply_po_extra_lsx).
--
-- Đơn thật của Cung ứng thường gộp nhu cầu nhiều lệnh vào một đơn gửi NCC:
-- "LSX 01+2+3/26-27" (HAPPYCO), "LSX 2+3/26-27" (ATP, Wecare), và đơn kèm dòng
-- "Bổ sung LSX 02". Cột `production_order_id` trên supply_purchase_orders vẫn là
-- LSX CHÍNH (mọi màn lọc/đếm cũ giữ nguyên nghĩa); bảng này giữ các LSX PHỤ gộp
-- thêm vào đơn. Panel nhu cầu của form gộp nhu cầu mọi LSX đã chọn; phiếu in nối
-- mã "LSX 04 + 02".
--
-- on delete: theo đơn thì cascade (xoá đơn nháp là sạch liên kết); theo LSX thì
-- restrict — lệnh đang có đơn đặt gộp không được xoá âm thầm.
--
-- RLS: enable, KHÔNG policy — anon bị chặn, secret key (server) bypass, đúng tư
-- thế mọi bảng khác của dự án.

create table if not exists public.supply_po_extra_lsx (
  po_id uuid not null references public.supply_purchase_orders(id) on delete cascade,
  production_order_id uuid not null references public.production_orders(id) on delete restrict,
  primary key (po_id, production_order_id)
);

create index if not exists supply_po_extra_lsx_lsx_idx
  on public.supply_po_extra_lsx (production_order_id);

alter table public.supply_po_extra_lsx enable row level security;

comment on table public.supply_po_extra_lsx is
  'LSX PHỤ gộp thêm vào một đơn đặt (LSX chính vẫn ở supply_purchase_orders.production_order_id).';
