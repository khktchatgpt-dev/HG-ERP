import {
  partGroupsRepo,
  productProfileRepo,
  productsRepo,
  NO_CATEGORY_FILTER,
  NO_CUSTOMER_FILTER,
  type Product,
  type ProductPacking,
  type ProductLite,
  type ProductPart,
  type ProductPickRow,
  type ProductTechSpec,
} from './technical.repo'
import {
  productRevisionsRepo,
  snapshotFields,
  snapshotParts,
  diffFields,
  type ProductRevision,
} from './product-revisions.repo'
import type {
  BomStatus,
  ProductPartInput as PartInput,
  ProductPartPatch as PartPatch,
  ProductClusterInput as ClusterInput,
  ProductClusterPatch as ClusterPatch,
} from './technical.schema'
import { usersRepo, type User } from '@/modules/core/users/users.repo'
import { hasPermission, assertAction, canAction } from '@/modules/core/rbac/rbac.service'
import { BadRequest, Conflict, NotFound } from '@/server/http'
import { buildCopiedParts } from '@/lib/bom-copy'
import { calcPartDerived } from '@/lib/bom-calc'
import { normalizeSearch, worthFuzzy } from '@/lib/search-text'
import { ensureCatalogItem } from '@/modules/core/catalogs/catalogs.service'
import {
  LIFECYCLE_LABEL,
  flagsFor,
  requiresReason,
  type Lifecycle,
} from '@/lib/product-lifecycle'
import {
  MAX_SERIAL,
  buildProductCode,
  nextSerial,
  parseProductCode,
} from '@/lib/product-code'

/**
 * Phân loại (loại SP + vật liệu khung) cho một SP sắp tạo.
 *
 * Mã SP đã mang sẵn hai thông tin này nên SUY TỪ MÃ là nguồn khỏi lệch — dữ
 * liệu thật đang khớp 100% giữa mã và hai cột. Giá trị gửi tường minh vẫn
 * thắng, để SP mã cũ (`RHONE-CHAIR`, `28256-228`… — parse ra null) còn đường
 * khai phân loại bằng tay.
 *
 * Trước đây hai cột này KHÔNG có đường nào ghi từ app (schema không nhận, service
 * không set, DB không có trigger) — chỉ script import điền. Nên mọi SP tạo qua
 * giao diện đều rơi ra ngoài cột "Loại" và bộ lọc loại của thư viện.
 */
function classify(input: {
  code: string
  product_type?: string | null
  frame_material?: string | null
}): { product_type: string | null; frame_material: string | null } {
  const parsed = parseProductCode(input.code)
  return {
    product_type: input.product_type ?? parsed?.type ?? null,
    frame_material: input.frame_material ?? parsed?.material ?? null,
  }
}

// Phase B RBAC: mọi guard method đọc thẳng registry `actions.ts` qua
// `assertAction` (nguồn sự thật). `isTechnicalStaff` giữ lại vì các module khác
// (files/loans/samples/showroom) còn dùng để suy "thuộc phòng Kỹ thuật".
async function isTechnicalStaff(user: User): Promise<boolean> {
  return hasPermission(user, 'technical.member')
}

/**
 * Cờ SỬA cho giao diện hồ sơ sản phẩm. Trước đây mỗi trang tự tính
 * `user.role === 'admin' || 'manager'` — NV phòng Kỹ thuật (role `employee`,
 * vai dẫn xuất `technical_staff`) vào được nhưng KHÔNG thấy nút nào, dù guard
 * server đã cho phép. Đọc thẳng registry thao tác để UI và guard cùng nguồn.
 *
 * Hồ sơ SP giờ là khu DÙNG CHUNG (`/products`) nên cờ này chạy cho MỌI phòng:
 * Kỹ thuật/Bán hàng/Giám đốc → true (thấy nút), phòng khác → false (chỉ xem).
 */
async function canEditProducts(user: User): Promise<boolean> {
  return canAction(user, 'technical.product.update')
}

async function canCreateProducts(user: User): Promise<boolean> {
  return canAction(user, 'technical.product.create')
}

/** Bóc tách / sửa BOM — tầng riêng, gác bằng `technical.bom.edit` (0118). */
async function canEditBom(user: User): Promise<boolean> {
  return canAction(user, 'technical.bom.save')
}

/** Khoá / mở khoá hồ sơ (0140) — Kỹ thuật + Giám đốc. */
async function canLockProducts(user: User): Promise<boolean> {
  return canAction(user, 'technical.product.lock')
}

/** Cập nhật trạng thái hồ sơ (0145) — Kỹ thuật + Bán hàng + Giám đốc. */
async function canSetLifecycle(user: User): Promise<boolean> {
  return canAction(user, 'technical.product.lifecycle')
}

/**
 * HỒ SƠ ĐÃ KHOÁ THÌ KHÔNG SỬA (0140 — user chốt "khoá TOÀN BỘ hồ sơ SP").
 *
 * Chặn ở SERVICE chứ không chỉ ẩn nút: hồ sơ khoá là bản cả xưởng và Cung ứng
 * đang dùng để mua/sản xuất — một request thủ công hay một tab mở sẵn từ trước
 * lúc khoá cũng không được sửa lọt. Muốn sửa: mở khoá (có ghi lý do).
 */
function assertUnlocked(p: { locked_at: string | null; code?: string }): void {
  if (!p.locked_at) return
  throw Conflict(
    `Hồ sơ ${p.code ?? ''} đã KHOÁ — mở khoá (kèm lý do) rồi mới sửa được`.trim(),
    'PRODUCT_LOCKED',
  )
}

/**
 * Ghi một dòng LỊCH SỬ PHIÊN BẢN (0143).
 *
 * `lock` → chốt bản mới: số bản +1, chụp thuộc tính + định mức, tính danh sách
 * trường đổi so với bản chốt gần nhất. `unlock` → ghi vết trên bản đang chốt,
 * không tăng số, không chụp lại (nội dung y bản đang chốt).
 *
 * `p` là hồ sơ ĐỌC TRƯỚC khi patch — đúng nội dung được chốt; mấy cột kiểm soát
 * (locked_*) không nằm trong ảnh chụp nên chụp trước hay sau đều như nhau.
 */
async function writeRevision(
  user: User,
  p: Product,
  action: 'lock' | 'unlock',
  reason: string | null,
): Promise<void> {
  const maxRev = await productRevisionsRepo.maxRev(p.id)
  if (action === 'unlock') {
    await productRevisionsRepo.insert({
      product_id: p.id,
      rev: Math.max(1, maxRev),
      action,
      reason,
      created_by: user.id,
    })
    return
  }

  const [parts, prev] = await Promise.all([
    productProfileRepo.parts(p.id),
    productRevisionsRepo.lastLockSnapshot(p.id),
  ])
  const fields = snapshotFields(p)
  const partsSnap = snapshotParts(parts)
  const partsChanged = prev
    ? JSON.stringify(prev.parts) !== JSON.stringify(partsSnap)
    : false
  await productRevisionsRepo.insert({
    product_id: p.id,
    rev: maxRev + 1,
    action,
    reason,
    changed_fields: diffFields(prev?.fields ?? null, fields, partsChanged),
    fields_snapshot: fields,
    parts_snapshot: partsSnap,
    created_by: user.id,
  })
}

