# Kế hoạch thiết kế: Quản lý mẫu showroom

Trạng thái: đề xuất, chưa triển khai. Ngày: 2026-07-16.

## 1. Hiện trạng — gần như từ số 0

Toàn bộ "quản lý mẫu" hiện nay là **một ô checkbox boolean** trên sản phẩm:

- `technical_products.showroom_sample boolean not null default false`
  (`supabase/migrations/0026_technical_product_specs.sql:20`)
- Nhập tay ở `ProductForm.tsx:472`, hiện badge ở `ProductDetailView.tsx:211`,
  in cột ✓ trên LSX (`src/app/print/lsx/[id]/page.tsx:161`).

Nó chỉ trả lời được đúng một câu: *"SP này có mẫu ở showroom hay không"*. Không
biết **có mấy cái**, **cái nào**, **đang ở đâu**, **ai cầm**, **tình trạng ra
sao**, **bao giờ trả**. Không có bảng mẫu, không có người mượn, không có lịch sử.

=> Làm mới hoàn toàn. Không có gì để mở rộng.

## 2. Quyết định đã chốt (2026-07-16)

| Câu hỏi | Chốt | Hệ quả thiết kế |
|---|---|---|
| 1 SP có nhiều mẫu vật lý? | **Có, mỗi mẫu một mã** | Cần thực thể *mẫu* riêng, không gắn 1-1 với SP |
| Khách mượn có cần duyệt? | **Không — ghi sổ là đủ** | Không có trạng thái `chờ duyệt`, không có màn duyệt |
| Phòng nào quản lý? | **Kỹ thuật** (chốt 2026-07-16) | Bảng `technical_*`, module + nav nằm gọn trong Kỹ thuật |

## 3. Chủ quản: Kỹ thuật

Showroom thuộc **Kỹ thuật**, không phải miền dùng chung. Điều đó làm mọi thứ
gọn hẳn — bám thẳng convention sẵn có, không phát sinh pattern mới:

- **Bảng**: tiền tố `technical_*` như `technical_products`.
- **Module**: nhét vào `src/modules/dept/technical/` sẵn có, thêm file
  `samples.*` / `loans.*`. Đúng như Sales đang để `quotes.*` + `orders.*` +
  `sales.*` chung một thư mục phòng — không cần thư mục module mới.
- **Route**: chỉ `(workspace)/technical/showroom/page.tsx`. Một trang, một shell.
- **Nav**: thêm 1 item vào `sections[0].items` của `technical`
  (`workspaces.config.ts:176-194`). Không đụng `sales`.

**Kinh doanh vẫn xem được** — quyền xem mở cho mọi NV đã đăng nhập, đúng như thư
viện SP hiện nay ("Thư viện SP là tài sản chung", `files.service.ts:159`). Sales
tra được mẫu nào đang rảnh để dẫn khách, nhưng **người ghi sổ là Kỹ thuật** —
sample do Kỹ thuật giao thì Kỹ thuật ghi phiếu. Người mượn (`borrower_*`) vẫn có
thể là nhân viên Sales; người giao (`issued_by`) là Kỹ thuật.

## 4. Mô hình dữ liệu

### 4.1 `technical_samples` — hiện vật

1 dòng = **1 cái mẫu vật lý**. 3 cái ghế Paxos = 3 dòng, mã riêng từng cái.

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `id` | uuid pk | |
| `code` | text unique | `MS-2026-0001`, sinh bằng `next_doc_code('MS')` |
| `product_id` | uuid not null → `technical_products` **on delete restrict** | mẫu phải thuộc 1 SP; cấm xoá SP khi còn mẫu |
| `status` | text check | `in_showroom` \| `on_loan` \| `maintenance` \| `lost` \| `disposed` |
| `condition` | text check | `new` \| `good` \| `scratched` \| `damaged` — tình trạng vật lý |
| `location` | text | vị trí trong showroom (kệ A3, góc trưng bày…) |
| `acquired_at` | date | ngày nhập mẫu |
| `note` | text | |
| `created_by` | uuid → `users` on delete set null | |
| `created_at` / `updated_at` | timestamptz | trigger `set_updated_at` |

`status` và `condition` **tách riêng có chủ đích**: một mẫu đang cho mượn
(`on_loan`) vẫn có thể bị xước (`scratched`). Gộp làm một sẽ mất thông tin ngay
khi mẫu vừa hỏng vừa đi mượn.

