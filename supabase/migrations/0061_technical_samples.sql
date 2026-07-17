-- 0061_technical_samples.sql
-- Quản lý mẫu showroom: hiện vật + sổ theo dõi mượn/trả + lịch sử tình trạng.
--
-- Trước đây "quản lý mẫu" chỉ là 1 boolean `technical_products.showroom_sample`
-- (0026), trả lời đúng một câu "SP này có mẫu hay không". Không biết có mấy cái,
-- cái nào, ai đang cầm, tình trạng ra sao, bao giờ trả. Ba bảng dưới thay nó.
--
--   technical_samples        1 dòng = 1 HIỆN VẬT. 3 ghế Paxos = 3 dòng, mã riêng.
--   technical_sample_loans   1 dòng = 1 lượt mượn. ĐÂY LÀ SỔ THEO DÕI.
--   technical_sample_events  lịch sử NGOÀI mượn/trả (đổi tình trạng, sửa, mất).
--
-- Chủ quản: phòng Kỹ Thuật → tiền tố `technical_*`. Kinh doanh chỉ xem.
--
-- Mã chứng từ: MS-YYYY-NNNN (mẫu) và PM-YYYY-NNNN (phiếu mượn) qua
-- next_doc_code() — `doc_counters.kind` không có check constraint (0011) nên
-- thêm kind mới KHÔNG cần DDL.
--
-- `status` vs `condition` tách riêng có chủ đích: mẫu đang cho mượn (on_loan)
-- vẫn có thể bị xước (scratched). Gộp làm một là mất thông tin ngay khi mẫu vừa
-- hỏng vừa đi mượn.
--
-- Ảnh mẫu ("4 góc") tái dùng bảng `files` sẵn có qua parent mới `sample_id`,
-- thay vì 4 cột ảnh cứng — upload/signed URL/giới hạn dung lượng/xoá đã có sẵn.
-- Giới hạn 4 ảnh/mẫu ép ở service, không ở DB (đổi số sau khỏi phải migration).
--
-- RLS: cả 3 bảng ENABLED, no policies — app dùng secret key nên bypass, anon key
-- bị chặn hoàn toàn. Giống mọi bảng khác trong dự án.
-- Idempotent: create table/index if not exists, drop+add lại constraint.
-- Apply: `npx supabase db push` hoặc SQL editor. Sau đó "sync types".

