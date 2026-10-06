import { redirect } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { loadPoPrint } from '@/modules/dept/supply/po-print.service'
import { PoPrintSheet } from '../PoPrintSheet'

/**
 * In ĐƠN ĐẶT HÀNG đã lưu — trang này chỉ NẠP DỮ LIỆU.
 *
 * Toàn bộ cách dựng tờ phiếu nằm ở `PoPrintSheet`, dùng chung với nút "Xem trước
 * phiếu in" trên form soạn đơn. Dữ liệu nạp qua `loadPoPrint` — CHUNG với file
 * Excel, để tờ in từ web và tờ in từ Excel là một (05/10/2026).
 */
export default async function PoPrintPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await authService.currentUser()
  if (!user) redirect('/login')
  const { id } = await params

  const d = await loadPoPrint(id)
  if (!d) redirect('/mua-hang/don')

  return (
    <PoPrintSheet
      company={d.company}
      tpl={d.tpl}
      shipments={d.shipments}
      po={d.po}
      supplier={d.supplier}
      lines={d.lines}
      exportHref={`/api/dept/supply/pos/${id}/export`}
    />
  )
}
