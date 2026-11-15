import { redirect } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { canAction } from '@/modules/core/rbac/rbac.service'
import { congNoThangService } from '@/modules/dept/accounting/cong-no-thang.service'
import { WorkspaceShell } from '@/components/workspace/WorkspaceShell'
import { WORKSPACES } from '@/workspaces/workspaces.config'
import { SoNcc } from './SoNcc'

export const metadata = { title: 'Tài chính · Sổ công nợ một nhà cung cấp' }
export const dynamic = 'force-dynamic'

const MONTH = /^\d{4}-\d{2}$/

/**
 * CÔNG NỢ NHÀ CUNG CẤP — Màn 2: sổ riêng một NCC, như một sheet Excel (bản vẽ
 * Ht7MpqcutpTUyG4r4DvymN bản 3). `?tu=YYYY-MM&den=YYYY-MM` chọn khoảng tháng;
 * bỏ trống = mọi tháng có phiếu.
 */
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tu?: string; den?: string }>
}) {
  const user = await authService.requirePageUser()
  if (!(await canAction(user, 'accounting.payable.view'))) redirect('/finance')
  const [{ id }, sp] = await Promise.all([params, searchParams])
  const data = await congNoThangService.soNcc(user, id)
  return (
    <WorkspaceShell
      workspace={WORKSPACES.finance}
      title={data.supplier?.name ?? 'Công nợ nhà cung cấp'}
    >
      <SoNcc
        data={data}
        tu={MONTH.test(sp.tu ?? '') ? sp.tu : undefined}
        den={MONTH.test(sp.den ?? '') ? sp.den : undefined}
      />
    </WorkspaceShell>
  )
}
