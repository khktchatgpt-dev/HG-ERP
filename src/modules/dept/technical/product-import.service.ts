import { randomUUID } from 'node:crypto'
import { BadRequest, Conflict, Forbidden } from '@/server/http'
import { assertAction, canAction } from '@/modules/core/rbac/rbac.service'
import type { User } from '@/modules/core/users/users.repo'
import { storage } from '@/modules/core/files/storage'
import { filesRepo } from '@/modules/core/files/files.repo'
import { filesService } from '@/modules/core/files/files.service'
import { isLifecycle, type Lifecycle } from '@/lib/product-lifecycle'
import { PRODUCT_TYPE_CODES } from '@/lib/product-code'
import {
  imageRefOf,
  planImport,
  type ImportPlan,
  type PlannedRow,
  type ExistingProduct,
  type ImportLookups,
  type RawRow,
} from '@/lib/product-import'
import { fileImageSrc } from '@/server/file-image'
import { profileSnapshot } from '@/modules/dept/production/lsx-lines.service'
import type { Product } from './technical.repo'
import { productsRepo } from './technical.repo'
import { usersRepo } from '@/modules/core/users/users.repo'
import { catalogsService } from '@/modules/core/catalogs/catalogs.service'
import { planPacking, type OptionData, type PackingPlan, type PackingPlanItem } from '@/lib/product-packing-import' // prettier-ignore
import { productsService } from './technical.service'
import type { BomStatus } from './technical.schema'
import { ImportFileError, buildProductWorkbook, fillWritten, readImportRows, type ExportThumb } from './product-import-workbook' // prettier-ignore
import { IMAGE_MIME, fitForUpload, imageHash, makeThumb } from './product-images'

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
/**
 * Ô hồ sơ còn trống SAU KHI ghi dòng này — đếm bằng đúng hàm của LSX
 * (`profileSnapshot().gaps`), tách hai tầng: `core` là thứ Sale cần để in LSX /
 * báo giá (tên nước ngoài, barcode, đóng gói, CBM); `spec` là thông số in LSX
 * (sơn, gỗ, kính, nệm, mây) — trống là thường với SP không có thứ đó.
 */
export type ProfileGaps = { core: string[]; spec: string[] }
export type PreviewRow = Omit<PlannedRow, 'write'> & {
  gaps: ProfileGaps
  /** Ảnh đại diện ĐANG CÓ (đường dẫn ký sẵn) — màn soi bày cũ → mới. */
  imageUrl: string | null
}
export type ImportPreview = Omit<ImportPlan, 'rows'> & {
  rows: PreviewRow[]
  sheet: string
  blank: number
  /** Cột có trong file — màn soi nói "file có X/46 cột". */
  columns: string[]
  /** Sheet "Đóng gói" — kèm bộ phương án ĐANG CÓ để màn soi bày từng kiện cũ → mới. */
  packing: {
    items: (PackingPlanItem & { old: OptionData[]; name: string | null })[]
    counts: PackingPlan['counts']
  }
}

/** Mỗi lần gọi ghi đóng gói tối đa chừng này SP (mỗi SP: xoá + chèn phương án + kiện). */
export const PACKING_CHUNK = 40
export type WrittenRow = {
  row: number
  code: string
  id: string
  version: string
  action: 'create' | 'update'
  /** Ô "Ảnh gốc" mới khi dòng vừa ghi ảnh mới — để tải lại file không ghi ảnh lần hai. */
  imageRef?: string | null
}

/** Ảnh thu nhỏ lưu sẵn — tạo một lần, mỗi lần xuất chỉ tải ~10 KB/ảnh thay vì ảnh gốc. */
const THUMB_DIR = 'thumbs/products'
/** Ngân sách thời gian tạo ảnh thu nhỏ còn thiếu trong một lần xuất. */
const THUMB_BUDGET_MS = 70_000

/** Chạy `fn` trên từng phần tử, tối đa `n` việc cùng lúc. */
async function pool<T>(items: readonly T[], n: number, fn: (x: T) => Promise<void>) {
  let i = 0
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length) await fn(items[i++])
    }),
  )
}

type ExistingProductLike = { id: string; image_file_id?: unknown }

/**
 * Ảnh thu nhỏ cho các SP có ảnh. Có sẵn trong `thumbs/products` thì tải về; chưa có
 * thì tải ảnh gốc, thu nhỏ, lưu lại — trong ngân sách thời gian. Lần xuất đầu cả
 * thư viện (680 ảnh gốc, 229 MB) có thể không kịp hết: SP nào chưa kịp thì xuất
 * không ảnh (`missing`), lần xuất sau tiếp tục từ chỗ đó.
 */
