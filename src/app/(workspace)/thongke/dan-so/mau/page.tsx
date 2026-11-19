import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { isProductionStaff } from '@/modules/dept/production/perms'
import { danSoService } from '@/modules/dept/production/dan-so.service'
import { COOKIE_LENH } from '@/lib/lenh-nho'
import { MauScreen } from './MauScreen'

export const dynamic = 'force-dynamic'

/**
 * FILE MẪU NHẬP LIỆU THEO LỆNH — bản vẽ v2 (19/11/2026,
 * https://claude.ai/artifact/4N2faPL2w4QHYQTvu5zNjX): ERP sinh file cả lệnh, mỗi công đoạn một
 * tờ; thống kê điền số rồi tải lên (bước sau). Khuôn F, KHÔNG kit.
 */
export default async function MauPage() {
  const user = await authService.requirePageUser()
  const duocGhi = user.role === 'admin' || (await isProductionStaff(user))
  if (!duocGhi) redirect('/thongke/lenh')
  const opt = await danSoService.tuyChon(user)
  const nho = (await cookies()).get(COOKIE_LENH)?.value ?? null
  return <MauScreen opt={opt} lenhNho={nho} />
}
