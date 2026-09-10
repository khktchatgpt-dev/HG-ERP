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

### HAI HỆ GIAO DIỆN ĐANG SỐNG SONG SONG — đọc trước khi sửa file `.tsx` nào

|           | Bộ kit ERP (MỚI)                         | Theme v3 + ERP kit cũ                         |
| --------- | ---------------------------------------- | --------------------------------------------- |
| Import từ | `@/components/kit`                       | `@/components/erp/*`, `@/components/shadcn/*` |
| Lớp token | `.kit` (`src/components/kit/tokens.css`) | `.theme-v3` (`src/app/globals.css`)           |
| Đang phủ  | 6 file (đo 10/09/2026)                   | 168 file                                      |
| Dùng khi  | **mọi màn MỚI**                          | màn CŨ, sửa tại chỗ                           |

**Đừng viết lại 168 file cho đều nhau** — đổi rất nhiều rủi ro lấy rất ít giá trị. Màn cũ
chuyển sang kit mới khi có việc nghiệp vụ chạm vào nó, không chuyển vì lý do thẩm mỹ.
Trong một file thì **chỉ dùng một hệ**; trộn hai hệ là hai bộ token đánh nhau.

### Thiết kế theo hướng ERP — sổ ở `/design-lab`

**Trước khi dựng màn mới, mở [`/design-lab`](src/app/design-lab/page.tsx) (public, không cần
đăng nhập).** Việc đầu tiên không phải chọn thành phần, mà là **xác định màn thuộc khuôn
nào** — khuôn đã chốt sẵn phần lớn quyết định bố cục.

**Sáu khuôn màn.** Số loại màn trong một ERP là tập ĐÓNG; chốt khuôn là chốt luôn bố cục.
Không chọn được khuôn nào nghĩa là câu hỏi nghiệp vụ chưa rõ, không phải cần khuôn thứ bảy —
tập nở từ bốn lên sáu một lần duy nhất, khi rà 12 trang thật của phòng Cung ứng (mục 03b của
sổ) lộ ra hai loại màn mà bốn khuôn đầu, vốn dựng từ mỗi luồng đơn mua, không chứa nổi.

| Khuôn                  | Trả lời câu hỏi                                 | Mẫu chạy được               | Chép của                                                        |
| ---------------------- | ----------------------------------------------- | --------------------------- | --------------------------------------------------------------- |
| **A · Vào việc**       | Hôm nay tôi phải làm gì?                        | `/design-lab/mau-vao-viec`  | SAP Fiori launchpad, Dynamics workspace                         |
| **B · Hộp thư**        | Việc nào chờ tôi, ở MỌI loại chứng từ?          | `/design-lab/mau-hop-thu`   | SAP My Inbox, Odoo activity                                     |
| **C · Danh sách**      | Trong tập này, cái nào cần tôi động vào?        | `/design-lab/mau-danh-sach` | SAP List Report, Dynamics List page                             |
| **D · Chứng từ**       | Tờ này ở đâu, ai giữ, vướng gì?                 | `/design-lab/mau-erp`       | SAP Object Page, Dynamics Details master                        |
| **E · Hồ sơ danh mục** | Đối tượng này là ai, làm ăn ra sao, dùng ở đâu? | `/design-lab/mau-ho-so-ncc` | SAP Business Partner, Dynamics Vendor master, Odoo partner form |
| **F · Bảng nhập liệu** | Khai 40 dòng nhanh như Excel mà không sai?      | `/design-lab/mau-soan-don`  | Dynamics journal entry, SAP mass entry, Odoo list sửa tại chỗ   |

**Đừng nhầm D với E, hay D với F.** Hồ sơ danh mục KHÔNG có vòng đời duyệt — nhét nó vào
khuôn chứng từ là phải bịa ra một vòng đời, rồi người dùng đi tìm nút "gửi duyệt" trên thứ
không ai duyệt bao giờ; chỗ của ba trục trạng thái ở đó là **dải hiệu suất** (`MetricStrip`,
mỗi ô bắt buộc kèm mẫu số). Màn nhập liệu thì lưới là nhân vật chính, đầu đơn co thành
**dải chip** (`HeadChips`) vì mỗi hàng đầu trang là một hàng lưới bị lấy mất, và thanh chốt
đáy (`CommitBar`) phải nói vì sao chưa lưu được bằng một câu **bấm được**.

