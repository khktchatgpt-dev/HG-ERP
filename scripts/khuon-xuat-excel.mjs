/**
 * XUẤT DANH MỤC KHUÔN NHÔM ra Excel kèm ảnh mặt cắt (09/10/2026, chủ dự án:
 * "xuất file excel có thông tin có ảnh — phần khuôn nhôm").
 *
 *   node scripts/khuon-xuat-excel.mjs            → exports/KhuonNhom_<ngày>.xlsx
 *
 * Mỗi khuôn một dòng, ảnh thu nhỏ 200 px neo trong ô Ảnh; sheet "Hướng dẫn" ghi
 * nghĩa từng cột. Chỉ XUẤT — chưa có luồng nạp ngược.
 */
import ExcelJS from 'exceljs'
import sharp from 'sharp'
import { mkdirSync } from 'node:fs'
import { client, chunk } from './products-lib.mjs'

const sb = await client(import.meta.url)
const STATUS = {
  pending: 'Chờ mở khuôn',
  active: 'Đang dùng',
  rarely_used: 'Ít dùng',
  broken: 'Khuôn hư',
  replaced: 'Đã thay',
  retired: 'Đã bỏ',
  unknown: 'Chưa xác định',
}

const dies = await sb
  .from('technical_dies')
  .select('*')
  .order('profile_shape')
  .order('code')
if (dies.error) throw new Error(dies.error.message)
const rows = dies.data
const fileIds = rows.map((d) => d.image_file_id).filter(Boolean)
const files = new Map()
for (const ids of chunk(fileIds, 200)) {
  const r = await sb.from('files').select('id,bucket,path,mime_type').in('id', ids)
  for (const f of r.data ?? []) files.set(f.id, f)
}
const thumbs = new Map()
for (const b of chunk(
  rows.filter((d) => d.image_file_id && files.has(d.image_file_id)),
  8,
)) {
  await Promise.all(
    b.map(async (d) => {
      const f = files.get(d.image_file_id)
      const dl = await sb.storage.from(f.bucket).download(f.path)
      if (dl.error) return
      const buf = Buffer.from(await dl.data.arrayBuffer())
      try {
        thumbs.set(
          d.id,
          await sharp(buf)
            .rotate()
            .resize(200, 200, { fit: 'inside', withoutEnlargement: true })
            .flatten({ background: '#ffffff' })
            .jpeg({ quality: 78 })
            .toBuffer(),
        )
      } catch {
        /* ảnh lạ — bỏ */
      }
    }),
  )
}

const COLS = [
  ['Mã khuôn', 16, (d) => d.code],
  ['Ảnh mặt cắt', 12, () => null],
  ['Chi tiết làm ra', 40, (d) => d.name],
  ['Nhóm', 16, (d) => d.profile_shape],
  ['Quy cách', 24, (d) => d.profile_spec],
  ['A (mm)', 8, (d) => d.section_a_mm],
  ['B (mm)', 8, (d) => d.section_b_mm],
  ['Dày δ (mm)', 9, (d) => d.wall_thickness_mm],
  ['Ø (mm)', 8, (d) => d.outer_diameter_mm],
  ['kg/m', 8, (d) => d.weight_per_m],
  ['Dài cây (m)', 9, (d) => d.bar_length_m],
  ['Hợp kim', 14, (d) => d.alloy],
  ['NCC / chủ khuôn', 18, (d) => d.supplier_name],
  ['Nơi giữ khuôn', 18, (d) => d.holder_name],
  ['Trạng thái', 14, (d) => STATUS[d.status] ?? d.status],
  ['Mã cũ / mã NCC', 18, (d) => (d.legacy_codes ?? []).join(', ') || null],
  ['Tiền khuôn (đ)', 14, (d) => d.die_price],
  ['Ngày hiệu lực', 12, (d) => d.effective_date],
  ['Cần rà', 10, (d) => (d.data_confidence === 'needs_review' ? 'có' : null)],
  ['Ghi chú', 40, (d) => d.note],
  ['Nguồn', 30, (d) => d.source_note],
]

const wb = new ExcelJS.Workbook()
wb.creator = 'HG-ERP'
const ws = wb.addWorksheet('Khuôn nhôm', {
  views: [{ state: 'frozen', xSplit: 3, ySplit: 1 }],
})
ws.columns = COLS.map((c) => ({ width: c[1] }))
const LINE = { style: 'thin', color: { argb: 'FFB9C2D0' } }
const BORDER = { top: LINE, left: LINE, bottom: LINE, right: LINE }
COLS.forEach((c, i) => {
  const h = ws.getCell(1, i + 1)
  h.value = c[0]
  h.font = { bold: true }
  h.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8EEFB' } }
  h.alignment = { vertical: 'middle', wrapText: true }
  h.border = BORDER
})
ws.getRow(1).height = 30
let r = 2
for (const d of rows) {
  COLS.forEach((c, i) => {
    const cell = ws.getCell(r, i + 1)
    const v = c[2](d)
    cell.value = v == null || v === '' ? null : v
    cell.border = BORDER
    cell.alignment = {
      vertical: 'middle',
      horizontal: typeof v === 'number' ? 'right' : 'left',
      wrapText: i === 2 || i === 19,
    }
  })
  const t = thumbs.get(d.id)
  if (t) {
    const id = wb.addImage({ buffer: t, extension: 'jpeg' })
    ws.addImage(id, {
      tl: { col: 1 + 0.06, row: r - 1 + 0.06 },
      ext: { width: 72, height: 54 },
      editAs: 'oneCell',
    })
    ws.getRow(r).height = 44
  } else ws.getRow(r).height = 24
  r++
}
ws.getColumn(1).numFmt = '@'

const guide = wb.addWorksheet('Hướng dẫn')
guide.columns = [{ width: 110 }]
;[
  `DANH MỤC KHUÔN NHÔM — HG-ERP, xuất ${new Date().toLocaleDateString('vi-VN')} — ${rows.length} khuôn, ${thumbs.size} ảnh`,
  '',
  'Mỗi dòng một khuôn (profile). A × B = tiết diện bao (mm), δ = dày thành, Ø = đường kính ngoài (ống tròn).',
  'kg/m là trọng lượng mỗi mét cây nhôm — khuôn Phong Gia Phát quy đổi từ kg/cây 6 m (chia 6).',
  'NCC / chủ khuôn: "Nhôm Hoàng Gia" = khuôn của công ty, gửi tại Nơi giữ khuôn (Việt Eco, Tiến Đạt…).',
  'Mã cũ / mã NCC: mã khuôn phía nhà cung cấp hoặc mã cũ trước khi đổi.',
  'Cần rà = "có": mã lặp trong dữ liệu cũ, chưa rõ là hai đời khuôn hay hai khuôn khác nhau.',
  'File này chỉ để XEM / in. Sửa trên hệ thống: Dùng chung → Khuôn nhôm → mở khuôn → Sửa.',
].forEach((t, i) => {
  guide.getCell(i + 1, 1).value = t
  if (i === 0) guide.getCell(1, 1).font = { bold: true, size: 13 }
})

mkdirSync('exports', { recursive: true })
const out = `exports/KhuonNhom_${new Date().toISOString().slice(0, 10)}.xlsx`
await wb.xlsx.writeFile(out)
console.log(`Đã ghi ${out} — ${rows.length} khuôn, ${thumbs.size} ảnh`)
