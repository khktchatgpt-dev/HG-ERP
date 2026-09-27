-- 0213 — THEO DÕI THỰC HIỆN ĐƠN MUA: sổ hẹn giao, sổ sự cố, đơn bổ sung,
-- loại chứng từ NCC.
--
-- Bối cảnh (27/09/2026): chủ dự án đối chiếu 18 tình huống thực tế của nhân
-- viên cung ứng. Bốn chỗ hệ thống đang ghi bằng CHỮ trong ghi chú hoặc không
-- ghi gì:
--   1. `supply_po_commit_log` — lịch sử HẸN GIAO: ngày mình đề nghị → NCC cam
--      kết → dời hẹn → huỷ đợt. Trước đây `expected_date` / `expected_at` bị
--      ghi đè, vết chỉ còn là "[Dời …]" trong note — không ai trả lời được
--      "NCC đã hứa mấy lần, lần đầu hứa ngày nào".
--   2. `supply_po_issues` — SỰ CỐ giao hàng (sai quy cách, thiếu/dư, hỏng, trễ):
--      ghi nhận sai lệch thay vì sửa đơn "cho khớp". Mở → đã xử lý (kèm cách xử
--      lý). Đếm được theo NCC.
--   3. `supply_purchase_orders.source_po_id` — đơn BỔ SUNG cho phần NCC giao
--      thiếu (hoặc chuyển NCC khác) trỏ về đơn gốc; trước đây đơn mới không có
--      liên kết nào với đơn thiếu.
--   4. `files.doc_type` thêm loại chứng từ NCC: báo giá, xác nhận đơn, hợp
--      đồng, phiếu giao, hoá đơn (CO/CQ đi `cert` sẵn có).
--
-- Không xoá, chỉ ghi thêm: hai sổ mới chỉ INSERT (sự cố thì cập nhật trạng
-- thái đóng). RLS: ENABLE, không policy (anon chặn, secret key bypass).
-- Idempotent.

-- 1 · SỔ HẸN GIAO ─────────────────────────────────────────────────────────
create table if not exists public.supply_po_commit_log (
  id           uuid primary key default gen_random_uuid(),
  po_id        uuid not null references public.supply_purchase_orders(id) on delete cascade,
  shipment_id  uuid references public.supply_po_shipments(id) on delete set null,
  -- de_nghi: lịch mình đề nghị lúc soạn (bị thay khi NCC xác nhận)
  -- ncc_xac_nhan: NCC cam kết một đợt · them_dot: hẹn thêm đợt bù
  -- doi_hen: dời ngày một đợt · huy_dot: huỷ một đợt · doi_hen_don: dời hẹn cả đơn
  kind         text not null check (kind in ('de_nghi', 'ncc_xac_nhan', 'them_dot', 'doi_hen', 'huy_dot', 'doi_hen_don')),
  date_before  date,
  date_after   date,
  -- Hàng trong đợt lúc ghi: [{po_line_id, qty}] — chụp lại, không trỏ sống.
  lines        jsonb not null default '[]'::jsonb,
  reason       text,
  created_by   uuid references public.users(id) on delete set null,
  created_at   timestamptz not null default now()
);
create index if not exists supply_po_commit_log_po_idx on public.supply_po_commit_log (po_id, created_at);
alter table public.supply_po_commit_log enable row level security;

-- 2 · SỔ SỰ CỐ GIAO HÀNG ──────────────────────────────────────────────────
create table if not exists public.supply_po_issues (
  id            uuid primary key default gen_random_uuid(),
  po_id         uuid not null references public.supply_purchase_orders(id) on delete cascade,
  po_line_id    uuid references public.supply_purchase_order_lines(id) on delete set null,
  kind          text not null check (kind in ('sai_quy_cach', 'thieu_so_luong', 'du_so_luong', 'hong_loi', 'giao_tre', 'khac')),
  qty           numeric check (qty is null or qty >= 0),
  description   text not null check (length(btrim(description)) >= 5),
  status        text not null default 'mo' check (status in ('mo', 'da_xu_ly')),
  resolution    text,
  created_by    uuid references public.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  resolved_by   uuid references public.users(id) on delete set null,
  resolved_at   timestamptz,
  constraint supply_po_issues_resolved_chk check (
    (status = 'mo' and resolved_at is null)
    or (status = 'da_xu_ly' and resolved_at is not null and length(btrim(coalesce(resolution, ''))) >= 5)
  )
);
create index if not exists supply_po_issues_po_idx on public.supply_po_issues (po_id, created_at);
alter table public.supply_po_issues enable row level security;

-- 3 · ĐƠN BỔ SUNG → ĐƠN GỐC ───────────────────────────────────────────────
alter table public.supply_purchase_orders
  add column if not exists source_po_id uuid references public.supply_purchase_orders(id) on delete set null;
create index if not exists supply_purchase_orders_source_idx on public.supply_purchase_orders (source_po_id)
  where source_po_id is not null;

-- 4 · LOẠI CHỨNG TỪ NCC ───────────────────────────────────────────────────
alter table public.files drop constraint if exists files_doc_type_valid;
alter table public.files
  add constraint files_doc_type_valid check (
    doc_type is null
    or doc_type in (
      'drawing', 'bom', 'packing', 'assembly', 'image', 'cert', 'other',
      'quote', 'po_confirm', 'contract', 'delivery_note', 'invoice'
    )
  );