/** Chặn sửa định mức của hồ sơ đã khoá — cùng luật với sửa thuộc tính SP. */
async function assertProductUnlocked(productId: string): Promise<void> {
  const p = await productsRepo.findById(productId)
  if (!p) throw NotFound('Sản phẩm không tồn tại')
  assertUnlocked(p)
}

/** Các trường hình học — đụng bất kỳ trường nào thì phải tính lại số dẫn xuất. */
const GEO_KEYS = [
  'profile_shape',
  'material_kind',
  'dim_a_mm',
  'dim_b_mm',
  'wall_thickness_mm',
  'cut_length_mm',
  'bend_waste_mm',
  'tenon_mm',
  'kg_per_m',
  'qty',
] as const

/**
 * Chuẩn hoá một dòng định mức trước khi ghi:
 *
 *  1. `cluster_name` → `cluster_id` (gõ tên cụm mới thì tạo, tên đã có thì gán
 *     vào cụm đó). Lưu bằng khoá chứ không bằng chuỗi nên đổi tên cụm về sau
 *     không làm dòng rơi ra khỏi cụm.
 *  2. Tính lại tổng chiều dài / khối lượng / diện tích / m³ **ở server**. Client
 *     tính sẵn để hiện ngay khi gõ, nhưng số ghi xuống DB không được phụ thuộc
 *     vào việc client có gửi đủ hay không — báo cáo khối lượng đọc thẳng cột này.
 *     Số người dùng NHẬP TAY thì giữ (profile gân, hợp kim lạ thì hình học sai).
 *
 * `base` là dòng đang có trong DB khi sửa — cần để tính đúng lúc người dùng chỉ
 * đổi một ô (sửa mỗi số lượng mà tính lại từ patch rỗng thì kích thước thành null).
 */
async function resolveLine<T extends Record<string, unknown>>(
  productId: string,
  input: T,
  base?: ProductPart | null,
): Promise<Record<string, unknown>> {
  const { cluster_name, ...rest } = input as T & { cluster_name?: string | null }
  const row: Record<string, unknown> = { ...rest }

  if (cluster_name !== undefined) {
    const name = (cluster_name ?? '').trim()
    row.cluster_id = name
      ? (await productProfileRepo.ensureCluster(productId, name)).id
      : null
  }

  const touchesGeo = GEO_KEYS.some((k) => k in row)
  if (!touchesGeo && base == null) return row

  const geo = Object.fromEntries(
    GEO_KEYS.map((k) => [k, (k in row ? row[k] : base?.[k]) ?? null]),
  )
  const d = calcPartDerived(geo)
  // `?? d.x` chứ không phải `d.x ?? ...`: người dùng gửi số thì số của họ thắng.
  row.total_length_m = (row.total_length_m as number | null) ?? d.total_length_m
  row.weight_kg = (row.weight_kg as number | null) ?? d.weight_kg
  row.paint_area_m2 = (row.paint_area_m2 as number | null) ?? d.paint_area_m2
  row.paint_area_box_m2 = d.paint_area_box_m2
  row.volume_m3 = (row.volume_m3 as number | null) ?? d.volume_m3
  return row
}

type CreateInput = {
  code: string
  name: string
  category?: string | null
  /** Nhãn khách/nhóm gõ tự do (0091) — không ràng buộc danh mục khách Kinh doanh. */
  customer_name?: string | null
  customer_item_code?: string | null
  description_en?: string | null
  unit?: string
  packing?: ProductPacking
  notes?: string | null
  name_foreign?: string | null
  shipping_mark?: string | null
  barcode?: string | null
  showroom_sample?: boolean
  reference_price?: number | null
  tech_spec?: ProductTechSpec
  hs_code?: string | null
  origin_country?: string | null
  material?: string | null
  max_load_kg?: number | null
  assembly?: 'assembled' | 'kd' | null
  set_contents?: string | null
}

