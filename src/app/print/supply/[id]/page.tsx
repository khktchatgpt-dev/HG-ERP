import { redirect } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { settingsService } from '@/modules/core/settings/settings.service'
import { posRepo } from '@/modules/dept/supply/pos.repo'
import { suppliersRepo } from '@/modules/dept/supply/supply.repo'
import { PoPrintSheet } from '../PoPrintSheet'

/**
 * In ĐƠN ĐẶT HÀNG đã lưu — trang này chỉ NẠP DỮ LIỆU.
 *
 * Toàn bộ cách dựng tờ phiếu nằm ở `PoPrintSheet`, dùng chung với nút "Xem trước
 * phiếu in" trên form soạn đơn. Hai bản dựng riêng thì bản xem trước sẽ trôi
 * khỏi bản in thật, và người dùng tin vào thứ không phải cái sẽ gửi NCC.
 */
export default async function PoPrintPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await authService.currentUser()
  if (!user) redirect('/login')
  const { id } = await params

  const po = await posRepo.findById(id)
  if (!po) redirect('/planning/pos')
  const [lines, supplier, company] = await Promise.all([
    posRepo.listLines(id),
    suppliersRepo.findById(po.supplier_id),
    settingsService.getAll(),
  ])

  return (
    <PoPrintSheet
      company={company}
      po={{ ...po, template: po.template ?? 'simple' }}
      supplier={supplier}
      lines={lines}
    />
  )
}
