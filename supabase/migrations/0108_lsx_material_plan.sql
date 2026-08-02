-- BẢNG KÊ VẬT TƯ THEO LSX (BKVT) — chỗ đứng giữa "cần gì" và "đặt ai".
--
-- Mô hình thật của phòng Cung ứng (rà 8 file đơn ở E:\PO): mỗi LSX có một sheet
-- BKVT liệt kê từng dòng `Mã SP · Tên vật tư · ĐVT · đm/sp · SL · VTRL · SL đặt
-- hàng · Tồn · SL cần đặt · NCC`. Một LSX nhiều SP thì BKVT là các khối BOM xếp
-- nối nhau, phân biệt bằng `Mã SP`. Đơn đặt hàng = lọc bảng đó theo cột NCC —
-- LSX 04 ra 8 đơn cho 8 nhà cung cấp. Hiện app bắt soạn tay từng đơn một.
--
-- Vì sao là BẢNG RIÊNG chứ không đọc thẳng định mức:
--   · Cột NCC, tồn, hao, đơn giá là quyết định của NGƯỜI MUA cho riêng lệnh này
--     — không thuộc hồ sơ kỹ thuật của sản phẩm.
--   · Nguồn dòng có thể là Excel (nhập từ file LSX) HOẶC định mức (BOM × SL).
--     Cùng đổ vào một bảng nên màn hình và nút tách đơn không phải viết hai lần.
--     Cột `source` ghi rõ dòng từ đâu ra.
--   · `v_lsx_material_status` (BOM × SL đơn hàng − đã xuất) hiện trả 0 dòng vì
--     định mức mới có 66 dòng/4 SP và chưa dòng nào mang `material_code`. Bảng
--     này cho Cung ứng làm việc ngay, không chờ Kỹ thuật nạp xong định mức.
--
-- VẬT TƯ GHI BẰNG CẢ HAI: `material_id` (nếu khớp danh mục kho) VÀ
-- `material_name` nguyên văn. File thật có tên chưa từng vào kho ("Pat xoay 3 lỗ
-- vít, 7 màu"); bắt buộc khoá ngoại là mất dòng, mà mất dòng nghĩa là quên mua.
--
-- CỘT NCC CỦA FILE KHÔNG PHẢI LÚC NÀO CŨNG LÀ NHÀ CUNG CẤP — dữ liệu thật có
-- `HGIA` (xưởng tự làm rồi xuất đi xi), `TQ` (hàng Trung Quốc), `ĐỦ` (tồn đủ,
-- khỏi mua), `CHƯA MUA`. Vì thế `status` tách khỏi `supplier_id`: dòng có thể
-- "đã quyết" mà không sinh đơn nào. Giữ thêm `supplier_label` = mã nguyên văn
-- để đối chiếu khi mã chưa khớp NCC nào.
--
-- RLS: bật, KHÔNG policy — anon bị chặn, secret key của server bypass, đúng tư
-- thế mọi bảng khác. Idempotent: create ... if not exists + drop/create trigger.

create table if not exists public.supply_lsx_material_plan (
  id uuid primary key default gen_random_uuid(),
  production_order_id uuid not null
    references public.production_orders(id) on delete cascade,

  -- Sản phẩm của dòng. `product_id` null khi mã trên file chưa khớp hồ sơ SP nào
  -- — vẫn giữ `product_code` để người dùng tự đối chiếu.
  product_id   uuid references public.technical_products(id) on delete set null,
  product_code text,
  product_name text,

  -- Vật tư: khớp kho thì có id, không khớp vẫn giữ tên.
  material_id   uuid references public.warehouse_materials(id) on delete set null,
  material_name text not null,
  unit          text,

  qty_per_product numeric(14, 3),          -- đm/sp
  product_qty     numeric(14, 3),          -- SL sản phẩm trong LSX
  qty_required    numeric(14, 3) not null default 0,  -- SL đặt hàng = đm/sp × SL
  waste_pct       numeric(6, 3) not null default 0,   -- hao (file hay dùng 3%)
  qty_on_hand     numeric(14, 3),          -- tồn tại thời điểm lập bảng kê
  qty_to_order    numeric(14, 3) not null default 0,  -- SL cần đặt (sau hao, trừ tồn)
  unit_price      numeric(14, 2),

  supplier_id    uuid references public.supply_suppliers(id) on delete set null,
  supplier_label text,
  status text not null default 'pending'
    check (status in ('pending', 'assigned', 'self_make', 'enough', 'other', 'ordered')),

  -- Dòng đã đi vào đơn nào. on delete set null: xoá đơn thì dòng quay lại chờ.
  po_line_id uuid references public.supply_purchase_order_lines(id) on delete set null,

  note   text,                              -- cột VTRL của file (vị trí lắp)
  source text not null default 'excel' check (source in ('excel', 'bom', 'manual')),

  created_at timestamptz not null default now(),
  created_by uuid references public.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.users(id) on delete set null
);

create index if not exists supply_lsx_plan_lsx_idx
  on public.supply_lsx_material_plan (production_order_id);
create index if not exists supply_lsx_plan_supplier_idx
  on public.supply_lsx_material_plan (supplier_id);
create index if not exists supply_lsx_plan_status_idx
  on public.supply_lsx_material_plan (production_order_id, status);
create index if not exists supply_lsx_plan_material_idx
  on public.supply_lsx_material_plan (material_id);

drop trigger if exists set_updated_at on public.supply_lsx_material_plan;
create trigger set_updated_at
  before update on public.supply_lsx_material_plan
  for each row execute function public.set_updated_at();

alter table public.supply_lsx_material_plan enable row level security;
