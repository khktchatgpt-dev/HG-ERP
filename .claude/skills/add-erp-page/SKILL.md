---
name: add-erp-page
description: Scaffold một trang quản lý (list + CRUD) trong workspace dùng bộ ERP UI kit của dự án (PageHeader, StatsBar, Toolbar, DataTable, RowMenu). Dùng khi user nói "thêm trang", "làm màn quản lý", "add page cho <workspace>".
---

# add-erp-page

Sinh một trang danh sách + CRUD nhất quán với các trang admin/technical đã có. KHÔNG dựng bảng thô — luôn dùng ERP kit.

## Bối cảnh cần rõ

- **Workspace** nào (`system`, `technical`, `sales`, ...) — quyết route base + accent.
- **Entity** hiển thị (từ module/service nào). Module phải có sẵn `list/create/update/remove`; nếu chưa, chạy `add-module` trước.
- Trang này **read-only** hay có CRUD? Quyền sửa của ai?

## Thành phần bắt buộc (import từ @/components/erp/*)

- `PageHeader` — breadcrumb + title + description + actions (nút Export/Thêm).
- `StatsBar` — 3–6 KPI tính từ dữ liệu.
- `Toolbar` + `ToolbarInput` + `ToolbarSelect` — filter/search.
- `DataTable` + `Column<T>` — sort, pagination (`storageKey` để nhớ page size), `table-fixed`. Cột actions rộng ~56px dùng `RowMenu`.
- `EmptyState` — trạng thái rỗng có CTA.
- `RowMenu` — gom action mỗi dòng (⋯), item `danger` cho Xoá, `disabled` + `disabledReason` khi cấm.
- `Spinner` + `TopProgressBar` — feedback khi `busy`.
- `downloadCsv` từ `@/lib/csv` — nút Export CSV.
- `api` + `ApiError` từ `@/lib/api` — mọi mutation; toast `useToast`, confirm `useConfirm`.

## Cấu trúc

```
src/app/(workspace)/<ws>/<entity>/
  page.tsx          Server: auth + service.list (page_size lớn nếu client-paginate) → <Manager>
  <Entity>Manager.tsx   'use client' — toàn bộ UI ERP ở đây
```

Shell (sidebar + topbar) nằm ở `(<ws>)/layout.tsx` — KHÔNG wrap `WorkspaceShell` trong page. Nếu workspace chưa có layout+loading, tạo theo mẫu `src/app/(workspace)/technical/{layout,loading}.tsx`.

## Mẫu để copy

`src/app/(admin)/admin/users/UsersManager.tsx` (đầy đủ: bulk action, sort, export) hoặc
`src/app/(workspace)/technical/products/ProductsManager.tsx` (gọn hơn, có view-detail modal).

## Quy tắc

1. Load dữ liệu ở server component, truyền xuống Manager (client). Không fetch trong client nếu có thể SSR.
2. Mutation: `api(url, { method, body })` trong try/catch, `router.refresh()` khi xong, toast success/error, `TopProgressBar active={busy}`.
3. Form trong `Modal`; nút submit có `Spinner` + đóng modal + toast khi thành công.
4. Auto-mở modal khi `?new=1` (để Command palette / link ngoài dùng).
5. State modal nên lưu **id** rồi derive object từ props (tự đồng bộ sau refresh) — xem DepartmentsManager.
6. Quyền: nhận `canEdit` từ server, ẩn nút sửa/xoá nếu chỉ xem.

## Sau khi xong

- `npm run typecheck`.
- Nếu là entity mới trong Command palette: cân nhắc thêm lệnh vào `src/components/erp/CommandPalette.tsx`.
- Nếu workspace mới bật: set `ready: true` trong `src/workspaces/workspaces.config.ts` + thêm nav item.