export const productsService = {
  async list(
    user: User,
    opts: {
      q?: string
      category?: string
      customer_name?: string
      bom_status?: BomStatus
      active_only?: boolean
      page: number
      page_size: number
    },
  ) {
    // Mọi NV trong công ty đều xem được thư viện SP — tài sản chung (đặc tả 4.2:
    // các phòng đọc trạng thái BOM, xưởng tra bản vẽ).
    return productsRepo.list({
      q: opts.q,
      category: opts.category,
      customer_name: opts.customer_name,
      bom_status: opts.bom_status,
      active_only: opts.active_only ?? true,
      page: opts.page,
      page_size: opts.page_size,
    })
  },

  /**
   * Thư viện SP — lọc/tìm/phân trang phía server, cột tối thiểu. Tìm hai nhịp:
   *
   *  1. KHỚP CHẶT — mọi từ khoá phải có mặt trong `search_text` (đã bỏ dấu).
   *  2. GẦN ĐÚNG — chỉ khi nhịp 1 ra 0 dòng: xếp hạng theo độ giống trigram
   *     (0098) để "folrenz" vẫn ra "Florenz". Trả kèm cờ `fuzzy` để màn hình nói
   *     rõ đây là kết quả gần đúng, chứ không lặng lẽ đưa thứ khác cho người dùng.
   *
   * Nhánh gần đúng KHÔNG phân trang: nó chỉ để cứu một lần gõ sai, đưa vài chục
   * kết quả gần nhất. Gõ lại cho đúng thì về nhánh 1 với phân trang đầy đủ.
   */
  async listLite(
    _user: User,
    opts: {
      q?: string
      customer_name?: string
      bom_status?: BomStatus
      is_active?: boolean
      has_image?: boolean
      /** true = chỉ hồ sơ ĐÃ KHOÁ (0140). */
      locked?: boolean
      /** Lọc theo TRẠNG THÁI hồ sơ (0145). */
      lifecycle?: Lifecycle
      product_type?: string
      category?: string
      page: number
      page_size: number
    },
  ): Promise<{ rows: ProductLite[]; total: number; fuzzy?: boolean }> {
    const strict = await productsRepo.listLite(opts)
    if (strict.total > 0 || !opts.q || !worthFuzzy(opts.q)) return strict

    const ids = await productsRepo.fuzzyIds(opts.q, opts.page_size)
    if (ids.length === 0) return strict

    const rows = await productsRepo.listLiteByIds(ids)
    // Bộ lọc đang bật vẫn phải được tôn trọng — người dùng lọc "khách A" thì kết
    // quả gần đúng cũng chỉ được nằm trong khách A.
    const kept = rows.filter(
      (r) =>
        (opts.is_active == null || r.is_active === opts.is_active) &&
        (opts.customer_name == null ||
          (opts.customer_name === NO_CUSTOMER_FILTER
            ? r.customer_name == null
            : r.customer_name === opts.customer_name)) &&
        (opts.bom_status == null || r.bom_status === opts.bom_status) &&
        (opts.has_image == null || (r.image_file_id != null) === opts.has_image) &&
        (opts.locked == null || (r.locked_at != null) === opts.locked) &&
        (opts.lifecycle == null || r.lifecycle === opts.lifecycle) &&
        (opts.product_type == null || r.product_type === opts.product_type) &&
        (opts.category == null ||
          (opts.category === NO_CATEGORY_FILTER
            ? r.category == null
            : r.category === opts.category)),
    )
    return kept.length > 0 ? { rows: kept, total: kept.length, fuzzy: true } : strict
  },

  /**
   * Ô CHỌN SP ở báo giá/đơn hàng. Thư viện SP đọc mở (`technical.product.view` =
   * PUBLIC) nên không gác quyền — nhưng CÓ giới hạn số dòng, vì đây là đường thay
   * thế cho việc nạp cả 537 SP vào một `<select>`.
   *
   * Giữ nguyên lối chịu-lỗi-gõ của thư viện: khớp chặt ra 0 dòng thì thử gần đúng
   * (`fuzzyIds`), để sale gõ "florez" vẫn ra "Florenz".
   */
  async pick(
    _user: User,
    opts: { q?: string; customer_id?: string; ids?: string[]; limit: number },
  ): Promise<{ rows: ProductPickRow[]; fuzzy?: boolean }> {
    if (opts.ids) return { rows: await productsRepo.listPickByIds(opts.ids) }

    const rows = await productsRepo.listForPick(opts)
    if (rows.length > 0 || !opts.q || !worthFuzzy(opts.q)) return { rows }

    const ids = await productsRepo.fuzzyIds(opts.q, opts.limit)
    if (ids.length === 0) return { rows }
    return { rows: await productsRepo.listPickByIds(ids), fuzzy: true }
  },

  /**
   * Kinh doanh BỔ SUNG thông tin SP còn thiếu ngay trong form báo giá.
   *
   * Cùng tầm quyền với `quickCreate`: sale đã tự khai được đúng các trường này
   * lúc tạo nhanh SP, nên chặn họ điền tiếp cho SP cũ chỉ khiến tờ báo giá in ra
   * trống chỗ quy cách rồi phải chờ Kỹ thuật.
   *
   * `packing` và `tech_spec` GỘP vào bản cũ chứ không ghi đè: payload chỉ chứa
   * mấy ô sale vừa điền, ghi đè cả cục sẽ xoá số Kỹ thuật đã khai. Muốn XOÁ một
   * số thì vào hồ sơ SP bên Kỹ thuật.
   *
   * `tech_spec` + `barcode` thêm 08/2026 cho luồng soạn dòng LSX bổ sung ngược
   * về hồ sơ (lsx-lines.service.fillProductFromLine — chỉ gửi trường hồ sơ
   * đang TRỐNG).
   */
  async fillSpecs(
    user: User,
    id: string,
    input: {
      packing?: ProductPacking
      tech_spec?: ProductTechSpec
      description_en?: string | null
      unit?: string
      customer_item_code?: string | null
      material?: string | null
      hs_code?: string | null
      origin_country?: string | null
      name_foreign?: string | null
      barcode?: string | null
    },
  ): Promise<Product> {
    await assertAction(user, 'technical.product.fill_specs')
    const before = await productsRepo.findById(id)
    if (!before) throw NotFound('Sản phẩm không tồn tại')
    const { packing, tech_spec, ...rest } = input
    return productsRepo.patch(id, {
      ...rest,
      ...(packing ? { packing: { ...(before.packing ?? {}), ...packing } } : {}),
      ...(tech_spec ? { tech_spec: { ...(before.tech_spec ?? {}), ...tech_spec } } : {}),
    })
  },

  /** Nhãn khách/nhóm đã dùng — gợi ý khi gõ ở form + dropdown lọc thư viện. */
  async customerNames() {
    return productsRepo.customerNames()
  },

  /**
   * Số xếp cont 40HC của MỘT TRANG SP (map productId → loading) — thư viện dùng
   * để chấm mục "đóng gói" trên dải hồ sơ. Thư viện SP đọc được cho mọi NV nên
   * không lọc theo user.
   */
  async packingLoading(_user: User, productIds: string[]) {
    return productProfileRepo.packingLoadingByProducts(productIds)
  },

  /**
   * Gợi ý cho MỌI ô gõ tự do của hồ sơ SP (danh mục / ĐVT / chất liệu / máy /
   * nệm / sơn / kính / gỗ / đơn vị đóng gói / khách hàng). Thư viện SP đọc được
   * cho mọi NV nên không lọc theo user.
   */
  async fieldSuggestions(): Promise<Record<string, string[]>> {
    const [byField, customers] = await Promise.all([
      productsRepo.fieldSuggestions(),
      productsRepo.customerNames(),
    ])
    return { ...byField, customer_name: customers.map((c) => c.name) }
  },

  /**
   * TẠO DANH MỤC SP NGAY TRONG FORM HỒ SƠ (13/08/2026 — user: "không thể tuỳ
   * chỉnh loại khách hàng hay tạo khách hàng mới, danh mục cũng vậy").
   *
   * `catalogsService.create` đòi ADMIN vì danh mục dùng chung cả hệ thống. Ở
   * đây mở một cửa HẸP: chỉ loại `product_category`, chỉ người sửa được hồ sơ SP
   * — họ vốn đã gán danh mục cho SP, bắt đi xin admin thêm một nhãn là lý do
   * khiến 528/537 SP bỏ trống ô này. Nhãn trùng thì trả về nhãn cũ chứ không
   * báo lỗi: người dùng đang muốn "có danh mục này", không quan tâm ai tạo trước.
   */
  async createCategory(
    user: User,
    label: string,
  ): Promise<{ code: string; label: string }> {
    await assertAction(user, 'technical.product.update')
    const clean = label.trim()
    if (!clean) throw BadRequest('Nhập tên danh mục')
    if (clean.length > 100) throw BadRequest('Tên danh mục tối đa 100 ký tự')

    // Code là khoá tham chiếu, phải ascii-kebab (catalogCreateSchema) — suy từ
    // nhãn, bỏ dấu tiếng Việt. Nhãn thuần ký tự lạ thì rơi về mã theo thời gian.
    const code =
      normalizeSearch(clean)
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 50) || `dm_${Date.now().toString(36)}`

    const item = await ensureCatalogItem('product_category', code, clean)
    return { code: item.code, label: item.label }
  },

  /** Đếm cho StatsBar (HEAD count) — không kéo toàn bộ dòng. Thư viện SP là tài
   *  sản chung, mọi NV đọc được nên không cần lọc theo user. */
  async stats() {
    return productsRepo.counts()
  },

  /** 1 SP đầy đủ trường (mở form sửa / deep-link từ trang chi tiết). */
  async get(_user: User, id: string): Promise<Product> {
    const product = await productsRepo.findById(id)
    if (!product) throw NotFound('Sản phẩm không tồn tại')
    return product
  },

  /**
   * Cấp mã kế tiếp cho một (loại, vật liệu) — form tạo SP gọi khi người dùng
   * chọn xong hai ô này, thay cho việc tự nghĩ mã.
   *
   * KHÔNG giữ chỗ: mã chỉ thực sự thuộc về SP khi insert thành công. Hai người
   * mở form cùng lúc sẽ nhận cùng một số, người lưu sau bị `create` trả 409
   * CODE_TAKEN và form xin mã mới — đúng hơn là dựng cơ chế đặt chỗ rồi rò rỉ số
   * mỗi lần ai đó mở form xong bỏ đi.
   */
  async nextCode(user: User, type: string, material: string): Promise<string> {
    await assertAction(user, 'technical.product.create')
    const codes = await productsRepo.codesByType(type)
    let serial = nextSerial(codes, type)
    // `nextSerial` đã lấy max của cả loại nên bình thường vòng này chạy đúng 1
    // lượt; nó chỉ nhảy tiếp khi có SP vừa được chèn xen vào giữa 2 truy vấn.
    for (let i = 0; i < 100 && serial <= MAX_SERIAL; i++) {
      const code = buildProductCode(type, serial, material)
      if (!(await productsRepo.existsByCode(code))) return code
      serial++
    }
    throw Conflict(`Không cấp được mã mới cho loại "${type}"`, 'CODE_EXHAUSTED')
  },

  async create(user: User, input: CreateInput): Promise<Product> {
    await assertAction(user, 'technical.product.create')
    if (await productsRepo.existsByCode(input.code)) {
      throw Conflict(`Mã "${input.code}" đã tồn tại`, 'CODE_TAKEN')
    }
    return productsRepo.insert({
      code: input.code,
      name: input.name,
      category: input.category ?? null,
      ...classify(input),
      customer_name: input.customer_name || null,
      customer_item_code: input.customer_item_code ?? null,
      description_en: input.description_en ?? null,
      unit: input.unit ?? 'cai',
      packing: input.packing ?? {},
      notes: input.notes ?? null,
      name_foreign: input.name_foreign ?? null,
      shipping_mark: input.shipping_mark ?? null,
      barcode: input.barcode ?? null,
      showroom_sample: input.showroom_sample ?? false,
      reference_price: input.reference_price ?? null,
      tech_spec: input.tech_spec ?? {},
      hs_code: input.hs_code ?? null,
      origin_country: input.origin_country ?? null,
      material: input.material ?? null,
      max_load_kg: input.max_load_kg ?? null,
      assembly: input.assembly ?? null,
      set_contents: input.set_contents ?? null,
    })
  },

  /**
   * Tạo nhanh SP từ màn Kinh doanh: Kinh doanh (mọi NV Bán hàng) HOẶC Kỹ thuật
   * tạo được. SP mới bom_status='none' — Kỹ thuật bổ sung BOM/thông số sau.
   */
  async quickCreate(
    user: User,
    input: {
      code: string
      name: string
      unit?: string
      customer_id?: string | null
      customer_item_code?: string | null
      description_en?: string | null
      notes?: string | null
      reference_price?: number | null
      packing?: ProductPacking
      material?: string | null
      hs_code?: string | null
      origin_country?: string | null
      name_foreign?: string | null
      shipping_mark?: string | null
      /* Hai trường LSX cần mà trước đây tạo nhanh không khai được (07/08/2026). */
      barcode?: string | null
      tech_spec?: ProductTechSpec
    },
  ): Promise<Product> {
    await assertAction(user, 'technical.product.quick_create')
    if (await productsRepo.existsByCode(input.code)) {
      throw Conflict(`Mã "${input.code}" đã tồn tại`, 'CODE_TAKEN')
    }
    // Đường Kinh doanh vẫn gắn FK khách (form báo giá chia rổ theo customer_id);
    // điền luôn nhãn tương ứng để SP hiện đúng nhóm trong thư viện Kỹ thuật.
    const customer_name = input.customer_id
      ? await productsRepo.customerNameById(input.customer_id)
      : null
    return productsRepo.insert({
      code: input.code,
      name: input.name,
      // Kinh doanh tạo nhanh thì không chọn loại/vật liệu — suy từ mã là đủ.
      ...classify(input),
      unit: input.unit ?? 'cai',
      customer_id: input.customer_id ?? null,
      customer_name,
      customer_item_code: input.customer_item_code ?? null,
      description_en: input.description_en ?? null,
      notes: input.notes ?? null,
      reference_price: input.reference_price ?? null,
      material: input.material ?? null,
      hs_code: input.hs_code ?? null,
      origin_country: input.origin_country ?? null,
      name_foreign: input.name_foreign ?? null,
      shipping_mark: input.shipping_mark ?? null,
      barcode: input.barcode ?? null,
      bom_status: 'none',
      packing: input.packing ?? {},
      tech_spec: input.tech_spec ?? {},
      showroom_sample: false,
    })
  },

  /**
   * Đặt ảnh đại diện SP — dùng sau khi Kinh doanh upload ảnh lúc tạo nhanh SP
   * trong đơn/báo giá. Cho Kinh doanh + Kỹ thuật; ảnh lưu vào hồ sơ SP (in BG/LSX).
   */
  async setMainImage(user: User, productId: string, fileId: string): Promise<Product> {
    await assertAction(user, 'technical.product.set_image')
    const product = await productsRepo.findById(productId)
    if (!product) throw NotFound('Sản phẩm không tồn tại')
    return productsRepo.patch(productId, { image_file_id: fileId })
  },

  async update(user: User, id: string, patch: Partial<Product>): Promise<Product> {
    await assertAction(user, 'technical.product.update')
    const before = await productsRepo.findById(id)
    if (!before) throw NotFound('Sản phẩm không tồn tại')
    assertUnlocked(before)
    return productsRepo.patch(id, patch)
  },

  /*
   * `setBomFile` (chọn file BOM đang dùng, 0140) đã BỎ 13/08/2026 — user bỏ hẳn
   * phần chốt bản BOM ở tab Tài liệu, nên không còn đường gọi. Cột
   * `bom_file_id` vẫn nằm trong DB và trong ảnh chụp phiên bản (0143): dữ liệu
   * cũ giữ nguyên, chỉ là giao diện không đặt/đổi được nữa.
   */

  /**
   * KHOÁ HỒ SƠ (0140): tuyên bố "bản này dùng được, đừng sửa nữa". Khoá TOÀN
   * BỘ hồ sơ — thuộc tính SP, bảng định mức, file đính kèm. Kỹ thuật + Giám
   * đốc (`technical.product.lock`).
   *
   * KHÔNG đòi chọn file BOM trước (user chốt 13/08/2026 — "không cần phức
   * tạp"): khoá là thao tác một nhịp ở trang chi tiết. Chỉ rõ bản BOM đang
   * dùng vẫn làm được ở tab Tài liệu, nhưng là TIỆN ÍCH riêng, không phải
   * điều kiện — hồ sơ chưa kịp chỉ file vẫn chốt được.
   */
  async lock(user: User, id: string, note?: string | null): Promise<Product> {
    await assertAction(user, 'technical.product.lock')
    const before = await productsRepo.findById(id)
    if (!before) throw NotFound('Sản phẩm không tồn tại')
    if (before.locked_at) throw BadRequest('Hồ sơ đã khoá rồi')
    const locked = await productsRepo.patch(id, {
      locked_at: new Date().toISOString(),
      locked_by: user.id,
      lock_note: note?.trim() || null,
    })
    /*
     * KHOÁ = CHỐT MỘT BẢN (0143). Ảnh chụp thuộc tính + định mức tại đúng giây
     * này, kèm danh sách trường đổi so với bản trước — đó là "revision history"
     * mà không bắt ai học thao tác mới.
     *
     * Lỗi ghi lịch sử KHÔNG làm hỏng nhịp khoá: khoá là thứ chặn sửa, phải
     * chắc chắn xảy ra; lịch sử là ghi vết, hỏng thì log rồi đi tiếp.
     */
    try {
      await writeRevision(user, before, 'lock', note?.trim() || null)
    } catch (e) {
      console.error('[products.lock] ghi lịch sử phiên bản lỗi', id, e)
    }
    return locked
  },

  /**
   * MỞ KHOÁ khi phát sinh (user chốt: khoá rồi vẫn mở lại được). Cùng quyền với
   * khoá — người khoá được thì cũng chịu trách nhiệm mở. BẮT lý do: mở khoá là
   * gỡ bản đang được cả xưởng dùng, phải nói vì sao để sau còn truy.
   */
  async unlock(user: User, id: string, reason: string): Promise<Product> {
    await assertAction(user, 'technical.product.lock')
    const before = await productsRepo.findById(id)
    if (!before) throw NotFound('Sản phẩm không tồn tại')
    if (!before.locked_at) throw BadRequest('Hồ sơ đang không khoá')
    if (!reason.trim()) throw BadRequest('Nhập lý do mở khoá')
    const opened = await productsRepo.patch(id, {
      locked_at: null,
      locked_by: null,
      unlocked_at: new Date().toISOString(),
      unlocked_by: user.id,
      unlock_reason: reason.trim(),
    })
    // Mở khoá = một dòng ghi vết trên bản ĐANG chốt (không tăng số bản) — lý do
    // đã bắt nhập từ 0140, giờ nó nằm trong lịch sử chứ không chỉ đè lên cột cũ.
    try {
      await writeRevision(user, before, 'unlock', reason.trim())
    } catch (e) {
      console.error('[products.unlock] ghi lịch sử phiên bản lỗi', id, e)
    }
    return opened
  },

  /** Lịch sử phiên bản của hồ sơ (0143) — thư viện SP đọc mở nên không gác quyền. */
  async revisions(_user: User, id: string): Promise<ProductRevision[]> {
    return productRevisionsRepo.list(id)
  },

  /** Số bản chốt hiện tại (0 = chưa chốt lần nào) — cho badge "Bản #N" ở header. */
  async currentRev(_user: User, id: string): Promise<number> {
    return productRevisionsRepo.maxRev(id)
  },

  /**
   * CẬP NHẬT TRẠNG THÁI HỒ SƠ (0145) — nút "Cập nhật trạng thái" ở trang chi tiết.
   *
   *   Nháp → Đang rà soát → Đã duyệt mẫu → Đang sản xuất → Ngừng dùng
   *
   * Đi tới tự do; ĐI LÙI bắt ghi lý do (khách bắt sửa lại mẫu, hàng ngừng rồi
   * đặt lại — có thật, nhưng phải truy được vì sao).
   *
   * Một nhịp bấm làm ba việc, nên KHÔNG để ai gọi thẳng repo:
   *   1. ghi `lifecycle` + vết ai/khi nào,
   *   2. đồng bộ cờ cũ (`is_active`, `sample_confirmed_*`) — xem `flagsFor`,
   *   3. ghi một dòng lịch sử để tab Lịch sử truy được.
   *
   * KHÔNG `assertUnlocked`: khoá là khoá NỘI DUNG hồ sơ (thuộc tính/định mức/
   * file). Trạng thái là tiến trình — hồ sơ đang khoá vẫn phải chuyển sang
   * "đang sản xuất" hay "ngừng dùng" được mà không cần mở khoá ra.
   */
  async setLifecycle(
    user: User,
    id: string,
    to: Lifecycle,
    reason?: string | null,
  ): Promise<Product> {
    await assertAction(user, 'technical.product.lifecycle')
    const before = await productsRepo.findById(id)
    if (!before) throw NotFound('Sản phẩm không tồn tại')
    const from = before.lifecycle
    if (from === to) throw BadRequest(`Hồ sơ đang ở trạng thái "${LIFECYCLE_LABEL[to]}"`)
    const note = reason?.trim() || null
    if (requiresReason(from, to) && !note) {
      throw BadRequest(
        `Lùi từ "${LIFECYCLE_LABEL[from]}" về "${LIFECYCLE_LABEL[to]}" phải ghi lý do`,
      )
    }

    const now = new Date().toISOString()
    const flags = flagsFor(to)
    const updated = await productsRepo.setLifecycle(id, {
      lifecycle: to,
      lifecycle_at: now,
      lifecycle_by: user.id,
      is_active: flags.is_active,
      // Mốc "chốt mẫu với khách" (0141) nay là hệ quả của trạng thái, không còn
      // nút riêng. Giữ nguyên mốc cũ nếu đã có để khỏi mất ngày đã chốt.
      sample_confirmed_at: flags.sample_confirmed
        ? (before.sample_confirmed_at ?? now)
        : null,
      sample_confirmed_by: flags.sample_confirmed
        ? (before.sample_confirmed_by ?? user.id)
        : null,
      sample_note: flags.sample_confirmed ? (before.sample_note ?? note) : null,
    })

    // Lịch sử: hỏng thì log rồi đi tiếp — trạng thái là thứ phải đổi cho được.
    try {
      await productRevisionsRepo.insert({
        product_id: id,
        rev: Math.max(1, await productRevisionsRepo.maxRev(id)),
        action: 'status',
        reason: note,
        changed_fields: ['lifecycle'],
        fields_snapshot: { from, to },
        created_by: user.id,
      })
    } catch (e) {
      console.error('[products.setLifecycle] ghi lịch sử lỗi', id, e)
    }
    return updated
  },

  /**
   * Tái sử dụng mẫu (FR-ENG-02): nhân bản SP cũ (thuộc tính + BOM) thành SP mới,
   * thường để gắn cho khách khác. BOM copy nguyên trạng, cờ giữ theo SP gốc nếu
   * có BOM, ngược lại 'none'.
   */
  async clone(
    user: User,
    sourceId: string,
    input: {
      code: string
      name?: string
      customer_name?: string | null
      customer_item_code?: string | null
    },
  ): Promise<Product> {
    await assertAction(user, 'technical.product.clone')
    const src = await productsRepo.findById(sourceId)
    if (!src) throw NotFound('Sản phẩm gốc không tồn tại')
    if (await productsRepo.existsByCode(input.code)) {
      throw Conflict(`Mã "${input.code}" đã tồn tại`, 'CODE_TAKEN')
    }

    const created = await productsRepo.insert({
      code: input.code,
      name: input.name ?? src.name,
      category: src.category,
      // Nhân bản để gắn cho khách khác: chưa gõ nhãn mới thì giữ nhãn mẫu gốc.
      // customer_id KHÔNG copy — FK đó là của Kinh doanh, mẫu mới chưa thuộc khách nào.
      customer_name:
        input.customer_name === undefined
          ? src.customer_name
          : input.customer_name || null,
      customer_item_code: input.customer_item_code ?? null,
      description_en: src.description_en,
      unit: src.unit,
      packing: src.packing,
      notes: src.notes,
      // Copy thông số kỹ thuật; barcode KHÔNG copy (mỗi SP một barcode riêng).
      name_foreign: src.name_foreign,
      shipping_mark: src.shipping_mark,
      barcode: null,
      showroom_sample: src.showroom_sample,
      reference_price: src.reference_price,
      tech_spec: src.tech_spec,
      // Đặc tính XK theo mẫu gốc — cùng thiết kế thì cùng chất liệu/tải trọng.
      hs_code: src.hs_code,
      origin_country: src.origin_country,
      material: src.material,
      max_load_kg: src.max_load_kg,
      assembly: src.assembly,
      set_contents: src.set_contents,
    })
    // Chép định mức chi tiết (0096: chỉ còn một loại định mức duy nhất —
    // technical_product_parts). SP mới chưa có dòng nào nên chép thẳng vào.
    const srcParts = await productProfileRepo.parts(src.id)
    const copied = srcParts.length
      ? await productProfileRepo.insertParts(
          buildCopiedParts(srcParts as unknown as Record<string, unknown>[], {
            productId: created.id,
          }),
        )
      : 0
    if (copied > 0 && src.bom_status !== 'none') {
      return productsRepo.patch(created.id, { bom_status: src.bom_status })
    }
    return created
  },

  /**
   * Tab Hồ sơ / Đóng gói / Thông số: SP + phương án đóng gói (nhẹ, ≤ vài kiện).
   * KHÔNG kéo định mức (có SP tới 145 dòng) — tab Định mức lo riêng. Trên
   * đường tải của cả 3 tab nên chạy song song thay vì chờ product xong mới
   * hỏi packing (packing không phụ thuộc kết quả product, chỉ cần productId).
   */
  async getProfileInfo(user: User, productId: string) {
    // `bomRows` là ĐẾM dòng định mức thật trong app — cố tình tách khỏi cột
    // `product.part_count` (số người nhập đã tính sẵn trong file Excel). Hai số
    // này lệch nhau ở hầu hết SP (325 SP có part_count, 4 SP có dòng thật), nên
    // hồ sơ phải nói rõ đang khoe số nào; xem băng "Kích thước & khối lượng".
    const [product, packing, bomRows] = await Promise.all([
      productsRepo.findById(productId),
      productProfileRepo.packingOptions(productId),
      productProfileRepo.partsCount(productId),
    ])
    if (!product) throw NotFound('Sản phẩm không tồn tại')
    // Tên người phụ trách cho khối "Hồ sơ" của tab Thông số (thay khối ISO đã
    // bỏ 18/08/2026 — chỉ ghi nhận người tạo theo phiên đăng nhập + ngày tạo).
    const ownerName = product.owner_id
      ? ((await usersRepo.displayNamesByIds([product.owner_id])).get(product.owner_id) ??
        null)
      : null
    return { product, packing, bomRows, ownerName }
  },

  /** Tab Định mức: định mức + món trong bộ + danh mục nhóm. */
  async getPartsInfo(user: User, productId: string) {
    const product = await productsRepo.findById(productId)
    if (!product) throw NotFound('Sản phẩm không tồn tại')
    const [parts, setItems, groups, clusters] = await Promise.all([
      productProfileRepo.parts(productId),
      productProfileRepo.setItems(productId),
      partGroupsRepo.list(),
      productProfileRepo.clusters(productId),
    ])
    // KHÔNG còn tra `knownMaterialNames`: ô "Mã VT kho" đã gỡ khỏi màn định mức
    // (19/08/2026) nên không có gì để gắn cờ, mà mỗi lần mở tab lại bắn thêm một
    // truy vấn sang danh mục kho.
    return { product, parts, setItems, groups, clusters }
  },

  /**
   * Hồ sơ sản phẩm đầy đủ (0092): định mức tự mô tả + món trong bộ + các phương
   * án đóng gói. Ba truy vấn chạy song song vì độc lập nhau.
   */
  async getProfile(user: User, productId: string) {
    const product = await productsRepo.findById(productId)
    if (!product) throw NotFound('Sản phẩm không tồn tại')
    const [parts, setItems, packing, groups, clusters] = await Promise.all([
      productProfileRepo.parts(productId),
      productProfileRepo.setItems(productId),
      productProfileRepo.packingOptions(productId),
      partGroupsRepo.list(),
      productProfileRepo.clusters(productId),
    ])
    return { product, parts, setItems, packing, groups, clusters }
  },

  /**
   * Bóc tách / cập nhật BOM (FR-ENG-04): Kỹ thuật + Sales (manager/admin).
   * Ghi đè trọn bộ dòng; nếu SP đang 'none' và BOM có dòng → tự nâng cờ 'drawing'
   * (bước 'done' vẫn do người dùng xác nhận tay — BR-03).
   */
  /**
   * Thêm / sửa / xoá TỪNG DÒNG định mức của hồ sơ sản phẩm (0092) — sửa nhỏ tại
   * chỗ thay vì ghi đè trọn bộ như `saveBom`. Dùng chung quyền `technical.bom.save`.
   *
   * Cờ `bom_status` tự nâng khi sản phẩm có dòng đầu tiên và tự hạ khi hết dòng,
   * để thư viện không còn cảnh "59 dòng định mức mà vẫn hiện Chưa có BOM".
   */
  async addPart(user: User, productId: string, input: PartInput) {
    await assertAction(user, 'technical.bom.save')
    await assertProductUnlocked(productId)
    const product = await productsRepo.findById(productId)
    if (!product) throw NotFound('Sản phẩm không tồn tại')
    const sort_order =
      input.sort_order ?? (await productProfileRepo.nextSortOrder(productId))
    const row = await resolveLine(productId, input)
    const part = await productProfileRepo.insertPart(productId, {
      ...(row as Partial<ProductPart>),
      part_name: input.part_name,
      // `undefined` (client không gửi ô SL) và null (gửi ô rỗng) cùng nghĩa "chưa
      // có SL" từ 0163 — nắn về null để khớp kiểu cột.
      qty: input.qty ?? null,
      group_code: input.group_code,
      sort_order,
      updated_by: user.id,
    })
    if (product.bom_status === 'none') {
      await productsRepo.patch(productId, { bom_status: 'done' })
    }
    return part
  },

  async updatePart(user: User, productId: string, partId: string, patch: PartPatch) {
    await assertAction(user, 'technical.bom.save')
    await assertProductUnlocked(productId)
    const base = await productProfileRepo.findPart(productId, partId)
    if (!base) throw NotFound('Dòng định mức không tồn tại')
    const row = await resolveLine(productId, patch, base)
    const part = await productProfileRepo.patchPart(productId, partId, {
      ...row,
      updated_by: user.id,
    })
    if (!part) throw NotFound('Dòng định mức không tồn tại')
    return part
  },

  // ── CỤM ────────────────────────────────────────────────────────────────────

  async listClusters(user: User, productId: string) {
    return productProfileRepo.clusters(productId)
  },

  async addCluster(user: User, productId: string, input: ClusterInput) {
    await assertAction(user, 'technical.bom.save')
    const product = await productsRepo.findById(productId)
    if (!product) throw NotFound('Sản phẩm không tồn tại')
    const cluster = await productProfileRepo.ensureCluster(productId, input.name)
    // `ensureCluster` chỉ đặt tên — các số của cụm (SL cụm/SP, lộ trình) đi tiếp
    // qua patch để "gõ tên mới" và "khai đầy đủ" dùng chung một đường.
    const rest = { ...input, name: undefined }
    return (await productProfileRepo.patchCluster(productId, cluster.id, rest)) ?? cluster
  },

  async updateCluster(
    user: User,
    productId: string,
    clusterId: string,
    patch: ClusterPatch,
  ) {
    await assertAction(user, 'technical.bom.save')
    await assertProductUnlocked(productId)
    const cluster = await productProfileRepo.patchCluster(productId, clusterId, patch)
    if (!cluster) throw NotFound('Cụm không tồn tại')
    return cluster
  },

  /** Xoá cụm — các dòng của nó về RỜI (`on delete set null`), không mất dòng nào. */
  async removeCluster(user: User, productId: string, clusterId: string) {
    await assertAction(user, 'technical.bom.save')
    await assertProductUnlocked(productId)
    const ok = await productProfileRepo.deleteCluster(productId, clusterId)
    if (!ok) throw NotFound('Cụm không tồn tại')
    return { ok: true }
  },

  /** "Gom thành cụm…" — chọn nhiều dòng rồi gán một lượt. */
  async assignCluster(
    user: User,
    productId: string,
    input: { part_ids: string[]; cluster_id?: string | null; cluster_name?: string },
  ) {
    await assertAction(user, 'technical.bom.save')
    await assertProductUnlocked(productId)
    const product = await productsRepo.findById(productId)
    if (!product) throw NotFound('Sản phẩm không tồn tại')

    let clusterId: string | null = input.cluster_id ?? null
    if (input.cluster_name) {
      clusterId = (await productProfileRepo.ensureCluster(productId, input.cluster_name))
        .id
    }
    const moved = await productProfileRepo.assignCluster(
      productId,
      input.part_ids,
      clusterId,
    )
    return { moved, cluster_id: clusterId }
  },

  /**
   * "Xác nhận Phôi" — cột có sẵn trong biểu mẫu, quyền của XƯỞNG chứ không phải
   * Kỹ thuật. Tick được cả khi hồ sơ đã chốt vì nó không đụng số liệu định mức:
   * chỉ ghi nhận "phôi cắt ra đúng như dòng này".
   */
  async setBlankConfirmed(
    user: User,
    productId: string,
    partId: string,
    confirmed: boolean,
  ) {
    await assertAction(user, 'production.component.save')
    const part = await productProfileRepo.patchPart(productId, partId, {
      blank_confirmed_at: confirmed ? new Date().toISOString() : null,
      blank_confirmed_by: confirmed ? user.id : null,
    })
    if (!part) throw NotFound('Dòng định mức không tồn tại')
    return part
  },

  async removePart(user: User, productId: string, partId: string) {
    await assertAction(user, 'technical.bom.save')
    await assertProductUnlocked(productId)
    const ok = await productProfileRepo.deletePart(productId, partId)
    if (!ok) throw NotFound('Dòng định mức không tồn tại')
    const left = await productProfileRepo.parts(productId)
    if (left.length === 0) {
      const product = await productsRepo.findById(productId)
      if (product && product.bom_status !== 'none') {
        await productsRepo.patch(productId, { bom_status: 'none' })
      }
    }
    return { ok: true }
  },

  /**
   * Nhập nhiều dòng định mức một lượt. Khối / đơn vị tính / nhóm / món khai một
   * lần rồi áp cho cả lô.
   *
   * Đại lượng dẫn xuất (tổng dài, kg, m² sơn) tính LẠI Ở SERVER thay vì tin số
   * client gửi — client có thể gửi thiếu, mà báo cáo khối lượng khung lại đọc
   * thẳng các cột này. Khối lượng người dùng nhập tay thì được giữ.
   */
  async addParts(
    user: User,
    productId: string,
    input: {
      group_code: string
      section_title?: string | null
      unit_basis?: string | null
      lines: Record<string, unknown>[]
    },
  ) {
    await assertAction(user, 'technical.bom.save')
    await assertProductUnlocked(productId)
    const product = await productsRepo.findById(productId)
    if (!product) throw NotFound('Sản phẩm không tồn tại')

    // Cột `Parts/ Bộ phận` dán từ Excel lặp lại tên cụm trên MỌI dòng của cụm đó
    // (file mẫu: "Cụm khung" ×4 dòng). Giải một lượt theo tên duy nhất — 2 cụm
    // thay vì 10 lượt gọi DB.
    const names = [
      ...new Set(
        input.lines
          .map((l) => String(l.cluster_name ?? '').trim())
          .filter((s) => s.length > 0),
      ),
    ]
    const clusterIds = new Map<string, string>()
    for (const name of names) {
      clusterIds.set(name, (await productProfileRepo.ensureCluster(productId, name)).id)
    }

    let order = await productProfileRepo.nextSortOrder(productId)
    const rows = input.lines.map((l) => {
      const { cluster_name, ...rest } = l
      const geo = {
        profile_shape: (l.profile_shape as string | null) ?? null,
        material_kind: (l.material_kind as string | null) ?? null,
        dim_a_mm: (l.dim_a_mm as number | null) ?? null,
        dim_b_mm: (l.dim_b_mm as number | null) ?? null,
        wall_thickness_mm: (l.wall_thickness_mm as number | null) ?? null,
        cut_length_mm: (l.cut_length_mm as number | null) ?? null,
        bend_waste_mm: (l.bend_waste_mm as number | null) ?? null,
        tenon_mm: (l.tenon_mm as number | null) ?? null,
        kg_per_m: (l.kg_per_m as number | null) ?? null,
        qty: (l.qty as number | null) ?? null,
      }
      const d = calcPartDerived(geo)
      return {
        ...rest,
        product_id: productId,
        group_code: input.group_code,
        section_title: input.section_title ?? null,
        unit_basis: input.unit_basis ?? null,
        cluster_id: clusterIds.get(String(cluster_name ?? '').trim()) ?? null,
        weight_kg: (l.weight_kg as number | null) ?? d.weight_kg,
        total_length_m: d.total_length_m,
        paint_area_m2: d.paint_area_m2,
        paint_area_box_m2: d.paint_area_box_m2,
        volume_m3: d.volume_m3,
        updated_by: user.id,
        sort_order: order++,
      }
    })

    const added = await productProfileRepo.insertParts(rows)
    if (added > 0 && product.bom_status === 'none')
      await productsRepo.patch(productId, { bom_status: 'done' })
    return { added }
  },

  /**
   * Chép định mức từ sản phẩm khác — lối dựng định mức mới hay dùng nhất (ghế
   * biến thể chỉ khác vài dòng). 'replace' xoá sạch định mức đích trước khi chép.
   */
  async copyPartsFrom(
    user: User,
    targetId: string,
    input: { source_product_id: string; mode: 'append' | 'replace'; groups?: string[] },
  ) {
    await assertAction(user, 'technical.bom.save')
    // Chép ĐÈ lên hồ sơ đích — hồ sơ đích khoá thì chặn (nguồn khoá không sao).
    await assertProductUnlocked(targetId)
    if (input.source_product_id === targetId)
      throw BadRequest('Không thể chép định mức từ chính sản phẩm đó')

    const [target, source] = await Promise.all([
      productsRepo.findById(targetId),
      productsRepo.findById(input.source_product_id),
    ])
    if (!target) throw NotFound('Sản phẩm đích không tồn tại')
    if (!source) throw NotFound('Sản phẩm nguồn không tồn tại')

    const srcParts = await productProfileRepo.parts(input.source_product_id)
    if (srcParts.length === 0)
      throw BadRequest(`Sản phẩm ${source.code} chưa có định mức để chép`)

    let removed = 0
    if (input.mode === 'replace')
      removed = await productProfileRepo.deleteAllParts(targetId)

    // Dựng lại CỤM bên SP đích trước khi chép dòng: cụm là bản ghi riêng của mỗi
    // SP, chép thẳng `cluster_id` sang thì dòng của SP đích trỏ vào cụm SP nguồn.
    const srcClusters = await productProfileRepo.clusters(input.source_product_id)
    const clusterMap = new Map<string, string>()
    for (const c of srcClusters) {
      const dest = await productProfileRepo.ensureCluster(targetId, c.name)
      await productProfileRepo.patchCluster(targetId, dest.id, {
        qty_per_product: c.qty_per_product,
        first_stage: c.first_stage,
        final_stage: c.final_stage,
      })
      clusterMap.set(c.id, dest.id)
    }

    const startOrder =
      input.mode === 'replace' ? 1 : await productProfileRepo.nextSortOrder(targetId)
    const rows = buildCopiedParts(srcParts as unknown as Record<string, unknown>[], {
      productId: targetId,
      startOrder,
      groups: input.groups,
      clusterMap,
    })
    const added = await productProfileRepo.insertParts(rows)

    if (added > 0 && target.bom_status === 'none')
      await productsRepo.patch(targetId, { bom_status: 'done' })

    return { added, removed, source_code: source.code }
  },

  // `saveBom` (ghi đè trọn bộ BOM cũ) ĐÃ BỎ ở 0096. Định mức giờ chỉ sửa theo
  // TỪNG DÒNG (addPart/patchPart/removePart) — giữ lại lối "xoá sạch rồi ghi
  // lại" là để ngỏ khả năng một cú lưu quét bay toàn bộ quy cách, tiết diện,
  // chiều dài cắt của sản phẩm. Chép hàng loạt dùng `copyPartsFrom`.

  async remove(user: User, id: string): Promise<void> {
    await assertAction(user, 'technical.product.remove')
    const before = await productsRepo.findById(id)
    if (!before) throw NotFound()

    // FK restrict (báo giá/đơn hàng 0013, mẫu 0061) chặn xoá ở DB — báo rõ
    // thay vì văng 500, và chỉ đường "Ngừng dùng" (ẩn khỏi danh mục, giữ
    // nguyên chứng từ cũ). Ảnh/hồ sơ (set null) và BOM (cascade) không chặn.
    const refs = await productsRepo.referenceCounts(id)
    const parts = [
      refs.quotes > 0 ? `${refs.quotes} dòng báo giá` : null,
      refs.orders > 0 ? `${refs.orders} dòng đơn hàng` : null,
      refs.samples > 0 ? `${refs.samples} mẫu showroom` : null,
    ].filter(Boolean)
    if (parts.length > 0) {
      throw Conflict(
        `Không xoá được "${before.code}" — SP đang nằm trong ${parts.join(', ')}. ` +
          'Hãy dùng "Ngừng dùng" để ẩn khỏi danh mục (chứng từ cũ giữ nguyên).',
      )
    }

    const { blocked } = await productsRepo.delete(id)
    if (blocked) {
      // Lưới an toàn: tham chiếu mới chen vào giữa lúc kiểm tra và xoá.
      throw Conflict(
        `Không xoá được "${before.code}" — SP vừa được chứng từ khác tham chiếu. Dùng "Ngừng dùng" để ẩn.`,
      )
    }
  },
}

export {
  isTechnicalStaff,
  canEditProducts,
  canCreateProducts,
  canEditBom,
  canLockProducts,
  canSetLifecycle,
}
