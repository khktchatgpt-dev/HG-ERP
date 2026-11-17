import { redirect } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { isProductionStaff } from '@/modules/dept/production/perms'
import { danSoService } from '@/modules/dept/production/dan-so.service'
import { DanSoScreen } from './DanSoScreen'

export const dynamic = 'force-dynamic'

/**
 * DÁN SỔ EXCEL — khuôn F (bảng nhập liệu), KHÔNG kit. Bản vẽ 17/11/2026
 * https://claude.ai/artifact/TN9FdcN5S1mJBDAvwQcsS4, Q1–Q8 duyệt, dựng B1.
 *
 * Câu hỏi: "tờ sổ Excel này (số cũ hoặc số hôm nay) vào ERP đúng chưa, còn thiếu
 * gì?" — dán tờ công đoạn, xem trước từng dòng, rồi ghi mỗi ngày một phiếu nhập bù.
 */
export default async function DanSoPage() {
  const user = await authService.requirePageUser()
  const duocGhi = user.role === 'admin' || (await isProductionStaff(user))
  if (!duocGhi) redirect('/thongke/lenh')
  const opt = await danSoService.tuyChon(user)
  return <DanSoScreen opt={opt} />
}
