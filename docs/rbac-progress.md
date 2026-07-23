# RBAC data-hoá — Tiến độ & việc chưa xong

Tái thiết kế phân quyền: đưa **vai + quyền thành dữ liệu trong DB** thay cho suy
diễn từ `role` cứng + tên phòng hardcode. Triển khai **strangler, từng bước không
gãy**. Plan gốc: `~/.claude/plans/noble-prancing-candy.md`.

## Trạng thái tổng: ĐÃ XONG Phase 0 → 2 (TẤT CẢ module) + dọn dẹp. Còn Phase 3 + 4.

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
- **Phase 2 — các module còn lại + dọn dẹp** (nhánh `rbac-finish`): flip nốt mọi
  guard sang `hasPermission`, xoá hardcode tên phòng cho authz.
  - **accounting** `isAccountingStaff→accounting.member`.
  - **hr** `isHRStaff→hr.member`; `canDecide→hr.leave.decide` (async).
  - **sales** `isSalesUser/isSalesStaff→sales.member`; `canEdit` KH giữ role-tier +
    row-level owner (seed không có `sales.edit` — không dựng key thừa).
  - **supply** `isSupplyStaff→supply.member`; `canApprove(PO)→supply.po.approve`.
    `SUPPLY_DEPT_NAMES` GIỮ LẠI (orders/stock dùng tính người-nhận notify, không authz).
  - **warehouse** `isWarehouseUser→warehouse.member`; `canEdit→warehouse.edit`
    (cả stock.service); tạo vật tư→`warehouse.material.create`.
  - **production** `isProductionStaff→production.member`, `isPlannerStaff→planner.member`,
    `canIssue→lsx.issue`, `canApprove→lsx.approve`, `canTrackProgress→progress.track`,
    `canEditComponents→components.edit`, `canRecordOutput→output.record`,
    outsource→`outsource.record`, incident report/close, daylock lock/unlock,
    team board→`team.manage`, `assertExec→exec.tower.view` (async).
  - **Dọn dẹp**: gỡ `rbac/shadow.ts` (hết caller); gộp `Role` = `UserRole`
    (`workspaces.config` re-export từ `users.repo`).
  - **Test**: helper `src/test-utils/rbac.ts` (`makeFakeHasPermission` = ma trận seed
    + `computeDerivedRoleKeys` thật) mock hasPermission cho 9 file service test.
    `npm run check` xanh, 497 test.
  - **Verify DB thật (74 user)**: 19/21 guard **0 lệch**. 2 guard warehouse lệch
    do seed cố ý gán rộng hơn legacy — **user chốt CHẤP NHẬN** (chính sách data-driven):
    `warehouse.edit` +1 NV Kho (ghi nhập/xuất tồn + sửa DM); `warehouse.material.create`
    +8 (mọi manager + NV Kho). Không quay lại legacy.

---

## CHƯA LÀM

### UI mirror (chưa bắt buộc — authz đã ở server; đây là tối ưu/trình bày)
- [ ] `src/workspaces/access.ts` — đang gọi loạt `is*Staff` (đã RBAC, ĐÚNG hành vi);
      có thể refactor đọc thẳng `permissionsOf` để bớt round-trip.
- [ ] `src/components/Sidebar.tsx` — `DEPT_NAV` key theo tên phòng (thuần render menu,
      không phải ổ khoá — server vẫn chặn qua permission).
- [ ] `src/app/(workspace)/production/entry/shared.ts` — `canRecordHere` (admin ||
      isProductionStaff; tương đương `production.output.record`, để mirror chính xác).

### Dọn còn lại
- [ ] Bỏ `department.manage` DEAD trong `src/server/permissions.ts`; cân nhắc gộp
      task ACL vào cùng cơ chế `hasPermission` hoặc giữ riêng (task là quan hệ).

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
