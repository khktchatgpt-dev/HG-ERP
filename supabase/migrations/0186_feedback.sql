-- 0186_feedback.sql
-- GÓP Ý HỆ THỐNG ("System Feedback") — nhân viên ghi góp ý về hệ thống / vận
-- hành từ mọi trang, có luồng trao đổi, vòng mở lại, cửa xác nhận tuỳ chọn,
-- "tôi cũng gặp", tóm tắt tuần. Mang từ Nam An ERP v2 (gói goi-system-feedback,
-- 20/10/2026), viết lại theo chuẩn dự án.
--
-- 4 bảng mới (lõi, không prefix phòng vì là tính năng dùng chung):
--   feedback                 — một góp ý (đầu phiếu + trạng thái + vòng + cửa xác nhận)
--   feedback_votes           — "tôi cũng gặp" (user_id × feedback_id)
--   feedback_comments        — luồng trao đổi: bình luận / trả lời chính thức /
--                              "vẫn cần chỉnh thêm" / "đã ổn" / mốc đổi trạng thái
--   feedback_weekly_updates  — tóm tắt cập nhật từng tuần (week_start = thứ Hai)
-- Cộng:
--   files.feedback_id        — tệp / ảnh chụp màn hình kèm góp ý hoặc dòng trao đổi
--                              (gắn theo góp ý; dòng trao đổi giữ danh sách id ở file_ids)
--   notifications type       — thêm 6 loại feedback_* (và trả lại lsx_orders_changed /
--                              lsx_revised bị 0162 làm rơi khỏi constraint)
--   permissions              — 'feedback.manage' (xử lý góp ý), seed cho 'director';
--                              admin bypass theo cột users.role như mọi nơi.
--   Người xác nhận (cửa) lưu ở bảng settings key 'feedback_reviewers' (jsonb mảng
--   user id) — không cần bảng mới.
--
-- RLS: ENABLE, no policies trên cả 4 bảng — anon bị chặn, server secret key bypass
-- (chuẩn dự án). Idempotent: chạy lại vô hại. Apply: `npx supabase db push` hoặc
-- SQL editor. Sau đó "sync types" (src/lib/database.types.ts đã được điền tay
-- cùng hình với output máy; regen để chắc).

-- ── feedback ───────────────────────────────────────────────────────────────

create table if not exists public.feedback (
  id               uuid primary key default gen_random_uuid(),
  kind             text not null check (kind in ('system','operation')),
  type             text not null check (type in ('bug','idea','hard_to_use','process','question')),
  severity         text not null default 'annoying' check (severity in ('blocking','annoying','nice')),
  title            text not null,
  content          text not null,
  page_url         text,
  page_title       text,
  is_private       boolean not null default false,
  topic            text,
  status           text not null default 'new' check (status in (
                     'pending_review','returned','new','reviewing','planned','done','declined','reopened')),
  reopen_count     int not null default 0,
  reopened_at      timestamptz,
  confirmed_ok_at  timestamptz,
  -- Cửa xác nhận: null = chưa qua cửa (hoặc không đi qua cửa).
  gate_passed_at   timestamptz,
  reviewed_by      uuid references public.users(id) on delete set null,
  reviewed_at      timestamptz,
  returned_reason  text,
  returned_at      timestamptz,
  -- Lần gửi / gửi lại gần nhất của người viết — mốc tính "chưa ai khác trả lời".
  submitted_at     timestamptz not null default now(),
  admin_reply      text,
  admin_reply_by   uuid references public.users(id) on delete set null,
  admin_replied_at timestamptz,
  done_at          timestamptz,
  created_by       uuid references public.users(id) on delete set null,
  department_id    uuid references public.departments(id) on delete set null,
  file_ids         uuid[] not null default '{}',
  edited_at        timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists feedback_status_idx     on public.feedback (status);
create index if not exists feedback_created_idx    on public.feedback (created_at desc);
create index if not exists feedback_created_by_idx on public.feedback (created_by);

drop trigger if exists trg_feedback_updated_at on public.feedback;
create trigger trg_feedback_updated_at
  before update on public.feedback
  for each row execute function public.set_updated_at();

-- ── feedback_votes ─────────────────────────────────────────────────────────

create table if not exists public.feedback_votes (
  feedback_id uuid not null references public.feedback(id) on delete cascade,
  user_id     uuid not null references public.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (feedback_id, user_id)
);

-- ── feedback_comments ──────────────────────────────────────────────────────

create table if not exists public.feedback_comments (
  id           uuid primary key default gen_random_uuid(),
  feedback_id  uuid not null references public.feedback(id) on delete cascade,
  kind         text not null check (kind in ('comment','reply','needs_more','confirmed','status')),
  content      text,
  author_id    uuid references public.users(id) on delete set null,
  is_admin     boolean not null default false,
  round        int not null default 0,
  from_status  text,
  to_status    text,
  file_ids     uuid[] not null default '{}',
  mention_ids  uuid[] not null default '{}',
  edited_at    timestamptz,
  created_at   timestamptz not null default now()
);

create index if not exists feedback_comments_fb_idx on public.feedback_comments (feedback_id, created_at);

-- ── feedback_weekly_updates ────────────────────────────────────────────────

create table if not exists public.feedback_weekly_updates (
  id          uuid primary key default gen_random_uuid(),
  week_start  date not null unique,
  title       text,
  content     text not null,
  author_id   uuid references public.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists trg_feedback_weekly_updates_updated_at on public.feedback_weekly_updates;
create trigger trg_feedback_weekly_updates_updated_at
  before update on public.feedback_weekly_updates
  for each row execute function public.set_updated_at();

-- ── files.feedback_id ──────────────────────────────────────────────────────

alter table public.files
  add column if not exists feedback_id uuid references public.feedback(id) on delete set null;
create index if not exists files_feedback_idx on public.files (feedback_id) where feedback_id is not null;

-- ── notifications: loại mới ────────────────────────────────────────────────

alter table public.notifications
  drop constraint if exists notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check
  check (type in ('assigned','reassigned','status_changed','submitted',
                  'approved','rejected','commented','due_soon','overdue',
                  'quote_submitted','quote_approved','quote_rejected',
                  'wh_receipt','wh_stock_low','wh_return','wh_doc_reversed',
                  'wh_stocktake_pending','wh_stocktake_approved','wh_stocktake_rejected',
                  'po_submitted','po_approved','po_rejected',
                  'po_withdrawn','po_reassigned','po_closed_short','po_late',
                  'lsx_submitted','lsx_approved','lsx_rejected',
                  'lsx_orders_changed','lsx_revised',
                  'order_changed','order_cancelled',
                  'stage_handoff','incident_reported','incident_resolved',
                  'feedback_new','feedback_reviewed','feedback_processed',
                  'feedback_commented','feedback_mentioned','feedback_confirmed'));

-- ── Quyền ──────────────────────────────────────────────────────────────────

insert into public.permissions (key, label, domain, sort_order)
values ('feedback.manage', 'Xử lý góp ý hệ thống (đổi trạng thái, trả lời, tóm tắt tuần, xuất cho AI)', 'feedback', 10)
on conflict (key) do nothing;

insert into public.role_permissions (role_id, permission_key)
select r.id, v.pkey
from (values ('director', 'feedback.manage')) as v(rkey, pkey)
join public.roles r on r.key = v.rkey
on conflict do nothing;

-- ── RLS ────────────────────────────────────────────────────────────────────

alter table public.feedback                enable row level security;
alter table public.feedback_votes          enable row level security;
alter table public.feedback_comments       enable row level security;
alter table public.feedback_weekly_updates enable row level security;
