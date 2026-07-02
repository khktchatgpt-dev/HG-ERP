# HG-ERP — Hệ thống quản trị nội bộ Hoàng Gia

Nền tảng ERP nội bộ cho **Công ty SXTM Hoàng Gia** (sản xuất nội thất): quản lý công việc theo phòng ban, người dùng & phân quyền, và thư viện kỹ thuật (bản vẽ / định mức vật tư). Xây theo mô hình **workspace riêng cho từng bộ phận** — mỗi phòng ban có giao diện, menu và bảng điều khiển phù hợp với nghiệp vụ của mình.

<p>
  <img alt="Next.js" src="https://img.shields.io/badge/Next.js-16-black?logo=next.js" />
  <img alt="React" src="https://img.shields.io/badge/React-19-149eca?logo=react" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript" />
  <img alt="Supabase" src="https://img.shields.io/badge/Supabase-Postgres-3ecf8e?logo=supabase" />
  <img alt="Tailwind CSS" src="https://img.shields.io/badge/Tailwind-v4-38bdf8?logo=tailwindcss" />
  <img alt="Vitest" src="https://img.shields.io/badge/Tested%20with-Vitest-6e9f18?logo=vitest" />
</p>

---

## Tính năng chính

- 🏢 **Workspace theo phòng ban** — 10 bộ phận (Bán hàng, Kế toán, Kho, Kỹ thuật, Kế hoạch, QC, Sản xuất, Nhân sự, Ban Giám Đốc, Quản trị hệ thống), mỗi workspace có màu, sidebar, dashboard riêng. Đăng nhập tự đưa vào đúng workspace.
- 🛡️ **Quản trị hệ thống (IT)** — CRUD người dùng đầy đủ: tạo / sửa / đổi vai trò / khoá / xoá mềm / khôi phục / **reset mật khẩu** / **import Excel hàng loạt**; nhật ký thao tác (audit log); kiểm tra sức khoẻ hệ thống; quản lý phòng ban + gán trưởng phòng.
- 🔧 **Kỹ thuật** — thư viện sản phẩm (mã, danh mục, bản vẽ, BOM) với lọc, tìm kiếm, phân trang, export CSV.
- ✅ **Quản lý công việc** — giao việc, báo cáo tiến độ, duyệt / từ chối, báo cáo tuần, kế hoạch, thông báo.
- 🔐 **Xác thực tuỳ biến** — bcrypt + JWT cookie (httpOnly), phân quyền theo vai trò/phòng ban trong application layer.
- ⚡ **UI/UX kiểu ERP** — bộ component dùng chung (bảng dữ liệu có sort/phân trang, thanh KPI, breadcrumb, command palette `Ctrl+K`, phản hồi loading xuyên suốt).

> Trạng thái workspace: **Quản trị hệ thống** và **Kỹ thuật** đã hoàn thiện; **Bán hàng** dựng khung; các bộ phận còn lại đang lên kế hoạch (cấu hình sẵn, bật dần).

---

## Công nghệ & kiến trúc

| Lớp | Công nghệ |
|---|---|
| Frontend | Next.js 16 (App Router, Turbopack), React 19, Tailwind CSS v4 |
| Backend | Next.js Route Handlers (API), tổ chức domain-driven 3 lớp |
| Database | Supabase Postgres — **RLS bật, không policy** (chặn anon, server bypass bằng secret key) |
| Auth | Custom: `bcryptjs` + `jose` (JWT HS256) |
| Validate | Zod ở biên API |
| Test | Vitest |

**Nguyên tắc kiến trúc**

- **Domain-driven** — mã tổ chức theo nghiệp vụ trong `src/modules/*` (mỗi domain có `schema` + `repo` + `service`), hạ tầng dùng chung ở `src/server/*`. Route handler mỏng: `validate → service → JSON`.
- **Tách lớp rõ**: `repo` chỉ truy cập dữ liệu, `service` chứa business logic + phân quyền, `route` chỉ điều phối.
- **Event bus** — side-effect chéo module (thông báo, audit) đi qua `emit()` domain event thay vì gọi service khác trực tiếp → giảm coupling.
- **Type an toàn** — Supabase client được gen type từ schema (`src/lib/database.types.ts`), cập nhật bằng skill `sync-types` sau mỗi migration.

