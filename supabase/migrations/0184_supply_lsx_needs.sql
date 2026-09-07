-- 0184: supply_lsx_needs — BẢNG KÊ VẬT TƯ NHẬP TAY của phòng Cung ứng theo lệnh.
--
-- Vì sao cần: số "lệnh cần bao nhiêu" hôm nay có hai nguồn tự động — bảng định
-- hình của Sản xuất (production_components, chỉ dòng đã gắn mã vật tư) và định
-- mức × số lượng (v_lsx_material_status). Đo 05/09/2026: 7/15 lệnh đang chạy
-- không có nguồn nào, trong khi Cung ứng vẫn phải mua — họ tính trong sổ Excel
-- (sheet "BK thép") rồi gõ lại. Bảng này là chỗ gõ số đó vào hệ thống, để bảng
-- kê /planning/lsx/[id]/bang-ke tính được còn thiếu và các trang họp có nghĩa.
--
-- Nguyên tắc (user chốt 05/09/2026):
--   * Ghi đè TỪNG MÃ, không ghi đè cả lệnh: có dòng tay cho mã nào thì mã đó
--     lấy số tay, mã khác vẫn theo nguồn tự động. Lệch > 10% so với tự động thì
--     màn hình gắn cờ để Kỹ thuật xem lại — không tự sửa định mức.
--   * Ai nhập: nhân viên Cung ứng + admin (cùng quyền soạn đơn) — kiểm ở service.
--   * Một mã một dòng trên một lệnh (unique) — sửa là UPSERT, không chồng dòng.
--
-- RLS: enable row level security, KHÔNG policy — anon/publishable key bị chặn
-- hoàn toàn, server dùng secret key bypass (mọi truy cập qua API route).

create table if not exists public.supply_lsx_needs (
  id                  uuid primary key default gen_random_uuid(),
  production_order_id uuid not null
                        references public.production_orders(id) on delete cascade,
  material_id         uuid not null
                        references public.warehouse_materials(id) on delete restrict,
  -- Số CẦN cho cả lệnh theo ĐVT của vật tư (không phải còn phải đặt — máy trừ).
  qty_needed          numeric(14, 4) not null check (qty_needed >= 0),
  note                text,
  created_by          uuid references public.users(id) on delete set null,
  updated_by          uuid references public.users(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (production_order_id, material_id)
);

create index if not exists supply_lsx_needs_lsx_idx
  on public.supply_lsx_needs (production_order_id);

drop trigger if exists supply_lsx_needs_set_updated_at on public.supply_lsx_needs;
create trigger supply_lsx_needs_set_updated_at
  before update on public.supply_lsx_needs
  for each row execute function public.set_updated_at();

alter table public.supply_lsx_needs enable row level security;
