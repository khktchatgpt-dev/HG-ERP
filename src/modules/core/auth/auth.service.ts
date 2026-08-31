import { redirect } from 'next/navigation'
import { verifyPassword } from '@/modules/core/auth/password'
import { createSession, destroySession, getSession } from '@/modules/core/auth/session'
import { usersRepo, type User } from '@/modules/core/users/users.repo'
import { Unauthorized } from '@/server/http'

// Pre-computed bcrypt hash used to keep timing roughly constant when the user
// doesn't exist — avoids an email-enumeration side channel on /login.
const DUMMY_HASH = '$2a$12$CwTycUXWue0Thq9StjUM0uJ8L0v.5h6h7n5xq4Hkz8t9V1iX3W3i.'

/**
 * Mốc đời mật khẩu đem nhét vào token. Người chưa từng đổi mật khẩu có
 * `password_changed_at = null` → dùng chuỗi rỗng cho claim luôn là string.
 *
 * CHUẨN HOÁ VỀ ISO-Z, không dùng chuỗi thô. Hai đầu của phép so sánh đến từ hai
 * nguồn viết giờ KHÁC NHAU: lúc đổi mật khẩu, `setPasswordHash` sinh mốc bằng
 * `new Date().toISOString()` → `…478Z`; còn lúc `currentUser()` đọc lại thì
 * Postgres trả `…478+00:00`. Cùng một khoảnh khắc, khác chuỗi → so thô là lệch,
 * và người vừa đổi mật khẩu bị chính hệ thống coi là "token đời cũ" rồi đá về
 * /login (đo thật 31/08/2026, lỗi có từ 0130).
 */
export function passwordVersion(passwordChangedAt: string | null): string {
  if (!passwordChangedAt) return ''
  const ms = Date.parse(passwordChangedAt)
  // Chuỗi lạ (không parse được) thì giữ nguyên: thà so thô còn hơn quy hết về
  // một giá trị, vì như thế là mọi token đều hợp lệ với nhau.
  return Number.isNaN(ms) ? passwordChangedAt : new Date(ms).toISOString()
}

// NOTE: there is no self-registration. Accounts are provisioned by an admin via
// POST /api/users (see modules/users). The first admin is seeded out-of-band
// (scripts/create-user.ts or an UPDATE on the bootstrap row).
export const authService = {
  async login(input: { email: string; password: string }): Promise<User> {
    const row = await usersRepo.findByEmail(input.email)
    const ok = await verifyPassword(input.password, row?.password_hash ?? DUMMY_HASH)
    // Cùng 1 thông báo cho sai email / sai mật khẩu / tài khoản khoá — tránh
    // lộ tài khoản nào tồn tại (email enumeration).
    if (!row || !ok || !row.is_active) {
      throw Unauthorized('Email hoặc mật khẩu không đúng')
    }
    await createSession({
      sub: row.id,
      email: row.email,
      pv: passwordVersion(row.password_changed_at),
      // Mật khẩu do admin đặt hộ → token mang cờ, proxy giữ người này ở
      // /doi-mat-khau cho tới khi họ tự đặt mật khẩu riêng.
      mc: row.must_change_password,
    })
    void usersRepo.touchLastLogin(row.id)
    const { password_hash: _ph, ...user } = row
    void _ph
    return user
  },

  async logout() {
    await destroySession()
  },

  /**
   * User của phiên hiện tại, hoặc null nếu phiên KHÔNG CÒN GIÁ TRỊ.
   *
   * Cookie hợp lệ về chữ ký chưa đủ: proxy chạy ở Edge nên không tra được DB,
   * nghĩa là đây là chỗ DUY NHẤT đối chiếu token với trạng thái thật của tài
   * khoản. Trước 08/2026 hàm này trả thẳng row nên khoá/xoá một người xong họ
   * vẫn dùng được cả hệ thống tới hết hạn cookie (7 ngày) — `is_active` chỉ
   * được kiểm lúc login.
   */
  async currentUser(): Promise<User | null> {
    const session = await getSession()
    if (!session) return null
    const user = await usersRepo.findById(session.sub)
    if (!user) return null
    // Khoá / xoá mềm giữa phiên → cắt ngay ở request kế tiếp.
    if (!user.is_active || user.deleted_at) return null
    // Mật khẩu đã đổi kể từ lúc cấp token → token này thuộc "đời" cũ.
    if (passwordVersion(user.password_changed_at) !== session.pv) return null
    return user
  },

  /** Throws 401 if not signed in. Use at the top of protected routes. */
  async requireUser(): Promise<User> {
    const user = await this.currentUser()
    if (!user) throw Unauthorized()
    return user
  },

  /**
   * Cho PAGE (server component): user null → về /login thay vì 500.
   *
   * Proxy chỉ VERIFY CHỮ KÝ cookie, không tra DB — user bị xoá/khoá giữa phiên
   * thì cookie vẫn hợp lệ, qua được cổng, và `(await currentUser())!` trong 73
   * trang nổ "Cannot read properties of null" (gặp thật 09/08/2026 sau khi xoá
   * tài khoản test còn phiên sống). Page dùng hàm này; API vẫn `requireUser`
   * (401 JSON, không redirect).
   */
  async requirePageUser(): Promise<User> {
    const user = await this.currentUser()
    if (!user) redirect('/login')
    return user
  },
}
