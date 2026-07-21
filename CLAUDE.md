@AGENTS.md

# Task Manager

Next.js 16 (App Router, Turbopack) + React 19 + Tailwind v4. Supabase Postgres as DB only; **auth is custom** (bcryptjs + JWT cookie).

## Stack

- `next@16` — App Router, `cookies()` is **async**, file convention is `proxy.ts` (not `middleware.ts`).
- `@supabase/supabase-js` — used **server-side only**, with the secret key (`sb_secret_*`, the new replacement for `service_role`). RLS is **ENABLED with no policies** on every table: the anon/publishable key is fully blocked, the secret key bypasses RLS. All access goes through API routes; per-role/row authz lives in `src/server/permissions.ts`.
- `bcryptjs` — password hashing (12 rounds).
- `jose` — JWT for the `session` cookie (HS256, httpOnly, sameSite=lax, 7-day expiry).

## Folder layout

Code is organized **by domain** under `src/modules/*` (each domain owns its
schema + service + repos), with cross-cutting infra in `src/server/*`. Route
handlers stay thin and live in `src/app/api/*`. Adding an API = add/extend a
module, then a thin route.

```
src/
  app/
    page.tsx                       Protected home; renders the current user
    login/ tasks/ notifications/   Pages (server + client components)
    api/<route>/route.ts           Thin handlers: validate → service → JSON
  modules/                         Domain modules (server-only)
    auth/
      auth.schema.ts               Zod: login
      auth.service.ts              login / logout / currentUser / requireUser
      password.ts                  hashPassword / verifyPassword
      session.ts                   createSession / destroySession / getSession / verifySessionToken
    users/
      users.schema.ts              Zod: create / update / list query
      users.service.ts             admin user management (create/update/list)
      users.repo.ts                User type + usersRepo
    tasks/
      tasks.schema.ts              Zod + TASK_STATUSES / TASK_PRIORITIES
      tasks.service.ts             Task business logic (also comments/activity/dashboard)
      tasks.repo.ts                tasksRepo
      comments.repo.ts             commentsRepo
      activity.repo.ts             activityRepo
    departments/                   departments.schema/service/repo.ts
    notifications/                 notifications.service/repo.ts
  server/                          Shared infra (no domain logic)
    db.ts                          Supabase admin client (secret key, bypasses RLS)
    http.ts                        HttpError + factories + handle() + parseJson/parseQuery
    permissions.ts                 can() / assertCan() — role-based authorization
  proxy.ts                         Next 16 proxy — gates everything except PUBLIC_PATHS
supabase/
  migrations/0001_users.sql        users table (RLS disabled by design)
```

### Adding a new domain/API

1. Create `src/modules/<domain>/` with `<domain>.schema.ts` (Zod), `<domain>.repo.ts`
   (data access via `db()`), and `<domain>.service.ts` (business logic + authz).
2. Add a thin handler at `src/app/api/<route>/route.ts`:
   `export const POST = handle(async (req) => { … })` — `requireUser()`,
   `parseJson(req, schema)`, call the service, return `NextResponse.json(...)`.

## Auth flow

**No public self-registration.** Accounts are provisioned by an admin via `POST /api/users`
(or `scripts/create-user.mjs` for the first admin). Then:

1. POST `/api/login` → fetch user → bcrypt verify (constant-ish time even if user missing) → sign JWT → set `session` cookie.
2. `proxy.ts` verifies the cookie on every request; missing/invalid → redirect to `/login` (HTML routes) or 401 (`/api/*` routes).
3. POST `/api/logout` → delete cookie.

### Bootstrap the first admin

```
node scripts/create-user.mjs --email admin@hg.com --password "Str0ngPass!" --role admin --name "Admin"
# or promote an existing user:
node scripts/create-user.mjs --email someone@hg.com --promote --role admin
```

## Conventions

