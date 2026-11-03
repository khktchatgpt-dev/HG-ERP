import { redirect } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { transferDocsService } from '@/modules/dept/production/transfer-docs.service'
import { isProductionStaff } from '@/modules/dept/production/perms'
import { GiaoNhanScreen } from './GiaoNhanScreen'

export const metadata = { title: 'Sản xuất · Giao nhận' }
export const dynamic = 'force-dynamic'

/**
 * GIAO NHẬN BÁN THÀNH PHẨM (0289, B4 — docs/san-xuat-cau-hinh-thiet-ke.md, bản
 * vẽ S5). Thống kê tổ: tổ tôi giao gì, nhận gì, còn chờ nhận gì. Cùng quyền
 * vào với Ghi sản lượng (thành viên xưởng / admin).
 */
export default async function GiaoNhanPage({
  searchParams,
}: {
  searchParams: Promise<{ lsx?: string }>
}) {
  const user = await authService.requirePageUser()
  const sp = await searchParams
  const canRecord = user.role === 'admin' || (await isProductionStaff(user))
  if (!canRecord) redirect('/thongke/lenh')
  const data = await transferDocsService.inbox(user, { lsxId: sp.lsx })
  return <GiaoNhanScreen data={data} />
}
