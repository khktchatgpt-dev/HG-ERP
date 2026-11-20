import { redirect } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { canEnterWorkspace } from '@/workspaces/access'
import { lsxHoSoService } from '@/modules/dept/technical/lsx-ho-so.service'
import { LenhScreen } from './LenhScreen'

/**
 * LỆNH SX · HỒ SƠ SP — Kỹ thuật theo dõi SP trên lệnh đã có định mức / hồ sơ
 * chưa (09/10/2026). Khuôn C: mỗi lệnh một khối, sắp theo ngày xuất gần nhất.
 */
export default async function LenhHoSoPage({
  searchParams,
}: {
  searchParams: Promise<{ tat_ca?: string }>
}) {
  const user = await authService.requirePageUser()
  // Màn riêng của Kỹ thuật — thư viện mở cho mọi phòng từ 20/11/2026, màn này thì không.
  if (!(await canEnterWorkspace(user, 'technical'))) redirect('/thu-vien')
  const sp = await searchParams
  const all = sp.tat_ca === '1'
  const lenh = await lsxHoSoService.list(user, { all })
  return <LenhScreen lenh={lenh} all={all} />
}
