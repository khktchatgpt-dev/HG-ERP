import { randomUUID } from 'node:crypto'
import { BadRequest, Conflict, Forbidden } from '@/server/http'
import { assertAction, canAction } from '@/modules/core/rbac/rbac.service'
import type { User } from '@/modules/core/users/users.repo'
import { storage } from '@/modules/core/files/storage'
import { filesRepo } from '@/modules/core/files/files.repo'
import { filesService } from '@/modules/core/files/files.service'
import { fileImageSrc } from '@/server/file-image'
import { buildProductCode, nextSerial, MAX_SERIAL } from '@/lib/product-code'
import {
  imageRef,
  planRows,
  type ExistingSp,
  type PkSummary,
  type PlannedRow,
  type RawRow,
} from '@/lib/sp-excel'
import { libraryService } from './library.service'
import { packingRepo } from './packing.repo'
import { productsService } from './technical.service'
import { spExcelRepo, type DefaultPacking } from './sp-excel.repo'
import {
  buildSpWorkbook,
  fillWritten,
  readSpWorkbook,
  SpFileError,
  type ImageBytes,
} from './sp-excel-workbook'
import type { SpExcelExportQuery } from './sp-excel.schema'

/**
 * THÊM + CẬP NHẬT SP BẰNG EXCEL (09/10/2026) — gác quyền + nối DB + Storage.
 * Luật ở `lib/sp-excel`, file ở `sp-excel-workbook`.
 *
 * FILE ĐI THẲNG LÊN STORAGE: Vercel cắt thân request ~4,5 MB, file kèm ảnh vượt
 * ngay. Trình duyệt PUT file vào `private/imports/products/<user>/…` bằng URL
 * ký; các bước sau chỉ gửi ĐƯỜNG DẪN, server chỉ đọc đường dẫn trong thư mục
 * của chính người gọi. Xuất cũng trả URL ký vì cùng lý do.
 *
 * GHI THEO LÔ ≤ 50 dòng; mỗi lô soi LẠI cả file, còn dòng lỗi thì không ghi.
 */

const BUCKET = 'private' as const
export const SP_EXCEL_CHUNK = 50
const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
const STALE_MS = 24 * 60 * 60 * 1000
const folderOf = (user: User) => `imports/products/${user.id}`

export type SpPreviewRow = Omit<PlannedRow, 'write' | 'tech' | 'pk'> & {
  imageUrl: string | null
}
export type SpPreview = {
  rows: SpPreviewRow[]
  counts: ReturnType<typeof planRows>['counts']
  columns: string[]
  totalColumns: number
}
export type SpWritten = {
  row: number
  code: string
  id: string
  version: string
  action: 'create' | 'update'
  imageRef: string | null
}

function assertOwnPath(user: User, path: string) {
  if (!path.startsWith(`${folderOf(user)}/`) || path.includes('..'))
    throw Forbidden('Đường dẫn file không hợp lệ')
}
async function load(user: User, path: string): Promise<Buffer> {
  assertOwnPath(user, path)
  const buf = await storage.downloadBuffer(BUCKET, path)
  if (!buf) throw BadRequest('Không thấy file đã tải lên — chọn lại file')
  return buf
}
async function plan(
  user: User,
  buffer: Buffer,
  written: readonly { row: number; code: string }[] = [],
) {
  let read
  try {
    read = await readSpWorkbook(buffer)
  } catch (e) {
    if (e instanceof SpFileError) throw BadRequest(e.message)
    throw e
  }
  const codeOf = new Map(written.map((w) => [w.row, w.code]))
  const rows: RawRow[] = read.rows.map((r) =>
    codeOf.has(r.row) ? { ...r, cells: { ...r.cells, code: codeOf.get(r.row)! } } : r,
  )
  const existing = await spExcelRepo.listExisting()
  return { ...planRows(rows, existing), read, existing }
}

