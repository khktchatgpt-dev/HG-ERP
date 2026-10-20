-- 0208: CHUẨN HOÁ ĐƠN VỊ sản phẩm — gộp các cách viết của cùng một đơn vị.
--
-- BỐI CẢNH. Chủ dự án chốt 19/09/2026: **mọi sản phẩm tính theo CÁI để tách
-- biệt trong sản xuất**, còn đóng gói mới tuỳ khách (đóng riêng từng cái hay
-- đóng chung cả bộ). Đo cùng ngày thì dữ liệu vốn đã gần như vậy rồi:
--   · dòng lệnh SX: 257/291 (88%) là "cái"
--   · hồ sơ SP:     798/807 (99%) là "cái"
-- nhưng cùng một đơn vị đang có nhiều cách viết, và máy coi chúng là khác
-- nhau: `cái` · `Cái` · `cai` · `pcs`, rồi `bộ` · `Bộ` · `set`. Mọi phép gom
-- theo đơn vị vì thế đều tách thành nhiều nhóm giả.
--
-- LÀM GÌ: chỉ gộp CÁCH VIẾT. `Cái`/`cai`/`pcs` → `cái`; `Bộ`/`set` → `bộ`.
--
-- KHÔNG LÀM: đổi `bộ` → `cái`. Nghe thì đúng chủ trương, nhưng đó là quyết
-- định NGHIỆP VỤ của từng mã chứ không phải phép thay chuỗi. Ví dụ thật:
-- ST0221HG-IR khai ba "cụm" tên là `Arm chair` · `Sofa` · `Table` — đó không
-- phải cụm hàn, đó là BA CÁI khác nhau nằm trong một bộ. Mã ấy cần Kỹ thuật
-- TÁCH THÀNH BA MÃ SP, và chừng nào chưa tách thì đổi đơn vị của nó sang
-- "cái" chỉ che mất vấn đề: số lượng vẫn là 1, mà 1 "cái" đó thật ra là ba
-- món. Sáu mã ST còn lại thì cụm đúng nghĩa cụm hàn (Cụm ngồi · Cụm tựa ·
-- Cụm hông) nên chúng là MỘT cái thật, đổi được — nhưng vẫn phải người biết
-- nghề xác nhận từng mã.
--
-- Nên migration này để lại `bộ` nguyên vẹn như một DANH SÁCH VIỆC nhìn thấy
-- được: còn mã nào mang đơn vị `bộ` nghĩa là còn mã đó chưa được rà.
--
-- RLS: không đổi posture. Idempotent: update theo điều kiện, chạy lại vô hại.

-- ── Hồ sơ sản phẩm ──────────────────────────────────────────────────────────
update public.technical_products
set unit = 'cái'
where unit is not null
  and lower(btrim(unit)) in ('cai', 'cái', 'pcs', 'pc', 'piece')
  and unit <> 'cái';

update public.technical_products
set unit = 'bộ'
where unit is not null
  and lower(btrim(unit)) in ('bo', 'bộ', 'set')
  and unit <> 'bộ';

-- ── Dòng lệnh sản xuất ──────────────────────────────────────────────────────
-- Dòng lệnh là bản chụp lúc phát lệnh; sửa chính tả ở đây KHÔNG đổi số lượng
-- hay ý nghĩa, chỉ làm các phép gom theo đơn vị thôi tách nhóm giả.
update public.production_order_lines
set unit = 'cái'
where unit is not null
  and lower(btrim(unit)) in ('cai', 'cái', 'pcs', 'pc', 'piece')
  and unit <> 'cái';

update public.production_order_lines
set unit = 'bộ'
where unit is not null
  and lower(btrim(unit)) in ('bo', 'bộ', 'set')
  and unit <> 'bộ';
