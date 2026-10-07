import { BadRequest, Conflict } from '@/server/http'
import { assertAction } from '@/modules/core/rbac/rbac.service'
import type { User } from '@/modules/core/users/users.repo'
import { planImport, type ImportPlan } from '@/lib/product-import'
import { productsRepo } from './technical.repo'
import {
  ImportFileError,
  buildImportTemplate,
  fillCodes,
  readImportRows,
} from './product-import-workbook'

/**
 * THÊM SẢN PHẨM HÀNG LOẠT BẰNG EXCEL (07/10/2026). Luật ở `lib/product-import`,
 * đọc/ghi file ở `product-import-workbook`; đây chỉ gác quyền + nối DB.
 *
 * Cùng quyền với nút "Thêm sản phẩm" (`technical.product.create`).
 */

export type ImportPreview = ImportPlan & { sheet: string; blank: number }

async function plan(buffer: Buffer): Promise<ImportPreview> {
  let read
  try {
    read = await readImportRows(buffer)
  } catch (e) {
    if (e instanceof ImportFileError) throw BadRequest(e.message)
    throw e
  }
  const existing = await productsRepo.importIndex()
  return { ...planImport(read.rows, existing), sheet: read.sheet, blank: read.blank }
}

export const productImportService = {
  /** File mẫu — nhãn khách đang dùng đổ vào danh sách gợi ý, đông SP đứng trước. */
  async template(user: User): Promise<Buffer> {
    await assertAction(user, 'technical.product.create')
    const names = await productsRepo.customerNames()
    const labels = [...names].sort((a, b) => b.count - a.count).map((n) => n.name)
    return buildImportTemplate(labels)
  },

  /** Soi trước — KHÔNG ghi gì. */
  async preview(user: User, buffer: Buffer): Promise<ImportPreview> {
    await assertAction(user, 'technical.product.create')
    return plan(buffer)
  },

  /**
   * Thêm cả lô. Tính LẠI từ file ngay lúc bấm (người khác có thể vừa thêm SP,
   * mã cấp có thể khác bản soi) — không nhận kết quả soi từ client. Còn dòng lỗi
   * thì không thêm dòng nào.
   */
  async commit(
    user: User,
    buffer: Buffer,
  ): Promise<{ created: { row: number; code: string; id: string }[]; file: string }> {
    await assertAction(user, 'technical.product.create')
    const p = await plan(buffer)
    if (p.counts.error > 0) {
      const rows = p.rows.filter((r) => r.status === 'error').map((r) => r.row)
      throw BadRequest(
        `Còn ${rows.length} dòng lỗi (dòng ${rows.slice(0, 8).join(', ')}${rows.length > 8 ? '…' : ''}) — sửa trong file rồi tải lại`,
      )
    }
    if (p.rows.length === 0) throw BadRequest('File không có dòng sản phẩm nào')

    let inserted: { id: string; code: string }[]
    try {
      inserted = await productsRepo.insertMany(
        p.rows.map((r) => ({
          // Người LẬP + người phụ trách = người tải file, như form tạo SP (0179).
          created_by: user.id,
          owner_id: user.id,
          code: r.code!,
          name: r.name,
          product_type: r.type,
          frame_material: r.material,
          customer_name: r.customer,
          name_foreign: r.name_foreign,
          unit: r.unit,
          packing: {},
          tech_spec: {},
          showroom_sample: false,
        })),
      )
    } catch (e) {
      if (e instanceof Error && e.message === 'CODE_TAKEN') {
        throw Conflict(
          'Có người vừa thêm SP trùng mã trong lúc anh/chị soi — tải lại file để soi lại',
          'CODE_TAKEN',
        )
      }
      throw e
    }

    const idByCode = new Map(inserted.map((x) => [x.code, x.id]))
    const created = p.rows.map((r) => ({ row: r.row, code: r.code!, id: idByCode.get(r.code!) ?? '' })) // prettier-ignore
    const filled = await fillCodes(buffer, created)
    return { created, file: filled.toString('base64') }
  },
}
