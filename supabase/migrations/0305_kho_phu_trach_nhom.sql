-- 0305_kho_phu_trach_nhom.sql
-- NGƯỜI PHỤ TRÁCH NHÓM VẬT TƯ của Kho (bản vẽ 27qPqf6oxKKaU1XuAwy1in, chủ dự án
-- duyệt 24/11/2026: "thủ kho phân bổ"). Mỗi nhân viên Kho giữ một số loại vật tư;
-- gán MỘT LẦN theo nhóm (`warehouse_materials.group_name`) thì mọi đơn đang về,
-- phiếu, mã tự biết thuộc ai — không đánh dấu tay từng đơn.
--
--   group_name — đúng chuỗi `warehouse_materials.group_name` (khoá tự nhiên; nhóm
--                đổi tên ở Danh mục thì service đổi theo).
--   user_id    — một người chính / nhóm (Q2). Nhóm không có dòng = thuộc thủ kho.
--
-- Chỉ là BỘ LỌC: không chặn ai nhận / xuất hàng nhóm không phải của mình (Q4), và
-- không ghi "phụ trách" lên phiếu — phiếu vẫn ghi người lập thật.
--
-- RLS: ENABLED, không policy — anon bị chặn, khoá bí mật của server đi qua.
-- Idempotent: create table / index if not exists; trigger drop-if-exists rồi tạo.

create table if not exists public.warehouse_group_keepers (
  group_name text primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  updated_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists warehouse_group_keepers_user_idx
  on public.warehouse_group_keepers (user_id);

drop trigger if exists warehouse_group_keepers_updated_at on public.warehouse_group_keepers;
create trigger warehouse_group_keepers_updated_at
  before update on public.warehouse_group_keepers
  for each row execute function public.set_updated_at();

alter table public.warehouse_group_keepers enable row level security;
