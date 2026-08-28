-- 0166: production_transfers — hoàn trả (return) BẮT BUỘC lý do, nâng ràng
-- buộc từ service (0090 ghi "reason bắt buộc ở service") xuống DB (GĐ5.2
-- plan-sx). Đã kiểm remote 23/08/2026: bảng RỖNG — backfill dưới đây chỉ là
-- phòng thủ cho môi trường khác.
-- RLS: không đổi tư thế (chỉ thêm check constraint).
-- Idempotent: backfill update + add constraint trong do-block nuốt duplicate.

update production_transfers
   set reason = '(không ghi lý do — dữ liệu cũ)'
 where direction = 'return' and reason is null;

do $$ begin
  alter table production_transfers
    add constraint production_transfers_return_reason_ck
    check (direction <> 'return' or reason is not null);
exception when duplicate_object then null; end $$;
