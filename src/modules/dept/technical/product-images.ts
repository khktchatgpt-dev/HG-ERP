import sharp from 'sharp'
import JSZip from 'jszip'

/**
 * ẢNH của luồng thêm + cập nhật SP bằng Excel (B2, 07/10/2026) — thu nhỏ, vân
 * tay, đọc ảnh "Đặt trong ô" của Excel 365. Thuần byte → byte, không chạm DB,
 * để test được.
 */

/** Cạnh dài ảnh thu nhỏ khi XUẤT — đủ nhận ra SP, ~10 KB một ảnh. */
export const THUMB_PX = 200
/** Ảnh mới lớn hơn cạnh này thì thu về khi ghi — ảnh chụp điện thoại 4000px không cần cho hồ sơ. */
export const MAX_IMAGE_PX = 2000

export const IMAGE_MIME: Record<
  string,
  'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif'
> = {
  png: 'image/png',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
}

/** Ảnh thu nhỏ JPEG (xoay đúng chiều theo EXIF, không phóng to ảnh nhỏ). */
export async function makeThumb(buf: Buffer): Promise<Buffer> {
  return sharp(buf)
    .rotate()
    .resize(THUMB_PX, THUMB_PX, { fit: 'inside', withoutEnlargement: true })
    .flatten({ background: '#ffffff' })
    .jpeg({ quality: 72 })
    .toBuffer()
}

/**
 * Vân tay dHash 64 bit (16 hex): thu về 9×8 xám, so từng điểm với điểm bên phải.
 * Nén lại / đổi cỡ / đổi định dạng chỉ lệch vài bit; ảnh khác hẳn lệch hàng chục.
 * Nền trong suốt được trải trắng trước để PNG trong suốt và bản JPEG của nó khớp.
 */
export async function imageHash(buf: Buffer): Promise<string> {
  const px = await sharp(buf)
    .rotate()
    .flatten({ background: '#ffffff' })
    .grayscale()
    .resize(9, 8, { fit: 'fill' })
    .raw()
    .toBuffer()
  let hex = ''
  for (let y = 0; y < 8; y++) {
    let byte = 0
    for (let x = 0; x < 8; x++)
      byte = (byte << 1) | (px[y * 9 + x] < px[y * 9 + x + 1] ? 1 : 0)
    hex += byte.toString(16).padStart(2, '0')
  }
  return hex
}

/** Ảnh nhỏ 64px cho màn soi — data URL, ~2 KB. */
export async function previewDataUrl(buf: Buffer): Promise<string> {
  const out = await sharp(buf)
    .rotate()
    .resize(64, 64, { fit: 'inside' })
    .flatten({ background: '#ffffff' })
    .jpeg({ quality: 60 })
    .toBuffer()
  return `data:image/jpeg;base64,${out.toString('base64')}`
}

/** Cỡ thật (đã xoay theo EXIF). null = sharp không đọc được (EMF, file hỏng…). */
export async function imageSize(
  buf: Buffer,
): Promise<{ width: number; height: number } | null> {
  try {
    const m = await sharp(buf).rotate().metadata()
    if (!m.width || !m.height) return null
    const swap = (m.orientation ?? 1) >= 5
    return swap
      ? { width: m.height, height: m.width }
      : { width: m.width, height: m.height }
  } catch {
    return null
  }
}

/** Ảnh mới quá lớn → thu về MAX_IMAGE_PX (JPEG); ảnh vừa thì giữ nguyên byte. */
export async function fitForUpload(
  buf: Buffer,
  ext: string,
): Promise<{ buffer: Buffer; ext: string }> {
  const size = await imageSize(buf)
  if (size && Math.max(size.width, size.height) <= MAX_IMAGE_PX && IMAGE_MIME[ext]) {
    return { buffer: buf, ext }
  }
  const out = await sharp(buf)
    .rotate()
    .resize(MAX_IMAGE_PX, MAX_IMAGE_PX, { fit: 'inside', withoutEnlargement: true })
    .flatten({ background: '#ffffff' })
    .jpeg({ quality: 85 })
    .toBuffer()
  return { buffer: out, ext: 'jpeg' }
}

// ── Ảnh "Đặt trong ô" (Excel 365) ────────────────────────────────────────────

/** A1 → số cột (1-based). */
const colNumber = (letters: string) =>
  [...letters].reduce((n, ch) => n * 26 + (ch.charCodeAt(0) - 64), 0)

const attr = (tag: string, name: string) =>
  new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1] ?? null

/** Mọi thẻ mở `<x:name …>` (bỏ qua tiền tố namespace) theo thứ tự xuất hiện. */
const tags = (xml: string, name: string) =>
  [...xml.matchAll(new RegExp(`<(?:\\w+:)?${name}\\b[^>]*>`, 'g'))].map((m) => m[0])

/** Các khối `<x:name>…</x:name>` theo thứ tự. */
const blocks = (xml: string, name: string) =>
  [...xml.matchAll(new RegExp(`<(?:\\w+:)?${name}\\b[^>]*>([\\s\\S]*?)</(?:\\w+:)?${name}>`, 'g'))].map((m) => m[1]) // prettier-ignore

