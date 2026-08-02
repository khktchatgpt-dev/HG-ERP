import { authService } from '@/modules/core/auth/auth.service'
import { isWarehouseUser } from '@/modules/dept/warehouse/warehouse.service'
import { materialsService } from '@/modules/dept/warehouse/warehouse.service'
import { materialTaxonomy } from '@/modules/dept/warehouse/taxonomy.service'
import { suppliersService } from '@/modules/dept/supply/suppliers.service'
import { MaterialsManager } from './MaterialsManager'
import { PAGE_SIZE } from './constants'

/**
 * Danh mục vật tư — LỌC VÀ PHÂN TRANG Ở SERVER.
 *
 * Bản cũ nạp cứng 1.000 dòng đầu rồi lọc ở client. Danh mục nay 12.991 vật tư
 * nên tìm "Thép hộp mạ kẽm" ra "Không khớp bộ lọc" dù mã có thật — nó nằm
 * ngoài 1.000 mã đầu theo thứ tự chữ cái. Tệ hơn: tiêu đề ghi "1000 / 1000
 * vật tư" nên không ai biết mình đang thiếu 11.991 mã.
 */
export default async function MaterialsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; group?: string; page?: string }>
}) {
  const sp = await searchParams
  const user = (await authService.currentUser())!
  const isWh = await isWarehouseUser(user)
  const canEdit = user.role === 'admin' || (user.role === 'manager' && isWh)

  const q = sp.q?.trim() || undefined
  const group = sp.group?.trim() || undefined
  const page = Math.max(1, Number(sp.page) || 1)

  const [{ rows }, counts, { rows: suppliers }, tax] = await Promise.all([
    materialsService.list(user, {
      q,
      group_name: group,
      page,
      page_size: PAGE_SIZE,
      active_only: false,
    }),
    materialsService.counts(user, { q, group_name: group }),
    // NCC đang hoạt động — cho ô "NCC mặc định" của vật tư (tự-điền lên đơn).
    suppliersService.list(user, { active_only: true, page: 1, page_size: 500 }),
    materialTaxonomy(),
  ])

  return (
    <MaterialsManager
      materials={rows}
      suppliers={suppliers.map((s) => ({ id: s.id, name: s.name }))}
      canEdit={canEdit}
      counts={counts}
      page={page}
      filters={{ q: sp.q ?? '', group: sp.group ?? '' }}
      groups={tax.groups.map((g) => g.name)}
    />
  )
}
