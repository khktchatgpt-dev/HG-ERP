import { redirect } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { canAction } from '@/modules/core/rbac/rbac.service'
import { deNghiService } from '@/modules/dept/warehouse/de-nghi.service'
import { todayVn } from '@/lib/date-vn'
import { DuyetDeNghiSoScreen } from './DuyetDeNghiSoScreen'

export const metadata = { title: 'Duyệt đề nghị mua' }
export const dynamic = 'force-dynamic'

/**
 * DANH SÁCH ĐỀ NGHỊ MUA CHO LÃNH ĐẠO — `/duyet/de-nghi` (Đ5, bản vẽ DN-6
 * https://claude.ai/artifact/Tu7kTTCUPr2aALmAZ2g18b, duyệt 13/10/2026).
 *
 * Khu dùng chung như màn duyệt một phiếu: ba người duyệt đến từ hai khu khác
 * nhau (Ban Giám đốc · Mua hàng). Ai không có quyền duyệt mà là Kho thì về sổ
 * đề nghị của Kho; còn lại service chặn.
 */
export default async function DuyetDeNghiSoPage() {
  const user = await authService.requirePageUser()
  if (!(await canAction(user, 'warehouse.request.approve'))) {
    if (await canAction(user, 'warehouse.request.manage')) redirect('/warehouse/de-nghi')
  }
  const { rows, thang } = await deNghiService.danhSachDuyet(user)
  return <DuyetDeNghiSoScreen rows={rows} thang={thang} today={todayVn()} />
}