Sáu màn mẫu dựng **hoàn toàn bằng kit** và vừa là mẫu vừa là phép thử API: dựng một màn ERP
đầy đủ mà phải chế thêm CSS tại chỗ thì kit còn thiếu, và chỗ thiếu lộ ra ngay ở đó. Đúng
theo cách đó, Khuôn E và F đẻ ra bốn thành phần mới cho kit — `MetricStrip`/`Metric`,
`MasterWarn`, `HeadChips`/`HeadChip`, `CommitBar`. Thư viện thành phần tra ở
`/design-lab/thanh-phan`.

**Bản đồ 12 trang thật của phòng Cung ứng → khuôn** ở mục 03b của sổ. Bảng đó là phép thử của
bản đồ khuôn: một trang không xếp được vào khuôn nào thì bản đồ thiếu, chứ không phải trang
đó đặc biệt.

**Sáu nguyên tắc** (chi tiết + triệu chứng đo được ở mục 02 của sổ):

1. **Một màn trả lời một câu hỏi nghiệp vụ** — không phải "một màn trưng một bảng".
2. **Chứng từ tự kể chuyện đời nó** — đang ở bước nào / ai đang giữ / đã có chuyện gì.
3. **Con số là một lời hứa** — badge, chip lọc, ô việc phải đếm bằng **đúng hàm trang đích
   dùng**. Số 0 không phải lúc nào cũng xấu, đừng tô đỏ.
4. **Dày, nhưng có kỷ luật căn chỉnh** — thang chữ nền giữ 13px. Chữa "khó nhìn" bằng cách
   nới thoáng là phản xạ web; nguyên nhân thật thường là tương phản. **Không thẻ nổi**: khối
   ngăn nhau bằng một vạch mảnh, lưới sát mép, FactBox một vạch dọc (kit mặc định phẳng từ
   10/09/2026 — SAP GUI, Dynamics đều bày như vậy).
5. **Một màu hành động, ba màu vòng đời** — `--act` cho thứ bấm được/đang chọn; `--stop`
   `--warn` `--done` chỉ mã hoá vòng đời dữ liệu, **không bao giờ lên nút hay dòng đang chọn**.
6. **Số nào không kiểm được thì không ai tin** — chân bảng nói tổng KHÔNG gồm gì; số suy ra
   từ phép tính bày được phép tính nguyên văn (`WhyBox`).

**Luật kiểm trước khi coi màn là xong** — bản đầy đủ 14 dòng ở mục 05 của sổ. Ba dòng hay
trượt nhất:

- Bảng dài phải có tiêu đề cột dính **và** chân tổng dính. Cha đặt `min-h-screen` thì bảng
  không bao giờ cuộn trong khung và cả hai thứ dính đều vô hiệu — dùng `ScreenFrame`.
- Hành động bị chặn phải nói vướng gì **và cách gỡ**, ngay tại chỗ. Không cho bấm rồi mới
  báo lỗi.
- Trạng thái rỗng phải nói lý do và việc làm tiếp (`Empty` bắt buộc `reason` + `next`).

**Màn mẫu đã dựng thật theo phân tích riêng**: [`docs/mua-hang-phieu-mua.md`](docs/mua-hang-phieu-mua.md)
— Phiếu mua (`/mua-hang/don`): đối chiếu SAP/Dynamics/Odoo/NetSuite, 8 lối mòn đo được của màn
cũ, bản đồ tính năng cũ → mới. Làm màn danh sách khác thì chép cấu trúc tài liệu này.

