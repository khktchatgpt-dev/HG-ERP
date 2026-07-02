# Đánh giá cấu trúc code cho ERP

**Ngày:** 2026-07-01
**Scope:** src/ hiện tại (~12K LOC, 15 module)
**Kết luận ngắn:** Kiến trúc **đủ cho task-manager**, nhưng có **10 gap lớn** trước khi scale thành ERP thật.

---

## Điểm mạnh (giữ nguyên)

| # | Điểm | Ghi chú |
|---|---|---|
| 1 | Domain-driven layout | `modules/{core,dept,workflow}/*`, mỗi domain schema+service+repo |
| 2 | 3-layer thin route → service → repo | Chuẩn để team đông người vào cùng làm |
| 3 | Server-only isolation | `src/server/*` không lộ client, RLS bật + secret key bypass |
| 4 | Permission matrix `assertCan` | Mở rộng được cho ERP |
| 5 | Audit log cho users | Pattern có thể copy sang các entity khác |
| 6 | Workspace redesign đang chạy | Config-driven, mở rộng 10 phòng ban |
| 7 | Migration convention | Numbered, RLS-first, idempotent — chuẩn công nghiệp |

## Gap — theo tier ưu tiên

### 🔴 Tier 1: chặn scale, phải xử lý sớm

#### G1. Multi-tenant / Company scope
**Vấn đề:** Không có `company_id` trên tables nghiệp vụ. Nếu Hoàng Gia mở chi nhánh, mở xưởng con → không tách được data.

**Fix:**
- Thêm bảng `public.companies (id, code, name, ...)`
- Migration: thêm `company_id uuid references companies(id)` vào mọi table nghiệp vụ (tasks, invoices, customers, ...)
- Session cookie chứa `company_id` hiện hoạt
- `db()` wrap để auto-filter theo `company_id` của session
- Permission check: `assertCan(user, action, { ...ctx, company_id })`

**Effort:** 2-3 lượt lớn (migration + wrap DB + refactor services + UI switch company)

#### G2. Domain Events / Message Bus
**Vấn đề:** `tasks.service` gọi trực tiếp `notifications.service`. Với 30 module × N cross-call → spaghetti không maintainable.

**Fix:**
```
src/events/
  bus.ts                       # simple typed pub/sub (in-process trước)
  types.ts                     # domain event definitions
  handlers/
    task.created.ts            # gen notification
    task.done.ts               # gen notif + trigger KPI update
    invoice.paid.ts            # gen notif + audit + close AR
```

**Effort:** 1 lượt setup + refactor tasks/notifications làm mẫu.

#### G3. Test framework
**Vấn đề:** Không có test. ERP tính lương/tồn kho/công nợ sai → mất tiền thật.

**Fix:**
- `vitest` + `@vitest/coverage`
- Structure: `src/**/*.test.ts` co-located với file test
- Test factory: `src/testing/{fixtures.ts,db.ts}` — DB test isolation
- CI hook (Vercel/GitHub Actions) run test trước deploy

**Effort:** 1 lượt setup + viết ~10 test mẫu cho users + tasks service.

---

### 🟡 Tier 2: khó chịu dần, plan sớm

#### G4. Shared Kernel (Value Objects)
**Vấn đề:** `Money`, `Period`, `Code` phân tán khắp nơi. Tính toán tiền có sai lệch làm tròn giữa module.

**Fix:**
```
src/kernel/
  money.ts        # class Money { amount, currency; add, sub, mul, format }
  period.ts       # Period.month('2026-01'), Period.range(from,to)
  code.ts         # generateCode(prefix, seq) — cho InvoiceNo, TaskCode
  identifiers.ts  # ID<T> brand type
```

**Effort:** 1 lượt viết kernel + adopt dần khi sửa từng module.

#### G5. Batch Jobs / Scheduled tasks
**Vấn đề:** ERP cần: nhắc HĐ quá hạn hàng ngày, chốt lương cuối tháng, EOD reports.

**Fix:**
```
src/jobs/
  registry.ts             # danh sách job
  hourly/                 # notify.overdue.ts, sync.attendance.ts
  daily/                  # eod.report.ts, close.day.ts
  monthly/                # payroll.ts, close.month.ts
```

Wire: Supabase `pg_cron` hoặc Vercel Cron gọi `/api/jobs/{name}` với secret token.

**Effort:** 1 lượt setup + 2-3 job mẫu.

#### G6. Reports/Analytics layer
**Vấn đề:** `/reports/weekly` nằm bậy trong `tasks/`. ERP cần nhiều loại report với precompute + cache + export.

**Fix:**
```
src/modules/reports/
  reports.schema.ts       # query params, output format
  engine.ts               # query runner + cache layer
  generators/
    task.weekly.ts        # move từ tasks
    finance.pl.ts         # P&L
    inventory.balance.ts  # cân đối kho
  export/
    excel.ts              # xlsx generator
    pdf.ts                # nếu cần
```

**Effort:** 1 lượt refactor + tách weekly ra khỏi tasks.

---

### 🟢 Tier 3: nice-to-have

#### G7. Integrations layer
```
src/modules/integrations/
  email/         # SMTP hoặc Resend/SendGrid
  zalo/          # ZaloOA bot
  einvoice/      # Hoá đơn điện tử VN (MISA/Viettel/FPT)
  misa/          # MISA sync (nếu cần)
```

#### G8. Config layer typed
- Thay `settings` KV bằng typed config theo domain:
  ```
  src/modules/core/config/
    schemas/
      hr.config.ts       # quy tắc chấm công, phép năm
      finance.config.ts  # mẫu số HĐ, VAT
      workflow.config.ts # duyệt N-cấp
  ```

#### G9. Frontend regrouping
```
src/components/
  ui/              # primitives — giữ nguyên
  layout/          # AppShell, Sidebar, Topbar (chuyển từ root)
  features/       # NotificationsDropdown, FileUploader, UserMenu
```

#### G10. `src/lib/` tách rõ
```
src/lib/
  client/api.ts        # client-only fetch
  shared/deadline.ts   # dùng cả 2 phía
  generated/database.types.ts  # auto-gen
```

---

## Roadmap đề xuất

| Phase | Focus | Effort | Blocker cho? |
|---|---|---|---|
| **A** | G3 Test framework | 1 lượt | Không (nhưng ngăn regression) |
| **B** | G2 Domain Events | 1 lượt | G5 (job cần bus) |
| **C** | G4 Shared Kernel | 1 lượt | G6, G8 |
| **D** | G6 Report engine + G5 Jobs | 2 lượt | — |
| **E** | G1 Multi-tenant (nếu cần) | 3 lượt | Tất cả module mới sau đó |
| **F** | G7-G10 dọn dẹp | 1-2 lượt | — |

**Đề xuất bắt đầu:** làm **A + B** trước khi build thêm workspace mới. Vì mỗi workspace mới đều sẽ tạo notif → nếu chưa có event bus, mỗi lần bạn thêm feature là 1 lần đụng vào `notifications.service`.

**Nếu chưa cần multi-tenant** (Hoàng Gia chỉ có 1 công ty) → skip G1, tiết kiệm 3 lượt lớn.
