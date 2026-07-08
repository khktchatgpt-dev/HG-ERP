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
  drawing_url?: string | null
  bom_url?: string | null
  notes?: string | null
  name_de?: string | null
  shipping_mark?: string | null
  barcode?: string | null
  showroom_sample?: boolean
  reference_price?: number | null
  tech_spec?: ProductTechSpec
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
      drawing_url: input.drawing_url || null,
      bom_url: input.bom_url || null,
      notes: input.notes ?? null,
      name_de: input.name_de ?? null,
      shipping_mark: input.shipping_mark ?? null,
      barcode: input.barcode ?? null,
      showroom_sample: input.showroom_sample ?? false,
      reference_price: input.reference_price ?? null,
      tech_spec: input.tech_spec ?? {},
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
      bom_status: 'none',
      packing: {},
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
      drawing_url: src.drawing_url,
      bom_url: src.bom_url,
      notes: src.notes,
      // Copy thông số kỹ thuật; barcode KHÔNG copy (mỗi SP một barcode riêng).
      name_de: src.name_de,
      shipping_mark: src.shipping_mark,
      barcode: null,
      showroom_sample: src.showroom_sample,
      reference_price: src.reference_price,
      tech_spec: src.tech_spec,
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
    await productsRepo.delete(id)
  },
}

export { isTechnicalStaff, isTechnicalOrSales }
