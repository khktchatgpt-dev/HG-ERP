import { randomUUID } from 'node:crypto'
import { BadRequest, Conflict, Forbidden } from '@/server/http'
import { assertAction, canAction } from '@/modules/core/rbac/rbac.service'
import type { User } from '@/modules/core/users/users.repo'
import { storage } from '@/modules/core/files/storage'
import { isLifecycle, type Lifecycle } from '@/lib/product-lifecycle'
import { PRODUCT_TYPE_CODES } from '@/lib/product-code'
import {
  planImport,
  type ImportPlan,
  type PlannedRow,
  type RawRow,
} from '@/lib/product-import'
import { productsRepo } from './technical.repo'
import { productsService } from './technical.service'
import type { BomStatus } from './technical.schema'
import { ImportFileError, buildProductWorkbook, fillWritten, readImportRows } from './product-import-workbook' // prettier-ignore

/**
 * THÊM + CẬP NHẬT SẢN PHẨM BẰNG EXCEL (07/10/2026, B1 của bản vẽ vòng 2). Luật ở
 * `lib/product-import`, đọc/ghi file ở `product-import-workbook`; đây chỉ gác
 * quyền + nối DB + Storage.
 *
 * FILE ĐI THẲNG LÊN STORAGE: Vercel cắt thân request ở ~4,5 MB, file kèm ảnh (B2)
 * vượt ngay. Trình duyệt PUT file vào `private/imports/products/<user>/…` bằng URL
 * ký; mọi bước sau chỉ gửi ĐƯỜNG DẪN. Server chỉ đọc đường dẫn nằm trong thư mục
 * của chính người gọi.
 *
 * GHI THEO LÔ: mỗi lần gọi ghi tối đa `CHUNK` dòng (giới hạn thời gian một lần gọi
 * của Vercel). Mỗi lô server soi LẠI cả file — còn dòng lỗi thì không ghi gì.
 */

const BUCKET = 'private' as const
export const CHUNK = 50
const folderOf = (user: User) => `imports/products/${user.id}`
/** File tạm cũ hơn chừng này bị dọn ở lần tải lên kế tiếp. */
const STALE_MS = 24 * 60 * 60 * 1000

/** Màn soi không cần `write` (thứ sẽ ghi) — bỏ cho nhẹ. */
export type PreviewRow = Omit<PlannedRow, 'write'>
export type ImportPreview = Omit<ImportPlan, 'rows'> & {
  rows: PreviewRow[]
  sheet: string
  blank: number
  /** Cột có trong file — màn soi nói "file có X/46 cột". */
  columns: string[]
}
export type WrittenRow = {
  row: number
  code: string
  id: string
  version: string
  action: 'create' | 'update'
}

/** Bộ lọc thư viện SP (đúng tham số URL của /products) → bộ lọc `listLite`. */
export type LibraryFilter = {
  q?: string
  customer_name?: string
  bom_status?: BomStatus
  is_active?: boolean
  has_image?: boolean
  locked?: boolean
  lifecycle?: Lifecycle
  product_type?: string
  category?: string
}
export function libraryFilterFromParams(sp: URLSearchParams): LibraryFilter {
  const v = (k: string) => sp.get(k)?.trim() || ''
  const type = v('type').toUpperCase()
  const lifecycle = v('lifecycle')
  return {
    q: v('q') || undefined,
    customer_name: v('customer') && v('customer') !== 'all' ? v('customer') : undefined,
    bom_status: ['none', 'drawing', 'done'].includes(v('bom')) ? (v('bom') as BomStatus) : undefined, // prettier-ignore
    is_active:
      v('status') === 'active' ? true : v('status') === 'inactive' ? false : undefined,
    has_image: v('image') === 'missing' ? false : v('image') === 'has' ? true : undefined,
    locked: v('locked') === 'yes' ? true : v('locked') === 'no' ? false : undefined,
    lifecycle: isLifecycle(lifecycle) ? lifecycle : undefined,
    product_type: PRODUCT_TYPE_CODES.includes(type as never) ? type : undefined,
    category: v('category') && v('category') !== 'all' ? v('category') : undefined,
  }
}

function assertOwnPath(user: User, path: string) {
  // Chỉ file trong thư mục của chính mình, không đi ngược thư mục.
  if (!path.startsWith(`${folderOf(user)}/`) || path.includes('..')) {
    throw Forbidden('Đường dẫn file không hợp lệ')
  }
}