-- ── 1. Hiện vật ──────────────────────────────────────────────────────────────
create table if not exists public.technical_samples (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,                       -- MS-2026-0001
  product_id  uuid not null references public.technical_products(id) on delete restrict,
  status      text not null default 'in_showroom'
                check (status in ('in_showroom', 'on_loan', 'maintenance', 'lost', 'disposed')),
  condition   text not null default 'good'
                check (condition in ('new', 'good', 'scratched', 'damaged')),
  location    text,                                       -- kệ A3, góc trưng bày…
  acquired_at date,
  note        text,
  created_by  uuid references public.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists technical_samples_product_idx
  on public.technical_samples (product_id);
create index if not exists technical_samples_status_idx
  on public.technical_samples (status);

drop trigger if exists set_updated_at on public.technical_samples;
create trigger set_updated_at before update on public.technical_samples
  for each row execute function public.set_updated_at();

alter table public.technical_samples enable row level security;

-- ── 2. Sổ theo dõi mượn/trả ──────────────────────────────────────────────────
create table if not exists public.technical_sample_loans (
  id                  uuid primary key default gen_random_uuid(),
  code                text not null unique,               -- PM-2026-0001
  sample_id           uuid not null references public.technical_samples(id) on delete restrict,
  -- Người mượn đa hình: NV nội bộ / khách hàng / đối tác ngoài chưa có hồ sơ.
  borrower_kind       text not null check (borrower_kind in ('user', 'customer', 'other')),
  borrower_user_id    uuid references public.users(id) on delete set null,
  borrower_customer_id uuid references public.sales_customers(id) on delete set null,
  -- BẢN CHỤP tên lúc mượn. FK trên là `on delete set null`, nên khi khách/NV bị
  -- xoá thì sổ vẫn đọc được "ai đã mượn". Sổ mà mất tên người mượn thì hết là sổ.
  borrower_name       text not null,
  borrower_contact    text,
  purpose             text,                               -- chào khách, chụp ảnh, hội chợ…
  borrowed_at         timestamptz not null default now(),
  due_at              date,                               -- hẹn trả
  returned_at         timestamptz,                        -- NULL = đang mượn
  returned_condition  text check (returned_condition in ('new', 'good', 'scratched', 'damaged')),
  issued_by           uuid references public.users(id) on delete set null,
  received_by         uuid references public.users(id) on delete set null,
  note                text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  -- Đúng loại nào thì phải có ref của loại đó.
  constraint loan_borrower_shape check (
    (borrower_kind = 'user'     and borrower_user_id is not null) or
    (borrower_kind = 'customer' and borrower_customer_id is not null) or
    (borrower_kind = 'other')
  ),
  -- Trả rồi thì phải có tình trạng lúc nhận lại.
  constraint loan_return_shape check (
    returned_at is null or returned_condition is not null
  )
);

-- CHỐT CHẶN QUAN TRỌNG NHẤT: 1 mẫu không thể cho 2 người mượn cùng lúc. Đặt ở DB
-- chứ không chỉ ở service, nên dù service có bug hay 2 request vào cùng lúc thì
-- việc cho mượn trùng vẫn là BẤT KHẢ THI.
create unique index if not exists technical_sample_loan_active_uniq
  on public.technical_sample_loans (sample_id) where returned_at is null;

create index if not exists technical_sample_loans_sample_idx
  on public.technical_sample_loans (sample_id, borrowed_at desc);
create index if not exists technical_sample_loans_open_idx
  on public.technical_sample_loans (due_at) where returned_at is null;

drop trigger if exists set_updated_at on public.technical_sample_loans;
create trigger set_updated_at before update on public.technical_sample_loans
  for each row execute function public.set_updated_at();

alter table public.technical_sample_loans enable row level security;

-- ── 3. Lịch sử ngoài mượn/trả ────────────────────────────────────────────────
-- Bảng log riêng theo tiền lệ dự án (user_audit_log 0007), không dùng chung
-- activity_log vì bảng đó khoá cứng vào task (task_id not null, 0002).
create table if not exists public.technical_sample_events (
  id         uuid primary key default gen_random_uuid(),
  sample_id  uuid not null references public.technical_samples(id) on delete cascade,
  actor_id   uuid references public.users(id) on delete set null,
  action     text not null check (action in
               ('created', 'status_changed', 'condition_changed', 'location_changed', 'disposed')),
  before     jsonb not null default '{}'::jsonb,
  after      jsonb not null default '{}'::jsonb,
  note       text,
  created_at timestamptz not null default now()
);

create index if not exists technical_sample_events_sample_idx
  on public.technical_sample_events (sample_id, created_at desc);

alter table public.technical_sample_events enable row level security;

-- ── 4. files: thêm parent `sample` (ảnh 4 góc của từng mẫu) ──────────────────
-- Ảnh gắn theo MẪU chứ không theo SP: mẫu bị xước thì ảnh mẫu phải phản ánh
-- đúng hiện vật đó, trong khi ảnh SP vẫn là ảnh đẹp để chào khách.
alter table public.files
  add column if not exists sample_id uuid
    references public.technical_samples(id) on delete cascade;

alter table public.files drop constraint if exists files_one_parent;
alter table public.files
  add constraint files_one_parent check (
    (case when task_id             is null then 0 else 1 end) +
    (case when comment_id          is null then 0 else 1 end) +
    (case when customer_id         is null then 0 else 1 end) +
    (case when invoice_id          is null then 0 else 1 end) +
    (case when product_id          is null then 0 else 1 end) +
    (case when quote_id            is null then 0 else 1 end) +
    (case when sales_order_id      is null then 0 else 1 end) +
    (case when purchase_order_id   is null then 0 else 1 end) +
    (case when production_order_id is null then 0 else 1 end) +
    (case when sample_id           is null then 0 else 1 end) <= 1
  );

create index if not exists files_sample_idx
  on public.files (sample_id)
  where sample_id is not null and deleted_at is null;
