import { redirect } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { canAction } from '@/modules/core/rbac/rbac.service'
import { loadPoPrint } from '@/modules/dept/supply/po-print.service'
import { PoPrintSheet } from '../PoPrintSheet'

/**
 * In ĐƠN ĐẶT HÀNG đã lưu — trang này chỉ NẠP DỮ LIỆU.
 *
 * Toàn bộ cách dựng tờ phiếu nằm ở `PoPrintSheet`, dùng chung với nút "Xem trước
 * phiếu in" trên form soạn đơn. Dữ liệu nạp qua `loadPoPrint` — CHUNG với file
 * Excel, để tờ in từ web và tờ in từ Excel là một (05/10/2026).
 *
 * DẤU + CHỮ KÝ GIÁM ĐỐC (06/10/2026) chỉ cho người soạn/duyệt đơn mua: trang in
 * mở cho mọi tài khoản đăng nhập (Kho in đối chiếu), mà ảnh dấu đã lên màn là
 * lưu lại được — đừng phát nó cho người không cần gửi đơn đi.
 */
export default async function PoPrintPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await authService.currentUser()
  if (!user) redirect('/login')
  const { id } = await params

  const [canManage, canApprove] = await Promise.all([
    canAction(user, 'supply.po.manage'),
    canAction(user, 'supply.po.approve'),
  ])
  const d = await loadPoPrint(id, { withStamp: canManage || canApprove })
  if (!d) redirect('/mua-hang/don')

  return (
    <PoPrintSheet
      company={d.company}
      tpl={d.tpl}
      shipments={d.shipments}
      stamp={d.stamp}
      stampNote={d.stampNote}
      po={d.po}
      supplier={d.supplier}
      lines={d.lines}
      exportHref={`/api/dept/supply/pos/${id}/export`}
    />
  )
}
