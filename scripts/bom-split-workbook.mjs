// TÁCH MỘT WORKBOOK NHIỀU SHEET THÀNH TỪNG FILE MỘT-SHEET — ở mức ZIP.
//
//   node scripts/bom-split-workbook.mjs                 # tách + tự kiểm, không upload
//   node scripts/bom-split-workbook.mjs --apply         # tách + gắn vào hồ sơ SP
//   node scripts/bom-split-workbook.mjs --keep <thư mục>  # giữ lại file đã tách
//
// VÌ SAO Ở MỨC ZIP, KHÔNG DÙNG SheetJS GHI LẠI:
// `BOM MERXX CẦN CHUẨN HÓA LEAD TIME…xlsx` nặng 19,4 MB / 90 sheet, vượt trần
// 10 MB của `doc_type: 'bom'` nên 64 hồ sơ SP không đính kèm được file gốc. Ghi
// lại bằng SheetJS thì ra file nhẹ nhưng MẤT ảnh nhúng và toàn bộ định dạng —
// thành bản dẫn xuất, không còn là "file gốc" để đối chiếu.
//
// Cách làm: mở gói zip, GIỮ NGUYÊN từng phần XML của sheet cần lấy (kể cả
// drawing + ảnh), chỉ vá ba chỗ khai báo: `xl/workbook.xml`, rels của nó, và
// `[Content_Types].xml`. Bản ra vì thế vẫn là chính tờ gốc, chỉ bớt các sheet
// khác.
//
// TỰ KIỂM trước khi upload: mở lại từng file vừa tách bằng SheetJS, đối chiếu
// TÊN SHEET và SỐ DÒNG với bản gốc. Lệch một dòng là bỏ, không gắn.

import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'
import { client } from './products-lib.mjs'

const require = createRequire(import.meta.url)
const XLSX = require('xlsx')
const JSZip = require('jszip')

const SRC = 'E:/All BOM_Thức/BOM MERXX CẦN CHUẨN HÓA LEAD TIME HẾT NGÀY 27-07-2026.xlsx'
const APPLY = process.argv.includes('--apply')
const OUT = (() => {
  const i = process.argv.indexOf('--keep')
  return i >= 0
    ? process.argv[i + 1]
    : 'C:/Users/HP/AppData/Local/Temp/claude/D--HG-ERP/898a80db-19d7-4257-bd66-16d2d0ebc235/scratchpad/split'
})()
const BUCKET = 'attachments'
const MIME_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
const MAX_FILE = 10 * 1024 * 1024

const s = (v) => (v == null ? '' : String(v).replace(/\s+/g, ' ').trim())
const nodau = (v) =>
  s(v)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
const safeName = (v) =>
  nodau(v)
    .replace(/[^a-z0-9._-]+/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 60)

/* ── Đọc gói gốc ─────────────────────────────────────────────────────────── */
const srcBuf = require('node:fs').readFileSync(SRC)
const zip = await JSZip.loadAsync(srcBuf)
const text = (p) => zip.file(p)?.async('string')

const wbXml = await text('xl/workbook.xml')
const wbRels = await text('xl/_rels/workbook.xml.rels')
if (!wbXml || !wbRels) throw new Error('không đọc được workbook.xml')

