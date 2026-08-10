import { authService } from '@/modules/core/auth/auth.service'
import { execService } from '@/modules/core/exec/exec.service'
import { PurchasingOverview } from './PurchasingOverview'

/**
 * MUA HÀNG & NCC — vế MUA của Ban Giám đốc (09/08/2026). Layout exec đã gác quyền.
 */
export default async function ExecPurchasingPage() {
  const user = await authService.requirePageUser()
  const data = await execService.purchasing(user)
  return <PurchasingOverview data={data} />
}
