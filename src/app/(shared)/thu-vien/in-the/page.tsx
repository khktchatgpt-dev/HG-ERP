import { headers } from 'next/headers'
import { authService } from '@/modules/core/auth/auth.service'
import { canAction } from '@/modules/core/rbac/rbac.service'
import { theTreoService } from '@/modules/dept/technical/the-treo.service'
import { docLocThuVien, locQuery, thamSo, type ThuVienSearch } from '../thu-vien.filters'
import { InTheScreen } from './InTheScreen'
import './in-the.css'

export const metadata = { title: 'In thẻ treo' }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * IN THẺ TREO MẪU SHOWROOM (phiếu 101026 PKD; bản vẽ duyệt 19/11/2026).
 *
 * Tập SP = ĐÚNG bộ lọc của Thư viện (nút "In thẻ treo" mang nguyên query sang);
 * `?id=` = một SP (in lại thẻ hỏng từ hồ sơ). Gác cửa khu Kỹ thuật nằm ở layout
 * `thu-vien`; đánh dấu "đã treo" cần `technical.product.update` (route kiểm lại).
 * QR trỏ `/products/<id>` — trang hồ sơ dùng chung, phòng nào quét cũng vào được.
 */
export default async function InThePage({
  searchParams,
}: {
  searchParams: Promise<ThuVienSearch>
}) {
  const user = await authService.requirePageUser()
  const [sp, h, canMark] = await Promise.all([
    searchParams,
    headers(),
    canAction(user, 'technical.product.update'),
  ])
  const loc = docLocThuVien(sp, false)
  const id = thamSo(sp.id)
  const rows = await theTreoService.load(user, loc, UUID.test(id) ? id : undefined)
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000'
  const proto =
    h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')
  return (
    <InTheScreen
      rows={rows}
      origin={`${proto}://${host}`}
      canMark={canMark}
      backHref={`/thu-vien?${locQuery(loc)}`}
    />
  )
}