`next_doc_code` không có check constraint trên `kind` (`0011_catalogs.sql:111`),
nên thêm kind `MS`/`PM` **không cần DDL**.

### 4.2 `technical_sample_loans` — sổ theo dõi

1 dòng = **1 lượt mượn**. Đây chính là "sổ theo dõi" — không cần bảng sổ riêng.

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `id` | uuid pk | |
| `code` | text unique | `PM-2026-0001` (phiếu mượn) |
| `sample_id` | uuid not null → `technical_samples` **on delete restrict** | |
| `borrower_kind` | text check | `user` \| `customer` \| `other` |
| `borrower_user_id` | uuid → `users` on delete set null | NV nội bộ |
| `borrower_customer_id` | uuid → `sales_customers` on delete set null | khách hàng |
| `borrower_name` | text | đối tác ngoài chưa có hồ sơ KH + **snapshot tên** |
| `borrower_contact` | text | sđt/email người cầm mẫu |
| `purpose` | text | chào khách, chụp ảnh, hội chợ… |
| `borrowed_at` | timestamptz not null default now() | |
| `due_at` | date | hẹn trả |
| `returned_at` | timestamptz | **null = đang mượn** |
| `returned_condition` | text check | tình trạng lúc nhận lại |
| `issued_by` / `received_by` | uuid → `users` on delete set null | người giao / người nhận lại |
| `note` | text | |

**Người mượn đa hình** — đây là *pattern mới* trong codebase này, chưa có tiền
lệ. Ràng buộc bằng check:

```sql
constraint loan_borrower_shape check (
  (borrower_kind = 'user'     and borrower_user_id is not null) or
  (borrower_kind = 'customer' and borrower_customer_id is not null) or
  (borrower_kind = 'other'    and borrower_name is not null)
)
```

Giữ luôn `borrower_name` cho cả 3 loại như **bản chụp tên tại thời điểm mượn**:
FK là `on delete set null`, nên khi khách bị xoá, sổ vẫn đọc được "ai đã mượn".
Sổ theo dõi mà mất tên người mượn thì hết là sổ.

**Chốt chặn ở DB, không chỉ ở service** — một mẫu không thể cho 2 người mượn
cùng lúc:

```sql
create unique index if not exists technical_sample_loan_active_uniq
  on public.technical_sample_loans (sample_id) where returned_at is null;
```

Partial unique index này quan trọng: nó khiến việc cho mượn trùng là **bất khả
thi ở tầng DB**, kể cả khi service có bug hoặc 2 request vào cùng lúc.

### 4.3 `technical_sample_events` — lịch sử ngoài mượn/trả

Tiền lệ của dự án là **mỗi miền một bảng log riêng**, không dùng bảng chung —
`activity_log` bị khoá cứng vào task (`task_id not null`,
`0002_core_schema.sql:172`), còn `user_audit_log` (`0007_users_admin.sql:23`) là
mẫu tốt hơn để copy.

Bảng này ghi những thay đổi **không phải mượn/trả**: đổi tình trạng, đi sửa,
báo mất, thanh lý.

| Cột | Ghi chú |
|---|---|
| `sample_id` → `technical_samples` on delete cascade | |
| `actor_id` → `users` on delete set null | |
| `action` text check | `created` \| `status_changed` \| `condition_changed` \| `location_changed` \| `disposed` |
| `before` / `after` jsonb | `{"condition":"good"}` → `{"condition":"scratched"}` |
| `note` text | |
| `created_at` | |

Ghi log **không được làm hỏng mutation** — theo đúng `activity.repo.ts:33`, lỗi
ghi log thì `console.error` chứ không throw.

### RLS

Cả 3 bảng: `enable row level security` **không policy** — app dùng secret key
nên bypass, anon key bị chặn hoàn toàn. Đúng chuẩn dự án.

## 5. Trạng thái & chuyển trạng thái

```
                 ┌──────────────┐
    tạo mẫu ───► │ in_showroom  │ ◄──── ghi trả ────┐
                 └──────┬───────┘                    │
                        │ ghi mượn                   │
                        ▼                            │
                 ┌──────────────┐                    │
                 │   on_loan    │ ───────────────────┘
                 └──────┬───────┘
                        │ trả về hỏng / mang đi sửa
                        ▼
                 ┌──────────────┐      ┌──────────┐
                 │ maintenance  │ ───► │ disposed │
                 └──────────────┘      └──────────┘
                        ▲
   in_showroom / on_loan ─── báo mất ──► lost
```

