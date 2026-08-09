# Kế hoạch triển khai — tách quyền PO theo người phụ trách + vai Trưởng phòng CƯ

Trạng thái: **✅ ĐÃ TRIỂN KHAI 09/08/2026** — migration 0128 đã apply remote
(MCP `apply_migration`), `npm run check` xanh (954 test), verify API end-to-end
trên dev + DB thật (2 NV CƯ + BGĐ): chặn chéo 403 đúng thông báo, gửi/rút/từ
chối→nháp/bàn giao chạy đủ, audit ghi 4 mốc mới (đơn test + vết đã dọn sạch).

**Đã gán vai** (09/08/2026, admin Điền Hg thao tác): `supply_lead` →
**Phan Thị Lệ Hằng** (kehoach@hoanggia.de) — verify thật: bà gửi duyệt / rút về
nháp / bàn giao / xoá được đơn của NV khác, còn NV sau khi bị bàn giao đi thì
nhận 403. Muốn thêm người (phó phòng, người uỷ quyền khi trưởng phòng vắng):
`/admin/permissions` → tab Nhân viên → gán vai "Trưởng phòng Cung ứng".

Lưu ý đã xác nhận khi test: manager KHÔNG thuộc BGĐ (vd kehoach@) không có quyền
duyệt PO — đúng luật 0086, không phải bug. Vai `admin` trong DB được seed ĐỦ mọi
permission, nên danh sách "chọn NV cung ứng" khi bàn giao phải lọc bỏ `role=admin`
(đã xử lý ở `planning/pos/page.tsx`), không thì IT/GĐ lọt vào ô chọn.

Thiết kế nghiệp vụ gốc: [po-quy-trinh-phan-quyen.md](./po-quy-trinh-phan-quyen.md).

## Phương án áp dụng (đã triển khai theo khuyến nghị §6 — hai GĐ muốn đổi thì báo IT)

| # | Quyết định |
|---|---|
| 6.1 | **(b)** Khoá theo người phụ trách trên TOÀN vòng đời ghi (draft → in_transit) |
| 6.2 | **(b)** Đơn chờ duyệt KHÔNG sửa trực tiếp — phải **"Rút về nháp"** (withdraw) rồi sửa, gửi duyệt lại |
| 6.3 | **(b)** GĐ từ chối → đơn quay về **NHÁP** kèm lý do (không cancelled nữa) |
| 6.4 | Giữ **1 cấp duyệt** (GĐ) — không thêm duyệt sơ bộ/ngưỡng giá trị đợt này |
| 6.5 | **(a)** Audit mốc trạng thái (submit / withdraw / decide / bàn giao) vào `approval_events` sẵn có |
| 6.6 | Quyền trưởng phòng = permission **`supply.lead`**, vai mới `supply_lead`, admin gán tay qua `/admin/permissions` |

Khái niệm mới: **người phụ trách** (`assigned_to`, mặc định = người tạo). Quyền ghi
xét theo `assigned_to` (không phải `created_by`) để bàn giao xong người mới làm
tiếp được; `created_by` giữ nguyên làm vết "ai tạo".

---

## Phase 1 — DB: migration `0128_po_owner_and_supply_lead.sql`

1. `supply_purchase_orders` thêm cột
   `assigned_to uuid references users(id) on delete set null`
   + backfill `assigned_to = created_by` cho toàn bộ đơn cũ + index `(assigned_to)`.
2. Seed RBAC (idempotent, `on conflict do nothing`):
   - `permissions`: `('supply.lead', 'Trưởng phòng Cung ứng — thao tác mọi PO', 'supply', 42)`.
   - `roles`: `('supply_lead', 'Trưởng phòng Cung ứng', 'Thao tác mọi đơn của phòng, bàn giao đơn.', is_system=false)`.
   - `role_permissions`: `supply_lead → {supply.member, supply.lead}`.
   - KHÔNG tự gán user nào — admin gán tay (6.6). Vai `director`/`head` không đổi.
3. Header comment chuẩn RLS (bảng đã RLS-first, không đổi posture).
4. Apply lên remote bằng **MCP `apply_migration`** (CLI push từng lỗi IPv6) → chạy
   skill **sync-types** regen `database.types.ts`.

## Phase 2 — RBAC registry (`src/modules/core/rbac/actions.ts`)