- **Never** import `src/server/db.ts` (or anything under `src/modules/*`) from a Client Component. They use the secret key.
- All mutations live under `src/app/api/<route>/route.ts`. Keep them thin: validate → call the service → return JSON. Business logic and authz belong in the module's service, data access in its repo.
- Wrap handlers in `handle()` from `@/server/http`; throw `BadRequest/Forbidden/NotFound/...` instead of building error responses by hand.
- Always read the session via `getSession()` from `@/modules/auth/session` on the server. Inside `proxy.ts` (Edge runtime) use `verifySessionToken(token)` since `cookies()` isn't available there.
- New tables: **enable RLS with no policies** (`alter table ... enable row level security;`) so the anon key is blocked while the secret-key server bypasses. Views: add `with (security_invoker = on)` so they respect RLS. Document the posture in the migration.
- Validate input at the API boundary; trust internal callers.

## Migration conventions (`supabase/migrations/`)

- **Filename**: `NNNN_short_snake_case.sql` — 4-digit zero-padded, monotonic. Never reuse a number; never rewrite an applied migration.
- **First lines must be a comment block** stating: what the migration does, RLS posture (`enable row level security` with no policies = blocked-anon/bypass-secret), and any caveat. See `0001_users.sql` for the canonical header.
- **Per-domain tables get a prefix** so they don't collide: `sales_*`, `hr_*`, `accounting_*`, `technical_*`. Core tables (`users`, `departments`, `tasks`, ...) have no prefix.
- **Always idempotent**: `create table if not exists`, `create index if not exists`, `drop trigger if exists ... ; create trigger ...`. So a partially-applied migration is safe to re-run.
- **RLS**: every new table ends with `alter table ... enable row level security;` (no policies). Every view adds `with (security_invoker = on)` so it inherits the caller's RLS posture. Document the choice in the header.
- **Timestamps**: use `timestamptz not null default now()` for `created_at`/`updated_at`. Wire `updated_at` via `public.set_updated_at()` trigger (defined in `0002_core_schema.sql`).
- **Identifiers**: `uuid primary key default gen_random_uuid()`. FKs use explicit `on delete` policy — never leave it implicit.
- **After applying** (`supabase db push` or SQL editor): ask Claude to **"sync types"** to regen `src/lib/database.types.ts`. See `.claude/skills/sync-types/`.

## Frontend & UI conventions (admin/workspace)

- **Dùng ERP kit** ở `src/components/erp/*` — KHÔNG dựng bảng/toolbar thô. Các mảnh chuẩn: `PageHeader`, `StatsBar`, `Toolbar`/`ToolbarInput`/`ToolbarSelect`, `DataTable` (+`Column<T>`), `RowMenu` (action ⋯), `EmptyState`, `Spinner`/`TopProgressBar`, `Breadcrumbs`. Mẫu tham chiếu: `admin/users/UsersManager.tsx`, `technical/products/ProductsManager.tsx`.
- **Shell nằm ở layout, không ở page.** Mỗi workspace có `(<ws>)/layout.tsx` bọc `WorkspaceShell` + `(<ws>)/loading.tsx` dùng `ContentSkeleton`. Page trả nội dung trực tiếp. Sidebar tự highlight theo pathname (`NavLink` + `useLinkStatus`) — không truyền `current`.
- **Gọi API từ client** qua `api()`/`ApiError` ở `@/lib/api` (JSON, tự redirect 401). Không `fetch` thủ công. Mutation: try/catch → `router.refresh()` → toast (`useToast`) → `TopProgressBar active={busy}`. Nút submit có `Spinner`. Form đóng + toast khi thành công.
- **Workspace mới**: bật `ready: true` trong `src/workspaces/workspaces.config.ts` + nav item; login tự redirect qua `resolveWorkspace`. Dùng skill `add-erp-page` để scaffold.

## Cross-module side effects — Event Bus

- KHÔNG gọi service module khác trực tiếp cho side-effect (notify/audit/KPI). `emit()` một domain event từ `@/events/bus`, khai type ở `src/events/types.ts`, viết handler ở `src/events/handlers/` (đăng ký trong `register.ts`). Handler lỗi được nuốt + log, không làm rollback caller. Mẫu: `tasks.service.ts` → `task.notifications.ts`.

## Testing & quality gates

