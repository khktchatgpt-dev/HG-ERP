import { authService } from '@/modules/core/auth/auth.service'
import {
  canEditProducts,
  productsService,
} from '@/modules/dept/technical/technical.service'
import { filesService } from '@/modules/core/files/files.service'
import { catalogsService } from '@/modules/core/catalogs/catalogs.service'
import type { BomStatus } from '@/modules/dept/technical/technical.schema'
import { PRODUCT_TYPE_CODES } from '@/lib/product-code'
// (filesService dùng cho cả signed URL ảnh lẫn cờ tài liệu)
import { ProductsManager } from './ProductsManager'

const PAGE_SIZE = 24

export default async function TechnicalProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const user = await authService.requirePageUser()
  const canEdit = await canEditProducts(user)

  const spRaw = await searchParams
  const str = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? ''
  const q = str(spRaw.q).trim() || undefined
  const customer = str(spRaw.customer) || 'all'
  const bom = str(spRaw.bom) || 'all'
  const status = str(spRaw.status) || 'all'
  // 'missing' = chưa có ảnh, 'has' = đã có. Giá trị lạ coi như không lọc.
  const image = str(spRaw.image) || 'all'
  // Hồ sơ đã khoá (0140) — chip lọc ở thanh Trạng thái.
  const locked = str(spRaw.locked) || 'all'
  // Mã loại SP 2 ký tự; chỉ nhận mã có thật trong PRODUCT_TYPES để URL bịa ra
  // một mã lạ thì trả về danh sách đầy đủ chứ không phải 0 dòng khó hiểu.
  const typeRaw = str(spRaw.type).toUpperCase()
  const type = PRODUCT_TYPE_CODES.includes(typeRaw as never) ? typeRaw : 'all'
  // Mã danh mục SP (catalog_items) hoặc '__uncategorized'. Không kiểm mã ở đây:
  // catalog có thể đổi, mã lạ chỉ ra 0 dòng chứ không gây lỗi.
  const category = str(spRaw.category) || 'all'
  const page = Math.max(1, Number(str(spRaw.page)) || 1)

  // Chỉ nạp 1 TRANG SP (nhẹ) + lọc phía server thay vì kéo cả bảng.
  const { rows, total, fuzzy } = await productsService.listLite(user, {
    q,
    customer_name: customer === 'all' ? undefined : customer,
    bom_status: bom === 'all' ? undefined : (bom as BomStatus),
    is_active: status === 'active' ? true : status === 'inactive' ? false : undefined,
    has_image: image === 'missing' ? false : image === 'has' ? true : undefined,
    locked: locked === 'yes' ? true : locked === 'no' ? false : undefined,
    product_type: type === 'all' ? undefined : type,
    category: category === 'all' ? undefined : category,
    page,
    page_size: PAGE_SIZE,
  })

  // Nhãn khách/nhóm cho bộ lọc + đếm cho StatsBar + cờ "đã có bản vẽ / BOM"
  // suy từ FILE đã upload (chỉ cho SP của trang này). Vật tư cho BOM editor
  // KHÔNG nạp ở đây nữa — lazy-load khi mở editor (đỡ egress mỗi lần tải).
  //
  // `packingLoading`: số xếp cont THẬT nằm ở technical_packing_options, không
  // phải jsonb `packing` — xem chú thích ở packingLoadingByProducts.
  const ids = rows.map((p) => p.id)
  const [stats, customerNames, docFlags, packingLoading, catalog] = await Promise.all([
    productsService.stats(),
    productsService.customerNames(),
    filesService.productDocFlags(ids),
    productsService.packingLoading(user, ids),
    catalogsService.list(user, 'product_category'),
  ])
  const categories = catalog
    .filter((c) => c.is_active)
    .map((c) => ({ code: c.code, label: c.label }))

  // Ảnh SP của TRANG hiện tại — batch 1 query files + 1 lần ký/bucket (thay N lần).
  const urlByFileId = await filesService.getDownloadUrls(
    user,
    rows.filter((p) => p.image_file_id).map((p) => p.image_file_id!),
  )
  const imageUrls: Record<string, string> = {}
  for (const p of rows) {
    const url = p.image_file_id ? urlByFileId[p.image_file_id] : undefined
    if (url) imageUrls[p.id] = url
  }

  return (
    <ProductsManager
      products={rows.map((p) => ({
        id: p.id,
        code: p.code,
        name: p.name,
        category: p.category,
        product_type: p.product_type,
        frame_material: p.frame_material,
        customer_name: p.customer_name,
        customer_item_code: p.customer_item_code,
        unit: p.unit,
        bom_status: p.bom_status,
        packing: p.packing ?? {},
        length_mm: p.length_mm,
        width_mm: p.width_mm,
        height_mm: p.height_mm,
        image_file_id: p.image_file_id,
        locked_at: p.locked_at,
        is_active: p.is_active,
        has_drawing: docFlags[p.id]?.drawing ?? false,
        has_bom: docFlags[p.id]?.bom ?? false,
        // Phương án đóng gói thật; jsonb chỉ là ô tóm tắt nhập tay nên đứng sau.
        loading_40hc: packingLoading[p.id] ?? p.packing?.loading_40hc ?? null,
      }))}
      total={total}
      fuzzy={fuzzy ?? false}
      page={page}
      pageSize={PAGE_SIZE}
      counts={stats}
      filters={{ q: q ?? '', customer, bom, status, image, locked, type, category }}
      customerNames={customerNames}
      categories={categories}
      imageUrls={imageUrls}
      canEdit={canEdit}
    />
  )
}
