-- ĐỢT GIAO CÓ MÃ CHỨNG TỪ — GH-YYYY-NNNN.
--
-- LÀM GÌ: thêm `code` (duy nhất) cho `supply_po_shipments`, cấp mã cho các đợt
-- đang có, và khai khuôn mã 'GH' vào `doc_templates`.
--
-- VÌ SAO. Đợt giao tới nay chỉ có `seq` — đánh số TRONG PHẠM VI một đơn, nên
-- "đợt 2" là đợt 2 của đơn nào mới rõ. Hệ quả đo được trên giao diện:
--
--   · Kho không gọi tên được lô hàng khi nói chuyện với tài xế / nhà cung cấp;
--   · không tra cứu độc lập được — muốn tìm một đợt phải đi vòng qua đơn;
--   · không in ra phiếu kiểm nhận cho lô đó;
--   · và nặng nhất: đợt giao KHÔNG THỂ là một chứng từ mở ra được, nên màn kho
--     buộc phải nhảy thẳng từ danh sách sang hộp lập phiếu nhập, bỏ qua bước
--     người giữ kho thật sự làm — đối chiếu lô hàng trước mặt với lô đã hẹn.
--
-- Thu mua quản theo ĐƠN, kho quản theo ĐỢT GIAO. Vế thứ hai chỉ đứng được khi
-- đợt giao có danh tính riêng.
--
-- RLS: `supply_po_shipments` đã bật RLS không policy từ 0152 — anon bị chặn,
-- secret key bỏ qua. Thêm cột không đổi tư thế đó.
--
-- CAVEAT: `code` để NULLABLE. Không đặt `not null` vì repo hiện chèn đợt không
-- kèm mã ở vài đường (xác nhận NCC ghi đè cả bộ); service cấp mã, còn ràng buộc
-- cứng để lại cho khi mọi đường ghi đã đi qua một cửa.

-- 1) Cột mã ─────────────────────────────────────────────────────────────────
alter table public.supply_po_shipments
  add column if not exists code text;

-- Duy nhất nhưng CHO PHÉP NHIỀU NULL: unique index bỏ qua null, đúng thứ cần
-- trong lúc còn đường ghi chưa cấp mã.
create unique index if not exists supply_po_shipments_code_key
  on public.supply_po_shipments (code)
  where code is not null;

comment on column public.supply_po_shipments.code is
  'Mã chứng từ đợt giao GH-YYYY-NNNN (next_doc_code). Null = đợt cũ chưa cấp mã.';

-- 2) Khuôn mã ───────────────────────────────────────────────────────────────
-- `doc_counters.kind` không có check constraint (0011) nên thêm loại mới không
-- cần DDL; khai vào `doc_templates` để mã đi đúng khuôn chung của hệ thống.
insert into public.doc_templates
  (kind, label, prefix, pattern, seq_pad, reset_scope, title_vi, title_en,
   national_heading, form_no, signatures, default_terms)
values
  ('GH', 'Đợt giao hàng', 'GH', '{prefix}-{yyyy}-{seq}', 4, 'year',
   'PHIẾU GIAO HÀNG', 'DELIVERY NOTE', false, null, '[]'::jsonb, '')
on conflict (kind) do nothing;

-- 3) Cấp mã cho đợt đang có ─────────────────────────────────────────────────
-- Theo thứ tự NGÀY HẸN rồi tới ngày tạo: mã chạy cùng chiều thời gian, đọc sổ
-- không thấy số nhảy ngược. Chạy lại được — chỉ đụng dòng còn thiếu mã.
do $$
declare
  r record;
begin
  for r in
    select id
      from public.supply_po_shipments
     where code is null
     order by expected_date, created_at, seq
  loop
    update public.supply_po_shipments
       set code = public.next_doc_code('GH')
     where id = r.id;
  end loop;
end $$;
