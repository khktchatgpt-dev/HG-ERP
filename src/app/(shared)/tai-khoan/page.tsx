import { authService } from '@/modules/core/auth/auth.service'
import { accountService } from '@/modules/core/account/account.service'
import { PageHeader } from '@/components/erp/PageHeader'
import { AccountManager } from './AccountManager'

export const metadata = { title: 'Tài khoản của tôi' }

const ROLE_LABEL: Record<string, string> = {
  admin: 'Quản trị',
  manager: 'Quản lý',
  employee: 'Nhân viên',
}

/** Định dạng ở SERVER rồi truyền chuỗi xuống client — tránh lệch múi giờ. */
function fmt(iso: string | null): string | null {
  if (!iso) return null
  return new Date(iso).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Hồ sơ cá nhân — đặt ở khu DÙNG CHUNG nên ai cũng vào được và vẫn giữ sidebar
 * phòng mình (xem `(shared)/layout.tsx`). Không thêm vào nav: vào từ menu người
 * dùng ở góc phải, chỗ người ta tìm theo thói quen.
 */
export default async function AccountPage() {
  const user = await authService.requirePageUser()
  const profile = await accountService.getProfile(user)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Tài khoản của tôi"
        description="Thông tin cá nhân và mật khẩu đăng nhập"
      />
      <AccountManager
        profile={profile}
        readonly={{
          role_label: ROLE_LABEL[user.role] ?? user.role,
          department_name: profile.department_name,
          title: user.title,
          employee_code: user.employee_code,
          last_login_text: fmt(user.last_login_at),
          password_changed_text: fmt(user.password_changed_at),
        }}
      />
    </div>
  )
}
