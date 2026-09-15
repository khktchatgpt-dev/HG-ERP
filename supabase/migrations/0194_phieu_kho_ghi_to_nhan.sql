-- PHIẾU KHO GHI TỔ NHẬN — xuất cho tổ nào, không chỉ "cho ai".
--
-- VÌ SAO. Phiếu xuất đã gắn LỆNH SẢN XUẤT (`warehouse_movements.production_order_id`)
-- nên trả lời được "xuất cho lệnh nào". Nhưng người nhận chỉ có một ô CHỮ TỰ DO
-- (`counterparty`) — gõ "anh Tuấn" thì tháng sau không ai biết anh Tuấn thuộc tổ
-- nào, và không cộng được "tổ Phôi tháng này lĩnh bao nhiêu".
--
-- Tổ ĐÃ TỒN TẠI trong hệ thống dưới dạng phòng ban: production_jobs.team_department_id
-- trỏ `departments` (Tổ Phôi · Tổ Hàn · Tổ Nguội · Cắt Vải…). Dùng lại đúng khái
-- niệm đó thay vì đẻ một danh mục tổ thứ hai.
--
-- RLS: `warehouse_docs` đã bật RLS không policy — anon bị chặn, secret key bỏ
-- qua. Thêm cột không đổi tư thế đó.
--
-- `on delete restrict`: xoá một phòng ban mà phiếu kho đang trỏ vào thì phải
-- dừng lại — mất dấu ai lĩnh hàng là mất một chân đối chiếu.

alter table public.warehouse_docs
  add column if not exists team_department_id uuid
    references public.departments(id) on delete restrict;

create index if not exists warehouse_docs_team_idx
  on public.warehouse_docs (team_department_id)
  where team_department_id is not null;

comment on column public.warehouse_docs.team_department_id is
  'Tổ NHẬN vật tư (phiếu xuất) — trỏ departments, cùng khái niệm với production_jobs.team_department_id. Null = chưa khai / phiếu không phải xuất cho tổ.';