Theo đúng pattern PO (`pos.service.ts:162`), allow-map để trong service:

```ts
const ALLOWED: Record<SampleStatus, SampleStatus[]> = {
  on_loan:     ['in_showroom'],
  in_showroom: ['on_loan', 'maintenance', 'lost'],
  maintenance: ['in_showroom', 'disposed', 'lost'],
  lost:        ['in_showroom'],   // tìm lại được
  disposed:    [],                 // điểm cuối
}
```

`disposed` là ngõ cụt có chủ đích: mẫu đã thanh lý mà quay lại lưu thông thì
sổ sách không giải thích được.

## 6. Điểm rủi ro: `status` bị lệch với sổ

`samples.status = 'on_loan'` là **dữ liệu suy ra** từ "có loan chưa trả". Giữ
denormalized để list nhanh (không phải join mỗi dòng), nhưng đây là chỗ dễ trôi
nhất của cả thiết kế:

- Service **luôn** đổi `status` trong cùng thao tác với ghi/đóng phiếu mượn.
- Partial unique index (4.2) chặn được cho mượn trùng, nhưng **không** chặn được
  `status` lệch.
- Đề xuất: một test tính bất biến — `status='on_loan'` ⟺ tồn tại loan
  `returned_at is null`. Theo CLAUDE.md, logic rủi ro cao là bắt buộc có test.

Cách chắc hơn (cân nhắc P3): bỏ hẳn cột `status`, tính từ view
`v_technical_samples` với `security_invoker = on`. Đổi lại là mọi truy vấn phải
join. Khuyến nghị: giữ cột + test bất biến trước, đo rồi hẵng đổi.

## 7. Xử lý cột `showroom_sample` cũ

**Không xoá được ngay** — đang bị đọc ở `print/lsx/[id]/page.tsx:161` và join ở
`production.repo.ts:274,287,316`. Lộ trình:

1. **P1**: giữ cột. Bỏ checkbox nhập tay ở `ProductForm.tsx:472`. Service mẫu
   tự set `showroom_sample = (SP còn ít nhất 1 mẫu chưa thanh lý)`.
2. **P2**: chuyển 2 chỗ đọc kia sang bảng mới.
3. **P3**: migration `drop column`.

Bỏ qua bước 1 sẽ ra tình trạng tệ nhất: hai nguồn sự thật, người dùng tick tay
một đằng, bảng mẫu một nẻo.

## 8. Module & API

Không tạo thư mục module mới — thêm thẳng vào `src/modules/dept/technical/`
sẵn có, đúng như Sales để `quotes.*` + `orders.*` chung một thư mục phòng:

```
src/modules/dept/technical/
  technical.schema.ts   (đã có)
  technical.service.ts  (đã có — chứa sẵn isTechnicalStaff, xem mục Quyền)
  samples.schema.ts     SAMPLE_STATUSES / SAMPLE_CONDITIONS / BORROWER_KINDS + zod
  samples.repo.ts       samplesRepo  (COLS phẳng, unwrap() cho join PostgREST)
  samples.service.ts    tạo/sửa mẫu, đổi tình trạng, thanh lý
  loans.repo.ts         loansRepo
  loans.service.ts      ghi mượn / ghi trả  (+ đồng bộ samples.status)
```

Route mỏng, **một sub-route cho mỗi transition** (đúng pattern PO):

```
GET|POST  /api/dept/technical/samples
GET|PATCH /api/dept/technical/samples/[id]
POST      /api/dept/technical/samples/[id]/condition   đổi tình trạng
POST      /api/dept/technical/samples/[id]/dispose      thanh lý
POST      /api/dept/technical/samples/[id]/loan         ghi phiếu mượn
GET       /api/dept/technical/loans                     sổ theo dõi (lọc)
POST      /api/dept/technical/loans/[id]/return         ghi trả
```

### Quyền

`src/server/permissions.ts` chỉ phục vụ task; **các module phòng ban đều tự
viết guard trong service** rồi throw `Forbidden` (xem `pos.service.ts:10`).
Theo đúng vậy:

| Việc | Ai |
|---|---|
| Xem mẫu + sổ | mọi NV đã đăng nhập (như thư viện SP) |
| Tạo/sửa/thanh lý mẫu | Kỹ thuật + admin/manager |
| Ghi mượn / ghi trả | Kỹ thuật + admin/manager |

