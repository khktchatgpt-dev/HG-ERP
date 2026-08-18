import { authService } from '@/modules/core/auth/auth.service'
import {
  canEditProducts,
  productsService,
} from '@/modules/dept/technical/technical.service'
import { filesService } from '@/modules/core/files/files.service'
import { catalogsService } from '@/modules/core/catalogs/catalogs.service'
import type { BomStatus } from '@/modules/dept/technical/technical.schema'
import { PRODUCT_TYPE_CODES } from '@/lib/product-code'
import { isLifecycle } from '@/lib/product-lifecycle'
import { fileImageSrc } from '@/server/file-image'
// (filesService giờ chỉ dùng cho cờ tài liệu — ảnh đi đường dẫn cố định)
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
  // TRẠNG THÁI hồ sơ (0145) — ô chọn ở thanh lọc. Giá trị lạ coi như không lọc.
  const lifecycleRaw = str(spRaw.lifecycle)
  const lifecycle = isLifecycle(lifecycleRaw) ? lifecycleRaw : 'all'
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
    lifecycle: lifecycle === 'all' ? undefined : lifecycle,
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

  /*
   * Ảnh SP đi qua ĐƯỜNG DẪN CỐ ĐỊNH `/api/files/<id>/img`, KHÔNG phải URL ký.
   *
   * URL ký mang `?token=` đổi mỗi lần ký, mà Vercel tính phí tối ưu ảnh theo
   * từng URL nguồn duy nhất — 24 thẻ ảnh mỗi trang, mỗi lượt xem lại là 24
   * transformation mới. Đường dẫn tất định ở đây khiến mỗi ảnh chỉ tối ưu một
   * lần. Không còn phải ký gì ở đây nên cũng bớt một vòng gọi Storage.
   */
  const imageUrls: Record<string, string> = {}
  for (const p of rows) {
    if (p.image_file_id) imageUrls[p.id] = fileImageSrc(p.image_file_id)
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
        lifecycle: p.lifecycle,
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
      filters={{
        q: q ?? '',
        customer,
        bom,
        status,
        image,
        locked,
        lifecycle,
        type,
        category,
      }}
      customerNames={customerNames}
      categories={categories}
      imageUrls={imageUrls}
      canEdit={canEdit}
    />
  )
}
