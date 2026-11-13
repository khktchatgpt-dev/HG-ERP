-- 0296: GIỜ CÔNG TRÊN PHIẾU BÁO SẢN LƯỢNG (11/11/2026, bản vẽ Thống kê &
-- Sản xuất https://claude.ai/artifact/LocfQfiJSjv6Sxc8a9KQ6N, Q1 duyệt).
--
-- Sổ Excel thống kê đang dùng ("Tổng hợp tiến độ – năng suất") ghi ca · số
-- công nhân · giờ/người trên TỪNG DÒNG chi tiết, nên một tổ 4 người × 7 giờ
-- chép lên 97 dòng thành 2.716 giờ công trong một ngày. Giờ công thuộc về
-- tổ × ngày × ca × công đoạn — tức là ĐẦU PHIẾU (production_entry_docs), ghi
-- một lần, mọi dòng trong phiếu dùng chung. Năng suất = Σ kg ÷ Σ giờ công.
--
-- Cột để trống được: phiếu NHÁP chưa cần, phiếu cũ không có. Bắt buộc khi ghi
-- CHÍNH THỨC — kiểm ở service (entries.service record / submitDoc), không ở
-- DB, để nạp lịch sử từ Excel về sau không bị chặn.
--
-- `labor_hours` là cột SINH (worker_count × hours_per_worker): báo cáo cộng
-- thẳng, không ai phải nhân lại.
--
-- RLS: bảng đã enable row level security, không policy (0172) — không đổi.
-- Idempotent.

alter table public.production_entry_docs
  add column if not exists shift smallint,
  add column if not exists worker_count smallint,
  add column if not exists hours_per_worker numeric(4, 2);

alter table public.production_entry_docs
  add column if not exists labor_hours numeric(8, 2)
  generated always as (worker_count * hours_per_worker) stored;

alter table public.production_entry_docs
  drop constraint if exists production_entry_docs_shift_chk;
alter table public.production_entry_docs
  add constraint production_entry_docs_shift_chk
  check (shift is null or shift between 1 and 3);

alter table public.production_entry_docs
  drop constraint if exists production_entry_docs_worker_count_chk;
alter table public.production_entry_docs
  add constraint production_entry_docs_worker_count_chk
  check (worker_count is null or worker_count between 1 and 500);

alter table public.production_entry_docs
  drop constraint if exists production_entry_docs_hours_chk;
alter table public.production_entry_docs
  add constraint production_entry_docs_hours_chk
  check (hours_per_worker is null or (hours_per_worker > 0 and hours_per_worker <= 24));

comment on column public.production_entry_docs.shift is 'Ca làm (1–3). Giờ công của phiếu thuộc về tổ × ngày × ca × công đoạn.';
comment on column public.production_entry_docs.worker_count is 'Số công nhân làm phiếu này.';
comment on column public.production_entry_docs.hours_per_worker is 'Giờ mỗi người (0,5–24).';
comment on column public.production_entry_docs.labor_hours is 'Giờ công = số CN × giờ/người (cột sinh).';