- Thêm action mô tả (cho tab Thao tác minh bạch):
  `supply.po.manage_any` — nhãn "Thao tác mọi PO (trưởng phòng)", rule `perm('supply.lead')`.
- `supply.po.manage` giữ nguyên (`perm('supply.member')`) — đây vẫn là cổng vào;
  điều kiện "đúng người phụ trách" là **row-level, nằm ở service** (đúng pattern
  sales customer-owner đã có).
- Cập nhật `actions.test.ts` + `src/test-utils/rbac.ts` (ma trận seed thêm
  `supply.lead`, vai `supply_lead`) — test đang assert mọi permission key ∈ seed.

## Phase 3 — Service (`src/modules/dept/supply/pos.service.ts`)

1. Helper row-level dùng chung:
   ```
   assertPoOwner(user, po):
     admin → qua
     canAction(user, 'supply.po.manage_any') → qua   // supply.lead
     (po.assigned_to ?? po.created_by) === user.id → qua
     ngược lại → Forbidden('Đơn do <tên> phụ trách — chỉ người phụ trách hoặc trưởng phòng sửa được')
   ```
   Gắn vào: `update`, `remove`, `submit`, `advance`, `reschedule`, `cancel`
   (sau `assertAction('supply.po.manage')` hiện có). `list`/`detail`/`decide`
   không đổi quyền xem/duyệt.
2. `create`: ghi thêm `assigned_to: user.id`.
3. `update`: siết điều kiện trạng thái từ `draft | pending_approval` xuống
   **chỉ `draft`** (6.2b).
4. Method mới `withdraw(user, id)`: `pending_approval → draft` (qua `assertPoOwner`),
   emit event `po.withdrawn` (xoá "món nợ duyệt" khỏi bàn GĐ — notify người duyệt).
5. `decide` nhánh reject: `status: 'cancelled'` → **`status: 'draft'`** + note
   `[Từ chối] <lý do>` giữ nguyên; event `po.decided` giữ nguyên payload.
6. `submit`: người nhận notify lọc theo **quyền duyệt thật** thay vì
   `role ∈ {admin, manager}` — thêm `rbacRepo.userIdsWithPermission('supply.po.approve')`
   (join `user_roles → role_permissions`) ∪ mọi admin, trừ chính người gửi.
7. Method mới `reassign(user, id, toUserId)` — bàn giao:
   - Chỉ `supply.lead` / director (`supply.po.approve`) / admin.
   - Người nhận phải có `supply.member` (đừng gán cho người ngoài phòng).
   - Patch `assigned_to`, emit `po.reassigned` (notify người nhận + ghi audit).
   - Cho phép ở mọi trạng thái chưa kết thúc (`!received && !cancelled`).

## Phase 4 — Events + audit

- `src/events/types.ts`: thêm `po.withdrawn { po_id, code, by, approver_ids }`
  và `po.reassigned { po_id, code, from, to, by }`.
