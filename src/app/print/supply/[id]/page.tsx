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
  const [lines, supplier, company, extraLsx] = await Promise.all([
    posRepo.listLines(id),
    suppliersRepo.findById(po.supplier_id),
    settingsService.getAll(),
    posRepo.listExtraLsx(id),
  ])
  // Đơn gộp nhiều LSX (0125): phiếu ghi "LSX 04.26.27 + 02.26.27" như sổ thật.
  const lsxCode =
    [po.lsx_code, ...extraLsx.map((e) => e.code)].filter(Boolean).join(' + ') || null

  return (
    <PoPrintSheet
      company={company}
      po={{ ...po, template: po.template ?? 'simple', lsx_code: lsxCode }}
      supplier={supplier}
      lines={lines}
      exportHref={`/api/dept/supply/pos/${id}/export`}
    />
  )
}
