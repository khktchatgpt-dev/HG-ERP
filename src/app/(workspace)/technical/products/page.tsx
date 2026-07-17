import { authService } from '@/modules/core/auth/auth.service'
import { productsService } from '@/modules/dept/technical/technical.service'
import { customersRepo } from '@/modules/dept/sales/sales.repo'
import { materialsRepo } from '@/modules/dept/warehouse/warehouse.repo'
import { filesService } from '@/modules/core/files/files.service'
import type { BomStatus } from '@/modules/dept/technical/technical.schema'
// (filesService dùng cho cả signed URL ảnh lẫn cờ tài liệu)
import { ProductsManager } from './ProductsManager'

const PAGE_SIZE = 24

export default async function TechnicalProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const user = (await authService.currentUser())!
  const canEdit = user.role === 'admin' || user.role === 'manager'

  const spRaw = await searchParams
  const str = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? ''
  const q = str(spRaw.q).trim() || undefined
  const customer = str(spRaw.customer) || 'all'
  const bom = str(spRaw.bom) || 'all'
  const status = str(spRaw.status) || 'all'
  const page = Math.max(1, Number(str(spRaw.page)) || 1)

  // Chỉ nạp 1 TRANG SP (nhẹ) + lọc phía server thay vì kéo cả bảng.
  const { rows, total } = await productsService.listLite(user, {
    q,
    customer_id: customer === 'all' ? undefined : customer,
    bom_status: bom === 'all' ? undefined : (bom as BomStatus),
    is_active: status === 'active' ? true : status === 'inactive' ? false : undefined,
    page,
    page_size: PAGE_SIZE,
  })

  // Vật tư cho BOM editor + khách cho bộ lọc/nhãn nhóm + đếm cho StatsBar +
  // cờ "đã có bản vẽ / BOM" suy từ FILE đã upload (chỉ cho SP của trang này).
  const [stats, { rows: customers }, { rows: materials }, docFlags] = await Promise.all([
    productsService.stats(),
    customersRepo.list({ active_only: true, page: 1, page_size: 1000 }),
    materialsRepo.list({ active_only: true, page: 1, page_size: 1000 }),
    filesService.productDocFlags(rows.map((p) => p.id)),
  ])

  // Ảnh chỉ resolve cho SP của TRANG hiện tại (không phải toàn bộ thư viện).
  const imageUrls: Record<string, string> = {}
  await Promise.all(
    rows
      .filter((p) => p.image_file_id)
      .map(async (p) => {
        try {
          imageUrls[p.id] = await filesService.getDownloadUrl(user, p.image_file_id!)
        } catch {
          /* bỏ ảnh */
        }
      }),
  )

  return (
    <ProductsManager
      products={rows.map((p) => ({
        id: p.id,
        code: p.code,
        name: p.name,
        category: p.category,
        customer_id: p.customer_id,
        customer_item_code: p.customer_item_code,
        unit: p.unit,
        bom_status: p.bom_status,
        packing: p.packing ?? {},
        image_file_id: p.image_file_id,
        is_active: p.is_active,
        has_drawing: docFlags[p.id]?.drawing ?? false,
        has_bom: docFlags[p.id]?.bom ?? false,
      }))}
      total={total}
      page={page}
      pageSize={PAGE_SIZE}
      counts={stats}
      filters={{ q: q ?? '', customer, bom, status }}
      customers={customers.map((c) => ({ id: c.id, name: c.name }))}
      materials={materials.map((m) => ({
        id: m.id,
        code: m.code,
        name: m.name,
        unit: m.unit,
      }))}
      imageUrls={imageUrls}
      canEdit={canEdit}
    />
  )
}