async function thumbsFor(
  products: readonly ExistingProductLike[],
): Promise<{ thumbs: Map<string, ExportThumb>; missing: number }> {
  const deadline = Date.now() + THUMB_BUDGET_MS
  const withImage = products.filter((p) => typeof p.image_file_id === 'string')
  const fileIds = [...new Set(withImage.map((p) => p.image_file_id as string))]
  const files = new Map<string, Awaited<ReturnType<typeof filesRepo.getByIds>>[number]>()
  for (let i = 0; i < fileIds.length; i += 150) {
    for (const f of await filesRepo.getByIds(fileIds.slice(i, i + 150)))
      files.set(f.id, f)
  }
  const byFile = new Map<string, ExportThumb>()
  let missing = 0
  await pool(fileIds, 32, async (fileId) => {
    const path = `${THUMB_DIR}/${fileId}-200.jpg`
    let thumb = await storage.downloadBuffer(BUCKET, path)
    if (!thumb) {
      const f = files.get(fileId)
      if (!f || Date.now() > deadline) {
        missing++
        return
      }
      const orig = await storage.downloadBuffer(f.bucket, f.path)
      if (!orig) {
        missing++
        return
      }
      try {
        thumb = await makeThumb(orig)
      } catch {
        missing++ // ảnh gốc hỏng / định dạng lạ — xuất không ảnh, không làm hỏng cả file
        return
      }
      await storage
        .uploadBuffer(BUCKET, path, thumb, 'image/jpeg', { upsert: true })
        .catch(() => {})
    }
    byFile.set(fileId, {
      buffer: thumb,
      ref: imageRefOf(fileId, [await imageHash(thumb)]),
    })
  })
  const thumbs = new Map<string, ExportThumb>()
  for (const p of withImage) {
    const t = byFile.get(p.image_file_id as string)
    if (t) thumbs.set(p.id, t)
  }
  return { thumbs, missing }
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

/**
 * Danh mục SP + nhân sự cho cột Danh mục / Người phụ trách / Người tạo. Lấy cả
 * người đã nghỉ (để bày tên Người tạo), nhưng chỉ người ĐANG LÀM nhận làm phụ trách.
 */
async function loadLookups(user: User): Promise<ImportLookups> {
  const [cats, users] = await Promise.all([
    catalogsService.list(user, 'product_category'),
    usersRepo.list({ include_deleted: true }),
  ])
  return {
    categories: cats.map((c) => ({ code: c.code, label: c.label })),
    users: users.map((u) => ({
      id: u.id,
      name: u.name || u.email,
      email: u.email,
      active: u.is_active && !u.deleted_at,
    })),
  }
}

/** Đọc + soi cả file. `written` = dòng THÊM MỚI đã ghi ở lô trước: coi như đã có mã. */
async function plan(
  user: User,
  buffer: Buffer,
  written: readonly { row: number; code: string }[] = [],
): Promise<{
  plan: ImportPlan
  packing: PackingPlan
  packingOld: Map<string, OptionData[]>
  read: Awaited<ReturnType<typeof readImportRows>>
  existing: ExistingProduct[]
}> {
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
  const [existing, packingOld, lk] = await Promise.all([
    productsRepo.importIndex(),
    productsRepo.packingIndex(),
    loadLookups(user),
  ])
  const refs = existing.map((p) => ({ id: p.id, code: p.code, locked_at: p.locked_at }))
  return {
    plan: planImport(rows, existing, lk),
    packing: planPacking(read.packingRows, refs, packingOld),
    packingOld,
    read,
    existing,
  }
}

const imageOf = (p: ExistingProduct | undefined) =>
  typeof p?.image_file_id === 'string' ? fileImageSrc(p.image_file_id) : null

/** Các khoá "thiếu" mà Sale cần khi in LSX / báo giá — còn lại là thông số in LSX. */
const CORE_GAPS = new Set(['name_foreign', 'barcode', 'packing', 'cbm'])

/** Ô hồ sơ còn trống sau khi ghi `write` lên SP đang có (hoặc SP mới). */
function gapsAfter(
  before: ExistingProduct | undefined,
  write: Record<string, unknown>,
): ProfileGaps {
  const merged = { ...(before ?? {}), ...write } as unknown as Product
  const gaps = profileSnapshot(merged).gaps
  return {
    core: gaps.filter((g) => CORE_GAPS.has(g.key)).map((g) => g.label),
    spec: gaps.filter((g) => !CORE_GAPS.has(g.key)).map((g) => g.label),
  }
}

/** Còn lỗi ở BẤT KỲ sheet nào thì không ghi gì (luật chặn cả file). */
function assertNoErrors(p: ImportPlan, k: PackingPlan) {
  if (p.counts.error > 0) {
    const bad = p.rows.filter((r) => r.action === 'error').map((r) => r.row)
    throw BadRequest(`Còn ${bad.length} dòng lỗi (dòng ${bad.slice(0, 8).join(', ')}${bad.length > 8 ? '…' : ''}) — sửa trong file rồi tải lại`) // prettier-ignore
  }
  if (k.counts.error > 0) {
    const rows = k.items.filter((i) => i.action === 'error').flatMap((i) => i.rows)
    throw BadRequest(`Sheet Đóng gói còn ${k.counts.error} SP lỗi (dòng ${rows.slice(0, 8).join(', ')}${rows.length > 8 ? '…' : ''}) — sửa trong file rồi tải lại`) // prettier-ignore
  }
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
  ): Promise<{ buffer: Buffer; count: number; missingImages: number }> {
    const [names, all, packing, lk] = await Promise.all([
      productsRepo.customerNames(),
      filter ? productsRepo.importIndex() : Promise.resolve([]),
      filter
        ? productsRepo.packingIndex()
        : Promise.resolve(new Map<string, OptionData[]>()),
      loadLookups(user),
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
    const { thumbs, missing } = await thumbsFor(products)
    return {
      buffer: await buildProductWorkbook(products, labels, thumbs, packing, lk),
      count: products.length,
      missingImages: missing,
    }
  },

  /**
   * Xuất rồi đặt file lên Storage, trả URL tải (15 phút): file kèm ảnh thu nhỏ của
   * cả thư viện ~8 MB, vượt trần ~4,5 MB thân phản hồi của Vercel.
   */
  async exportToStorage(
    user: User,
    filter: LibraryFilter,
    filename: string,
  ): Promise<{ url: string; count: number; missingImages: number }> {
    const r = await this.exportFile(user, filter)
    const path = `${folderOf(user)}/${randomUUID()}-xuat.xlsx`
    await storage.uploadBuffer(BUCKET, path, r.buffer, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') // prettier-ignore
    const { url } = await storage.createSignedDownloadUrl(BUCKET, path, 15 * 60, filename)
    return { url, count: r.count, missingImages: r.missingImages }
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
  /** Số đếm thư viện cho màn chưa chọn file. */
  libraryFacts() {
    return productsRepo.importFacts()
  },

  async preview(user: User, path: string): Promise<ImportPreview> {
    if (!(await this.canUse(user)))
      throw Forbidden('Chỉ Kỹ thuật / Bán hàng / Giám đốc thêm, sửa SP')
    const { plan: p, packing: k, packingOld, read, existing } = await plan(user, await load(user, path)) // prettier-ignore
    const byId = new Map(existing.map((x) => [x.id, x]))
    return {
      ...p,
      // Màn soi không cần `write` (thứ sẽ ghi) — chỉ dùng để tính ô còn thiếu.
      rows: p.rows.map(({ write, ...rest }) => ({
        ...rest,
        gaps: gapsAfter(rest.id ? byId.get(rest.id) : undefined, write),
        imageUrl: imageOf(rest.id ? byId.get(rest.id) : undefined),
      })),
      sheet: read.sheet,
      blank: read.blank,
      columns: read.columns,
      packing: {
        items: k.items.map((it) => ({
          ...it,
          old: it.productId ? (packingOld.get(it.productId) ?? []) : [],
          name: it.productId ? (byId.get(it.productId)?.name ?? null) : null,
        })),
        counts: k.counts,
      },
    }
  },

  /**
   * GHI MỘT LÔ. Soi LẠI cả file (danh mục có thể đổi giữa lúc soi và lúc ghi) —
   * còn dòng lỗi thì không ghi dòng nào. `rows` = số hàng Excel của lô này;
   * `written` = dòng thêm mới của các lô trước (để chúng không bị cấp mã lần hai).
   */
  async commitChunk(
    user: User,
    input: {
      path: string
      rows: number[]
      written: { row: number; code: string }[]
      /** Mã SP có đóng gói cần THAY ở lô này (ghi sau khi xong mọi dòng sản phẩm). */
      packingCodes?: string[]
    },
  ): Promise<{ written: WrittenRow[]; packed: string[] }> {
    if (input.rows.length > CHUNK) throw BadRequest(`Mỗi lô tối đa ${CHUNK} dòng`)
    if ((input.packingCodes?.length ?? 0) > PACKING_CHUNK) throw BadRequest(`Mỗi lô đóng gói tối đa ${PACKING_CHUNK} SP`) // prettier-ignore
    const { plan: p, packing: k, packingOld, read } = await plan(user, await load(user, input.path), input.written) // prettier-ignore
    assertNoErrors(p, k)
    await assertCanWrite(user, p)
    if (input.packingCodes?.length) await assertAction(user, 'technical.product.update')
    const want = new Set(input.rows)
    const mine = p.rows.filter((r) => want.has(r.row))

    const rawOf = new Map(read.rows.map((r) => [r.row, r]))

    /**
     * Ảnh mới của một dòng → đính vào hồ sơ SP (tab Tài liệu, loại "ảnh") qua đúng
     * đường đính file từ server; trả id file + ô "Ảnh gốc" mới (vân tay MỌI ảnh
     * trong ô). Ảnh cũ KHÔNG xoá (Q3 bản vẽ: giữ ở tab Tài liệu).
     */
    const attachImage = async (r: PlannedRow, productId: string, code: string) => {
      if (r.newImage == null) return null
      const src = read.imageBytes.get(r.row)?.[r.newImage]
      if (!src) return null
      const fit = await fitForUpload(src.buffer, src.ext)
      const fileId = await filesService.uploadFromServer(user, {
        buffer: fit.buffer,
        filename: `${code}.${fit.ext === 'jpeg' ? 'jpg' : fit.ext}`,
        mime_type: IMAGE_MIME[fit.ext],
        bucket: 'attachments',
        parent: { kind: 'product', id: productId },
        doc_type: 'image',
      })
      const hashes = (rawOf.get(r.row)?.images ?? []).map((i) => i.hash)
      return { fileId, imageRef: imageRefOf(fileId, hashes) }
    }

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
            // File không ghi người phụ trách → người tải file, như form tạo SP.
            owner_id: (r.write.owner_id as string | null | undefined) ?? user.id,
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
        let version = x.updated_at
        const img = await attachImage(r, x.id, x.code)
        if (img) {
          // SP vừa tạo chưa khoá, chưa ai sửa — ghi thẳng ảnh đại diện.
          const saved = await productsRepo.patch(x.id, { image_file_id: img.fileId })
          version = saved.updated_at
        }
        out.push({ row: r.row, code: x.code, id: x.id, version, action: 'create', imageRef: img?.imageRef ?? null }) // prettier-ignore
      }
    }
    // Cập nhật qua đúng hàm trang chi tiết dùng: quyền + chặn hồ sơ đã khoá.
    for (const r of mine.filter((x) => x.action === 'update')) {
      // Ảnh trước, rồi MỘT lần cập nhật cho cả ô + ảnh đại diện.
      const img = await attachImage(r, r.id!, r.code!)
      const patch = img ? { ...r.write, image_file_id: img.fileId } : r.write
      const saved = await productsService.update(user, r.id!, patch)
      out.push({ row: r.row, code: saved.code, id: saved.id, version: saved.updated_at, action: 'update', imageRef: img?.imageRef ?? null }) // prettier-ignore
    }
    // Đóng gói: thay trọn bộ từng SP (repo tự khôi phục bản cũ nếu chèn hỏng).
    const packed: string[] = []
    const wantPack = new Set((input.packingCodes ?? []).map((c) => c.toUpperCase()))
    for (const item of k.items) {
      if (!wantPack.has(item.code) || item.action !== 'replace' || !item.productId)
        continue
      await productsRepo.replacePacking(item.productId, item.options, packingOld.get(item.productId) ?? []) // prettier-ignore
      packed.push(item.code)
    }
    return { written: out.sort((a, b) => a.row - b.row), packed }
  },

  /**
   * Ghi xong: chính file người dùng gửi, ô Mã + Phiên bản điền giá trị mới, đặt
   * lên Storage và trả URL tải (file kèm ảnh ở B2 vượt 4,5 MB nên không trả thẳng).
   * File gốc tạm bị xoá.
   */
  async finish(
    user: User,
    input: {
      path: string
      filename: string
      written: { row: number; code: string; version: string; imageRef?: string | null }[]
    },
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
