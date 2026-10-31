import { redirect } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { canAction } from '@/modules/core/rbac/rbac.service'
import { congNoThangService } from '@/modules/dept/accounting/cong-no-thang.service'
import { WorkspaceShell } from '@/components/workspace/WorkspaceShell'
import { WORKSPACES } from '@/workspaces/workspaces.config'
import { DanhSachThang } from './DanhSachThang'

export const metadata = { title: 'Tài chính · Công nợ nhà cung cấp' }
export const dynamic = 'force-dynamic'

/**
 * CÔNG NỢ NHÀ CUNG CẤP — Màn 1: danh sách NCC của một tháng (bản vẽ
 * Ht7MpqcutpTUyG4r4DvymN bản 3, duyệt 31/10/2026). Tính theo hàng đã nhận (phiếu
 * nhập kho gắn đơn mua), gồm VAT theo đơn — xem `lib/cong-no-thang.ts`.
 * Sổ riêng một NCC: `./ncc/[id]`.
 *
 * `?ky=YYYY-MM` chọn tháng; bỏ trống = tháng có phiếu gần nhất.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ ky?: string }>
}) {
  const user = await authService.requirePageUser()
  if (!(await canAction(user, 'accounting.payable.view'))) redirect('/finance')
  const [sp, data] = await Promise.all([searchParams, congNoThangService.danhSach(user)])
  return (
    <WorkspaceShell workspace={WORKSPACES.finance} title="Công nợ nhà cung cấp">
      <DanhSachThang
        data={data}
        ky={/^\d{4}-\d{2}$/.test(sp.ky ?? '') ? sp.ky : undefined}
      />
    </WorkspaceShell>
  )
}
