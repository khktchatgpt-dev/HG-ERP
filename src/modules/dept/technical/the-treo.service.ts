import { assertAction } from '@/modules/core/rbac/rbac.service'
import type { User } from '@/modules/core/users/users.repo'
import { fileImageSrc } from '@/server/file-image'
import type { TheNguon } from '@/lib/the-treo'
import { libraryService, type LibraryFilters } from './library.service'
import { theTreoRepo } from './the-treo.repo'

/**
 * THẺ TREO MẪU SHOWROOM (bản vẽ duyệt 19/11/2026) — nạp SP để in + đánh dấu đã
 * treo. Thẻ in GÌ do `lib/the-treo` quyết; ở đây chỉ đọc DB.
 *
 * Tập SP lấy ĐÚNG bộ lọc của Thư viện SP (`libraryService.listPage`) — nút "In
 * thẻ treo" mang theo bộ lọc đang xem, màn in ra đúng những dòng người dùng vừa
 * thấy, không đếm lại theo luật riêng.
 */
export type TheLoc = Omit<LibraryFilters, 'page' | 'page_size'>

const toNguon = (
  r: Awaited<ReturnType<typeof theTreoRepo.listByIds>>[number],
): TheNguon => ({
  id: r.id,
  code: r.code,
  name: r.name,
  description_en: r.description_en,
  frame_material: r.frame_material,
  length_mm: r.length_mm == null ? null : Number(r.length_mm),
  width_mm: r.width_mm == null ? null : Number(r.width_mm),
  height_mm: r.height_mm == null ? null : Number(r.height_mm),
  tech_spec: r.tech_spec,
  customer_name: r.customer_name,
  customer_item_code: r.customer_item_code,
  image_url: r.image_file_id ? fileImageSrc(r.image_file_id) : null,
  showroom_zone: r.showroom_zone,
  showroom_sample: r.showroom_sample,
  showroom_tagged_at: r.showroom_tagged_at,
  packing: r.packing,
  net_weight_kg: r.net_weight_kg == null ? null : Number(r.net_weight_kg),
  origin_country: r.origin_country,
})

export const theTreoService = {
  /** SP theo bộ lọc Thư viện (tối đa 10.000), hoặc đúng một SP khi in lại thẻ từ hồ sơ. */
  async load(user: User, loc: TheLoc, chiMotId?: string): Promise<TheNguon[]> {
    let ids: string[]
    if (chiMotId) {
      ids = [chiMotId]
    } else {
      ids = []
      for (let page = 1; page <= 20; page++) {
        const r = await libraryService.listPage(
          user,
          { ...loc, page, page_size: 500 },
          false,
        )
        ids.push(...r.rows.map((x) => x.id))
        if (r.rows.length < 500) break
      }
    }
    const rows = await theTreoRepo.listByIds(ids)
    const order = new Map(ids.map((id, i) => [id, i]))
    return rows
      .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
      .map(toNguon)
  },

  /** "Đã treo thẻ" hàng loạt — chỉ ghi dòng chưa treo, không ghi đè ngày cũ. */
  async markTagged(
    user: User,
    ids: string[],
  ): Promise<{ marked: number; already: number; at: string }> {
    await assertAction(user, 'technical.product.update')
    const uniq = [...new Set(ids)]
    const at = new Date().toISOString()
    const done = await theTreoRepo.setTaggedMany(uniq, at)
    return { marked: done.length, already: uniq.length - done.length, at }
  },
}
