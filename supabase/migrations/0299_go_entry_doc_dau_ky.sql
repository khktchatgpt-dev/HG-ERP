-- 0299: GỠ SỐ ĐẦU KỲ (0298) — 14/11/2026, chủ dự án: "bỏ số đầu kỳ đi vì thống
-- kê ghi sản lượng hằng ngày".
--
-- 0298 thêm production_entry_docs.kind ('ngay' | 'dau_ky') + production_entries.dau_ky
-- để nhập MỘT lần luỹ kế trước khi dùng ERP. Bỏ tính năng: số đã làm từ trước
-- (nếu cần) ghi lùi từng ngày ở Ghi sản lượng như phiếu thường. Trước khi gỡ, DB
-- chỉ có một phiếu đầu kỳ — PBS-2026-0033 trên lệnh giả "TEST-NHAP 14/11" — đã
-- xoá theo id cùng lượt.
--
-- Mã chưa từng lên main dùng hai cột này, nên gỡ không làm hỏng bản đang chạy.
-- RLS: hai bảng giữ nguyên (enable, không policy). Idempotent.

drop index if exists public.production_entries_dau_ky_idx;
drop index if exists public.production_entry_docs_dau_ky_uq;

alter table public.production_entry_docs
  drop constraint if exists production_entry_docs_kind_chk;
alter table public.production_entry_docs
  drop column if exists kind;

alter table public.production_entries
  drop column if exists dau_ky;
