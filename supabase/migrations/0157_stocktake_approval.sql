-- 0157 — KIỂM KÊ CÓ DUYỆT (plan-cung-ung-kho-hoan-thien GĐ C; GĐ2 plan-kho-redesign).
--
-- BỐI CẢNH: createStocktakeDoc (0077) ghi movement 'adjust' NGAY khi nhân viên
-- lập biên bản — tồn đổi mà không ai gác chênh lệch. User chốt 16/08/2026:
-- nhân viên đếm + lập biên bản (tồn CHƯA đổi) → quản lý Kho xem bảng chênh
-- lệch → duyệt mới áp; từ chối thì biên bản đóng, không đụng gì.
--
-- THIẾT KẾ:
--   warehouse_docs.status: 'pending' (chờ duyệt) | 'posted' (đã áp sổ)
--                        | 'rejected'. DEFAULT 'posted' — MỌI PHIẾU CŨ và mọi
--   phiếu nhập/xuất/điều chuyển (áp sổ ngay lúc lập) tự nhận 'posted', đúng sự
--   thật lịch sử; CHỈ kiểm kê lập mới đi đường 'pending'.
--   Chênh lệch ÁP LÚC DUYỆT = số đếm − tồn HIỆN TẠI (áp số đếm như sự thật
--   tuyệt đối — chuẩn kiểm kê); snapshot system_qty lúc đếm giữ nguyên trong
--   warehouse_stocktake_lines để đối chiếu.
--
-- RLS: bảng đã enable từ 0017 — không đổi. Idempotent. Apply xong sync types.

alter table public.warehouse_docs
  add column if not exists status text not null default 'posted'
    check (status in ('pending', 'posted', 'rejected')),
  add column if not exists approved_by uuid references public.users(id) on delete set null,
  add column if not exists approved_at timestamptz,
  add column if not exists reject_reason text;

-- Duyệt kiểm kê là màn lọc theo status — index bán phần cho hàng chờ.
create index if not exists warehouse_docs_pending_idx
  on public.warehouse_docs (created_at)
  where status = 'pending';
