-- 0259 — Khoảng kỳ công do Nhân sự tự đặt (bản vẽ duyệt 21/10/2026, Q1–Q5 theo đề xuất).
--
-- Khoảng kỳ nằm sẵn ở hr_time_periods.date_from / date_to (0244); trước đây dòng kỳ chỉ sinh
-- lúc chốt với khoảng cứng 26 → 25. Nay Nhân sự đặt từ–đến từng kỳ ngay khi kỳ còn mở (dòng
-- kỳ sinh lúc đặt, status 'open'); ERP chặn chồng ngày ở tầng service. Mỗi lần đặt ghi một
-- sự kiện 'set_range' (khoảng cũ → mới + lý do) vào dòng thời gian kỳ.
--
-- RLS: không bảng mới; hr_period_events đã bật RLS không policy — giữ nguyên.
-- Idempotent: drop constraint if exists rồi tạo lại.

alter table public.hr_period_events drop constraint if exists hr_period_events_kind_check;
alter table public.hr_period_events
  add constraint hr_period_events_kind_check check (kind in (
    'team_confirm', 'team_unconfirm', 'close', 'reopen_request', 'reopen_withdraw',
    'reopen_approve', 'reopen_reject', 'set_range'
  ));
