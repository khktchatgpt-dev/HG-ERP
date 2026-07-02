---
name: check-rls
description: Rà soát tư thế bảo mật RLS trên toàn bộ bảng/view Supabase và chạy security advisor. Dùng khi user nói "kiểm tra RLS", "audit bảo mật DB", "check security", hoặc sau khi thêm bảng mới.
---

# check-rls

Kiểm tra posture bảo mật của database theo mô hình dự án: **RLS bật, KHÔNG policy** (anon bị chặn, server dùng secret key bypass).

## Các bước

1. **Liệt kê bảng + trạng thái RLS**: `mcp__supabase__list_tables` (schema public). Với mỗi bảng, xem `rls_enabled`.
2. **Chạy advisor bảo mật**: `mcp__supabase__get_advisors` với `type: "security"`. Ưu tiên đọc mọi cảnh báo mức `critical`/`high` (rls_disabled, security_definer_view, exposed keys...).
3. **Đối chiếu view**: view phải có `security_invoker = on` (tôn trọng RLS người gọi). Advisor sẽ flag view `security definer` sai.
4. **Báo cáo dạng bảng**: mỗi bảng/view → OK / CẢNH BÁO / LỖI + lý do. Nhấn mạnh bảng nào đang TẮT RLS (nguy hiểm: anon key đọc/ghi được).
5. **Đề xuất SQL sửa** — KHÔNG tự apply. Với bảng tắt RLS:
   ```sql
   alter table public.<table> enable row level security;
   ```
   Cảnh báo: bật RLS mà chưa có policy sẽ chặn hết — đúng ý đồ dự án (server bypass bằng secret key), nhưng phải chắc bảng đó chỉ truy cập server-side.
6. Nếu có bảng cần cho anon đọc (hiếm trong dự án này) → nêu rõ và để user tự quyết policy.

## Ngữ cảnh dự án (đọc CLAUDE.md để chắc)

- Mọi truy cập đi qua API route + `src/server/permissions.ts`, KHÔNG dựa vào RLS policy.
- Secret key (`sb_secret_*`) bypass RLS; publishable/anon key bị chặn hoàn toàn.
- Bảng `settings` từng bị TẮT RLS — kiểm lại còn không.

## Không làm

- Không tự chạy `alter table ... enable rls` khi chưa hỏi (có thể khoá truy cập đột ngột).
- Không thêm policy trừ khi user yêu cầu rõ.
