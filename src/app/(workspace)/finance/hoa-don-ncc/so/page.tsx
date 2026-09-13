import { redirect } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { canAction } from '@/modules/core/rbac/rbac.service'
import { supplierInvoicesService } from '@/modules/dept/accounting/supplier-invoices.service'
import { WorkspaceShell } from '@/components/workspace/WorkspaceShell'
import { WORKSPACES } from '@/workspaces/workspaces.config'
import { SoHoaDonScreen, type SoHoaDonRow } from './SoHoaDonScreen'

export const metadata = { title: 'Tài chính · Sổ hoá đơn nhà cung cấp' }
export const dynamic = 'force-dynamic'

/**
 * SỔ HOÁ ĐƠN NCC (0188) — danh sách + nút VÀO SỔ.
 *
 * ĐỪNG NHẦM VỚI `/finance/invoices`: đó là sổ hoá đơn CŨ (`accounting_invoices`,
 * `party_name` chữ tự do, không nối dòng đơn mua). Hai bảng sống song song có
 * chủ ý — sổ cũ giữ dữ liệu đã có. Tờ lập từ màn đối chiếu nằm ở ĐÂY.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ hd?: string }>
}) {
  const user = await authService.requirePageUser()
  if (!(await canAction(user, 'accounting.supplier_invoice.view'))) redirect('/finance')
  const { hd } = await searchParams

  const [{ rows }, canManage] = await Promise.all([
    supplierInvoicesService.list(user, { page: 1, page_size: 200 }),
    canAction(user, 'accounting.supplier_invoice.manage'),
  ])

  return (
    <WorkspaceShell workspace={WORKSPACES.finance} title="Sổ hoá đơn NCC">
      <SoHoaDonScreen
        rows={rows as SoHoaDonRow[]}
        highlightId={hd ?? null}
        canManage={canManage}
      />
    </WorkspaceShell>
  )
}
