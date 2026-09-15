-- 0193 — KHU/KỆ trong kho: nơi chốn trở thành thuộc tính của LƯỢNG.
--
-- BỐI CẢNH (Đợt 2 của `docs/thiet-ke-kho.md`). Hôm nay vị trí kho nằm ở cột
-- `warehouse_materials.shelf_location` — tức là thuộc tính của VẬT TƯ, nên một
-- mã chỉ ở được đúng một chỗ, và chỗ đó không đổi theo từng lô. Đo 15/09/2026:
-- 5 trên 13.229 mã có điền. Không ai biết hàng để đâu.
--
-- Cả năm hệ ERP lớn đều đặt nơi chốn trên LƯỢNG (SAP storage bin, Odoo
-- location, Dynamics/NetSuite bin). Ở đây: `warehouse_movements.bin_id`.
-- `shelf_location` GIỮ NGUYÊN, đổi nghĩa thành "kệ gợi ý mặc định" — điền sẵn
-- lúc cất hàng. Không xoá cột: 5 dòng đang dùng, và gợi ý là việc có ích thật.
--
-- BỐN LOẠI KHU, trong đó BA LÀ KHU ẢO:
--   store      kệ thật
--   receiving  khu tiếp nhận — hàng vừa nhận, chưa cất
--   blocked    kệ hàng khoá — đã vào sổ nhưng chưa được dùng
--   scrap      khu phế liệu — chờ thanh lý
-- Khu ảo là cách chép "địa điểm ảo" của Odoo mà không phải dựng cây địa điểm.
-- Nhờ chúng, "chờ cất" là một CÂU TRUY VẤN (còn gì ở TIEP-NHAN) chứ không phải
-- một cờ trạng thái phải nuôi, và mọi lượng luôn ở một chỗ có tên.
--
-- CHỈ NẠP SẴN BA KHU ẢO. Khu thật phải khớp biển hiệu ngoài xưởng — nạp hộ 9
-- cái tên đoán mò là đẻ dữ liệu người dùng phải đi dọn. Thêm khu ở /warehouse/ke.
--
-- `bin_id` NULLABLE: 265 dòng sổ cũ không có nơi chốn, và viết lại lịch sử bằng
-- một giá trị đoán mò còn tệ hơn để trống. Dòng mới do service ép đủ.
--
-- RLS: ENABLED, NO policies (anon chặn, server secret key bypass). Idempotent.
-- Apply xong "sync types".

create table if not exists public.warehouse_bins (
  id           uuid primary key default gen_random_uuid(),
  warehouse_id uuid not null references public.warehouses(id) on delete restrict,
  code         text not null,
  name         text,
  kind         text not null default 'store'
               check (kind in ('store', 'receiving', 'blocked', 'scrap')),
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (warehouse_id, code)
);

create index if not exists warehouse_bins_kind_idx
  on public.warehouse_bins (warehouse_id, kind) where is_active;

drop trigger if exists trg_warehouse_bins_updated_at on public.warehouse_bins;
create trigger trg_warehouse_bins_updated_at
  before update on public.warehouse_bins
  for each row execute function public.set_updated_at();

alter table public.warehouse_bins enable row level security;

alter table public.warehouse_movements
  add column if not exists bin_id uuid
    references public.warehouse_bins(id) on delete restrict;

create index if not exists warehouse_movements_bin_idx
  on public.warehouse_movements (bin_id, created_at desc) where bin_id is not null;

-- Ba khu ảo cho MỌI kho đang hoạt động. `on conflict do nothing` để chạy lại
-- không đẻ trùng, và để kho thêm sau này cũng nhận được khi chạy lại migration.
insert into public.warehouse_bins (warehouse_id, code, name, kind)
select w.id, v.code, v.name, v.kind
from public.warehouses w
cross join (values
  ('TIEP-NHAN', 'Khu tiếp nhận — hàng vừa nhận, chưa cất', 'receiving'),
  ('KHOA-01',   'Kệ hàng khoá — chờ trả hoặc huỷ',         'blocked'),
  ('PHE-Z',     'Khu phế liệu — chờ thanh lý',             'scrap')
) as v(code, name, kind)
where w.is_active
on conflict (warehouse_id, code) do nothing;