/** Ô đóng gói → jsonb `packing` (ô tóm tắt) + kiện đầu của phương án mặc định nếu có. */
async function writePacking(
  user: User,
  productId: string,
  pk: Partial<PkSummary>,
  def: DefaultPacking | undefined,
) {
  const map: Record<keyof PkSummary, string> = {
    pk_qty: 'qty_per_carton',
    pk_l: 'carton_l_cm',
    pk_w: 'carton_w_cm',
    pk_h: 'carton_h_cm',
    pk_nw: 'nw_kg',
    pk_gw: 'gw_kg',
    pk_cbm: 'cbm',
    pk_hc: 'loading_40hc',
  }
  const packing: Record<string, number | null> = {}
  for (const [k, v] of Object.entries(pk)) packing[map[k as keyof PkSummary]] = v ?? null
  await productsService.update(user, productId, { packing: packing as never })
  if (!def) return
  const p = def.pkg
  const mm = (cmv: number | null | undefined, cur: number | null | undefined) =>
    cmv === undefined ? (cur ?? null) : cmv == null ? null : Math.round(cmv * 10)
  const touchesPkg = ['pk_l', 'pk_w', 'pk_h', 'pk_nw', 'pk_gw'].some((k) => k in pk)
  await packingRepo.update(productId, def.optionId, {
    ...('pk_qty' in pk ? { cartons_per_set: pk.pk_qty ?? null } : {}),
    ...('pk_hc' in pk ? { loading_40hc: pk.pk_hc ?? null } : {}),
    ...(touchesPkg
      ? {
          packages: [
            {
              package_label: p?.package_label ?? 'Thùng',
              qty: p?.qty ?? 1,
              carton_l_mm: mm(pk.pk_l, p?.carton_l_mm),
              carton_w_mm: mm(pk.pk_w, p?.carton_w_mm),
              carton_h_mm: mm(pk.pk_h, p?.carton_h_mm),
              net_weight_kg:
                pk.pk_nw === undefined ? (p?.net_weight_kg ?? null) : (pk.pk_nw ?? null),
              gross_weight_kg:
                pk.pk_gw === undefined
                  ? (p?.gross_weight_kg ?? null)
                  : (pk.pk_gw ?? null),
            },
          ],
        }
      : {}),
  })
}

