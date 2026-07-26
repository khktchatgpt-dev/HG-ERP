-- 0090_production_transfers_worker.sql — vế ĐẦU VÀO của sổ sản lượng: bàn giao
-- phôi/WIP vào tổ + người làm trực tiếp, đối chiếu file Excel thật của thống kê
-- ("Tổng TĐ SX- TK - KT.xlsx", user chốt 07/2026).
--
-- Excel: mỗi sheet TỔ (HÀN SẮT-CN, NGUỘI TỔ SỰ, SƠN NHÔM TỔ SINH…) có cột
-- "SL giao 1..4 / Tổng giao" = số phôi/cụm bàn giao VÀO tổ theo đợt; thiếu/dư
-- của tổ = giao − làm; có ghi chú kiểu "đã trả lại 2 (bộ) phôi lỗi (móp)".
-- production_entries (0084) mới ghi vế ĐẦU RA (làm được bao nhiêu) — chưa có
-- chỗ ghi vế đầu vào nên không tính được tồn WIP tại tổ. Bổ sung:
--
-- 1) production_transfers — sổ bàn giao NỘI BỘ vào tổ, APPEND-ONLY như
--    production_entries (ghi nhầm → xoá rồi ghi lại):
--      direction  'issue'  = giao phôi/WIP vào tổ để làm công đoạn `stage`
--                 'return' = tổ trả lại (lỗi/thừa) — reason bắt buộc ở service
--      Tồn WIP khả dụng tại tổ per (chi tiết × công đoạn × tổ) là ĐẠI LƯỢNG
--      DẪN XUẤT: Σ issue − Σ return − Σ(qty + defect_qty của production_entries)
--      — tính ở service (src/lib/production-summary.ts), KHÔNG lưu cứng.
--    Gia công NGOÀI đã có production_outsource_entries (send/receive) — bảng
--    này chỉ dành cho tổ nội bộ, không gộp để khỏi hai nguồn sự thật per NCC.
--
-- 2) production_entries thêm cột nhập tay còn thiếu so với sổ giấy:
--      worker_name   "Người làm" trực tiếp (text tự do như Excel; chưa bắt FK
--                    danh mục công nhân — nâng sau khi làm lương sản phẩm)
--      finish_state  'tran' (hàng trần) | 'dang_may' (hàng đang mây) — cột
--                    "Ghi chú (Hàng trần hay hàng đang mây)"; null = không ghi.
--    Cột kg giữ nguyên; service tự điền kg = dm_kg × qty khi bỏ trống
--    (backflush) — Excel cũng tính "Khối lượng đã làm" chứ không nhập tay.
--
-- RLS: production_transfers ENABLE ROW LEVEL SECURITY, KHÔNG policy — anon key
-- bị chặn hoàn toàn, server dùng secret key bypass (đúng posture mọi bảng).
-- Idempotent: create table/index if not exists, add column if not exists.
-- Apply xong: "sync types" (đã cập nhật tay database.types.ts kèm migration).

create table if not exists public.production_transfers (
  id uuid primary key default gen_random_uuid(),
  production_order_id uuid not null
    references public.production_orders (id) on delete cascade,
  component_id uuid not null
    references public.production_components (id) on delete cascade,
  stage text not null,
  team_department_id uuid not null
    references public.departments (id) on delete restrict,
  direction text not null check (direction in ('issue', 'return')),
  entry_date date not null,
  qty numeric(14, 2) not null check (qty > 0),
  reason text,
  note text,
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now()
);

-- Đối chiếu giao − làm per (chi tiết × công đoạn × tổ) + sổ theo lệnh/ngày.
create index if not exists production_transfers_lsx_idx
  on public.production_transfers (production_order_id, entry_date desc);
create index if not exists production_transfers_comp_idx
  on public.production_transfers (component_id, stage, team_department_id);
create index if not exists production_transfers_team_date_idx
  on public.production_transfers (team_department_id, entry_date);

alter table public.production_transfers enable row level security;

alter table public.production_entries
  add column if not exists worker_name text,
  add column if not exists finish_state text
    check (finish_state in ('tran', 'dang_may'));
