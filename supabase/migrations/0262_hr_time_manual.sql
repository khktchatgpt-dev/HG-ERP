-- 0262 — Công nhập tay của kỳ công (bản vẽ duyệt 22/10/2026, https://claude.ai/artifact/PYQ1Dw2WkN1Ge3ydzhLchq).
--
-- Người "không chấm công" (hr_employees.attendance_exempt) trước đây được tự cho đủ công chuẩn;
-- sổ lương T9 ghi công thật 26–32 + giờ tăng ca → ERP lệch sổ 18,6 tr. Nay Nhân sự nhập số công
-- + giờ tăng ca cho từng người mỗi kỳ (khối A, kind 'exempt' — bắt buộc trước khi chốt). Kind
-- 'extra' dành cho khối B (công cộng thêm ngoài máy, bước sau) — mở sẵn để khỏi đổi ràng buộc.
--
--   hr_time_manual            một dòng = một người × một kỳ ('YYYY-MM') × một loại
--   hr_time_results.manual    dòng bản chốt của người không chấm công mang công NHẬP TAY
--                             (frame_minutes = phút hành chính + phút tăng ca); false = cách cũ "đủ công"
--   hr_period_events.kind     thêm 'manual_set' — mỗi lần nhập / sửa / xoá ghi vết vào dòng thời gian kỳ
--
-- Kỳ không dùng FK tới hr_time_periods: dòng kỳ chỉ sinh khi đặt khoảng / chốt, còn công nhập
-- được trước đó. Khoá sau chốt kiểm ở service (giống phiếu điều chỉnh).
-- RLS: bật, KHÔNG policy (anon bị chặn, secret key đi qua service). Idempotent.

create table if not exists public.hr_time_manual (
  id uuid primary key default gen_random_uuid(),
  period text not null check (period ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  employee_id uuid not null references public.hr_employees (id) on delete restrict,
  kind text not null default 'exempt' check (kind in ('exempt', 'extra')),
  work_days numeric(5, 2) not null check (work_days >= 0 and work_days <= 31),
  ot_minutes integer not null default 0 check (ot_minutes >= 0 and ot_minutes <= 44640),
  reason text check (reason is null or char_length(reason) <= 120),
  note text check (note is null or char_length(note) <= 300),
  created_by uuid references public.users (id) on delete set null,
  updated_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists hr_time_manual_exempt_uq
  on public.hr_time_manual (period, employee_id) where kind = 'exempt';
create index if not exists hr_time_manual_period_idx on public.hr_time_manual (period);

drop trigger if exists hr_time_manual_updated_at on public.hr_time_manual;
create trigger hr_time_manual_updated_at
  before update on public.hr_time_manual
  for each row execute function public.set_updated_at();

alter table public.hr_time_manual enable row level security;

alter table public.hr_time_results add column if not exists manual boolean not null default false;

alter table public.hr_period_events drop constraint if exists hr_period_events_kind_check;
alter table public.hr_period_events
  add constraint hr_period_events_kind_check check (kind in (
    'team_confirm', 'team_unconfirm', 'close', 'reopen_request', 'reopen_withdraw',
    'reopen_approve', 'reopen_reject', 'set_range', 'manual_set'
  ));
