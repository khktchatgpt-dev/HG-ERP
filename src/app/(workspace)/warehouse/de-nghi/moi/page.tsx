import { authService } from '@/modules/core/auth/auth.service'
import { canAction } from '@/modules/core/rbac/rbac.service'
import { productionRepo } from '@/modules/dept/production/production.repo'
import { deNghiService } from '@/modules/dept/warehouse/de-nghi.service'
import { tongDuKien } from '@/lib/de-nghi'
import { DeNghiScreen } from '../DeNghiScreen'
import { phieuLapLai, phieuMoi } from '../tai-phieu'
import type { PhieuCu } from '../de-nghi.shared'

export const metadata = { title: 'Kho · Lập đề nghị mua' }
export const dynamic = 'force-dynamic'

/**
 * Lập "Giấy đề nghị mua vật tư" mới (0236, bản vẽ DN-1). `?tu=<id>` = LẬP LẠI từ
 * phiếu cũ (Đ8): bản nháp chép sẵn dòng, CHƯA lưu — xem `phieuLapLai`.
 */
export default async function DeNghiMoiPage({
  searchParams,
}: {
  searchParams: Promise<{ tu?: string }>
}) {
  const user = await authService.requirePageUser()
  const { tu } = await searchParams
  const nguoi = user.name ?? user.email
  const [lsx, canManage, ds, nguon] = await Promise.all([
    productionRepo.listActive(),
    canAction(user, 'warehouse.request.manage'),
    deNghiService.list(user),
    tu ? deNghiService.get(user, tu).catch(() => null) : Promise.resolve(null),
  ])
  // Phiếu chọn được để lập lại: đã gửi duyệt ít nhất một lần, mới nhất trước.
  const phieuCu: PhieuCu[] = ds
    .filter((p) => p.submitted_at && p.status !== 'cancelled')
    .slice(0, 30)
    .map((p) => ({
      id: p.id,
      code: p.code,
      status: p.status,
      ngay: p.submitted_at ?? p.created_at,
      so_dong: p.lines.length,
      tong: tongDuKien(p.lines, p.shipping_fee, { theoDuyet: p.status !== 'pending' })
        .tong,
      ten: p.lines
        .slice(0, 3)
        .map((l) => l.name)
        .join(', '),
    }))
  return (
    <DeNghiScreen
      // key: đổi phiếu nguồn thì dựng lại state của màn (useState chỉ đọc lần đầu).
      key={nguon?.phieu.id ?? 'moi'}
      phieu={nguon ? phieuLapLai(nguoi, nguon.phieu) : phieuMoi(nguoi)}
      lsx={lsx.map((l) => ({ id: l.id, code: l.code }))}
      canManage={canManage}
      phieuCu={phieuCu}
      lapLaiTu={nguon?.phieu.code ?? null}
    />
  )
}
