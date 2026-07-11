# Kế hoạch vá vòng đời theo thực tế — phát lại LSX, sửa đơn có báo, huỷ đơn khép chuỗi

> **✅ P1 + P2 + P3 HOÀN THÀNH 07/2026** — migration 0036 đã apply (không cần
> sync types); `productionService.resubmit` + form "Gửi duyệt lại" trên LSX bị
> từ chối; event `order.changed_after_lsx` + `order.cancelled` (handler
> `order.notifications.ts`); huỷ đơn cascade LSX/PO kèm confirm dialog nói thật
> hệ quả; badge `cancelled` trên mọi màn LSX. `npm run check` xanh — 203 test
> (+15). UAT mục 8b trong `docs/uat-checklist.md`.

Lập 07/2026, sau audit "quy trình có đổi theo thực tế được không". Kết luận
audit: đơn hàng sửa linh hoạt + có vết (FR-SAL-05 chạy đúng), PO sửa/huỷ/tạo
lại đủ; còn **3 lỗ hổng vòng đời** cần vá trước khi dùng thật. Tổng ~2 ngày.

## Quyết định đầu vào (doanh nghiệp chốt 07/2026)

- **KHÔNG làm tính năng gửi email đơn đặt cho NCC** — nhân viên tự gửi email
  riêng bằng bản in/PDF sẵn có (`/print/supply/[id]`). Nút "Gửi NCC" giữ nguyên
  ý nghĩa: chuyển trạng thái `approved → ordered` + đóng dấu `ordered_at`.
  → Gỡ hạng mục "email đơn đặt NCC kèm PDF" khỏi backlog GĐ2 (G7 chỉ còn MISA).

## P1 — Phát lại LSX bị từ chối (~0.5 ngày) — **bug thực tế, ưu tiên nhất**

Hiện trạng: GĐ từ chối → LSX `rejected`, đơn quay về `confirmed`, nhưng nút
"Phát LSX" chỉ hiện khi đơn **chưa có** LSX (`OrderDetailView.tsx:385`) và DB
ép unique `sales_order_id` (BR-01) nên bản rejected chiếm chỗ vĩnh viễn —
**không có đường phát lại**, phải sửa DB tay.

Phương án: **gửi duyệt lại chính LSX đó** (không tạo bản mới — giữ BR-01,
không cần migration):

1. **Service** `productionService.resubmit(user, id, input)`:
   - Guard `canIssue` (Sales/admin); LSX phải đang `rejected`.
   - `input` cho sửa kèm: `ship_date`, `received_date`, `container_summary`,
     `note` (header vốn bất biến — chỉ mở ở bước này, vì lý do từ chối thường
     nằm ở chính các trường này).
   - Patch: `status → 'pending_approval'`, `rejected_reason → null`,
     `issued_by/issued_at` = người + thời điểm gửi lại.
   - Đơn: `confirmed → lsx_pending` + `insertChange` type `lsx_resubmitted`
     (lý do từ chối cũ đã nằm trong lịch sử đơn — không mất vết).
   - Emit lại `lsx.submitted` để GĐ nhận thông báo duyệt (tái dùng event, thêm
     field `resubmitted?: true` trong `src/events/types.ts` nếu cần phân biệt
     lời văn thông báo).
2. **API** `POST /api/dept/production/lsx/[id]/resubmit` — thin route, zod
   schema (4 field optional), `handle()`.
3. **UI** `LsxDetailView`: trong khối đỏ "GĐ từ chối: <lý do>" thêm form sửa
   nhanh 4 field + nút **"Gửi duyệt lại"** (chỉ hiện khi `canIssue`).
   `OrderDetailView` không cần đổi — badge trạng thái LSX đã có link.
4. **Test** (bắt buộc — state machine): chỉ resubmit từ `rejected`; chỉ
   Sales/admin; đơn sync `lsx_pending`; notify đúng approver.

## P2 — Sửa đơn sau khi phát LSX → báo Cung ứng (~0.5 ngày)

Hiện trạng: sửa dòng SP/hạn giao khi đã phát LSX là hợp lệ và có vết, nhưng
không ai được báo — vật tư có thể đã đặt theo số lượng cũ.

Theo convention event bus (KHÔNG gọi chéo service):

1. **Event** `order.changed_after_lsx` khai ở `src/events/types.ts`:
   `{ order_id, order_code, lsx_code, changed_fields: string[],
   lines_changed: boolean, changed_by }`.
