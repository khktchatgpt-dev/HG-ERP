-- Sản lượng hằng ngày theo công đoạn/tổ (SX-P3 — SRS sản xuất chi tiết
-- FR-PR-01/02/03: thay các sheet PHÔI/HÀN/NGUỘI/SƠN của file Excel).
--
-- Sổ APPEND-ONLY: mỗi bản ghi = 1 lần tổ báo sản lượng cho 1 chi tiết ở 1
-- công đoạn trong 1 ngày (SL, kg, phế phẩm, máy/màu, ghi chú). Ghi nhầm →
-- xoá bản ghi (creator/QL) rồi nhập lại — không sửa đè. Tổng hợp (đã làm,
-- thiếu/dư, %HT, đồng bộ) KHÔNG lưu cứng — tính ở service
-- (src/lib/production-summary.ts, chia 0 an toàn — NFR-CC-03).
--
-- component_id cascade theo bảng chi tiết; service CHẶN ghi đè bảng chi tiết
-- khi đã có sản lượng (tránh mất sổ). Tổ = phòng ban (workspace production).
--
-- RLS: enable, KHÔNG policy — anon bị chặn, secret key server bypass.
-- Apply: `npx supabase db push` hoặc SQL editor. Sau đó SYNC TYPES (bảng mới).

create table if not exists public.production_output_entries (
  id                  uuid primary key default gen_random_uuid(),
  production_order_id uuid not null
                        references public.production_orders(id) on delete cascade,
  component_id        uuid not null
                        references public.production_order_components(id) on delete cascade,
  stage               text not null,                        -- code catalog production_stage
  team_department_id  uuid references public.departments(id) on delete set null,
  entry_date          date not null,
  qty                 numeric(14, 2) not null check (qty > 0),          -- SL đã làm
  kg                  numeric(14, 4) check (kg >= 0),                   -- khối lượng
  defect_qty          numeric(14, 2) not null default 0 check (defect_qty >= 0),
  machine_note        text,                                 -- máy cắt / loại hàn / màu sơn
  note                text,                                 -- "hàng trần", "đang mây"…
  created_by          uuid references public.users(id) on delete set null,
  created_at          timestamptz not null default now()
);

create index if not exists production_output_entries_lsx_idx
  on public.production_output_entries (production_order_id, entry_date desc);
create index if not exists production_output_entries_component_idx
  on public.production_output_entries (component_id, stage);

alter table public.production_output_entries enable row level security;
