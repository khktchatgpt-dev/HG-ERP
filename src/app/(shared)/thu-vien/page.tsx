import { authService } from '@/modules/core/auth/auth.service'
import { canAction } from '@/modules/core/rbac/rbac.service'
import { canEditProducts } from '@/modules/dept/technical/technical.service'
import { libraryService } from '@/modules/dept/technical/library.service'
import { PRODUCT_TYPE_CODES, FRAME_MATERIALS } from '@/lib/product-code'
import { isThieuFilter } from '@/lib/ho-so-sp'
import { ThuVienScreen } from './ThuVienScreen'
import { PAGE_SIZE } from './thu-vien.const'
import type { ThuVienFilters } from './thu-vien.shared'

/**
 * THƯ VIỆN SẢN PHẨM — khuôn C · Danh sách (dựng lại 08/10/2026 theo bản vẽ
 * https://claude.ai/artifact/GDH6ySuGAbkdhnfDen2eue, chép checklist hồ sơ +
 * lọc "Thiếu…" của app CodeIgniter cũ).
 *
 * Câu hỏi của màn: "SP nào chưa đủ hồ sơ để đưa vào lệnh / báo giá?"
 *
 * Trang server chỉ đọc URL → gọi MỘT hàm service → truyền xuống màn client
 * đúng thứ nó cần. Mọi phép đếm và lọc tập nằm ở `library.service` để chip và
 * dòng ra từ cùng một tập cờ.
 */
export default async function ThuVienSanPhamPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const user = await authService.requirePageUser()
  const [canEdit, canPrice, sp] = await Promise.all([
    canEditProducts(user),
    // Giá kế hoạch là bí mật của Bán hàng — cột Giá KH chỉ hiện cho người có quyền.
    canAction(user, 'technical.plan_cost.view'),
    searchParams,
  ])

  const str = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? ''
  const loaiRaw = str(sp.loai).toUpperCase()
  const khungRaw = str(sp.khung).toUpperCase()
  const thieuRaw = str(sp.thieu)
  const ttRaw = str(sp.tt)
  const filters: ThuVienFilters = {
    q: str(sp.q).trim(),
    kh: str(sp.kh),
    // Mã lạ trên URL coi như không lọc — không trả 0 dòng khó hiểu.
    loai: PRODUCT_TYPE_CODES.includes(loaiRaw as never) ? loaiRaw : '',
    khung: FRAME_MATERIALS.some((m) => m.code === khungRaw) ? khungRaw : '',
    thieu: isThieuFilter(thieuRaw) ? thieuRaw : '',
    kt: str(sp.kt) === '1',
    tt: ttRaw === 'inactive' || ttRaw === 'all' ? ttRaw : 'active',
    lenh: str(sp.lenh) === '1',
    mau: str(sp.mau) === '1',
    gia: canPrice && str(sp.gia) === '1',
  }
  const page = Math.max(1, Number(str(sp.trang)) || 1)

  const data = await libraryService.listPage(
    user,
    { ...filters, q: filters.q || undefined, page, page_size: PAGE_SIZE },
    canPrice,
  )

  return (
    <ThuVienScreen
      rows={data.rows}
      total={data.total}
      fuzzy={data.fuzzy}
      counts={data.counts}
      customers={data.customers}
      filters={filters}
      page={page}
      canEdit={canEdit}
      canPrice={canPrice}
    />
  )
}
