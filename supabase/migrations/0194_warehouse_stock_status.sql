-- 0194 — TRẠNG THÁI CỦA LƯỢNG: dùng được / chờ kiểm / khoá.
--
-- BỐI CẢNH (Đợt 2 của `docs/thiet-ke-kho.md`). Hôm nay hàng không đạt KHÔNG VÀO
-- SỔ: `qty_rejected` được ghi nhưng không tính vào tồn (BR-10 của 0010). Nghĩa
-- là 200 cây nhôm sai hợp kim nằm thật ngoài sân mà không bảng nào đếm được,
-- không ai nhắc, và không ai chấm được chất lượng nhà cung cấp.
--
-- SAP chia tồn làm ba ngay từ lúc nhận (Unrestricted / Quality Inspection /
-- Blocked); NetSuite gọi là Inventory Status. Cùng một mã, cùng một kệ, ba con
-- số khác nhau, và chuyển giữa chúng là một bút toán có người ký.
--
-- CHUYỂN TRẠNG THÁI = MỘT CẶP DÒNG SỔ (out khỏi trạng thái cũ + in vào trạng
-- thái mới) nối bằng `transfer_group` — đúng cách điều chuyển kệ đang làm.
-- Không có cột nào bị UPDATE tại chỗ: sổ chỉ cộng thêm, không sửa lùi.
--
-- MẶC ĐỊNH 'ok' cho 265 dòng cũ — ĐÚNG SỰ THẬT, không phải cho tiện: hàng không
-- đạt trước nay bị loại ngoài sổ, nên mọi dòng đã ghi đều là hàng đạt.
--
-- CỜ "CẦN KIỂM" ĐẶT TRÊN NHÓM, không trên từng mã, và MẶC ĐỊNH TẮT
-- (`catalog_items.meta->>'needs_inspection'`, type = 'material_group'). Không
-- bật nhóm nào thì trạng thái 'qc' không bao giờ xuất hiện và hệ thống hành xử
-- y hệt phương án hai trạng thái — chi phí bằng 0. Bỏ hẳn trạng thái rồi cần
-- lại thì phải chia lại số dư từng mã bằng tay, nên giữ là chiều rẻ hơn.
-- Không cần đổi schema: `meta` đã là jsonb và đang giữ `po_template`.
--
-- `is_low` GIỮ NGUYÊN trên `on_hand`, CÓ CHỦ Ý. Nó là ngưỡng đặt lại hàng, và
-- 0160 ghi rõ ba nơi phải đồng nhất (view + sweep 0159 + notifyLowStock). Đổi
-- nền tính sang `qty_ok` là đổi hành vi một cron — việc đáng làm nhưng phải đi
-- một migration riêng có tên đúng, không đi ké một migration cấu trúc.
--
-- RLS: view dùng security_invoker = on như cũ. Idempotent. Apply xong "sync types".

alter table public.warehouse_movements
  add column if not exists stock_status text not null default 'ok'
    check (stock_status in ('ok', 'qc', 'blocked'));

create index if not exists warehouse_movements_status_idx
  on public.warehouse_movements (material_id, stock_status);

-- ── Tồn theo VẬT TƯ ─────────────────────────────────────────────────────────
-- `create or replace view` chỉ cho THÊM cột vào cuối, không cho đổi thứ tự cột
-- đang có — nên thân 0160 giữ nguyên từng chữ, ba cột mới nối sau `is_low`.
--
-- `on_hand` GIỮ NGHĨA CŨ = tổng mọi trạng thái. Mọi nơi đang đọc nó không gãy.
-- Chỗ nào tính ĐỦ/THIẾU phải đổi sang `qty_ok` — service làm việc đó, không
-- phải view, vì view không biết ai hỏi để làm gì.
create or replace view public.warehouse_stock with (security_invoker = on) as
select
  m.id            as material_id,
  m.code,
  m.name,
  m.unit,
  m.group_name,
  m.min_stock,
  m.shelf_location,
  m.is_active,
  coalesce(
    sum(case mv.direction when 'in' then mv.qty when 'out' then -mv.qty else 0 end),
    0
  )               as on_hand,
  (m.min_stock > 0 and coalesce(
    sum(case mv.direction when 'in' then mv.qty when 'out' then -mv.qty else 0 end),
    0
  ) < m.min_stock) as is_low,
  coalesce(sum(case when mv.stock_status = 'ok'
    then case mv.direction when 'in' then mv.qty when 'out' then -mv.qty else 0 end
    else 0 end), 0) as qty_ok,
  coalesce(sum(case when mv.stock_status = 'qc'
    then case mv.direction when 'in' then mv.qty when 'out' then -mv.qty else 0 end
    else 0 end), 0) as qty_qc,
  coalesce(sum(case when mv.stock_status = 'blocked'
    then case mv.direction when 'in' then mv.qty when 'out' then -mv.qty else 0 end
    else 0 end), 0) as qty_blocked
from public.warehouse_materials m
left join public.warehouse_movements mv on mv.material_id = m.id
group by m.id;

-- ── Tồn theo (VẬT TƯ × KHU × TRẠNG THÁI) ────────────────────────────────────
-- View RIÊNG chứ không đổi grain của `warehouse_stock`: đổi grain là gãy mọi
-- nơi đang đọc nó. Đây là nguồn của màn "Chờ cất" (còn gì ở khu `receiving`)
-- và của tab "Tồn theo kệ" trên hồ sơ vật tư.
--
-- Bỏ các cặp có tổng bằng 0 để bảng không đầy dòng rỗng — một mã đã dời hết
-- khỏi kệ A thì kệ A không còn là câu trả lời cho "hàng để đâu".
create or replace view public.v_warehouse_stock_by_bin
  with (security_invoker = on) as
select
  mv.material_id,
  mv.bin_id,
  b.code                as bin_code,
  b.name                as bin_name,
  b.kind                as bin_kind,
  mv.stock_status,
  sum(case mv.direction when 'in' then mv.qty when 'out' then -mv.qty else 0 end) as qty
from public.warehouse_movements mv
left join public.warehouse_bins b on b.id = mv.bin_id
group by mv.material_id, mv.bin_id, b.code, b.name, b.kind, mv.stock_status
having sum(case mv.direction when 'in' then mv.qty when 'out' then -mv.qty else 0 end) <> 0;