/**
 * Ảnh "Đặt trong ô" của MỘT sheet: { hàng, cột, byte, đuôi }. exceljs không đọc
 * phần này (xl/richData) nên tự lần theo chuỗi tham chiếu của định dạng:
 *
 *   ô `vm="N"` → metadata.xml valueMetadata[N-1].rc.v → futureMetadata
 *   XLRICHVALUE[v].rvb.i → richData/rdrichvalue.xml rv[i] → khoá
 *   `_rvRel:LocalImageIdentifier` → richValueRel.xml rel[k] r:id → .rels → media.
 *
 * File không có phần này (hầu hết file) → mảng rỗng. Lần hỏng giữa chừng → bỏ
 * qua ô đó: thiếu ảnh thì màn soi bày "không có ảnh", không làm hỏng cả file.
 */
export async function readInCellImages(
  buffer: Buffer,
  sheetName: string,
): Promise<{ row: number; col: number; buffer: Buffer; ext: string }[]> {
  let zip: JSZip
  try {
    zip = await JSZip.loadAsync(buffer)
  } catch {
    return []
  }
  const text = async (p: string) => (await zip.file(p)?.async('string')) ?? null
  const [workbook, wbRels, metadata, rv, rvStruct, rvRel, rvRelRels] = await Promise.all([
    text('xl/workbook.xml'),
    text('xl/_rels/workbook.xml.rels'),
    text('xl/metadata.xml'),
    text('xl/richData/rdrichvalue.xml'),
    text('xl/richData/rdrichvaluestructure.xml'),
    text('xl/richData/richValueRel.xml'),
    text('xl/richData/_rels/richValueRel.xml.rels'),
  ])
  if (!workbook || !wbRels || !metadata || !rv || !rvRel || !rvRelRels) return []

  // Sheet theo TÊN → file xml của nó.
  const esc = sheetName.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
  const sheetTag = tags(workbook, 'sheet').find((t) => attr(t, 'name') === esc)
  const rid = sheetTag ? (attr(sheetTag, 'r:id') ?? attr(sheetTag, 'id')) : null
  const rel = rid ? tags(wbRels, 'Relationship').find((t) => attr(t, 'Id') === rid) : null
  const target = rel ? attr(rel, 'Target') : null
  if (!target) return []
  const sheetPath = target.startsWith('/')
    ? target.slice(1)
    : `xl/${target.replace(/^\.\.\//, '')}`
  const sheet = await text(sheetPath)
  if (!sheet) return []

  // metadata: valueMetadata (vm → chỉ số futureMetadata) + futureMetadata XLRICHVALUE (→ rv).
  const valueBk = blocks(blocks(metadata, 'valueMetadata')[0] ?? '', 'bk').map((b) => {
    const rc = tags(b, 'rc')[0]
    return rc ? Number(attr(rc, 'v')) : -1
  })
  const future = [...metadata.matchAll(/<(?:\w+:)?futureMetadata\b[^>]*name="XLRICHVALUE"[^>]*>([\s\S]*?)<\/(?:\w+:)?futureMetadata>/g)][0]?.[1] ?? '' // prettier-ignore
  const futureRv = blocks(future, 'bk').map((b) => {
    const t = tags(b, 'rvb')[0]
    return t ? Number(attr(t, 'i')) : -1
  })

  // rich value: rv[i] → giá trị theo khoá _rvRel:LocalImageIdentifier của cấu trúc s.
  const structs = rvStruct ? blocks(rvStruct, 's').map((s) => tags(s, 'k').map((k) => attr(k, 'n'))) : [] // prettier-ignore
  const rvTags = tags(rv, 'rv')
  const rvBodies = blocks(rv, 'rv')
  const relIndexOf = (i: number): number => {
    const vals = [...(rvBodies[i] ?? '').matchAll(/<(?:\w+:)?v\b[^>]*>([^<]*)</g)].map(
      (m) => m[1],
    )
    const s = Number(attr(rvTags[i] ?? '', 's') ?? 0)
    const keyAt = structs[s]?.indexOf('_rvRel:LocalImageIdentifier') ?? -1
    return Number(vals[keyAt >= 0 ? keyAt : 0])
  }
  const relIds = tags(rvRel, 'rel').map((t) => attr(t, 'r:id') ?? attr(t, 'id'))
  const mediaOf = new Map(
    tags(rvRelRels, 'Relationship').map((t) => [attr(t, 'Id'), attr(t, 'Target')]),
  )

  const out: { row: number; col: number; buffer: Buffer; ext: string }[] = []
  for (const c of tags(sheet, 'c')) {
    const vm = attr(c, 'vm')
    const ref = attr(c, 'r')
    if (!vm || !ref) continue
    const m = /^([A-Z]+)(\d+)$/.exec(ref)
    if (!m) continue
    const fut = valueBk[Number(vm) - 1]
    const rvIndex = futureRv[fut ?? -1]
    if (rvIndex == null || rvIndex < 0) continue
    const relIdx = relIndexOf(rvIndex)
    const mediaTarget = mediaOf.get(relIds[relIdx] ?? '')
    if (!mediaTarget) continue
    const mediaPath = mediaTarget.startsWith('/') ? mediaTarget.slice(1) : `xl/${mediaTarget.replace(/^\.\.\//, '')}` // prettier-ignore
    const file = zip.file(mediaPath)
    if (!file) continue
    out.push({
      row: Number(m[2]),
      col: colNumber(m[1]),
      buffer: Buffer.from(await file.async('uint8array')),
      ext: (mediaPath.split('.').pop() ?? '').toLowerCase(),
    })
  }
  return out
}
