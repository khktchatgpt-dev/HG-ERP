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
 */
export function passwordVersion(passwordChangedAt: string | null): string {
  return passwordChangedAt ?? ''
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
    })
    void usersRepo.touchLastLogin(row.id)
    const { password_hash, ...user } = row
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
