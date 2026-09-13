import { notFound, redirect } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { canAction } from '@/modules/core/rbac/rbac.service'
import { supplierInvoicesService } from '@/modules/dept/accounting/supplier-invoices.service'
import { WorkspaceShell } from '@/components/workspace/WorkspaceShell'
import { WORKSPACES } from '@/workspaces/workspaces.config'
import { NhapHoaDonScreen } from './NhapHoaDonScreen'

export const metadata = { title: 'Tài chính · Nhập hoá đơn nhà cung cấp' }
export const dynamic = 'force-dynamic'

/**
 * NHẬP HOÁ ĐƠN NCC TỪ ĐƠN MUA (`?don=<po_id>`).
 *
 * Route này TỪNG ĐƯỢC LINK TỚI MÀ CHƯA BAO GIỜ TỒN TẠI: nút "Nhập hoá đơn" trên
 * màn đối chiếu trỏ vào đây từ 0188 và trả 404. Hệ quả đo được 11/09/2026: sổ
 * TK 331 có đúng 1 tờ hoá đơn, trong khi đã cam kết mua 5,68 tỷ — cả phân hệ
 * công nợ là phần báo cáo dựng trên một cái phễu chưa có miệng.
 *
 * Bắt buộc có `?don=`: hoá đơn NCC ở đây luôn gắn về dòng đơn mua để đối chiếu
 * ba chiều chạy được. Tờ hoá đơn không thuộc đơn nào (phí lặt vặt) đi đường sổ
 * hoá đơn chung `/finance/invoices`.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ don?: string }>
}) {
  const user = await authService.requirePageUser()
  if (!(await canAction(user, 'accounting.supplier_invoice.manage'))) {
    redirect('/finance/hoa-don-ncc')
  }
  const { don } = await searchParams
  if (!don) redirect('/finance/hoa-don-ncc')

  let draft
  try {
    draft = await supplierInvoicesService.draftForPo(user, don)
  } catch {
    // Đơn không tồn tại / id hỏng → 404 thật, không bày màn trống mang tên đơn ma.
    notFound()
  }

  return (
    <WorkspaceShell workspace={WORKSPACES.finance} title="Nhập hoá đơn NCC">
      <NhapHoaDonScreen draft={draft} />
    </WorkspaceShell>
  )
}
