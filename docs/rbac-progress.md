# RBAC data-hoá — Tiến độ & việc chưa xong

Tái thiết kế phân quyền: đưa **vai + quyền thành dữ liệu trong DB** thay cho suy
diễn từ `role` cứng + tên phòng hardcode. Triển khai **strangler, từng bước không
gãy**. Plan gốc: `~/.claude/plans/noble-prancing-candy.md`.

## Trạng thái tổng: ĐÃ XONG Phase 0 → 2 (technical). Còn Phase 2 (các module) + 3 + 4.

### DB thật (Supabase `pcbfvrapknzykhtntuwg`) — đã apply
- `0073_rbac.sql` — 4 bảng `permissions/roles/role_permissions/user_roles` + seed
  (35 permission, 12 role, 76 role_permission) + backfill 74 gán user-role.
- `0074_user_roles_source.sql` — cột `user_roles.source` (`derived`/`manual`).

### Đã kiểm chứng trên dữ liệu thật
- Backfill khớp legacy **0 lệch** (đối chiếu 8 guard × mọi user).
- Sync bridge: dry-run derive cho 50 user = **no-op** (code-derive ≡ backfill).
- Technical flip: **0 lệch** legacy-vs-RBAC cho `product.edit` + `bom.save`.
- `npm run check` xanh (494 test). Login thật OK.

> ⚠️ **Mật khẩu**: toàn bộ 50 tài khoản hiện = `Test@1234` (reset để test). Đổi
> mật khẩu mạnh trước khi dùng thật.

---

## ĐÃ LÀM

- **Phase 0 — nền tảng** (commit `5067329`)
  - Module `src/modules/core/rbac/`: `rbac.repo/service/schema` + `hasPermission`/
    `assertPermission`/`permissionsOf` (bọc React `cache()` — nạp quyền 1 lần/request).
    admin (cột `users.role`) luôn bypass = true.
  - Trang **read-only** `/admin/permissions` (ma trận Vai×Quyền + Vai×Người dùng).
  - `database.types.ts` cập nhật tay (Supabase MCP chưa auth).
- **Phase 1 — shadow** (commit `4eef04d`): 10 guard `is*Staff/is*User` tính RBAC
  song song, `console.warn` khi lệch, **vẫn trả legacy** (`rbac/shadow.ts`).
- **Phase 1.5 — cầu đồng bộ** (commit `ca450b1`): `computeDerivedRoleKeys` +
  `syncUserRoles` (reconcile role `derived`, không đụng `manual`). Wire vào
  `users.service` (create/update role|dept/bulk) + `departments.service` (đổi
  trưởng phòng / tên phòng).
- **Phase 2 — technical** (commit `9f7c174`): flip RBAC-only, bỏ hardcode tên
  phòng. `isTechnicalStaff→technical.member`, `isTechnicalOrSales→technical.bom.edit`,
  `canEdit→async technical.edit`.

---

## CHƯA LÀM

### Phase 2 — flip nốt các module (mỗi module 1 PR, thứ tự rủi ro tăng dần)
Mẫu tham chiếu: commit technical `9f7c174`. Mỗi module: flip guard `is*Staff`→
`hasPermission`, chuyển guard sync (`canApprove/canEdit/canDecide/assertExec`)
sang `async hasPermission` + thêm `await` ở call-site, **xoá hardcode tên phòng**.

- [ ] **accounting** — `isAccountingStaff`→`accounting.member`.
- [ ] **hr** — `isHRStaff`→`hr.member`; `canDecide`→`hr.leave.decide`.
- [ ] **sales** — `isSalesStaff`/`isSalesUser`→`sales.member`; `canEdit` khách hàng
      (admin/manager/owner — nhánh owner giữ row-level ở service).
- [ ] **supply** — `isSupplyStaff`→`supply.member`; `canApprove(PO)`→`supply.po.approve`.
- [ ] **warehouse** — `isWarehouseUser`→`warehouse.member`; `canEdit`→`warehouse.edit`;
      tạo vật tư (Kho/Cung ứng)→`warehouse.material.create`.
- [ ] **production** (lớn nhất) — `isProductionStaff`→`production.member`,
      `isPlannerStaff`→`planner.member`, `canIssue`→`production.lsx.issue`,
      `canApprove`→`production.lsx.approve`, `canTrackProgress`→`production.progress.track`,
      `canEditComponents`→`production.components.edit`, `canRecordOutput`→
      `production.output.record`, incidents/day-locks/outsource/team, `assertExec`
      (ops)→`exec.tower.view`.

### UI mirror (đồng bộ khi flip module tương ứng)
- [ ] `src/workspaces/access.ts` — `resolveNavCapabilities` đọc từ `permissionsOf`
      thay vì gọi loạt `is*Staff`; `hasCrossRole`.
- [ ] `src/components/Sidebar.tsx` — `DEPT_NAV` đang key theo tên phòng.
- [ ] `src/app/(workspace)/production/entry/shared.ts` — `canRecordHere`.

### Dọn sau khi mọi module đã flip
- [ ] Gỡ `src/modules/core/rbac/shadow.ts` khi không còn caller.
- [ ] Bỏ `department.manage` DEAD trong `src/server/permissions.ts`; cân nhắc gộp
      task ACL vào cùng cơ chế `hasPermission` hoặc giữ riêng (task là quan hệ).
- [ ] Gộp `Role` type trùng: `users.repo.ts` vs `workspaces.config.ts`.

### Phase 3 — IT tự phục vụ (bật GHI ở /admin/permissions)
- [ ] Route `src/app/api/admin/rbac/**` (thin `handle`, guard admin): tạo/sửa role,
      gán permission↔role, gán role↔user (`source='manual'`). Zod đã có sẵn ở
      `rbac.schema.ts` (`roleCreateSchema`/`setRolePermissionsSchema`/`setUserRolesSchema`).
- [ ] `PermissionsManager.tsx` bật chỉnh sửa (hiện read-only).
- [ ] Audit qua event bus: thêm `role.assigned`/`role.revoked` ở `events/types.ts`,
      handler `events/handlers/rbac.audit.ts`, đăng ký ở `events/register.ts`
      (mẫu `approval.audit.ts`).
- [ ] Chặn tự-khoá: không cho gỡ quyền cuối của chính mình / xoá role `admin`.

### Phase 4 — tuỳ chọn
- [ ] Chuyển `canEnterWorkspace`/`openView` sang permission `workspace.<id>.view`
      (hoặc giữ tầng đọc — vốn không phải ổ khoá).

---

## Cách tiếp tục an toàn
1. Flip 1 module → `npm run check` xanh.
2. Đối chiếu legacy-vs-RBAC trên DB thật (query mẫu: so predicate tên-phòng cũ với
   `exists(permission)`), yêu cầu **0 lệch** trước khi commit.
3. Đăng nhập 1 tài khoản mỗi phòng liên quan, xác nhận sidebar + thao tác không đổi.
4. Nhớ: cầu đồng bộ (Phase 1.5) đã giữ `user_roles` đúng cho user mới/đổi phòng —
   nên flip RBAC-only không gãy.