async function load(user: User, path: string): Promise<Buffer> {
  assertOwnPath(user, path)
  const buf = await storage.downloadBuffer(BUCKET, path)
  if (!buf) throw BadRequest('Không thấy file đã tải lên — chọn lại file')
  return buf
}

/** Đọc + soi cả file. `written` = dòng THÊM MỚI đã ghi ở lô trước: coi như đã có mã. */
async function plan(
  buffer: Buffer,
  written: readonly { row: number; code: string }[] = [],
): Promise<{ plan: ImportPlan; read: Awaited<ReturnType<typeof readImportRows>> }> {
  let read
  try {
    read = await readImportRows(buffer)
  } catch (e) {
    if (e instanceof ImportFileError) throw BadRequest(e.message)
    throw e
  }
  const codeOf = new Map(written.map((w) => [w.row, w.code]))
  const rows: RawRow[] = read.rows.map((r) =>
    codeOf.has(r.row) ? { ...r, cells: { ...r.cells, code: codeOf.get(r.row)! } } : r,
  )
  const existing = await productsRepo.importIndex()
  return { plan: planImport(rows, existing), read }
}

async function assertCanWrite(user: User, p: ImportPlan) {
  if (p.counts.create > 0) await assertAction(user, 'technical.product.create')
  if (p.counts.update > 0) await assertAction(user, 'technical.product.update')
}

