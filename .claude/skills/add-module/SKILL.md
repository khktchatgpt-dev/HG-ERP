---
name: add-module
description: Scaffold một domain module mới theo pattern 3 lớp của dự án (schema + repo + service) + thin route. Dùng khi user nói "thêm module", "tạo domain", "add module <tên>", hoặc cần một API/nghiệp vụ mới.
---

# add-module

Sinh một domain module đúng convention trong CLAUDE.md. Mục tiêu: mọi module trông giống nhau để team đọc/bảo trì dễ.

## Trước khi bắt đầu

Hỏi (nếu chưa rõ):
- **Tên domain** (kebab, số ít): vd `products`, `invoices`, `leaves`.
- **Thuộc nhóm nào**: `core/*` (dùng chung), `dept/*` (theo phòng ban), `workflow/*` (quy trình).
- **Bảng DB** đã có chưa? Nếu chưa → chạy skill `add-migration` trước, apply, rồi `sync-types`.

## Cấu trúc sinh ra

```
src/modules/<group>/<domain>/
  <domain>.schema.ts     Zod: create / update / listQuery
  <domain>.repo.ts       Type + <domain>Repo — data access qua db()
  <domain>.service.ts    Business logic + authz (assertCan / role check)
src/app/api/<route>/route.ts        (+ [id]/route.ts nếu có update/delete)
```

## Quy tắc bắt buộc

1. **Repo** — chỉ data access, KHÔNG business logic. Trả type rõ ràng (không `any`). Dùng `db()` từ `@/server/db` (đã typed theo `Database`). Select cột tường minh, không `select('*')` cho bảng có cột nhạy cảm (vd password_hash).
2. **Service** — nhận `user: User` làm tham số đầu, gọi `assertCan(user, ...)` hoặc kiểm role NGAY đầu mỗi hàm mutate. Ném `Forbidden/NotFound/Conflict/BadRequest` từ `@/server/http`, không tự dựng response.
3. **Schema** — validate ở biên. `listQuery` dùng `z.coerce` cho query string. Bool từ query: dùng pattern `z.enum(['true','false']).transform(v => v === 'true')`.
4. **Route** — mỏng: `handle(async (req) => { requireUser() → parseJson/parseQuery → service → NextResponse.json })`. Không đặt logic ở đây.
5. **Side-effect chéo module** (notify, audit, KPI...) — KHÔNG gọi service module khác trực tiếp. `emit()` một domain event từ `@/events/bus` và viết handler trong `src/events/handlers/`. Xem `tasks.service.ts` làm mẫu.
6. **Test** — tạo `<domain>.schema.test.ts` (validate) tối thiểu; nếu service có nhánh authz phức tạp, thêm test thuần logic (mock repo hoặc test hàm can()).

## Các bước

1. Đọc 1 module mẫu cùng nhóm để copy phong cách:
   - core → `src/modules/core/users/*`
   - dept → `src/modules/dept/technical/*`
   - workflow → `src/modules/workflow/tasks/*`
2. Sinh schema → repo → service → route theo mẫu.
3. Nếu route cần side-effect chéo module: thêm event vào `src/events/types.ts` + handler.
4. `npm run typecheck` — sửa tới sạch.
5. Thêm test tối thiểu, `npm test`.
6. Báo lại: file đã tạo + endpoint + quyền yêu cầu.

## Không làm

- Không import `@/server/db` hay module từ Client Component.
- Không bỏ qua authz "để test cho nhanh".
- Không trùng số migration.
