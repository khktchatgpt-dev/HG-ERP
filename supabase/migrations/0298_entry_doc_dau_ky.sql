-- 0298: SỐ ĐẦU KỲ TRÊN SỔ SẢN LƯỢNG (14/11/2026, bản vẽ "Ghi sổ & số đầu kỳ"
-- https://claude.ai/artifact/ETJafgkaa8oT2esXzmKGmw, Q1–Q4 duyệt).
--
-- Lệnh đang chạy đã làm một phần TRƯỚC khi xưởng ghi sổ trên ERP. Thống kê
-- nhập MỘT lần tổng đã làm tới hết một ngày, mỗi lệnh × công đoạn × tổ một
-- phiếu (Q3). Phiếu đầu kỳ không ca, không giờ công, không lỗi; nó vào luỹ kế
-- (đã làm · còn lại · khả dụng · tiến độ) nhưng KHÔNG vào Năng suất, Báo cáo
-- theo kỳ, dải 14 ngày, Sổ ngày (Q4).
--
--   production_entry_docs.kind  'ngay' (phiếu sản lượng ngày, mặc định) | 'dau_ky'
--   production_entries.dau_ky   chép cờ của phiếu xuống dòng — các truy vấn
--                               THEO NGÀY lọc thẳng trên bảng dòng, khỏi join.
--
-- Mặc định giữ nguyên nghĩa cũ: mọi phiếu / dòng đã có là phiếu ngày; mã cũ
-- không biết hai cột này vẫn chạy đúng.
--
-- RLS: hai bảng đã enable row level security, không policy (0084, 0172) — không
-- đổi. Idempotent.

alter table public.production_entry_docs
  add column if not exists kind text not null default 'ngay';

alter table public.production_entry_docs
  drop constraint if exists production_entry_docs_kind_chk;
alter table public.production_entry_docs
  add constraint production_entry_docs_kind_chk check (kind in ('ngay', 'dau_ky'));

alter table public.production_entries
  add column if not exists dau_ky boolean not null default false;

-- Một phiếu đầu kỳ cho mỗi lệnh × công đoạn × tổ (Q3). Tổ trống gộp thành một
-- khoá để hai phiếu "không tổ" cũng không lọt.
create unique index if not exists production_entry_docs_dau_ky_uq
  on public.production_entry_docs (
    production_order_id,
    stage,
    coalesce(team_department_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  where kind = 'dau_ky';

-- Truy vấn theo ngày lọc `dau_ky = false` — chỉ mục theo ngày sẵn có vẫn dùng
-- được; thêm chỉ mục phần cho dòng đầu kỳ (ít) để Sổ đã ghi / dọn dẹp tìm nhanh.
create index if not exists production_entries_dau_ky_idx
  on public.production_entries (production_order_id)
  where dau_ky;
