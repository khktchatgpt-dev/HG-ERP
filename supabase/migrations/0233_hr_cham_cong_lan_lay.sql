-- 0233_hr_cham_cong_lan_lay.sql — Lịch sử mỗi lần lấy dữ liệu từ máy chấm công.
--
-- Chủ dự án chốt 12/10/2026 (câu 3, artboard Chấm công vòng 2): dữ liệu chỉ vào ERP
-- khi Nhân sự bấm "Lấy về từ máy" với một khoảng ngày, nên phải biết ai lấy, lúc
-- nào, khoảng nào, máy nào, được bao nhiêu lượt — để trả lời "tháng này đã lấy đủ
-- chưa". Mỗi lần bấm ghi MỘT DÒNG CHO MỖI MÁY (một máy lỗi không xoá kết quả máy kia).
--
-- RLS: ENABLE, KHÔNG policy → khoá publishable bị chặn, server dùng khoá bí mật.

create table if not exists public.hr_attendance_pulls (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.hr_attendance_devices (id) on delete cascade,
  created_by uuid references public.users (id) on delete set null,
  date_from date not null,
  date_to date not null check (date_to >= date_from),
  started_at timestamptz not null,
  finished_at timestamptz not null default now(),
  ok boolean not null,
  -- tổng lượt máy đang giữ lúc đọc
  device_log_count integer,
  -- lượt trên máy nằm trong khoảng ngày (sau khi bỏ trùng y hệt)
  logs_in_range integer,
  -- trong số đó, bao nhiêu lượt CHƯA có trong ERP trước lần lấy này
  logs_new integer,
  error text,
  created_at timestamptz not null default now()
);

create index if not exists hr_attendance_pulls_started_idx
  on public.hr_attendance_pulls (started_at desc);

alter table public.hr_attendance_pulls enable row level security;