- **Vitest** (`npm test`). Test file co-located `*.test.ts`. Bắt buộc test cho: logic thuần rủi ro cao (tính tiền/tồn/công nợ), `permissions.can()`, zod schema quan trọng, event bus. UI để verify tay.
- **Trước khi coi là xong**: `npm run check` (typecheck + lint + test) phải sạch. Format: `npm run format` (Prettier + tự sắp class Tailwind). Hook tự chạy prettier+eslint `--fix` trên file vừa sửa.
- **Đừng** mark hoàn thành khi typecheck/test còn đỏ.

## Skills (`.claude/skills/`)

Skill nội bộ (commit trong repo) — gọi khi hợp:

- `sync-types` — regen `database.types.ts` sau migration.
- `add-module` — scaffold domain module 3 lớp + route.
- `add-migration` — file SQL đúng chuẩn RLS + đánh số.
- `add-erp-page` — trang workspace dùng ERP kit.
- `check-rls` — rà RLS + Supabase security advisor.
- `frontend-design` — hướng dẫn thiết kế UI có chủ đích (palette/typography/layout, copy), tránh mẫu rập khuôn. Nguồn: plugin `frontend-design` của claude-code (vendored).

Skill ngoài (official Supabase, nguồn `.agents/skills/`, symlink vào `.claude/skills` theo máy — chạy `npx skills add supabase/agent-skills` sau khi clone):

- `supabase` — mọi task Supabase (auth/RLS/migration/storage), luôn verify theo changelog.
- `supabase-postgres-best-practices` — chuẩn Postgres.

## Environment

Copy `.env.local.example` → `.env.local`. Required:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (unused right now but kept for future client-side queries)
- `SUPABASE_SECRET_KEY` — server-only, bypasses RLS (new format: `sb_secret_*`)
- `SESSION_SECRET` — ≥32 chars. Generate: `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`

## MCP (Supabase) — HTTP transport

Copy the exact command from Supabase dashboard → **Connect → MCP → Claude Code**:

```
claude mcp add --scope project --transport http supabase "https://mcp.supabase.com/mcp?project_ref=<ref>&features=..."
claude /mcp        # then Authenticate (browser OAuth)
```

Project ref: `pcbfvrapknzykhtntuwg`.

## Common tasks

- Dev: `npm run dev`
- Typecheck: `npm run typecheck`
- Lint: `npm run lint`
- Apply SQL: paste `supabase/migrations/0001_users.sql` then `0002_core_schema.sql` into the SQL editor, or `npx supabase db push` after `supabase link`. (`0002` creates departments/tasks/comments/notifications/activity_log + `v_task_summary`, and enables RLS everywhere.)
- Seed/promote a user: `node scripts/create-user.mjs --email … --password … --role …`

## API quick reference

```
# Sign in (admin-provisioned account)
curl -X POST http://localhost:3000/api/login \
  -H "content-type: application/json" \
  -c cookies.txt \
  -d '{"email":"admin@hg.com","password":"Str0ngPass!"}'

curl http://localhost:3000/api/me -b cookies.txt

# Admin creates a user (no public registration)
curl -X POST http://localhost:3000/api/users -b cookies.txt \
  -H "content-type: application/json" \
  -d '{"email":"nv@hg.com","password":"pass1234","name":"Nhân viên","role":"employee"}'

curl -X POST http://localhost:3000/api/logout -b cookies.txt
```

## Gotchas (Next 16)

- `cookies()`, `headers()`, `params`, `searchParams` are async — always `await`.
- File convention is `proxy.ts` with `export function proxy`, not `middleware.ts`.
- Route handlers use Web `Request`/`Response`.

## Security caveats (custom auth)

- `/api/login` has in-memory rate limiting (`src/server/rate-limit.ts`, 5 fails / 15 min per IP+email). Single-instance only — switch to Upstash/Redis if deploying multi-instance/serverless.
- No email verification, password reset, account lockout, or audit log.
- No CSRF token — relying on `sameSite=lax` cookie + JSON-only API. If you ever accept form posts cross-origin, add CSRF.
- Consider switching to Supabase Auth or Auth.js if any of the above matter.
