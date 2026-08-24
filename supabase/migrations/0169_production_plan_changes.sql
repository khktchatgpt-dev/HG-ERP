-- 0169: production_plan_changes — NHẬT KÝ ĐIỀU CHỈNH kế hoạch sản xuất
-- (plan-hoan-thien-ke-hoach-sx #6, user chốt 23/08/2026): mỗi lần sửa lộ
-- trình/giao tổ/hạn của một dòng SP ghi một bản diff — truy lại được "ai đổi
-- gì, lúc nào, vì sao". Dòng SP có việc ĐÃ CHẠY thì service bắt buộc lý do.
-- Append-only: không update/delete từ app.
-- RLS: enable, no policies (anon chặn, secret-key server bypass).
-- Idempotent: create if not exists.

create table if not exists production_plan_changes (
  id uuid primary key default gen_random_uuid(),
  production_order_id uuid not null references production_orders(id) on delete cascade,
  production_order_line_id uuid references production_order_lines(id) on delete set null,
  -- {added:[stage], removed:[stage], changed:[{stage, field, from, to}]}
  changes jsonb not null,
  reason text,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists production_plan_changes_lsx_idx
  on production_plan_changes (production_order_id, created_at desc);

alter table production_plan_changes enable row level security;
