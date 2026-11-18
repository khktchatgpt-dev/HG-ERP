-- 0302_mau_ra_soat.sql
-- Rà soát mẫu showroom (phiếu chuyển thông tin 101026 của PKD, 17/11/2026; bản vẽ
-- duyệt 18/11: https://claude.ai/artifact/5paor21D4gkJSGPBBddUjq).
--
-- Đo 18/11: ERP có 2 mẫu (dữ liệu thử 07/2026), 0/147 SP có cờ showroom_sample —
-- đợt rà thực chất là nhập gần như toàn bộ mẫu lần đầu, và không có chỗ ghi
-- "mẫu này đã kiểm" hay "đã treo thẻ".
--
--   checked_at / checked_by — lần rà GẦN NHẤT (ai bấm "Có ở đây"). Mỗi lần rà
--       còn ghi một dòng `technical_sample_events` action 'checked' để giữ vết.
--       KHÔNG lập bảng "đợt rà": đợt = ngày "tính từ" trên màn (Q1 bản vẽ).
--   tagged_at — ngày treo thẻ (B2 in thẻ sẽ ghi; B1 chỉ có cột).
--   ref_code — mã SP gõ tay khi SP CHƯA có hồ sơ trên ERP (mẫu ghi tạm,
--       kind='prototype', Q2 bản vẽ). Kỹ thuật lập hồ sơ rồi nối vào sau.
--
-- Quyền: permission mới `technical.sample.audit` (rà mẫu: có ở đây / mất / thêm
-- nhanh) seed cho `sales_staff` — PKD ra phiếu và phối hợp rà showroom (Q5).
-- Kỹ thuật (`technical.member`) vẫn làm được mọi việc như cũ; mượn/trả, sửa,
-- thanh lý vẫn chỉ Kỹ thuật.
--
-- RLS: technical_samples / technical_sample_events đã ENABLED no-policies từ
-- 0061 — không đổi. Idempotent: add column if not exists, drop+add constraint,
-- on conflict do nothing.

alter table public.technical_samples
  add column if not exists checked_at timestamptz,
  add column if not exists checked_by uuid references public.users(id) on delete set null,
  add column if not exists tagged_at  timestamptz,
  add column if not exists ref_code   text;

alter table public.technical_sample_events
  drop constraint if exists technical_sample_events_action_check;
alter table public.technical_sample_events
  add constraint technical_sample_events_action_check
  check (action in ('created', 'status_changed', 'condition_changed',
                    'location_changed', 'disposed', 'checked'));

insert into public.permissions (key, label, domain, sort_order)
values ('technical.sample.audit', 'Rà soát mẫu showroom (có ở đây / mất / thêm nhanh)', 'technical', 60)
on conflict (key) do nothing;

insert into public.role_permissions (role_id, permission_key)
select r.id, v.pkey
from (values ('sales_staff', 'technical.sample.audit'),
             ('technical_staff', 'technical.sample.audit')) as v(rkey, pkey)
join public.roles r on r.key = v.rkey
on conflict do nothing;
