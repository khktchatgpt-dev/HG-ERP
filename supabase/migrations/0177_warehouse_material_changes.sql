-- 0177: VẾT THAY ĐỔI DANH MỤC VẬT TƯ — ai đổi ô nào, lúc nào, TỪ CHỨNG TỪ NÀO.
--
-- Vì sao cần: danh mục vật tư sửa được từ NHIỀU đường — màn Kho sửa tay, hộp
-- "Cập nhật kho vật tư?" sau khi lưu đơn đặt (fill-empty), và event `po.ordered`
-- ghi đè `last_purchase_price`. Trước migration này KHÔNG đường nào để lại vết:
-- một ô quy cách / giá mua gần nhất đổi giá trị mà không truy được ai ghi và vì
-- đơn nào. Giá thì đi thẳng vào giá thành, nên đây là lỗ hổng thật.
--
-- MỘT DÒNG = MỘT Ô ĐỔI (không phải một bản chụp cả bản ghi): người kiểm hầu như
-- luôn hỏi theo trường ("ai sửa giá con này?"), lọc theo `field` là xong; chụp
-- cả record thì mỗi lần đọc phải tự đi so hai khối JSON.
--
-- Giá trị lưu dạng TEXT: cột nguồn đủ kiểu (text/số/số thực), mà sổ này chỉ để
-- ĐỌC — không ai cộng trừ trên nó. Ép kiểu là tự trói khi thêm trường mới.
--
-- RLS: bật, KHÔNG policy — anon bị chặn hoàn toàn, server dùng secret key đi
-- vòng qua RLS như mọi bảng khác trong dự án.

create table if not exists public.warehouse_material_changes (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references public.warehouse_materials (id) on delete cascade,
  -- Chép mã tại thời điểm ghi: vật tư bị xoá thì dòng vết cũng đi theo (cascade),
  -- nhưng mã đổi thì sổ vẫn phải kể đúng cái tên hồi đó.
  material_code text,
  field text not null,
  before_value text,
  after_value text,
  -- Người bấm. NULL = máy tự ghi (event `po.ordered` chạy ngoài phiên người dùng).
  actor_id uuid references public.users (id) on delete set null,
  -- Đường ghi: manual (màn Kho) · po_enrich (hộp xác nhận sau khi lưu đơn) ·
  -- po_price (giá gần nhất khi gửi NCC) · import (script nạp liệu) · system.
  source text not null default 'manual',
  -- Mã chứng từ gây ra thay đổi — PO-2026-0024, tên file nạp…
  source_ref text,
  created_at timestamptz not null default now()
);

create index if not exists warehouse_material_changes_material_idx
  on public.warehouse_material_changes (material_id, created_at desc);

create index if not exists warehouse_material_changes_created_idx
  on public.warehouse_material_changes (created_at desc);

-- Soi theo trường trên toàn danh mục ("tháng này ai đổi giá những con nào").
create index if not exists warehouse_material_changes_field_idx
  on public.warehouse_material_changes (field, created_at desc);

alter table public.warehouse_material_changes enable row level security;
