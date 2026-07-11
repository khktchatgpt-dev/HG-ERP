-- Gia công ngoài (SX-P4 — SRS sản xuất chi tiết FR-OS-01/02: sheet
-- GIA CÔNG TTP / GIA CÔNG VINH của file Excel).
--
-- Sổ APPEND-ONLY giao ↔ nhận: direction 'send' = đợt giao (SL giao 1/2/3…),
-- 'receive' = nhận về (kèm hàng hỏng). Tổng giao / nhận / thiếu-dư / %HT
-- KHÔNG lưu cứng — tính ở service (chia 0 an toàn). Ghi nhầm → xoá + nhập lại.
--
-- Đơn vị gia công (TTP, Vinh…) dùng CHUNG danh mục supply_suppliers — họ là
-- NCC dịch vụ, KH-CƯ quản lý một chỗ (không thêm danh mục riêng).
-- Tiến độ GCN hiển thị riêng, KHÔNG tự cộng vào sản lượng công đoạn (FR-OS-04
-- để GĐ sau — tránh đếm đôi khi tổ vừa báo vừa gửi gia công).
--
-- RLS: enable, KHÔNG policy — anon bị chặn, secret key server bypass.
-- Apply: `npx supabase db push` hoặc SQL editor. Sau đó SYNC TYPES (bảng mới).

create table if not exists public.production_outsource_entries (
  id                  uuid primary key default gen_random_uuid(),
  production_order_id uuid not null
                        references public.production_orders(id) on delete cascade,
  component_id        uuid not null
                        references public.production_order_components(id) on delete cascade,
  supplier_id         uuid not null
                        references public.supply_suppliers(id) on delete restrict,
  direction           text not null check (direction in ('send', 'receive')),
  entry_date          date not null,
  qty                 numeric(14, 2) not null check (qty > 0),
  kg                  numeric(14, 4) check (kg >= 0),
  defect_qty          numeric(14, 2) not null default 0 check (defect_qty >= 0),
  note                text,
  created_by          uuid references public.users(id) on delete set null,
  created_at          timestamptz not null default now()
);

create index if not exists production_outsource_entries_lsx_idx
  on public.production_outsource_entries (production_order_id, entry_date desc);
create index if not exists production_outsource_entries_component_idx
  on public.production_outsource_entries (component_id, supplier_id);

alter table public.production_outsource_entries enable row level security;
