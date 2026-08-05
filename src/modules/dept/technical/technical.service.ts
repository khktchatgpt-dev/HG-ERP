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
import type {
  BomStatus,
  ProductPartInput as PartInput,
  ProductPartPatch as PartPatch,
  ProductClusterInput as ClusterInput,
  ProductClusterPatch as ClusterPatch,
} from './technical.schema'
import type { User } from '@/modules/core/users/users.repo'
import { hasPermission, assertAction, canAction } from '@/modules/core/rbac/rbac.service'
import { BadRequest, Conflict, NotFound } from '@/server/http'
import { buildCopiedParts } from '@/lib/bom-copy'
import { calcPartDerived } from '@/lib/bom-calc'
import { worthFuzzy } from '@/lib/search-text'
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
 * Cờ SỬA cho giao diện Kỹ thuật. Trước đây mỗi trang tự tính
 * `user.role === 'admin' || 'manager'` — NV phòng Kỹ thuật (role `employee`,
 * vai dẫn xuất `technical_staff`) vào được nhưng KHÔNG thấy nút nào, dù guard
 * server đã cho phép. Đọc thẳng registry thao tác để UI và guard cùng nguồn.
 */
async function canEditProducts(user: User): Promise<boolean> {
  return canAction(user, 'technical.product.update')
}

async function canCreateProducts(user: User): Promise<boolean> {
  return canAction(user, 'technical.product.create')
}

/** Bóc tách / sửa BOM — luật riêng (`technical.bom.edit` VÀ `technical.edit`). */
async function canEditBom(user: User): Promise<boolean> {
  return canAction(user, 'technical.bom.save')
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
   * `packing` GỘP vào bản cũ chứ không ghi đè: payload chỉ chứa mấy ô sale vừa
   * điền, ghi đè cả cục sẽ xoá số Kỹ thuật đã khai. Muốn XOÁ một số thì vào hồ sơ
   * SP bên Kỹ thuật.
   */
  async fillSpecs(
    user: User,
    id: string,
    input: {
      packing?: ProductPacking
      description_en?: string | null
      unit?: string
      customer_item_code?: string | null
      material?: string | null
      hs_code?: string | null
      origin_country?: string | null
      name_foreign?: string | null
    },
  ): Promise<Product> {
    await assertAction(user, 'technical.product.fill_specs')
    const before = await productsRepo.findById(id)
    if (!before) throw NotFound('Sản phẩm không tồn tại')
    const { packing, ...rest } = input
    return productsRepo.patch(id, {
      ...rest,
      ...(packing ? { packing: { ...(before.packing ?? {}), ...packing } } : {}),
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
      bom_status: 'none',
      packing: input.packing ?? {},
      tech_spec: {},
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
    return productsRepo.patch(id, patch)
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
    return { product, packing, bomRows }
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
    const product = await productsRepo.findById(productId)
    if (!product) throw NotFound('Sản phẩm không tồn tại')
    const sort_order =
      input.sort_order ?? (await productProfileRepo.nextSortOrder(productId))
    const row = await resolveLine(productId, input)
    const part = await productProfileRepo.insertPart(productId, {
      ...(row as Partial<ProductPart>),
      part_name: input.part_name,
      qty: input.qty,
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
    const cluster = await productProfileRepo.patchCluster(productId, clusterId, patch)
    if (!cluster) throw NotFound('Cụm không tồn tại')
    return cluster
  },

  /** Xoá cụm — các dòng của nó về RỜI (`on delete set null`), không mất dòng nào. */
  async removeCluster(user: User, productId: string, clusterId: string) {
    await assertAction(user, 'technical.bom.save')
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

export { isTechnicalStaff, canEditProducts, canCreateProducts, canEditBom }