**LUỒNG chạy thế nào — đọc TRƯỚC khi chọn khuôn màn**:
[`docs/tieu-chi-workflow-erp.md`](docs/tieu-chi-workflow-erp.md). Sổ `/design-lab` trả lời
"màn trông thế nào"; tài liệu này trả lời câu đứng trước nó. Bốn nguyên lý nền (chứng từ là
nguyên tử · danh mục ≠ chứng từ · ba dòng chảy · không xoá chỉ đảo), bảy tiêu chí luồng đo
được, sáu lối mòn còn lại đo trên mã nguồn, và **sáu bước thiết kế một luồng mới** — bắt đầu
bằng máy trạng thái, chọn khuôn màn là bước CUỐI.

**Nền tảng đối chiếu**: [`docs/thiet-ke-huong-erp.md`](docs/thiet-ke-huong-erp.md) — đo
HG-ERP với SAP/Odoo/Dynamics/NetSuite/Zoho trên mã nguồn + DB thật, và bốn lỗ hổng còn lại
(hộp thư bị nhốt một phòng, chưa có nơi trao đổi trên chứng từ, chỉ có duyệt/từ chối, không
ai biết đơn đang kẹt).

### Theme v3 "HG Ledger" (màn CŨ — 168 file)

- **Token là nguồn màu duy nhất** — khối `.theme-v3` trong `src/app/globals.css`, gắn ở gốc `WorkspaceShell`. KHÔNG gõ màu Tailwind cứng (zinc/sky/emerald/violet…) trong màn mới; dùng class token: `bg-background/bg-card/bg-muted`, `text-foreground/text-muted-foreground`, `border`/`border-input`, `text-[var(--primary)]` v.v.
- **Một màu hành động**: royal cobalt `--primary` (#2743c4) cho nút chính/link/focus/tab đang chọn. Hover/selected dùng tint `--accent` (#eef1fc). **Ba màu trạng thái** `--warn/--stop/--done` chỉ mã hoá vòng đời (nhãn, vạch `spine`), không bao giờ dùng cho nút.
- **Chữ**: thang 5 bậc `t-display/t-title/t-body/t-label/t-data` (globals.css). Mọi MÃ chứng từ, tiền, số lượng, ngày = `t-data` (JetBrains Mono, tabular-nums); mã phiếu hiển thị qua `DocChip`. KPI lớn: `font-mono tabular-nums`.
- **Icon**: chỉ MỘT bộ **lucide-react** — 16px trong nút/menu (icon đứng TRƯỚC chữ), 20px ở sidebar/tab, stroke 1.8 (đang chọn 2.1). Icon đứng một mình bắt buộc `aria-label` + Tooltip. Icon không tự mang màu — màu theo chữ bên cạnh. Ánh xạ khái niệm→icon dùng cố định (xem mục Icon ở /design-lab).
- **BẪY Radix portal — ĐÃ VÁ Ở PRIMITIVE (02/09/2026), không phải nhớ nữa**: Dialog/AlertDialog/Popover/Select/DropdownMenu render ra `<body>` NGOÀI shell nên token theme không phủ tới. Nay mỗi `*Content` tự gọi `usePortalTheme()` ([`src/components/shadcn/portal-theme.ts`](src/components/shadcn/portal-theme.ts)) — dò lớp theme đang phủ trong DOM rồi tự gắn lại. **Chỗ gọi KHÔNG cần gõ `theme-v3` nữa**; các chỗ đang gõ là thừa (vô hại, dọn dần). Dò theo DOM chứ không hằng số hoá nên đường lùi v2 vẫn nguyên. `Dialog`/`AlertDialog` cũng đã đổi nền mặc định `bg-background` → `bg-card`: dialog là thẻ trắng nổi trên nền đã tối, để màu canvas là ra hộp xám. `Modal` render inline nên vốn tự ăn theme.
- **Sổ tham chiếu cũ ĐÃ BỊ THAY** (09–10/09/2026): `design-lab/DesignLab.tsx` (14 mục token/chữ/icon của v3) và toàn bộ `kit-lab` đã xoá. `/design-lab` nay là sổ thiết kế hướng ERP — xem mục trên. Quy ước icon/chữ của v3 dưới đây vẫn đúng cho 168 màn cũ, nhưng không còn trang trưng bày riêng.
- **`theme-v2` đã XOÁ HẲN 09/09/2026** — không nơi nào gắn lớp đó nữa, khối token cũng đã bỏ khỏi globals.css. Đường lùi khẩn giờ là `git revert` một PR, không phải đổi một lớp CSS.

### Kit & pattern

- **Dùng ERP kit** ở `src/components/erp/*` và `src/components/shadcn/*` — TUYỆT ĐỐI KHÔNG dựng concept "tờ giấy in", "con dấu mộc xoay", "cột lề hẹp" hay bất kỳ skeuomorphism nào. Đây là Web SaaS ERP.
- **Thành phần kit bắt buộc**:
  - `RefChain`: chuỗi liên kết chứng từ cha→con (`Đơn hàng khách → Lệnh SX → Đơn đặt`).
  - `DocChip`: mã chứng từ và mã vật tư (`PO-…`, `LSX-…`, `VT-…`).
  - `StatTiles` / `StatTile` / `StatsBar`: dải 4 thẻ KPI tóm tắt đầu trang.
  - `PageHeader` & `Breadcrumbs`: điều hướng và nhận diện trang.
  - Action Toolbar: nút chính + nút phụ + DropdownMenu (⋯) luôn ở góc trên bên phải header.
  - `DataTable` hoặc `shadcn/table`: bảng dữ liệu có sticky header, căn phải font-mono cho số/tiền, tổng kết kế toán ở chân bảng.
  - `shadcn/tabs`: chia tab nghiệp vụ (Tổng quan, Đợt giao, Điều khoản, Dòng thời gian, Hồ sơ).
  - `Badge` (`@/components/Badge`): nhãn trạng thái theo token vòng đời (`primary`, `warn`, `done`, `stop`, `gray`).
- **Mẫu tham chiếu chuẩn**:
  - Màn MỚI → bốn khuôn ở `/design-lab` (mục trên). Đừng chép từ màn cũ.
  - Chi tiết đơn đặt vật tư (đã chuyển sang kit mới): `src/app/(workspace)/planning/pos/[id]/PoDetailScreen.tsx`
  - Chi tiết đơn hàng (còn theme v3): `src/components/sales/OrderDetailView.tsx`
  - Chi tiết lệnh sản xuất (còn theme v3): `src/components/production/LsxDetailView.tsx`
- **Shell nằm ở layout, không ở page.** Mỗi workspace có `(<ws>)/layout.tsx` bọc `WorkspaceShell` + `(<ws>)/loading.tsx` dùng `ContentSkeleton`. Page trả nội dung trực tiếp. Sidebar tự highlight theo pathname (`NavLink` + `useLinkStatus`) — không truyền `current`.
- **Gọi API từ client** qua `api()`/`ApiError` ở `@/lib/api` (JSON, tự redirect 401). Không `fetch` thủ công. Mutation: try/catch → `router.refresh()` → toast (`useToast`) → `TopProgressBar active={busy}`. Nút submit có `Spinner`. Form đóng + toast khi thành công.
- **Workspace mới**: bật `ready: true` trong `src/workspaces/workspaces.config.ts` + nav item; login tự redirect qua `resolveWorkspace`. Dùng skill `add-erp-page` để scaffold.
- **Trang DÙNG CHUNG** (không thuộc phòng nào) đặt ở `src/app/(shared)/*` + thêm vào `SHARED_SECTION` của `workspaces.config.ts` để mọi sidebar đều có. Layout `(shared)` chỉ gác đăng nhập và render `WorkspaceShell` theo workspace NHÀ của người xem — người xem giữ sidebar phòng mình. Quyền SỬA vẫn do service/registry quyết + page truyền cờ `canEdit` xuống để ẩn nút. Hiện có: `/products` (hồ sơ SP — mọi phòng xem, chỉ Kỹ thuật/Bán hàng/Giám đốc sửa).
- **Đổi chỗ route đã publish**: thêm cặp `[cũ, mới]` vào `MOVED_PREFIXES` ở `src/proxy.ts` (chạy trước gate đăng nhập) thay vì để page stub redirect — stub nằm trong layout cũ nên vẫn bị gác quyền của khu cũ.

## Cross-module side effects — Event Bus

- KHÔNG gọi service module khác trực tiếp cho side-effect (notify/audit/KPI). `emit()` một domain event từ `@/events/bus`, khai type ở `src/events/types.ts`, viết handler ở `src/events/handlers/` (đăng ký trong `register.ts`). Handler lỗi được nuốt + log, không làm rollback caller. Mẫu: `tasks.service.ts` → `task.notifications.ts`.

## Testing & quality gates

- **Vitest** (`npm test`). Test file co-located `*.test.ts`. Bắt buộc test cho: logic thuần rủi ro cao (tính tiền/tồn/công nợ), `permissions.can()`, zod schema quan trọng, event bus. UI để verify tay.
- **Trước khi coi là xong**: `npm run check` (typecheck + lint + test) phải sạch. Format: `npm run format` (Prettier + tự sắp class Tailwind). Hook tự chạy prettier+eslint `--fix` trên file vừa sửa.
- **Đừng** mark hoàn thành khi typecheck/test còn đỏ.

### Cổng đồng bộ giao diện (`eslint-rules/hg-ui.mjs`)

Hai luật ESLint riêng, chạy trên `src/app/**/*.tsx` + `src/components/**/*.tsx`:

- `hg/no-hardcoded-color` — cấm palette Tailwind dựng sẵn (`bg-zinc-50`,
  `text-emerald-600`, `dark:bg-zinc-950`…) và hex trong class (`text-[#2743c4]`).
  Thông báo lỗi tự gợi ý token đúng theo NGỮ NGHĨA: đỏ→`--stop`, hổ
  phách→`--warn`, lục→`--done`, lam→`--primary`, xám→`bg-muted`/`text-muted-foreground`.
- `hg/no-raw-control` — cấm `<table> <button> <input> <select> <textarea>` thô,
  chỉ ra đúng thành phần kit thay thế.

**Được miễn**: `components/erp/*`, `components/shadcn/*`, `components/ui/*`,
`app/design-lab/*` — đó là nơi ĐỊNH NGHĨA chuẩn, không phải nơi tiêu thụ chuẩn.

**Bánh cóc (ratchet)**: `ui-baseline.json` giữ 193 file nợ cũ ở mức `warn` để
`check` không đỏ ngày đầu. **Mọi file khác — gồm mọi file mới — là `error`.**
Dọn xong một file thì `npm run ui:baseline` để nó rớt khỏi danh sách và từ đó bị
canh ở mức `error` vĩnh viễn. Script thoát mã 1 nếu có file MỚI lọt vào baseline
— baseline chỉ được ngắn đi, không được dài ra.

**Đừng nhét file mới vào baseline để qua cổng.** Cần ngoại lệ thật thì
`// eslint-disable-next-line hg/<luật>` kèm một dòng lý do.

**Luật lint có test** (`eslint-rules/hg-ui.test.ts`, 20 ca, chạy trong `npm test`
qua `include` của `vitest.config.ts`). Bắt buộc, vì lint hỏng **im lặng**: regex
sai thì lint vẫn báo "0 lỗi" và cả hàng rào thành đồ giả. Sửa luật thì chạy test.

`npm run lint` (`--quiet`) chỉ in LỖI cho gọn; nợ cũ vẫn hiện inline trong IDE —
đúng lúc đang mở file đó. Muốn xem hết: `npm run lint:all`.

**BẪY khi sửa luật**: regex trong `hg-ui.mjs` phải viết bằng `` String.raw`…` ``.
Template literal thường nuốt `\b`/`\d` thành ký tự điều khiển và regex hỏng IM
LẶNG — luật vẫn chạy, chỉ là không khớp gì. Route group App Router có dấu ngoặc
(`src/app/(workspace)/…`) nên đường dẫn baseline phải escape trước khi đưa vào
`files` của flat config, nếu không minimatch hiểu `(` là nhóm glob và cả khu
workspace trượt khỏi baseline.

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

Optional (bật tính năng đọc file BOM bằng AI): `ANTHROPIC_API_KEY` **hoặc**
`GEMINI_API_KEY`, cộng `BOM_AI_PROVIDER` / `BOM_AI_MODEL` để chọn bên và tầng
model. Thiếu cả hai key thì route trả lỗi cấu hình, phần còn lại của app không
ảnh hưởng.

## Đọc file BOM bằng AI (`bom-ai.*`)

Trích định mức từ file BOM (.xlsx / PDF / ảnh) thành **bản nháp** cho hồ sơ SP.

- **Không mở đường ghi mới.** Service chỉ trả draft; UI (`BomAiImport.tsx`) cho
  người dùng soi rồi lưu qua đúng route `parts/bulk` mà lưới gõ tay đang dùng —
  vẫn qua `productPartsBulkSchema` + `calcPartDerived`.
- **Mô hình chỉ TRÍCH, không TÍNH.** Khối lượng / tổng dài / diện tích / m³ do
  `bom-calc.ts` tính lại. Đừng nhận số học của mô hình cho thứ đi vào giá thành.
- **Seam đổi nhà cung cấp**: `bom-ai.provider.ts` giữ interface `BomExtractor` +
  prompt + cách chọn adapter; `bom-ai.anthropic.ts` / `bom-ai.gemini.ts` chỉ còn
  việc gọi HTTP. Cả hai dùng CHUNG một JSON Schema, nên chấm điểm hai bên là đổi
  một biến env. Chọn xong thì xoá adapter kia + gỡ dependency của nó.
- **BẪY**: đừng sinh JSON Schema bằng `z.toJSONSchema(productPartsBulkSchema)` —
  structured outputs (cả hai bên) không nhận `minimum`/`maxLength`/`pattern`.
  `buildExtractJsonSchema()` viết tay schema "gầy", zod kiểm lại ở server. Có
  test canh chính điều này trong `bom-ai.schema.test.ts`.
- **`.xlsx` đi đường lưới ô** (`lib/bom-grid.ts`) chứ không phải vision: rẻ hơn
  nhiều lần, chính xác hơn, và là đường duy nhất lấy được `source_ref` (địa chỉ
  ô nguồn) cho người kiểm. File `.xls` đời cũ exceljs không đọc được — báo người
  dùng lưu lại thành .xlsx.
- **Gemini: ghim model, đừng dùng alias.** `gemini-flash-latest` trả 503
  UNAVAILABLE liên tục (đo 17/08/2026). Mặc định là `gemini-3.5-flash`. Kèm
  `withRetry` giãn cách vì `@google/genai` KHÔNG tự retry 5xx — request nhỏ đi
  lọt trong khi request thật (prompt + lưới + schema) 503 trên cùng model, tức
  là lỗi công suất theo kích thước. SDK Anthropic tự retry nên không cần.
- Lỗi nhà cung cấp được DỊCH sang câu người dùng đọc được (`translateGeminiError`
  / `translateAnthropicError`) — quá tải thì bảo chờ, cấu hình sai thì bảo đi
  sửa. Không dịch thì mọi thứ rơi ra "Internal server error".
- **Ghi bản nháp đi qua `parts/ai-apply`** (cả bản nháp một lượt), KHÔNG lặp
  `parts/bulk` từng khối: chế độ `replace` phải xoá xong mọi nhóm liên quan rồi
  mới ghi, chia nhỏ là khối sau cắn vào khối trước. `replace` chỉ xoá các NHÓM có
  trong bản nháp (`deletePartsByGroups`) — file chỉ nói về khung thì đừng xoá bao
  bì ai đó nhập tay. Màn duyệt luôn bày số dòng đang có (`meta.existing`) vì rất
  nhiều hồ sơ đã được `bom-import-all.mjs` nạp sẵn từ chính file đó.
- **Tạo SP mới từ file BOM**: `/products` → "Tạo từ file BOM"
  (`BomAiNewProduct.tsx` → `products/from-bom`). Bật `withProduct` để đọc thêm
  khối thông tin chung ở đầu file (TÊN SP, MÃ K.HÀNG, KTSP, Nhiên Liệu, KTBB,
  NW/GW). KTSP dạng `590x720/1060x1100/840` = W × D(mở) × H(mở) → `*_open_mm`.
  Mã HG trùng thì service bỏ trống để người dùng xin mã mới, không để họ ăn lỗi
  CODE_TAKEN sau khi đã duyệt xong cả form.
- **Lấy kèm ảnh + file khi tạo SP**: bóc ảnh nhúng
  (lấy ảnh LỚN NHẤT — biểu mẫu hay có logo ở header, lấy ảnh đầu là dính logo);
  đính file BOM (doc_type ) + ảnh () qua
  rồi set . Hai việc này làm SAU CÙNG và
  NUỐT LỖI: hỏng khâu đính file mà ném ra thì người dùng tưởng lượt Tạo thất bại
  và bấm lại → SP trùng. Client gửi LẠI file lúc bấm Tạo (không giữ ở server
  giữa hai nhịp, tránh file mồ côi khi người dùng bỏ ngang).
- **Lấy kèm ảnh + file khi tạo SP**: `readWorkbookImages` bóc ảnh nhúng — lấy
  ảnh LỚN NHẤT chứ không phải ảnh đầu tiên (biểu mẫu hay có logo ở header, lấy
  ảnh đầu là mọi SP đều mang ảnh logo). `createFromBom` đính file BOM
  (`doc_type: bom`) + ảnh (`image`) qua `uploadFromServer` rồi set
  `image_file_id`. Hai việc này làm SAU CÙNG và NUỐT LỖI có chủ ý: hỏng khâu
  đính file mà ném ra thì người dùng tưởng lượt Tạo thất bại và bấm lại → SP
  trùng; trả cờ `saved_file`/`saved_image` để toast nói thật. Client gửi LẠI
  file lúc bấm Tạo, không giữ ở server giữa hai nhịp (tránh file mồ côi khi
  người dùng đọc xong rồi bỏ ngang).
- **Mã SP theo đúng quy tắc đánh số**, không gõ tay: file không ghi mã HG thì xin
  `/next-code?type=&material=`; đổi Loại / Vật liệu khung là cấp lại (hai thứ đó
  nằm ngay trong mã); `CODE_TAKEN` thì xin số mới rồi bảo bấm lại — cùng cách
  `ProductForm.tsx` làm. Còn ô "gõ tay" cho SP mã cũ không theo quy tắc.
- Khối thuộc tính đọc thêm `customer_name` (thường CHỈ nằm trong TÊN FILE:
  `BOM_MERXX_…` → MERXX, nên `filename` được truyền vào prompt), `unit`, và
  **thông số in LSX** → `tech_spec` (Sơn/Gỗ/Kính/Nệm — đọc từ tiêu đề khối, BOM
  không ghi thì trống). CỐ Ý KHÔNG đọc: khối ISO (người tạo = `owner_id` theo
  phiên đăng nhập + `created_at`, không chép chữ ký giấy), kích thước mở, và ô
  "Khối lượng" (là tổng tính từ định mức — app tự tính, tránh hai nguồn một số).

## Tải file có dấu tiếng Việt

`GET /api/files/[id]?download=1` mới ép tải về kèm tên gốc; không có tham số thì
trả URL xem trực tiếp (cùng endpoint phục vụ `<img>`/`<iframe>` của
`FilePreviewDialog`). Đường dẫn trên Storage đã bị `sanitizeFilename` lột dấu nên
mở thẳng URL sẽ lưu ra `BOM_Gh_5_b_c….xlsx`.

**BẪY**: đừng dùng option `{ download }` của supabase-js — nó mã hoá tên bằng
`URLSearchParams` rồi bọc cả URL trong `encodeURI()`, ra `%25E1%25BA%25BF` (mã
hoá hai lần). `storage.createSignedDownloadUrl` tự nối `&download=` + một lần
`encodeURIComponent`. Có test canh trong `storage.test.ts`.

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