**Không cần viết helper mới**: `isTechnicalStaff(user)` đã có sẵn ở
`technical.service.ts:17` (so `dept.name === 'Kỹ Thuật'`, admin luôn qua) —
hiện đang private, chỉ cần export ra. Cũng đừng nhầm sang `isTechnicalOrSales`
(`:25`) — cái đó dành riêng cho BOM (FR-ENG-04), không áp cho mẫu.

## 9. Sự kiện (event bus)

Khai ở `src/events/types.ts`, handler ở `src/events/handlers/sample.notifications.ts`,
đăng ký ở `register.ts`:

```ts
| { name: 'sample.loaned'; sample_id: string; sample_code: string
    product_name: string; borrower_label: string; due_at: string | null
    issued_by: string; notify_ids: string[] }
| { name: 'sample.returned'; sample_id: string; sample_code: string
    condition: string; overdue_days: number; notify_ids: string[] }
| { name: 'sample.lost'; sample_id: string; sample_code: string; notify_ids: string[] }
```

Người nhận do bên phát tính sẵn và truyền trong payload — đúng convention hiện có.

**Nhắc quá hạn**: chưa có cron trong dự án. P2 chỉ **tính lúc đọc** (`due_at <
hôm nay` và `returned_at is null` → badge đỏ "Quá hạn N ngày"). Gửi thông báo
chủ động để P3, khi nào có scheduler.

## 10. Giao diện

Dùng ERP kit (`PageHeader`, `StatsBar`, `Toolbar`, `DataTable`, `RowMenu`) —
mẫu tham chiếu `ProductsManager.tsx`. Skill `add-erp-page` scaffold được.

**Danh sách mẫu** — `/technical/showroom`

- StatsBar: `Tổng mẫu` · `Ở showroom` · `Đang cho mượn` · `Quá hạn` · `Hỏng/Mất`
- Toolbar: tìm (mã mẫu, tên SP, tên người mượn) · lọc trạng thái · lọc SP · lọc người mượn
- Cột: `Mã mẫu` · `Ảnh` · `Sản phẩm` · `Trạng thái` · `Tình trạng` · `Vị trí / Đang ở chỗ ai` · `Hạn trả`
- RowMenu: `Ghi mượn` · `Ghi trả` · `Đổi tình trạng` · `Xem sổ` · `Thanh lý`

Cột "Đang ở chỗ ai" là cột đáng giá nhất — nó trả lời câu hỏi người dùng thực sự
hỏi khi mở màn hình này.

**Chi tiết mẫu** — `/technical/showroom/[id]`: thông tin mẫu + **sổ theo dõi**
(bảng các lượt mượn, mới nhất trước) + lịch sử tình trạng.

**Modal ghi phiếu mượn**: chọn loại người mượn (3 tab: NV / Khách hàng / Khác) →
autocomplete tương ứng → hạn trả → mục đích. Mặc định hạn trả +14 ngày.

## 11. Lộ trình

| Phase | Nội dung | Ước lượng |
|---|---|---|
| **P1** | Migration `0061` (3 bảng) + sync types + module + API mẫu + trang danh sách/chi tiết + bỏ checkbox cũ | 2–3 ngày |
| **P2** | Phiếu mượn/trả + sổ theo dõi + badge quá hạn + event `sample.loaned/returned` | 2 ngày |
| **P3** | Nhắc hạn trả chủ động (cần scheduler) + báo cáo (mẫu mượn nhiều nhất, khách hay giữ quá hạn) + dọn cột `showroom_sample` | 1–2 ngày |
| **P4** | Ảnh riêng cho từng mẫu (tách với ảnh SP — mẫu bị xước thì ảnh SP vẫn đẹp) + QR dán lên mẫu để quét ra trang chi tiết | tuỳ nhu cầu |

Nên làm P1 → P2 liền mạch: P1 một mình chỉ là danh mục tĩnh, chưa giải quyết
được nhu cầu "quản lý người mượn" bạn nêu.

## 12. Bắt buộc trước khi coi là xong

- `npm run check` sạch (typecheck + lint + test).
- Test cho: allow-map chuyển trạng thái, check ràng buộc người mượn đa hình,
  bất biến `status='on_loan'` ⟺ có loan chưa trả.
- Migration có header đúng chuẩn (RLS / Idempotent / Apply), rồi **sync types**.
- Chạy skill `check-rls` sau khi thêm bảng.
