-- Kỹ thuật: NHÓM HẠNG MỤC của định mức trở thành DỮ LIỆU thay vì danh sách cứng.
--
-- Bối cảnh: 0092 khoá nhóm bằng CHECK 6 giá trị (FRAME/HARDWARE/CUSHION/WOOD/
-- PACKAGING/OTHER). Mỗi lần thêm hay bớt một nhóm đều phải sửa CHECK + sửa hằng
-- số trong code, tức là cần lập trình viên và một migration. User đã báo trước
-- là sẽ định hình lại các danh mục bên trong định mức, nên chuyển sớm — lúc bảng
-- còn mới, mới có một màn hình đọc nó và chưa có form nhập liệu nào bám vào.
--
--   technical_part_groups   mã, nhãn, thứ tự, nhóm cha, còn dùng hay không.
--                           `parent_code` cho phép LỒNG CẤP sau này (Khung →
--                           Khung nhôm / Khung sắt) mà không phải đổi cấu trúc
--                           thêm lần nữa.
--
-- CHECK trên technical_product_parts.group_code đổi thành KHOÁ NGOẠI. Khác với
-- customer_name (0091) và material_code (0092) vốn cố ý để text tự do: hai cái
-- đó là danh mục của PHÒNG KHÁC nên ràng buộc gây vướng; còn nhóm hạng mục là
-- danh mục của chính phòng Kỹ thuật, ràng buộc ở đây có lợi vì chặn gõ sai mã.
--
-- `on update cascade`: đổi mã nhóm thì 9.443 dòng định mức tự đi theo.
-- `on delete restrict`: không cho xoá nhóm đang có dòng định mức dùng.
--
-- RLS: bảng mới ENABLE, no policies (anon chặn, secret key bypass).
-- Idempotent: create if not exists, insert ... on conflict do nothing, drop
-- constraint if exists. Dữ liệu định mức KHÔNG phải nạp lại.
-- Apply xong: "sync types".

create table if not exists public.technical_part_groups (
  code text primary key,
  label text not null,
  parent_code text references public.technical_part_groups(code)
    on update cascade on delete restrict,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Nhóm không thể là cha của chính nó (bẫy dễ gặp khi sửa trên UI).
  constraint technical_part_groups_no_self_parent check (parent_code is null or parent_code <> code)
);

create index if not exists technical_part_groups_parent_idx
  on public.technical_part_groups (parent_code) where parent_code is not null;

drop trigger if exists set_updated_at on public.technical_part_groups;
create trigger set_updated_at before update on public.technical_part_groups
  for each row execute function public.set_updated_at();

-- Nạp đúng 6 nhóm đang dùng, giữ nguyên thứ tự hiển thị hiện có.
insert into public.technical_part_groups (code, label, sort_order) values
  ('FRAME',     'Khung',              10),
  ('WOOD',      'Gỗ / Polywood',      20),
  ('CUSHION',   'Nệm & vải',          30),
  ('HARDWARE',  'Vật tư / phụ kiện',  40),
  ('PACKAGING', 'Bao bì',             50),
  ('OTHER',     'Khác',               60)
on conflict (code) do nothing;

-- Đổi CHECK cứng → khoá ngoại. Seed ở trên chạy trước nên mọi giá trị đang có
-- đều hợp lệ, thêm ràng buộc không làm hỏng dữ liệu.
alter table public.technical_product_parts
  drop constraint if exists technical_product_parts_group_code_check;

do $$ begin
  alter table public.technical_product_parts
    add constraint technical_product_parts_group_code_fkey
    foreign key (group_code) references public.technical_part_groups(code)
    on update cascade on delete restrict;
exception when duplicate_object then null; end $$;

alter table public.technical_part_groups enable row level security;
