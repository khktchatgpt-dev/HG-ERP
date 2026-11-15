import { authService } from '@/modules/core/auth/auth.service'
import { soCongDoanService } from '@/modules/dept/production/so-cong-doan.service'
import { SoCongDoanScreen } from './SoCongDoanScreen'

export const dynamic = 'force-dynamic'

/**
 * SỔ CÔNG ĐOẠN — tờ công đoạn của sổ thống kê (bản vẽ 14/11/2026
 * https://claude.ai/artifact/CpB5jKcS9Swtx6cHqKUyXx). Tham số: `thang` (yyyy-mm,
 * mặc định tháng này) · `cd` (mã công đoạn; mặc định công đoạn của tổ tài khoản) ·
 * `ca=1` (cả chi tiết của lệnh đang chạy).
 */
export default async function SoCongDoanPage({
  searchParams,
}: {
  searchParams: Promise<{ thang?: string; cd?: string; ca?: string }>
}) {
  const [sp, user] = await Promise.all([searchParams, authService.requirePageUser()])
  const p = await soCongDoanService.load(user, sp)
  return <SoCongDoanScreen key={`${p.thang}|${p.cd}|${p.ca}`} p={p} />
}
