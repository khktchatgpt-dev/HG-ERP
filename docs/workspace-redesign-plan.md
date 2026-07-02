# Kế hoạch tái thiết kế FE — Workspace theo phòng ban

**Mục tiêu:** thay "1 shell chung + menu filter" bằng "workspace riêng cho mỗi phòng ban", có màu accent + sidebar + dashboard đầu riêng. Vẫn giữ role (admin/manager/employee) filter items bên trong mỗi workspace.

## Danh sách workspace (theo dept thực tế trong DB)

| Workspace | Route base | Màu | Dept nguồn | User đang có |
|---|---|---|---|---|
| Sales | `/sales/*` | 🟠 orange-500 | Bán Hàng | 2 |
| Finance | `/finance/*` | 🟢 emerald-500 | Tài Chính Kế Toán | 4 |
| Warehouse | `/warehouse/*` | 🟤 amber-800 | Kho | 2 |
| Technical | `/technical/*` | 🔵 sky-500 | Kỹ Thuật | 2 |
| Planning | `/planning/*` | 🟣 violet-500 | Kế Hoạch Sản Xuất-cung ứng | 5 |
| QC | `/qc/*` | 🩶 slate-500 | QC | 3 |
| Production | `/production/*` | 🔴 red-600 | Xưởng Sản Xuất, Cắt Vải | 12 |
| HR | `/hr/*` | 💛 yellow-500 | Hành Chính Nhân Sự | 1 |
| Exec | `/exec/*` | ⚫ zinc-900 | Ban Giám Đốc | 1 |
| System | `/admin/*` | 🟪 purple-600 | (role=admin) | 3 |

**Tổng: 10 workspace.** Production gộp 2 dept (Xưởng SX + Cắt Vải) vì cùng loại công việc.

Shared routes (không thuộc workspace): `/tasks/*`, `/plan`, `/notifications`, `/login`, `/api/*`. Ai cũng có thể truy cập.

## Data model bổ sung

Thêm cột `workspace_id` vào `departments` để map dept → workspace (nhiều dept có thể chung 1 workspace, VD Production).

**Migration 0008:**
```sql
alter table public.departments
  add column if not exists workspace_id text
  check (workspace_id in (
    'sales','finance','warehouse','technical','planning',
    'qc','production','hr','exec','system'
  ));

update public.departments set workspace_id = case name
  when 'Bán Hàng' then 'sales'
  when 'Tài Chính Kế Toán' then 'finance'
  when 'Kho' then 'warehouse'
  when 'Kỹ Thuật' then 'technical'
  when 'Kế Hoạch Sản Xuất-cung ứng' then 'planning'
  when 'QC' then 'qc'
  when 'Xưởng Sản Xuất' then 'production'
  when 'Cắt Vải' then 'production'
  when 'Hành Chính Nhân Sự' then 'hr'
  when 'Ban Giám Đốc' then 'exec'
end;
```

Không đổi `users` — vẫn dùng `department_id`. Workspace suy ra từ dept join.

## Cấu trúc code mới

```
src/
  workspaces/                              # NEW: cấu hình workspace
    workspaces.config.ts                   # 10 workspace: id, label, color, iconLogo, sidebar items
    resolveWorkspace.ts                    # user → workspace ID + config
  components/workspace/                    # NEW: shell tái thiết kế
    WorkspaceShell.tsx                     # thay AppShell — nhận workspace prop
    WorkspaceSidebar.tsx                   # render từ config, không hardcode
    WorkspaceTopbar.tsx                    # màu accent, breadcrumb, badge dept/role
    WorkspaceThemeProvider.tsx             # CSS var --accent-* → cho toàn workspace
  app/
    (workspace)/                           # NEW route group — workspace pages
      layout.tsx                           # gate: require login + resolve workspace + apply theme
      sales/
        page.tsx                           # dashboard đầu Sales
        customers/page.tsx (mv từ dept/sales/customers)
        orders/... (feature mới)
      finance/
        page.tsx
        invoices/page.tsx (mv từ dept/accounting/invoices)
      hr/
        page.tsx
        leave/page.tsx (mv từ dept/hr/leave)
      warehouse/page.tsx
      technical/
        page.tsx
        products/page.tsx (mv từ dept/technical/products)
      planning/page.tsx
      qc/page.tsx
      production/page.tsx
      exec/page.tsx
    (system)/                              # NEW — admin only
      admin/… (mv từ src/app/admin/*)
    (shared)/                              # cross-workspace pages
      tasks/… (giữ nguyên)
      plan/… (giữ nguyên)
      notifications/… (giữ nguyên)
      page.tsx                             # home "chọn workspace" nếu không có dept
```

Xoá: [Sidebar.tsx](src/components/Sidebar.tsx), [AppShell.tsx](src/components/AppShell.tsx) sau khi mọi page đã migrate.

## Phase & effort

### Phase 1 — Foundation (1 lượt của tôi)
- [ ] Migration 0008 `workspace_id` + backfill
- [ ] `workspaces.config.ts` cho cả 10 workspace (chỉ metadata + màu, sidebar rỗng)
- [ ] `resolveWorkspace.ts` — user → workspace hoặc null
- [ ] `WorkspaceThemeProvider` (CSS var accent) + `WorkspaceTopbar` skeleton
- [ ] `sync-types`

