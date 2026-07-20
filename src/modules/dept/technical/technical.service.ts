import {
  bomLinesRepo,
  productsRepo,
  type Product,
  type ProductPacking,
  type ProductTechSpec,
} from './technical.repo'
import type { BomStatus } from './technical.schema'
import { departmentsRepo } from '@/modules/core/departments/departments.repo'
import type { User } from '@/modules/core/users/users.repo'
import { isSalesUser } from '@/modules/dept/sales/sales.service'
import { Conflict, Forbidden, NotFound } from '@/server/http'

const TECH_DEPT_NAME = 'Kỹ Thuật'
const SALES_DEPT_NAME = 'Bán Hàng'

async function isTechnicalStaff(user: User): Promise<boolean> {
  if (user.role === 'admin') return true
  if (!user.department_id) return false
  const dept = await departmentsRepo.findById(user.department_id)
  return dept?.name === TECH_DEPT_NAME
}

/** Kỹ thuật + Sales cùng bóc tách/cập nhật BOM (FR-ENG-04). */
async function isTechnicalOrSales(user: User): Promise<boolean> {
  if (user.role === 'admin') return true
  if (!user.department_id) return false
  const dept = await departmentsRepo.findById(user.department_id)
  return dept?.name === TECH_DEPT_NAME || dept?.name === SALES_DEPT_NAME
}

function canEdit(user: User): boolean {
  // Sửa thư viện SP: KT manager hoặc admin (NV xem read-only)
  return user.role === 'admin' || user.role === 'manager'
}

type CreateInput = {
  code: string
  name: string
  category?: string | null
  customer_id?: string | null
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
      customer_id?: string
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
      customer_id: opts.customer_id,
      bom_status: opts.bom_status,
      active_only: opts.active_only ?? true,
      page: opts.page,
      page_size: opts.page_size,
    })
  },

  /** Danh sách nhẹ (thư viện) — lọc/tìm/phân trang phía server, cột tối thiểu. */
  async listLite(
    _user: User,
    opts: {
      q?: string
      customer_id?: string
      bom_status?: BomStatus
      is_active?: boolean
      page: number
      page_size: number
    },
  ) {
    return productsRepo.listLite(opts)
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

  async create(user: User, input: CreateInput): Promise<Product> {
    if (!(await isTechnicalStaff(user)) || !canEdit(user)) {
      throw Forbidden('Chỉ Kỹ thuật / Admin tạo được sản phẩm')
    }
    if (await productsRepo.existsByCode(input.code)) {
      throw Conflict(`Mã "${input.code}" đã tồn tại`, 'CODE_TAKEN')
    }
    return productsRepo.insert({
      code: input.code,
      name: input.name,
      category: input.category ?? null,
      customer_id: input.customer_id ?? null,
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
    const allowed =
      (await isSalesUser(user)) || ((await isTechnicalStaff(user)) && canEdit(user))
    if (!allowed) throw Forbidden('Chỉ Kinh doanh / Kỹ thuật tạo được sản phẩm')
    if (await productsRepo.existsByCode(input.code)) {
      throw Conflict(`Mã "${input.code}" đã tồn tại`, 'CODE_TAKEN')
    }
    return productsRepo.insert({
      code: input.code,
      name: input.name,
      unit: input.unit ?? 'cai',
      customer_id: input.customer_id ?? null,
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
    const allowed =
      (await isSalesUser(user)) || ((await isTechnicalStaff(user)) && canEdit(user))
    if (!allowed) throw Forbidden('Chỉ Kinh doanh / Kỹ thuật cập nhật ảnh sản phẩm')
    const product = await productsRepo.findById(productId)
    if (!product) throw NotFound('Sản phẩm không tồn tại')
    return productsRepo.patch(productId, { image_file_id: fileId })
  },

  async update(user: User, id: string, patch: Partial<Product>): Promise<Product> {
    if (!(await isTechnicalStaff(user)) || !canEdit(user)) throw Forbidden()
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
      customer_id?: string | null
      customer_item_code?: string | null
    },
  ): Promise<Product> {
    if (!(await isTechnicalStaff(user)) || !canEdit(user)) {
      throw Forbidden('Chỉ Kỹ thuật / Admin nhân bản được sản phẩm')
    }
    const src = await productsRepo.findById(sourceId)
    if (!src) throw NotFound('Sản phẩm gốc không tồn tại')
    if (await productsRepo.existsByCode(input.code)) {
      throw Conflict(`Mã "${input.code}" đã tồn tại`, 'CODE_TAKEN')
    }

    const created = await productsRepo.insert({
      code: input.code,
      name: input.name ?? src.name,
      category: src.category,
      customer_id: input.customer_id === undefined ? src.customer_id : input.customer_id,
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
    const copied = await bomLinesRepo.copyAll(src.id, created.id)
    if (copied > 0 && src.bom_status !== 'none') {
      return productsRepo.patch(created.id, { bom_status: src.bom_status })
    }
    return created
  },

  /** Đọc BOM: mọi NV xem được (các phòng đọc trạng thái/định mức — đặc tả 4.2). */
  async getBom(user: User, productId: string) {
    const product = await productsRepo.findById(productId)
    if (!product) throw NotFound('Sản phẩm không tồn tại')
    const lines = await bomLinesRepo.listWithMaterials(productId)
    return { product, lines }
  },

  /**
   * Bóc tách / cập nhật BOM (FR-ENG-04): Kỹ thuật + Sales (manager/admin).
   * Ghi đè trọn bộ dòng; nếu SP đang 'none' và BOM có dòng → tự nâng cờ 'drawing'
   * (bước 'done' vẫn do người dùng xác nhận tay — BR-03).
   */
  async saveBom(
    user: User,
    productId: string,
    lines: { material_id: string; qty_per_unit: number; note?: string | null }[],
  ) {
    if (!(await isTechnicalOrSales(user)) || !canEdit(user)) {
      throw Forbidden('Chỉ Kỹ thuật / Kinh doanh (quản lý) cập nhật được BOM')
    }
    const product = await productsRepo.findById(productId)
    if (!product) throw NotFound('Sản phẩm không tồn tại')

    await bomLinesRepo.replaceAll(productId, lines)

    if (product.bom_status === 'none' && lines.length > 0) {
      await productsRepo.patch(productId, { bom_status: 'drawing' })
    }
    return bomLinesRepo.listWithMaterials(productId)
  },

  async remove(user: User, id: string): Promise<void> {
    if (!(await isTechnicalStaff(user)) || !canEdit(user)) throw Forbidden()
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

export { isTechnicalStaff, isTechnicalOrSales }
