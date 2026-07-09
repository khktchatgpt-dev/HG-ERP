-- Xưởng xác nhận đã nhận vật tư xuất theo LSX (đóng gap G-3 — FR-PROD-02 "Nên có").
--
-- Nới check production_progress.action: ('start','done') → thêm 'received'.
-- Bản ghi action='received' CHỈ là log xác nhận (kèm note), không đổi
-- current_stage/status của LSX — service enforce. Chưa có workspace Xưởng nên
-- phòng Kế hoạch - Cung ứng / GĐ bấm thay (guard canTrackProgress).
--
-- RLS: bảng production_progress đã enable từ 0014 — migration này không đổi posture.
-- Apply: `npx supabase db push` hoặc SQL editor. Không cần sync types (không đổi cột).

alter table public.production_progress
  drop constraint if exists production_progress_action_check;
alter table public.production_progress
  add constraint production_progress_action_check
  check (action in ('start', 'done', 'received'));
