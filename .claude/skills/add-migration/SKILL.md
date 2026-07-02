---
name: add-migration
description: Tạo file SQL migration mới trong supabase/migrations đúng convention (đánh số, RLS-first, idempotent, security_invoker cho view). Dùng khi user nói "thêm bảng", "tạo migration", "đổi schema DB", "add column".
---

# add-migration

Tạo migration theo đúng "Migration conventions" trong CLAUDE.md.

## Các bước

1. **Xác định số thứ tự tiếp theo**: liệt kê `supabase/migrations/`, lấy số lớn nhất + 1, 4 chữ số zero-pad. Không tái dùng số cũ, không sửa migration đã apply.
2. **Đặt tên**: `NNNN_short_snake_case.sql` — mô tả ngắn nội dung.
3. **Header comment bắt buộc** (xem `0001_users.sql` làm mẫu): migration làm gì, RLS posture, caveat, dòng "Apply: npx supabase db push" + "sau đó sync types".
4. **Viết SQL idempotent**:
   - `create table if not exists`, `create index if not exists`
   - `drop trigger if exists ...; create trigger ...`
   - Bảng nghiệp vụ theo phòng ban → prefix (`sales_`, `hr_`, `accounting_`, `technical_`). Bảng core không prefix.
   - `id uuid primary key default gen_random_uuid()`
   - `created_at/updated_at timestamptz not null default now()`; wire `updated_at` qua trigger `public.set_updated_at()` (có sẵn từ 0002).
   - FK luôn khai `on delete` tường minh.
5. **RLS**: kết thúc mỗi bảng mới bằng `alter table ... enable row level security;` (KHÔNG thêm policy — server bypass bằng secret key, anon bị chặn). View thêm `with (security_invoker = on)`.
6. **Ghi file** vào `supabase/migrations/NNNN_*.sql`.
7. **Apply**: dùng `mcp__supabase__apply_migration` (name snake_case, query = nội dung SQL không gồm comment header là được, nhưng nên giữ nguyên). Nếu MCP không có, hướng dẫn user `npx supabase db push` hoặc paste vào SQL editor.
8. **Sau khi apply**: chạy skill `sync-types` để cập nhật `src/lib/database.types.ts`.
9. **Kiểm bảo mật**: nếu vô tình để bảng TẮT RLS, cảnh báo user (Supabase advisor sẽ flag).

## Lưu ý

- File migration là source-of-truth versioned; `apply_migration` đẩy lên remote. Giữ cả hai đồng bộ.
- Không hardcode UUID sinh ra trong data migration.
