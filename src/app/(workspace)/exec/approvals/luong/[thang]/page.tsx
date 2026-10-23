import { notFound } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { canAction } from '@/modules/core/rbac/rbac.service'
import { duyetLuongService } from '@/modules/dept/hr/luong/duyet-luong.service'
import { Empty } from '@/components/kit'
import { ExecKitFrame } from '../../../_shell/KitFrame'
import { LuongDuyetScreen } from './LuongDuyetScreen'

export const metadata = { title: 'Duyệt bảng lương' }

/**
 * Duyệt BẢNG LƯƠNG một kỳ (bản vẽ duyệt 21/10/2026, https://claude.ai/artifact/8BH9Nam6…).
 * Kế toán trưởng thấy TỔNG theo khối → tổ, không thấy lương từng người. Quyền `hr.payroll.approve`.
 */
export default async function DuyetLuongPage({
  params,
}: {
  params: Promise<{ thang: string }>
}) {
  const user = await authService.requirePageUser()
  const { thang } = await params
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(thang)) notFound()
  if (!(await canAction(user, 'hr.payroll.approve')))
    return (
      <ExecKitFrame>
        <Empty
          headline="Chỉ người duyệt lương xem được màn này"
          reason="Việc này do Kế toán trưởng duyệt."
          next="Hỏi bảng lương của mình thì hỏi người quản lý lương ở Phòng Kế toán."
        />
      </ExecKitFrame>
    )
  const t = await duyetLuongService.trang(user, thang)
  return (
    <ExecKitFrame screen>
      <LuongDuyetScreen key={`${t.thang}|${t.bang?.trangThai ?? '-'}`} t={t} />
    </ExecKitFrame>
  )
}