export const productImportService = {
  /** Có được dùng luồng này không — nút ở thư viện + trang soi đọc cùng hàm. */
  async canUse(user: User): Promise<boolean> {
    const [c, u] = await Promise.all([
      canAction(user, 'technical.product.create'),
      canAction(user, 'technical.product.update'),
    ])
    return c || u
  },

  /**
   * Xuất SP ra Excel. `filter` null = file mẫu trống (chỉ để thêm mới). Thư viện
   * mở cho mọi NV nên xuất cũng vậy — file không có gì ngoài thứ trang chi tiết
   * đã bày (giá thành KH không nằm trong file).
   */
  async exportFile(
    user: User,
    filter: LibraryFilter | null,
  ): Promise<{ buffer: Buffer; count: number }> {
    const [names, all] = await Promise.all([
      productsRepo.customerNames(),
      filter ? productsRepo.importIndex() : Promise.resolve([]),
    ])
    let products = all
    if (filter && Object.values(filter).some((v) => v !== undefined)) {
      // Đúng hàm lọc của thư viện → số dòng xuất = số "kết quả" trên màn.
      const ids = new Set<string>()
      for (let page = 1; ; page++) {
        const r = await productsService.listLite(user, {
          ...filter,
          page,
          page_size: 500,
        })
        r.rows.forEach((x) => ids.add(x.id))
        if (r.rows.length < 500 || ids.size >= r.total) break
      }
      products = all.filter((p) => ids.has(p.id))
    }
    const labels = [...names].sort((a, b) => b.count - a.count).map((n) => n.name)
    return {
      buffer: await buildProductWorkbook(products, labels),
      count: products.length,
    }
  },

  /**
   * URL ký để trình duyệt PUT file thẳng lên Storage. Nhân tiện dọn file tạm
   * quá 1 ngày của chính người này (người dùng soi xong bỏ ngang).
   */
  async uploadUrl(user: User): Promise<{ path: string; uploadUrl: string }> {
    if (!(await this.canUse(user)))
      throw Forbidden('Chỉ Kỹ thuật / Bán hàng / Giám đốc thêm, sửa SP')
    const folder = folderOf(user)
    const old = (await storage.listFolder(BUCKET, folder)).filter(
      (o) => o.created_at && Date.now() - Date.parse(o.created_at) > STALE_MS,
    )
    if (old.length) await storage.remove(BUCKET, old.map((o) => `${folder}/${o.name}`)).catch(() => {}) // prettier-ignore
    const path = `${folder}/${randomUUID()}.xlsx`
    const { uploadUrl } = await storage.createSignedUploadUrl(BUCKET, path)
    return { path, uploadUrl }
  },

  /** Soi trước — KHÔNG ghi gì. */
  async preview(user: User, path: string): Promise<ImportPreview> {
    if (!(await this.canUse(user)))
      throw Forbidden('Chỉ Kỹ thuật / Bán hàng / Giám đốc thêm, sửa SP')
    const { plan: p, read } = await plan(await load(user, path))
    return {
      ...p,
      // Màn soi không cần `write` (thứ sẽ ghi) — bỏ cho nhẹ.
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      rows: p.rows.map(({ write, ...rest }) => rest),
      sheet: read.sheet,
      blank: read.blank,
      columns: read.columns,
    }
  },

  /**
   * GHI MỘT LÔ. Soi LẠI cả file (danh mục có thể đổi giữa lúc soi và lúc ghi) —
   * còn dòng lỗi thì không ghi dòng nào. `rows` = số hàng Excel của lô này;
   * `written` = dòng thêm mới của các lô trước (để chúng không bị cấp mã lần hai).
   */
  async commitChunk(
    user: User,
    input: { path: string; rows: number[]; written: { row: number; code: string }[] },
  ): Promise<WrittenRow[]> {
    if (input.rows.length > CHUNK) throw BadRequest(`Mỗi lô tối đa ${CHUNK} dòng`)
    const { plan: p } = await plan(await load(user, input.path), input.written)
    if (p.counts.error > 0) {
      const bad = p.rows.filter((r) => r.action === 'error').map((r) => r.row)
      throw BadRequest(`Còn ${bad.length} dòng lỗi (dòng ${bad.slice(0, 8).join(', ')}${bad.length > 8 ? '…' : ''}) — sửa trong file rồi tải lại`) // prettier-ignore
    }
    await assertCanWrite(user, p)
    const want = new Set(input.rows)
    const mine = p.rows.filter((r) => want.has(r.row))

    const out: WrittenRow[] = []
    const creates = mine.filter((r) => r.action === 'create')
    if (creates.length) {
      let inserted
      try {
        inserted = await productsRepo.insertMany(
          creates.map((r) => ({
            // Người LẬP + người phụ trách = người tải file, như form tạo SP (0179).
            packing: {},
            tech_spec: {},
            showroom_sample: false,
            ...r.write,
            created_by: user.id,
            owner_id: user.id,
            code: r.code!,
            name: String(r.write.name),
          })),
        )
      } catch (e) {
        if (e instanceof Error && e.message === 'CODE_TAKEN') {
          throw Conflict('Có người vừa thêm SP trùng mã trong lúc ghi — tải lại file để soi lại', 'CODE_TAKEN') // prettier-ignore
        }
        throw e
      }
      const byCode = new Map(inserted.map((x) => [x.code, x]))
      for (const r of creates) {
        const x = byCode.get(r.code!)!
        out.push({
          row: r.row,
          code: x.code,
          id: x.id,
          version: x.updated_at,
          action: 'create',
        })
      }
    }
    // Cập nhật qua đúng hàm trang chi tiết dùng: quyền + chặn hồ sơ đã khoá.
    for (const r of mine.filter((x) => x.action === 'update')) {
      const saved = await productsService.update(user, r.id!, r.write)
      out.push({ row: r.row, code: saved.code, id: saved.id, version: saved.updated_at, action: 'update' }) // prettier-ignore
    }
    return out.sort((a, b) => a.row - b.row)
  },

  /**
   * Ghi xong: chính file người dùng gửi, ô Mã + Phiên bản điền giá trị mới, đặt
   * lên Storage và trả URL tải (file kèm ảnh ở B2 vượt 4,5 MB nên không trả thẳng).
   * File gốc tạm bị xoá.
   */
  async finish(
    user: User,
    input: { path: string; filename: string; written: { row: number; code: string; version: string }[] }, // prettier-ignore
  ): Promise<{ url: string }> {
    const buf = await load(user, input.path)
    const filled = await fillWritten(buf, input.written)
    const outPath = `${folderOf(user)}/${randomUUID()}-da-ghi.xlsx`
    await storage.uploadBuffer(BUCKET, outPath, filled, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') // prettier-ignore
    await storage.remove(BUCKET, [input.path]).catch(() => {})
    const name = `${input.filename.replace(/\.xlsx$/i, '')}_da-ghi.xlsx`
    const { url } = await storage.createSignedDownloadUrl(BUCKET, outPath, 15 * 60, name)
    return { url }
  },
}
