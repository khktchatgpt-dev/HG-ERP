-- 0173: production_entries cho phép dòng CHỈ CÓ PHẾ (qty = 0, defect_qty > 0).
-- Nghiệp vụ: công đoạn sau phát hiện phế của lô hôm trước mà hôm đó không có
-- sản lượng đạt mới — trước đây check (qty > 0) chặn không ghi sổ được.
-- Nới: qty >= 0, kèm ràng buộc mới qty + defect_qty > 0 (không có dòng rỗng).
-- RLS: bảng đã enable row level security (no policies) từ 0084 — không đổi.
-- Idempotent: drop constraint if exists trước khi add.

alter table public.production_entries
  drop constraint if exists production_entries_qty_check;

alter table public.production_entries
  add constraint production_entries_qty_check check (qty >= 0);

alter table public.production_entries
  drop constraint if exists production_entries_qty_or_defect_check;

alter table public.production_entries
  add constraint production_entries_qty_or_defect_check
  check (qty > 0 or defect_qty > 0);