export const spExcelService = {
  async canUse(user: User): Promise<boolean> {
    const [c, u] = await Promise.all([
      canAction(user, 'technical.product.create'),
      canAction(user, 'technical.product.update'),
    ])
    return c || u
  },

  /**
   * Xuất file: mẫu trống · SP của một lệnh · SP theo bộ lọc thư viện. Ảnh nhúng
   * là ảnh gốc, nên file lớn → đặt lên Storage, trả URL ký 15 phút.
   */
  async exportToStorage(
    user: User,
    q: SpExcelExportQuery,
  ): Promise<{ url: string; count: number }> {
    let products: ExistingSp[] = []
    let label = 'mau'
    if (!q.blank) {
      let ids: string[] | undefined
      if (q.lsx) {
        const got = await spExcelRepo.productIdsOfLsx(q.lsx)
        if (!got) throw BadRequest(`Không thấy lệnh "${q.lsx}"`)
        ids = got
        label = q.lsx.replace(/[^\w-]+/g, '-')
      } else {
        ids = []
        for (let page = 1; page <= 20; page++) {
          const r = await libraryService.listPage(
            user,
            {
              q: q.q || undefined,
              kh: q.kh ?? '',
              loai: q.loai ?? '',
              khung: q.khung ?? '',
              thieu: (q.thieu ?? '') as never,
              kt: q.kt === '1',
              tt: q.tt === 'inactive' || q.tt === 'all' ? q.tt : 'active',
              lenh: q.lenh === '1',
              mau: q.mau === '1',
              gia: false,
              page,
              page_size: 500,
            },
            false,
          )
          ids.push(...r.rows.map((x) => x.id))
          if (r.rows.length < 500) break
        }
        label = 'thu-vien'
      }
      products = await spExcelRepo.listExisting(ids)
    }
    const images = new Map<string, ImageBytes>()
    const fileIds = [
      ...new Set(products.map((p) => p.image_file_id).filter((v): v is string => !!v)),
    ]
    const files = fileIds.length ? await filesRepo.getByIds(fileIds) : []
    const byFile = new Map(files.map((f) => [f.id, f]))
    await Promise.all(
      products.map(async (p) => {
        const f = p.image_file_id ? byFile.get(p.image_file_id) : null
        if (!f || !['image/png', 'image/jpeg'].includes(f.mime_type)) return
        const buf = await storage.downloadBuffer(f.bucket, f.path)
        if (buf)
          images.set(p.id, {
            buffer: buf,
            ext: f.mime_type === 'image/png' ? 'png' : 'jpeg',
          })
      }),
    )
    const buffer = await buildSpWorkbook(
      products,
      images,
      await spExcelRepo.customerNames(),
    )
    const path = `${folderOf(user)}/${randomUUID()}-xuat.xlsx`
    await storage.uploadBuffer(BUCKET, path, buffer, XLSX)
    const { url } = await storage.createSignedDownloadUrl(
      BUCKET,
      path,
      15 * 60,
      `SanPham_${label}.xlsx`,
    )
    return { url, count: products.length }
  },

  /** URL ký để trình duyệt PUT file lên Storage; tiện tay dọn file tạm quá 1 ngày. */
  async uploadUrl(user: User): Promise<{ path: string; uploadUrl: string }> {
    if (!(await this.canUse(user)))
      throw Forbidden('Chỉ Kỹ thuật / Bán hàng / Giám đốc thêm, sửa SP')
    const folder = folderOf(user)
    const old = (await storage.listFolder(BUCKET, folder)).filter(
      (o) => o.created_at && Date.now() - Date.parse(o.created_at) > STALE_MS,
    )
    if (old.length)
      await storage
        .remove(
          BUCKET,
          old.map((o) => `${folder}/${o.name}`),
        )
        .catch(() => {})
    const path = `${folder}/${randomUUID()}.xlsx`
    const { uploadUrl } = await storage.createSignedUploadUrl(BUCKET, path)
    return { path, uploadUrl }
  },

  /** Soi trước — KHÔNG ghi gì. */
  async preview(user: User, path: string): Promise<SpPreview> {
    if (!(await this.canUse(user)))
      throw Forbidden('Chỉ Kỹ thuật / Bán hàng / Giám đốc thêm, sửa SP')
    const { rows, counts, read, existing } = await plan(user, await load(user, path))
    const byId = new Map(existing.map((p) => [p.id, p]))
    return {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars -- bỏ write/tech/pk khỏi bản gửi client
      rows: rows.map(({ write: _w, tech: _t, pk: _p, ...r }) => {
        const cur = r.id ? byId.get(r.id) : undefined
        return {
          ...r,
          imageUrl: cur?.image_file_id ? fileImageSrc(cur.image_file_id) : null,
        }
      }),
      counts,
      columns: read.columns,
      totalColumns: 36,
    }
  },

  /** GHI MỘT LÔ. Soi lại cả file; còn lỗi thì không ghi dòng nào. */
  async commit(
    user: User,
    input: { path: string; rows: number[]; written: { row: number; code: string }[] },
  ): Promise<{ written: SpWritten[] }> {
    const { rows, counts, read, existing } = await plan(
      user,
      await load(user, input.path),
      input.written,
    )
    if (counts.error > 0) {
      const bad = rows.filter((r) => r.action === 'error').map((r) => r.row)
      throw BadRequest(
        `Còn ${bad.length} dòng lỗi (dòng ${bad.slice(0, 8).join(', ')}${bad.length > 8 ? '…' : ''}) — sửa trong file rồi tải lại`,
      )
    }
    if (counts.create > 0) await assertAction(user, 'technical.product.create')
    if (counts.update > 0) await assertAction(user, 'technical.product.update')
    const want = new Set(input.rows)
    const mine = rows.filter(
      (r) => want.has(r.row) && (r.action === 'create' || r.action === 'update'),
    )
    const def = await spExcelRepo.defaultPacking(
      mine.map((r) => r.id).filter((v): v is string => !!v),
    )
    const serialByType = new Map<string, number>()
    const out: SpWritten[] = []

    const attachImage = async (
      r: PlannedRow,
      productId: string,
      code: string,
    ): Promise<string | null> => {
      const img = read.images.get(r.row)
      if (!r.newImage || !img) return null
      const fileId = await filesService.uploadFromServer(user, {
        buffer: img.buffer,
        filename: `${code}.${img.ext === 'png' ? 'png' : 'jpg'}`,
        mime_type: img.ext === 'png' ? 'image/png' : 'image/jpeg',
        bucket: 'attachments',
        parent: { kind: 'product', id: productId },
        doc_type: 'image',
      })
      await productsService.update(user, productId, { image_file_id: fileId })
      return imageRef(fileId, r.imageSha ?? '')
    }

    for (const r of mine) {
      const tech = r.tech ? { ...(r.tech as Record<string, string | null>) } : undefined
      if (r.action === 'create') {
        const type = r.type!
        const material = r.material!
        if (!serialByType.has(type))
          serialByType.set(type, nextSerial(await spExcelRepo.codesByType(type), type))
        let created = null
        for (let i = 0; i < 50 && !created; i++) {
          const serial = serialByType.get(type)!
          if (serial > MAX_SERIAL) throw Conflict(`Hết số cho loại ${type}`)
          const code = buildProductCode(type, serial, material)
          try {
            // Loại + khung nằm trong mã (classify suy từ code), không gửi riêng.
            created = await productsService.create(user, {
              code,
              name: r.name,
              unit: (r.write.unit as string | undefined) ?? 'cái',
              customer_name: (r.write.customer_name as string | null | undefined) ?? null,
              customer_item_code:
                (r.write.customer_item_code as string | null | undefined) ?? null,
              name_foreign: (r.write.name_foreign as string | null | undefined) ?? null,
              material: (r.write.material as string | null | undefined) ?? null,
              barcode: (r.write.barcode as string | null | undefined) ?? null,
              description_en:
                (r.write.description_en as string | null | undefined) ?? null,
              notes: (r.write.notes as string | null | undefined) ?? null,
              tech_spec: tech as never,
            })
          } catch (e) {
            if (e instanceof Error && (e as { code?: string }).code === 'CODE_TAKEN')
              serialByType.set(type, serial + 1)
            else throw e
          }
        }
        if (!created) throw Conflict(`Không cấp được mã cho dòng ${r.row}`)
        serialByType.set(type, serialByType.get(type)! + 1)
        // các ô số + đang dùng: create() không nhận → ghi tiếp bằng update
        const rest: Record<string, unknown> = {}
        for (const k of [
          'length_mm',
          'width_mm',
          'height_mm',
          'net_weight_kg',
          'actual_weight_kg',
          'is_active',
        ])
          if (k in r.write) rest[k] = r.write[k]
        let saved = created
        if (Object.keys(rest).length)
          saved = await productsService.update(user, created.id, rest as never)
        if (r.pk) await writePacking(user, created.id, r.pk, undefined)
        const ref = await attachImage(r, created.id, created.code)
        out.push({
          row: r.row,
          code: created.code,
          id: created.id,
          version: saved.updated_at,
          action: 'create',
          imageRef: ref,
        })
      } else {
        const patch: Record<string, unknown> = { ...r.write }
        if (tech) patch.tech_spec = tech
        let saved = Object.keys(patch).length
          ? await productsService.update(user, r.id!, patch as never)
          : null
        if (r.pk) {
          await writePacking(user, r.id!, r.pk, def.get(r.id!))
          saved = null
        }
        const ref = await attachImage(r, r.id!, r.code!)
        const version =
          saved?.updated_at ?? existing.find((p) => p.id === r.id)?.updated_at ?? ''
        out.push({
          row: r.row,
          code: r.code!,
          id: r.id!,
          version,
          action: 'update',
          imageRef: ref,
        })
      }
    }
    return { written: out.sort((a, b) => a.row - b.row) }
  },

  /** Ghi xong: chính file người dùng gửi, điền mã + phiên bản + vân tay ảnh; trả URL tải. */
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
    await storage.uploadBuffer(BUCKET, outPath, filled, XLSX)
    await storage.remove(BUCKET, [input.path]).catch(() => {})
    const name = `${input.filename.replace(/\.xlsx$/i, '')}_da-ghi.xlsx`
    const { url } = await storage.createSignedDownloadUrl(BUCKET, outPath, 15 * 60, name)
    return { url }
  },
}
