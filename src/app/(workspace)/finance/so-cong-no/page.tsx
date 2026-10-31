import { redirect } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { canAction } from '@/modules/core/rbac/rbac.service'
import { apLedgerService } from '@/modules/dept/accounting/ap-ledger.service'
import { WorkspaceShell } from '@/components/workspace/WorkspaceShell'
import { WORKSPACES } from '@/workspaces/workspaces.config'
import { SoCongNoScreen } from './SoCongNoScreen'

export const metadata = { title: 'Tài chính · Công nợ nhà cung cấp' }
export const dynamic = 'force-dynamic'

/**
 * CÔNG NỢ NHÀ CUNG CẤP THEO THÁNG — cửa vào chính của phân hệ công nợ.
 *
 * Mọi màn công nợ khác là ảnh chụp "tại thời điểm này"; chỉ màn này làm việc
 * theo KỲ, nên chỉ nó chốt sổ và lên báo cáo được. Hai cơ sở: theo hàng đã nhận
 * (mặc định từ 31/10/2026 — `lib/ap-receipt-ledger.ts`) và theo hoá đơn NCC
 * (`?co-so=hd` — TK 331, `lib/ap-ledger.ts`). Không bao giờ cộng lẫn hai cơ sở,
 * cũng như không cộng lẫn tiền tệ.
 *
 * Kỳ · cơ sở · tiền tệ · NCC đang soi nằm trên URL (`?ky=&co-so=&tien=&ncc=&tt=`)
 * chứ không trong state: kế toán gửi đường dẫn cho nhau khi đối chiếu, và F5
 * phải ra đúng trang cũ.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    ky?: string
    'co-so'?: string
    tien?: string
    ncc?: string
    tt?: string
  }>
}) {
  const user = await authService.requirePageUser()
  if (!(await canAction(user, 'accounting.payable.view'))) redirect('/finance')
  const sp = await searchParams
  const data = await apLedgerService.overview(user, {
    month: /^\d{4}-\d{2}$/.test(sp.ky ?? '') ? sp.ky : undefined,
    supplier_id: sp.ncc,
    currency: sp.tt,
    basis: sp['co-so'] === 'hd' ? 'invoice' : 'receipt',
  })
  return (
    <WorkspaceShell workspace={WORKSPACES.finance} title="Công nợ nhà cung cấp">
      <SoCongNoScreen {...data} currency={sp.tien} />
    </WorkspaceShell>
  )
}