- `po.notifications.ts`: handler 2 event mới (withdraw → báo người duyệt "đơn đã
  rút về sửa"; reassign → báo người được giao).
- `approval.audit.ts` (hoặc handler audit mới): ghi `approval_events` cho
  `po.submitted` / `po.withdrawn` / `po.reassigned` (hiện mới ghi `po.decided`) —
  kiểm tra constraint cột `action` của bảng trước, nếu là enum/check thì migration
  0128 nới thêm giá trị.

## Phase 5 — API routes (`src/app/api/dept/supply/pos/`)

- Thêm `[id]/withdraw/route.ts` và `[id]/reassign/route.ts` (thin handler chuẩn:
  `requireUser` → `parseJson` (reassign: zod `{ user_id: uuid }`) → service).
- Các route cũ không đổi (authz đã dồn vào service).

## Phase 6 — UI (`src/app/(workspace)/planning/pos/`)

1. `page.tsx`: thay cờ thô
   `canEdit = admin || isSupplyStaff` bằng bộ cờ mới truyền xuống:
   - `meId` (user.id), `canManage` (supply.member), `canManageAny`
     (`canAction 'supply.po.manage_any'` — supply.lead/admin), `canApprove`
     (đổi sang `canAction 'supply.po.approve'` thay vì `role === 'manager'`).
2. Repo `list`/`findById`: SELECT thêm `assigned_to` + embed tên người phụ trách.
   ⚠️ Bảng giờ có ≥3 FK sang `users` (`created_by`, `approved_by`, `assigned_to`)
   — embed phải **chỉ đích danh FK** (`users!supply_purchase_orders_assigned_to_fkey(name)`),
   không PostgREST trả rỗng như bug 0125 đã dính.
3. `PosManager.tsx`:
   - Quyền theo TỪNG dòng: `rowCanEdit(po) = canManageAny || po.assigned_to === meId`
     — mọi chỗ đang if `canEdit` cho sửa/xoá/gửi/advance/dời hẹn/huỷ đổi sang cờ dòng.
   - Cột **"Phụ trách"** + filter toolbar **"Đơn của tôi"** (mặc định bật cho NV
     thường? — để mặc định TẮT, đỡ gây "mất đơn").
   - Nút **"Rút về sửa"** (pending, chủ đơn) + **"Bàn giao"** (canManageAny/GĐ,
     modal chọn NV cung ứng).
   - Đơn bị từ chối giờ về `draft` — bỏ nhánh UI "cancelled sau reject" nếu có,
     hiển thị note `[Từ chối]` ngay trên chi tiết đơn nháp.
4. `[id]/edit/page.tsx` + `new/page.tsx`: guard server-side theo cùng luật
   (mở form sửa đơn không phải của mình → 403/redirect kèm thông báo).

## Phase 7 — Test + nghiệm thu

- `pos.service.test.ts` bổ sung: NV khác bị chặn update/remove/submit/advance;
  supply.lead qua được; withdraw đúng trạng thái; reject → draft; reassign đổi
  người phụ trách + chặn người ngoài phòng; submit notify đúng tập người duyệt.
- Cập nhật mock: `makeFakeAssertAction`/`makeFakeHasPermission` nhận thêm
  `supply.lead`; các test cũ đang giả định "NV nào cũng sửa được" phải sửa lại
  cho đúng luật mới.
- `npm run check` xanh (typecheck + lint + toàn bộ test).
- Nghiệm thu tay trên dev: đăng nhập 3 tài khoản (NV CƯ A, NV CƯ B, GĐ):
  A tạo nháp → B không thấy nút sửa/xoá + gọi API trực tiếp bị 403 → gán
  `supply_lead` cho B qua `/admin/permissions` → B thao tác được → A gửi duyệt →
  GĐ từ chối → đơn về nháp của A kèm lý do → A sửa gửi lại → duyệt → gửi NCC.

## Phase 8 — Go-live

1. Apply 0128 remote (MCP) → sync types → deploy code cùng đợt (code mới đọc
   `assigned_to`; áp trước code sau sẽ chỉ khiến cột nằm im, không gãy).
2. Admin gán vai `supply_lead` cho Trưởng phòng CƯ (+ người uỷ quyền nếu chốt 6.6).
3. Thông báo phòng CƯ luật mới: đơn ai nấy sửa, cần đụng đơn người khác → nhờ
   trưởng phòng bàn giao.
4. Cập nhật 2 tài liệu docs (đánh dấu ĐÃ CHỐT + ngày).

## Rủi ro & điểm phải để mắt

- **Embed users mơ hồ** (nhiều FK) — phải nêu đích danh FK trong mọi SELECT có
  embed người (đã dính bug tương tự ở 0125, ghi chú ngay trong `pos.repo.ts`).
- **Test cũ vỡ theo chủ ý**: các test cho "user bất kỳ sửa đơn" giờ PHẢI đỏ —
  sửa expectation, đừng nới luật cho test xanh.
- **Đơn đang `pending_approval` lúc deploy**: luật mới coi là "không sửa trực
  tiếp" — vẫn withdraw được nên không kẹt; không cần data-fix.
- **`approval_events.action`**: kiểm tra constraint trước khi ghi action mới;
  cần thì nới trong 0128 luôn, đừng đẻ migration lẻ.
- **Thứ tự phase**: 1 → 2 → 3/4 → 5 → 6 → 7; phase 3 phụ thuộc types của phase 1
  (cột `assigned_to`) — sync types xong mới code service sạch được.

Ước lượng khối lượng: migration + service + events ~1 buổi; UI PosManager (quyền
theo dòng + 2 nút + filter) ~1 buổi; test + nghiệm thu tay ~nửa buổi.
