-- 0185: CHIA SỐ LƯỢNG CỦA MỘT DÒNG ĐƠN CHO NHIỀU LỆNH (supply_po_line_lsx).
--
-- Vì sao: 0125 cho một đơn gộp nhiều LSX (LSX chính + supply_po_extra_lsx),
-- nhưng số lượng thì KHÔNG chia — dòng hàng không mang lệnh nào. Hệ quả đo được
-- trên PO-2026-0065 (gộp lệnh 08 + 09): đơn có 1.350 tấm KIM0161, bảng kê CẢ HAI
-- lệnh đều ghi "đã đặt 1.350". Mỗi lệnh tưởng đã đặt đủ, "còn phải đặt" bị trừ
-- thừa, người mua đặt thiếu.
--
-- Chia ở mức DÒNG chứ không mức đơn, vì đó chính là lý do người ta gộp đơn: mua
-- chung CÙNG một mã cho nhiều lệnh để đủ số tối thiểu hoặc được giá tốt. Một
-- dòng 1.350 tấm ghi rõ lệnh 08 = 800, lệnh 09 = 550.
--
-- QUY ƯỚC TƯƠNG THÍCH NGƯỢC: dòng KHÔNG có bản ghi nào ở bảng này = 100% thuộc
-- LSX chính của đơn. Nhờ vậy 66 đơn cũ và mọi đơn một-lệnh không cần dữ liệu gì
-- thêm, và bảng này chỉ có dòng khi thật sự cần chia.
--
-- Tổng phân bổ phải bằng qty_ordered của dòng — KIỂM Ở SERVICE, không ở DB:
-- người soạn đơn sửa SL đặt trước rồi mới sửa phân bổ (hoặc ngược lại), ràng
-- buộc cứng ở DB sẽ chặn ngay giữa chừng một thao tác bình thường.
--
-- on delete: theo dòng thì cascade (xoá dòng là sạch phân bổ); theo LSX thì
-- restrict — lệnh đang được một đơn phân bổ không được xoá âm thầm.
--
-- RLS: enable, KHÔNG policy — anon bị chặn, secret key (server) bypass, đúng tư
-- thế mọi bảng khác của dự án.

create table if not exists public.supply_po_line_lsx (
  line_id uuid not null
    references public.supply_purchase_order_lines(id) on delete cascade,
  production_order_id uuid not null
    references public.production_orders(id) on delete restrict,
  qty numeric not null check (qty > 0),
  primary key (line_id, production_order_id)
);

create index if not exists supply_po_line_lsx_lsx_idx
  on public.supply_po_line_lsx (production_order_id);

alter table public.supply_po_line_lsx enable row level security;

comment on table public.supply_po_line_lsx is
  'Chia SL của một dòng đơn cho nhiều lệnh. Không có dòng nào = 100% thuộc LSX chính của đơn.';
comment on column public.supply_po_line_lsx.qty is
  'SL của dòng dành cho lệnh này, theo ĐVT mua của dòng. Tổng = qty_ordered (service kiểm).';
