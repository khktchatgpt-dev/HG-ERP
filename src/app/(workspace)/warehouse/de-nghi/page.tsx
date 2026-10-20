import { authService } from '@/modules/core/auth/auth.service'
import { canAction } from '@/modules/core/rbac/rbac.service'
import { deNghiService } from '@/modules/dept/warehouse/de-nghi.service'
import { tongDuKien } from '@/lib/de-nghi'
import { DeNghiSoScreen } from './DeNghiSoScreen'
import type { DeNghiSoRow } from './de-nghi.shared'

export const metadata = { title: 'Kho · Đề nghị mua' }
export const dynamic = 'force-dynamic'

/**
 * SỔ ĐỀ NGHỊ MUA VẬT TƯ — `/warehouse/de-nghi` (0236 · Đ1, bản vẽ DN-4): phiếu
 * nào đang kẹt ở ai. Mỗi phiếu chỉ gửi xuống đúng số đếm màn cần, không gửi dòng.
 */
export default async function DeNghiSoPage() {
  const user = await authService.requirePageUser()
  const [ds, canManage] = await Promise.all([
    deNghiService.list(user),
    canAction(user, 'warehouse.request.manage'),
  ])
  const rows: DeNghiSoRow[] = ds.map((p) => {
    const t = tongDuKien(p.lines, p.shipping_fee)
    return {
      id: p.id,
      code: p.code,
      status: p.status,
      created_at: p.created_at,
      need_by: p.need_by,
      nguoi: p.requested_by_name,
      so_dong: p.lines.length,
      chua_ma: p.lines.filter((l) => !l.material_id).length,
      tong: t.tong,
      thieu_gia: t.thieuGia,
      bi_tu_choi: p.status === 'draft' && !!p.rejected_at,
      rejected_reason: p.rejected_reason,
      cancel_reason: p.cancel_reason,
      lsx_code: p.lsx_code,
    }
  })
  return <DeNghiSoScreen rows={rows} canManage={canManage} />
}
