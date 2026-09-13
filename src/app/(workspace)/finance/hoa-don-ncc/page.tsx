import { redirect } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { canAction } from '@/modules/core/rbac/rbac.service'
import { posRepo } from '@/modules/dept/supply/pos.repo'
import { supplierInvoicesService } from '@/modules/dept/accounting/supplier-invoices.service'
import { WorkspaceShell } from '@/components/workspace/WorkspaceShell'
import { WORKSPACES } from '@/workspaces/workspaces.config'
import { HoaDonNccScreen } from './HoaDonNccScreen'

export const metadata = { title: 'Tài chính · Hoá đơn nhà cung cấp' }

/**
 * ĐỐI CHIẾU BA CHIỀU (0188) — mắt xích cuối của Procure-to-Pay.
 *
 * Câu hỏi của trang: "NCC đòi tiền có đúng không, và lệch thì lệch ở ĐÂU."
 *
 * Trang chọn đơn mua rồi đối chiếu, chứ không bày sổ hoá đơn trước: người đi
 * đối chiếu cầm trên tay TỜ HOÁ ĐƠN của một NCC cho một lô hàng, việc của họ là
 * so nó với đơn đã đặt và phiếu đã nhập. Bày danh sách hoá đơn trước là bắt họ
 * đi tìm lại thứ họ đang cầm.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ don?: string }>
}) {
  const user = await authService.requirePageUser()
  if (!(await canAction(user, 'accounting.supplier_invoice.view'))) redirect('/finance')

  const { don } = await searchParams

  // Chỉ đơn ĐÃ GỬI NCC mới có gì để đối chiếu: chưa gửi thì chưa có hàng về và
  // chắc chắn chưa có hoá đơn. Bày cả đơn nháp ở đây là mời người dùng bấm vào
  // những dòng không bao giờ có số.
  const { rows: pos } = await posRepo.list({ page: 1, page_size: 200 })
  const candidates = pos
    .filter((p) =>
      ['ordered', 'confirmed', 'in_transit', 'partial', 'received'].includes(p.status),
    )
    .map((p) => ({
      id: p.id,
      code: p.code,
      supplier_name: p.supplier_name ?? '—',
      status: p.status,
      currency: p.currency,
    }))

  const selected = don && candidates.some((c) => c.id === don) ? don : null
  const match = selected ? await supplierInvoicesService.matchForPo(user, selected) : null

  /*
   * Bọc WorkspaceShell — trang này TRƯỚC GIỜ THIẾU, nên vào bằng link là mất
   * sidebar và mất luôn lớp token .kit (chữ và màu rơi về mặc định trình duyệt).
   * Layout của route group chỉ gác đăng nhập; mỗi trang phải tự bọc vỏ.
   */
  return (
    <WorkspaceShell workspace={WORKSPACES.finance} title="Đối chiếu hoá đơn NCC">
      <HoaDonNccScreen
        pos={candidates}
        selectedId={selected}
        match={match}
        canManage={await canAction(user, 'accounting.supplier_invoice.manage')}
      />
    </WorkspaceShell>
  )
}
