import { authService } from '@/modules/core/auth/auth.service'
import { canAction } from '@/modules/core/rbac/rbac.service'
import { materialsService } from '@/modules/dept/warehouse/warehouse.service'
import { materialTaxonomy } from '@/modules/dept/warehouse/taxonomy.service'
import { VatTuKhoScreen } from './VatTuKhoScreen'
import { RO_VT, type RoVatTu } from './ro-vat-tu'

export const metadata = { title: 'Kho · Danh mục vật tư' }
export const dynamic = 'force-dynamic'

const PAGE_SIZE = 50

/**
 * DANH MỤC VẬT TƯ — BẢN CỦA KHO (`docs/kho-buoc-4-danh-muc.md`).
 *
 * Chủ dự án chốt 16/09/2026: dựng lại trong khu Kho, KHÔNG mượn màn Cung ứng.
 * Hai phòng hỏi hai câu khác nhau về cùng một bảng — Cung ứng hỏi "mua của
 * ai, bao nhiêu tiền", Kho hỏi "đơn vị gì, để kệ nào, dưới bao nhiêu thì
 * báo". Ranh giới quyền sửa đã có sẵn: `PURCHASING_EDITABLE_FIELDS` trong
 * `warehouse.service`; mọi trường ngoài danh sách đó là của Kho.
 *
 * TRANG NÀY LÀ MỘT Ô TÌM, không phải bảng để lướt: 13.229 mã là 265 trang.
 * Lọc và phân trang Ở SERVER, mọi bộ lọc nằm trên URL.
 */
export default async function VatTuKhoPage({
  searchParams,
}: {
  searchParams: Promise<{ ro?: string; q?: string; nhom?: string; trang?: string }>
}) {
  const user = await authService.requirePageUser()
  const sp = await searchParams
  const ro: RoVatTu = (RO_VT as readonly string[]).includes(sp.ro ?? '')
    ? (sp.ro as RoVatTu)
    : 'review'
  const q = sp.q?.trim() || undefined
  const nhom = sp.nhom?.trim() || undefined
  const trang = Math.max(1, Number(sp.trang) || 1)

  const loc = {
    q,
    group_name: nhom,
    needs_review: ro === 'review' || undefined,
    no_min_stock: ro === 'no_min' || undefined,
    no_shelf: ro === 'no_shelf' || undefined,
  }

  const [res, counts, taxonomy, canEdit] = await Promise.all([
    materialsService.list(user, { ...loc, page: trang, page_size: PAGE_SIZE }),
    // Đếm rổ trên bộ lọc tìm/nhóm ĐANG ÁP, không đếm cả danh mục — chip nói 52
    // mà mở ra 7 là hỏng nguyên tắc "con số là một lời hứa".
    materialsService.counts(user, { q, group_name: nhom }),
    materialTaxonomy(),
    user.role === 'admin'
      ? Promise.resolve(true)
      : canAction(user, 'warehouse.material.update'),
  ])

  return (
    <VatTuKhoScreen
      rows={res.rows.map((m) => ({
        id: m.id,
        code: m.code,
        name: m.name,
        unit: m.unit,
        group_name: m.group_name,
        sub_group: m.sub_group,
        shelf_location: m.shelf_location,
        min_stock: m.min_stock,
        needs_review: m.needs_review,
        is_active: m.is_active,
      }))}
      counts={{
        review: counts.needsReview,
        no_min: counts.noMinStock,
        no_shelf: counts.noShelf,
        all: counts.total,
      }}
      total={res.total}
      trang={trang}
      soTrang={Math.max(1, Math.ceil(res.total / PAGE_SIZE))}
      ro={ro}
      q={sp.q ?? ''}
      nhom={nhom ?? ''}
      nhomOptions={taxonomy.groups.map((g) => g.name)}
      dvtOptions={taxonomy.units}
      canEdit={canEdit}
    />
  )
}