/** rId → đường dẫn trong xl/ */
const relOf = new Map()
for (const m of wbRels.matchAll(
  /<Relationship\b[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"[^>]*\/>/g,
)) {
  relOf.set(m[1], m[2].replace(/^\//, '').replace(/^xl\//, ''))
}
/** Thẻ <sheet .../> theo đúng thứ tự trong workbook. */
const sheetTags = [...wbXml.matchAll(/<sheet\b[^>]*\/>/g)].map((m) => m[0])
const sheets = sheetTags.map((tag) => ({
  tag,
  name: tag.match(/name="([^"]*)"/)?.[1] ?? '',
  rid: tag.match(/r:id="([^"]+)"/)?.[1] ?? '',
}))

const srcWb = XLSX.readFile(SRC)
const rowsOf = (wb, name) => {
  const ws = wb.Sheets[name]
  if (!ws) return -1
  return XLSX.utils.sheet_to_json(ws, { header: 1, defval: null }).length
}

/* ── Tách một sheet ──────────────────────────────────────────────────────── */
async function extract(sheet) {
  const target = relOf.get(sheet.rid) // "worksheets/sheet7.xml"
  if (!target) return null
  const sheetPath = `xl/${target}`
  if (!zip.file(sheetPath)) return null

  const keep = new Set([
    '[Content_Types].xml',
    '_rels/.rels',
    'xl/workbook.xml',
    'xl/_rels/workbook.xml.rels',
    sheetPath,
  ])
  for (const p of Object.keys(zip.files)) {
    // Phần dùng chung cho cả workbook — giữ hết, nhẹ và cần cho hiển thị.
    if (/^xl\/(styles|sharedStrings)\.xml$/.test(p)) keep.add(p)
    if (/^xl\/theme\//.test(p)) keep.add(p)
    if (/^docProps\//.test(p)) keep.add(p)
  }

  // Sheet → drawing → media: đi theo rels để giữ đúng ảnh của tờ này.
  const sheetRelsPath = sheetPath.replace(/worksheets\//, 'worksheets/_rels/') + '.rels'
  const sheetRels = await text(sheetRelsPath)
  if (sheetRels) {
    keep.add(sheetRelsPath)
    for (const m of sheetRels.matchAll(/Target="([^"]+)"/g)) {
      const t = m[1].replace(/^\.\.\//, 'xl/')
      if (zip.file(t)) keep.add(t)
      if (/drawings\/drawing\d+\.xml$/.test(t)) {
        const dRelsPath = t.replace(/drawings\//, 'drawings/_rels/') + '.rels'
        const dRels = await text(dRelsPath)
        if (dRels) {
          keep.add(dRelsPath)
          for (const mm of dRels.matchAll(/Target="([^"]+)"/g)) {
            const mt = mm[1].replace(/^\.\.\//, 'xl/')
            if (zip.file(mt)) keep.add(mt)
          }
        }
      }
    }
  }

  // Vá ba chỗ KHAI BÁO, phần nội dung giữ nguyên byte.
  const outWbXml = wbXml.replace(
    /<sheets>[\s\S]*?<\/sheets>/,
    `<sheets>${sheet.tag.replace(/sheetId="\d+"/, 'sheetId="1"')}</sheets>`,
  )
  const outWbRels = wbRels.replace(/<Relationship\b[^>]*\/>/g, (rel) => {
    const id = rel.match(/Id="([^"]+)"/)?.[1]
    const tgt = rel.match(/Target="([^"]+)"/)?.[1] ?? ''
    if (id === sheet.rid) return rel
    // Giữ các quan hệ KHÔNG phải worksheet (styles, sharedStrings, theme).
    return /worksheets\//.test(tgt) ? '' : rel
  })
  const ct = await text('[Content_Types].xml')
  const outCt = ct.replace(/<Override\b[^>]*\/>/g, (ov) => {
    const part = ov.match(/PartName="([^"]+)"/)?.[1] ?? ''
    const rel = part.replace(/^\//, '')
    if (/worksheets\//.test(rel) && rel !== sheetPath) return ''
    if (/drawings\//.test(rel) && !keep.has(rel)) return ''
    return ov
  })

  const out = new JSZip()
  for (const p of Object.keys(zip.files)) {
    if (!keep.has(p) || zip.files[p].dir) continue
    if (p === 'xl/workbook.xml') out.file(p, outWbXml)
    else if (p === 'xl/_rels/workbook.xml.rels') out.file(p, outWbRels)
    else if (p === '[Content_Types].xml') out.file(p, outCt)
    else out.file(p, await zip.file(p).async('nodebuffer'))
  }
  return out.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
}

/* ── Chạy ────────────────────────────────────────────────────────────────── */
rmSync(OUT, { recursive: true, force: true })
mkdirSync(OUT, { recursive: true })

const made = []
const bad = []
for (const sh of sheets) {
  let buf
  try {
    buf = await extract(sh)
  } catch (e) {
    bad.push({ sheet: sh.name, why: 'tách lỗi: ' + e.message })
    continue
  }
  if (!buf) {
    bad.push({ sheet: sh.name, why: 'không tìm thấy phần sheet' })
    continue
  }
  const path = `${OUT}/${safeName(sh.name) || 'sheet'}.xlsx`
  writeFileSync(path, buf)

  // TỰ KIỂM: mở lại, phải đúng 1 sheet, đúng tên, đúng số dòng như bản gốc.
  try {
    const back = XLSX.readFile(path)
    const want = rowsOf(srcWb, sh.name)
    const got = rowsOf(back, sh.name)
    if (back.SheetNames.length !== 1 || back.SheetNames[0] !== sh.name)
      throw new Error(`sheet ra "${back.SheetNames.join(',')}"`)
    if (got !== want) throw new Error(`số dòng ${got} ≠ gốc ${want}`)
    made.push({ sheet: sh.name, path, size: buf.length })
  } catch (e) {
    bad.push({ sheet: sh.name, why: 'kiểm lại hỏng: ' + e.message })
  }
}

const mb = (b) => (b / 1024 / 1024).toFixed(2)
console.log(`\n=== TÁCH WORKBOOK ===`)
console.log(
  `Nguồn        : ${SRC.split('/').pop()} (${mb(srcBuf.length)} MB · ${sheets.length} sheet)`,
)
console.log(`Tách + tự kiểm đạt : ${made.length}`)
console.log(`Hỏng               : ${bad.length}`)
console.log(
  `Cỡ file ra   : ${mb(Math.min(...made.map((m) => m.size)))}–${mb(Math.max(...made.map((m) => m.size)))} MB · tổng ${mb(made.reduce((n, m) => n + m.size, 0))} MB`,
)
for (const b of bad.slice(0, 10)) console.log(`  ✗ ${b.sheet} → ${b.why}`)

if (!APPLY) {
  console.log(`\nChưa upload. File nằm ở ${OUT}\nThêm --apply để gắn vào hồ sơ SP.\n`)
  process.exit(0)
}

/* ── Gắn vào hồ sơ SP ────────────────────────────────────────────────────── */
const db = await client(import.meta.url)
async function allRows(table, cols, filter) {
  const out = []
  for (let from = 0; ; from += 1000) {
    let q = db
      .from(table)
      .select(cols)
      .range(from, from + 999)
    if (filter) q = filter(q)
    const { data, error } = await q
    if (error) throw new Error(`${table}: ${error.message}`)
    out.push(...data)
    if (data.length < 1000) break
  }
  return out
}
const products = await allRows(
  'technical_products',
  'id, code, code_legacy, customer_item_code, name',
)
const hasBom = new Set(
  (
    await allRows('files', 'product_id', (q) =>
      q.eq('doc_type', 'bom').is('deleted_at', null).not('product_id', 'is', null),
    )
  ).map((r) => r.product_id),
)
const byKey = new Map()
for (const p of products) {
  for (const k of [p.code, p.code_legacy, p.customer_item_code, p.name]) {
    const key = nodau(k)
    if (key && !byKey.has(key)) byKey.set(key, p)
  }
}
const codesIn = (t) =>
  [
    ...(s(t).match(/\b\d{5}\s*-\s*\d{2,3}\b/g) ?? []),
    ...(s(t).match(/\b[A-Z]{1,2}\d{3,4}HG-[A-Z]{2}\b/gi) ?? []),
  ].map((x) => x.replace(/\s+/g, ''))

let ok = 0
let skip = 0
const noProduct = []
for (const m of made) {
  let p = null
  for (const c of codesIn(m.sheet)) {
    p = byKey.get(nodau(c))
    if (p) break
  }
  if (!p) p = byKey.get(nodau(m.sheet))
  if (!p) {
    noProduct.push(m.sheet)
    continue
  }
  if (hasBom.has(p.id)) {
    skip++
    continue
  }
  const buf = require('node:fs').readFileSync(m.path)
  if (buf.length > MAX_FILE) {
    skip++
    continue
  }
  const filename = `BOM MERXX — ${m.sheet.trim()}.xlsx`
  const path = `product/${p.id}/${randomUUID()}-${safeName(filename)}.xlsx`
  const up = await db.storage
    .from(BUCKET)
    .upload(path, buf, { contentType: MIME_XLSX, upsert: false })
  if (up.error) {
    console.error(`  ✗ ${p.code}: ${up.error.message}`)
    continue
  }
  const { error } = await db.from('files').insert({
    bucket: BUCKET,
    path,
    filename,
    mime_type: MIME_XLSX,
    size_bytes: buf.length,
    doc_type: 'bom',
    product_id: p.id,
    finalized_at: new Date().toISOString(),
  })
  if (error) {
    console.error(`  ✗ ${p.code}: ${error.message}`)
    continue
  }
  ok++
  hasBom.add(p.id)
}
console.log(
  `\nĐÃ GẮN ${ok} file · bỏ ${skip} (SP đã có file) · ${noProduct.length} sheet chưa có hồ sơ`,
)
for (const n of noProduct.slice(0, 10)) console.log(`  – ${n}`)