2. **Emit** trong `ordersService.update`: sau `insertChange`, nếu
   `status ∈ {lsx_pending, lsx_issued, in_production}` **và**
   (`linesChange` hoặc `due_date` đổi) → emit. Đơn `confirmed` (chưa phát LSX)
   sửa thoải mái, không báo.
3. **Handler** `src/events/handlers/order.notifications.ts` (đăng ký trong
   `register.ts`): notify nhân sự phòng KH-CƯ + GĐ/QL (trừ người sửa) —
   "Đơn DH-xxx sửa sau khi phát LSX (SL/hạn giao) — kiểm tra vật tư & tiến độ".
   Handler nuốt lỗi + log theo convention, không rollback caller.
4. **Test**: emit đúng điều kiện (đổi lines lúc `in_production` → emit; đổi
   `note` → không emit; đơn `confirmed` → không emit).

## P3 — Huỷ đơn khép chuỗi (~1 ngày)

Hiện trạng: huỷ đơn đang sản xuất chỉ đổi trạng thái đơn — LSX vẫn "Đang sản
xuất", PO vẫn mở, không ai được báo.

1. **Migration** `0036_production_orders_cancelled.sql` (chuẩn add-migration):
   nới check `production_orders.status` thêm `'cancelled'` (drop constraint if
   exists + add — idempotent; RLS đã bật từ 0014, ghi rõ trong header). Sau
   apply: **sync types**.
2. **Service** `ordersService.cancel` mở rộng (trong 1 flow, best-effort từng
   bước, lỗi bước phụ không chặn huỷ đơn):
   - LSX `pending_approval/approved/in_progress` → patch `cancelled` + ghi
     `production_progress` note "Đơn hàng huỷ: <lý do>". LSX `completed` giữ
     nguyên (hàng đã làm xong — xử lý thương mại ngoài hệ thống).
   - PO `pending_approval/approved` (chưa gửi NCC) → tự huỷ, note
     "[Huỷ theo đơn <mã>] <lý do>".
   - PO `ordered/confirmed/in_transit` (đã cam kết với NCC) → **KHÔNG tự huỷ**
     — notify Cung ứng tự thương lượng với NCC rồi huỷ tay.
   - Emit `order.cancelled` → notify phòng KH-CƯ + GĐ (handler cùng file P2).
   - Vật tư đã xuất cho LSX: **không tự hoàn kho** — Kho lập phiếu nhập lại
     nếu thu hồi (đúng nguyên tắc sổ cái, ghi chú trong confirm dialog).
3. **UI**: confirm dialog trước khi huỷ liệt kê hệ quả thật (server trả kèm:
   trạng thái LSX, số PO sẽ tự huỷ, số PO phải xử lý tay với NCC).
4. **UI trạng thái mới**: badge `cancelled` cho LSX ở `LsxDetailView`,
   `ProductionProgressManager`, tracking, `/exec` (map label "Đã huỷ", tone
   gray) — rà bằng grep `LsxStatus`.
5. **Test**: cascade đúng nhánh (PO đã gửi NCC không bị tự huỷ; LSX completed
   không bị huỷ); state machine LSX chặn `updateStage/complete` khi `cancelled`.

## Cập nhật tài liệu khi xong

- `docs/system-status.md`: gỡ "email đơn đặt NCC" khỏi GĐ2 (làm ngay — quyết
  định đã chốt); tick từng P khi hoàn thành.
- `docs/db-requirements-traceability.md`: FR-SAL-05 ghi thêm "notify sau LSX";
  BR-01 ghi đường resubmit.
- `docs/uat-checklist.md`: thêm 3 kịch bản (từ chối → sửa → duyệt lại; sửa đơn
  đang SX → Cung ứng nhận báo; huỷ đơn giữa chừng → chuỗi dừng đúng).

## Thứ tự & nghiệm thu

P1 → P2 → P3, mỗi phase: `npm run check` sạch (typecheck + lint + test) rồi
mới sang phase sau. P3 có migration — apply + sync types trước khi code UI.

## Rủi ro / lưu ý

- P1 tái dùng event `lsx.submitted` — kiểm tra handler hiện tại không giả định
  "chỉ bắn 1 lần / LSX".
- P3 cascade dùng nhiều lượt ghi không transaction (hạn chế PostgREST) — thứ
  tự: huỷ đơn trước (nguồn sự thật), rồi LSX, rồi PO; bước sau lỗi thì log +
  notify, không rollback (nhất quán triết lý event handler).
- Đừng chép chuỗi tên phòng — dùng `isSupplyStaff` / `supplyTechIds` sẵn có.