---

## Cấu trúc thư mục

```
src/
  app/
    (public)/login          Trang đăng nhập
    (app)/                  Trang cho người dùng đã đăng nhập (tasks, plan, notifications)
    (admin)/admin           Workspace Quản trị hệ thống (IT)
    (workspace)/technical   Workspace Kỹ thuật
    api/<route>/route.ts    API handler mỏng
  modules/
    core/                   auth · users · departments · notifications · settings · files
    dept/                   accounting · hr · sales · technical
    workflow/               tasks · team
  server/                   db (Supabase admin client) · http · permissions
  components/
    erp/                    Bộ UI kit ERP (DataTable, PageHeader, StatsBar, RowMenu…)
    workspace/              Shell / sidebar / topbar theo workspace
  workspaces/               Cấu hình workspace + resolver
  events/                   Event bus + handlers
  lib/                      api client · csv · database.types
supabase/migrations/        SQL migration (0001 → 0008), RLS-first
.claude/skills/             Skill tự động hoá theo convention dự án
```

---

## Bắt đầu

**Yêu cầu:** Node 20+, một project Supabase.

```bash
# 1. Cài dependencies
npm install

# 2. Cấu hình môi trường
cp .env.local.example .env.local
# Điền: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
#       SUPABASE_SECRET_KEY (sb_secret_*), SESSION_SECRET (≥32 ký tự)

# 3. Áp migration DB
#    Dùng Supabase CLI:  npx supabase db push
#    Hoặc paste supabase/migrations/*.sql vào SQL editor theo thứ tự

# 4. Tạo admin đầu tiên
node scripts/create-user.mjs --email admin@hg.com --password "Str0ngPass!" --role admin --name "Admin"

# 5. Chạy dev
npm run dev            # http://localhost:3000
```

Sinh `SESSION_SECRET`:
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

---

## Scripts

| Lệnh | Mô tả |
|---|---|
| `npm run dev` | Dev server (Turbopack) |
| `npm run build` / `start` | Build & chạy production |
| `npm run typecheck` | Kiểm tra kiểu TypeScript |
| `npm run lint` | ESLint |
| `npm test` | Vitest |
| `npm run format` | Prettier (tự sắp class Tailwind) |
| `npm run check` | typecheck + lint + test (gate trước khi coi là xong) |

---

## Chất lượng code

- **Prettier + ESLint**, hook Claude Code tự `format + lint --fix` file vừa sửa.
- **Vitest** cho logic rủi ro cao (phân quyền, validate schema, event bus).
- **Skills** hỗ trợ theo convention: `add-module`, `add-migration`, `add-erp-page`, `check-rls`, `sync-types` (trong `.claude/skills/`); cùng bộ skill Supabase chính chủ (`npx skills add supabase/agent-skills`).
- Quy ước chi tiết trong [`CLAUDE.md`](./CLAUDE.md).

---

## Bảo mật

- RLS bật trên mọi bảng, **không policy** — anon/publishable key bị chặn hoàn toàn; chỉ server (secret key) truy cập được. Mọi request đi qua API route + `src/server/permissions.ts`.
- Secret key **chỉ dùng server-side**, không bao giờ import vào Client Component.
- Chống email enumeration ở `/login` (so sánh hash thời gian hằng định).
- Mật khẩu bcrypt 12 vòng; session JWT httpOnly, sameSite=lax, hết hạn 7 ngày.

**Cần bổ sung trước production:** rate limit `/api/login`, CSRF token nếu nhận form cross-origin, email verification / reset mật khẩu tự phục vụ. Xem mục Security caveats trong `CLAUDE.md`.

---

## Trạng thái & lộ trình

- ✅ Hạ tầng: auth, phân quyền, event bus, test, module Files (Supabase Storage)
- ✅ Workspace: Quản trị hệ thống (IT), Kỹ thuật
- 🚧 Bán hàng (khung), các phòng còn lại (Kế toán / Kho / Kế hoạch / QC / Sản xuất / Nhân sự / BGĐ)
- 📋 Đánh giá độ sẵn sàng ERP: [`docs/erp-readiness-assessment.md`](./docs/erp-readiness-assessment.md)

---

_Dự án nội bộ — © Công ty SXTM Hoàng Gia._
