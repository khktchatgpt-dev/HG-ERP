-- 0275: supply_lsx_sourcing — NCC + GIÁ CHÀO đã chọn cho từng mã của lệnh
--        (màn Kế hoạch mua · bước 2 "Chọn NCC", 22/10/2026).
--
-- Vì sao cần: NV Cung ứng so giá và chia vật tư theo NCC NGOÀI app (Excel), rồi
-- mới gõ đơn. Bước 2 cho chọn NCC + gõ giá chào ngay trên bảng kê của lệnh; bước
-- 3 tạo mỗi NCC một đơn nháp từ chính các lựa chọn này. Lựa chọn phải SỐNG QUA
-- PHIÊN (chọn hôm nay, lên đơn ngày mai; hai người cùng làm một lệnh) → bảng.
--
-- Nguyên tắc (user chốt 22/10/2026, bản vẽ WE12EjR59Qj1WNVaPXmzXu Q3–Q4):
--   * Một mã MỘT NCC trên một lệnh (unique) — muốn chia hai NCC thì tách dòng ở
--     đơn. Đổi NCC là UPSERT.
--   * Giá chào lưu THEO LỆNH, không vào bảng giá chung; chỉ thành "giá đã mua"
--     khi đơn được duyệt. `price` null = chưa có giá (đi hỏi).
--   * `price_basis` 'unit' = đ/ĐVT mua của mã; 'kg' = đ/kg (nhôm/thép mua theo cân
--     — bước 3 lên dòng price_basis unit2).
--   * Chỉ phòng Cung ứng + admin ghi (kiểm ở service, cùng quyền bảng kê tay 0184).
--
-- RLS: enable row level security, KHÔNG policy — anon/publishable key bị chặn hoàn
-- toàn, server dùng secret key bypass (mọi truy cập qua API route).

create table if not exists public.supply_lsx_sourcing (
  id                  uuid primary key default gen_random_uuid(),
  production_order_id uuid not null
                        references public.production_orders(id) on delete cascade,
  material_id         uuid not null
                        references public.warehouse_materials(id) on delete restrict,
  supplier_id         uuid not null
                        references public.supply_suppliers(id) on delete restrict,
  price               numeric(18, 4) check (price is null or price >= 0),
  price_basis         text not null default 'unit'
                        check (price_basis in ('unit', 'kg')),
  note                text,
  created_by          uuid references public.users(id) on delete set null,
  updated_by          uuid references public.users(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (production_order_id, material_id)
);

create index if not exists supply_lsx_sourcing_lsx_idx
  on public.supply_lsx_sourcing (production_order_id);
create index if not exists supply_lsx_sourcing_supplier_idx
  on public.supply_lsx_sourcing (supplier_id);

drop trigger if exists supply_lsx_sourcing_set_updated_at on public.supply_lsx_sourcing;
create trigger supply_lsx_sourcing_set_updated_at
  before update on public.supply_lsx_sourcing
  for each row execute function public.set_updated_at();

alter table public.supply_lsx_sourcing enable row level security;