**Output:** không có UI mới hiển thị, nhưng infra sẵn sàng.

### Phase 2 — Sales workspace mẫu (1 lượt)
- [ ] `WorkspaceShell` + `WorkspaceSidebar` (đọc từ config)
- [ ] Sales sidebar items trong config: Trang chủ, Khách hàng, Đơn hàng, Báo cáo
- [ ] `/sales/page.tsx` dashboard: 3 widget dummy (KPI, Top KH, Đơn chờ)
- [ ] Update login redirect: user thuộc "Bán Hàng" → `/sales/`
- [ ] Giữ `/` cũ cho user chưa có workspace (không đổi gì)

**Output:** login 2 user Sales → thấy workspace mới. Các user khác không đổi.

**→ Review checkpoint.** Bạn duyệt thấy pattern OK mới sang Phase 3.

### Phase 3 — Nhân ra 9 workspace còn lại (2-3 lượt)
Cho mỗi workspace:
- [ ] Thêm sidebar items trong config
- [ ] Move page cũ vào workspace mới (VD `dept/sales/customers` → `sales/customers`)
- [ ] Dashboard đầu workspace với widget cơ bản (empty state OK, thay dần)
- [ ] Cập nhật link nội bộ, redirect cũ → mới (VD `/dept/sales/customers` → 301 sang `/sales/customers`)

Chia batch:
- **Batch 3a**: Finance + HR + Technical (đã có UI dept sẵn, chỉ move)
- **Batch 3b**: Warehouse + Planning + QC + Production (dept chưa có UI riêng — dashboard rỗng ban đầu)
- **Batch 3c**: Exec + System (admin move từ /admin sang /admin trong (system) group, giữ URL)

### Phase 4 — Xoá cái cũ (1 lượt)
- [ ] Xoá `AppShell`, `Sidebar` cũ sau khi mọi page đã migrate
- [ ] Xoá route `/dept/*` sau khi redirect đã hoạt động 1-2 tuần
- [ ] Cleanup import lẻ

## Migration path — không phá bản chạy được

1. **Phase 1-2** không đụng vào layout cũ → nhân viên Sales thấy UI mới, người khác giữ cũ.
2. **Phase 3** mỗi batch tự đóng gói: chạy Sales xong ổn định 1 ngày trước khi làm Finance/HR/…
3. **Route cũ luôn 301 sang route mới** trong 2 tuần chuyển tiếp, tránh bookmark chết.
4. Không xoá component cũ cho đến khi Phase 4.

## Điểm cần quyết trước Phase 2

1. **Login redirect** — user thuộc dept → workspace của dept, OK. Nhưng:
   - Nếu user KHÔNG có `department_id` (VD `admin@hg.com`, các admin bootstrap) → đi đâu?
     - Đề xuất: role='admin' → `/admin/`. Role khác + không dept → `/tasks` (fallback, có sẵn).
   - Nếu user có dept nhưng dept không có workspace_id (dữ liệu lỗi) → `/tasks`.
2. **Menu "Của tôi" hiện tại** (Tổng quan, Kế hoạch, Công việc, Nghỉ phép, Thông báo) — mọi user thấy. Giữ ở sidebar mỗi workspace, hay để lên header dropdown?
   - Đề xuất: **giữ ở sidebar mỗi workspace**, section đầu tên "Cá nhân". Thêm sub-header ở dưới là workspace-specific.
3. **Trưởng phòng (`is_head`)** — hiện Sidebar thấy `Đội nhóm`, `Báo cáo tuần`. Chỗ này gắn vào workspace nào?
   - Đề xuất: gắn vào workspace của dept họ dẫn. Sales head thấy Đội nhóm + Báo cáo tuần trong sidebar Sales.

## Ước tính effort

| Phase | Lượt của tôi | Tôi làm gì cụ thể |
|---|---|---|
| 1 | 1 | Foundation + infra + types |
| 2 | 1 | Sales workspace + demo redirect |
| 3a | 1 | Finance + HR + Technical |
| 3b | 1 | Warehouse + Planning + QC + Production |
| 3c | 1 | Exec + System |
| 4 | 1 | Cleanup |
| **Tổng** | **6 lượt** | |

Nếu bạn đồng ý plan → tôi bắt đầu **Phase 1** ngay.

## Risk / lưu ý

- **Font-size / spacing** không thay — chỉ đổi màu accent để không phải retest layout mọi trang.
- **Notification bell + user menu** — giữ nguyên vị trí top-right, không đổi.
- **Mobile** — Sidebar hiện chỉ hiện trên `lg:` (desktop). Phải quyết drawer/bottom-tab cho mobile trong workspace mới. Nếu muốn ship nhanh: giữ pattern cũ (không sidebar trên mobile), làm mobile drawer sau.
- **Storybook / Component test** — không có, nên khó test isolated. Verify bằng cách login từng role.
- **URL bookmark** — 301 redirect 2 tuần rồi bỏ.

---

**Bạn có muốn tôi:**
- (A) Bắt đầu Phase 1 ngay (foundation, không có UI mới hiển thị)
- (B) Điều chỉnh scope trước (bớt/thêm workspace, đổi màu, đổi route)
- (C) Chỉ làm 1-2 workspace ưu tiên (VD chỉ Sales + Finance) trước khi quyết đại trà
