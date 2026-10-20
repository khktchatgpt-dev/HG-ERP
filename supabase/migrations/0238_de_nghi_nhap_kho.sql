-- 0238 — ĐỀ NGHỊ MUA · Đ3/Đ4: KHO NHẬP HÀNG ĐÃ MUA + KHÉP PHIẾU (13/10/2026)
--
-- Chủ dự án 13/10: phiếu đề nghị được duyệt thì KHO tự đi mua và tự nhập kho,
-- không qua Cung ứng lập đơn mua. Bản vẽ DN-3 / DN-5
-- (https://claude.ai/artifact/6bFb19HuFtSzT8y2wqT17g, duyệt Q10–Q14 13/10).
--
--   warehouse_movements.purchase_request_line_id — dòng sổ kho nhập cho DÒNG đề
--       nghị nào. "Đã nhập" của một dòng = Σ in − Σ out của các dòng sổ trỏ về
--       nó (dòng đảo phiếu chép lại cột này, nên đảo PNK là tự trừ). Một dòng đề
--       nghị nhập được nhiều lần (nhiều chuyến mua).
--   warehouse_docs.purchase_request_id — phiếu nhập này thuộc đề nghị nào (để
--       sổ phiếu / phiếu in nói "Mua theo DNM-…" mà không phải dò từng dòng).
--   warehouse_purchase_requests.closed_* — "Chốt xong" khi còn dòng thiếu mà
--       không mua nữa (Q14): bắt lý do, phiếu khoá ở Xong.
--
-- po_line_id của dòng đề nghị (0236) để nguyên: luồng cũ "Cung ứng lập đơn từ
-- phiếu" đã bỏ, cột trống không hại gì.
--
-- RLS: không thêm bảng — các bảng đã bật RLS không policy từ trước (anon bị
-- chặn, khoá bí mật server đi qua). Idempotent.

alter table public.warehouse_movements
  add column if not exists purchase_request_line_id uuid
    references public.warehouse_purchase_request_lines(id) on delete set null;

create index if not exists warehouse_movements_purchase_request_line_idx
  on public.warehouse_movements (purchase_request_line_id)
  where purchase_request_line_id is not null;

alter table public.warehouse_docs
  add column if not exists purchase_request_id uuid
    references public.warehouse_purchase_requests(id) on delete set null;

create index if not exists warehouse_docs_purchase_request_idx
  on public.warehouse_docs (purchase_request_id)
  where purchase_request_id is not null;

alter table public.warehouse_purchase_requests
  add column if not exists closed_at timestamptz,
  add column if not exists closed_by uuid references public.users(id) on delete set null,
  add column if not exists closed_reason text
    check (closed_reason is null or char_length(closed_reason) <= 1000);
