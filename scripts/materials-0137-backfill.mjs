// BACKFILL 3 CỘT THÔNG SỐ THEO NHÓM (0137) từ các file đơn thật của Cung ứng:
//   · open_style + pcs_per_ctn — sheet bao bì (KIMPACK/BB: "Cách mở | Pcs/ctn")
//   · finish                   — sheet inox/nhôm tấm ("Màu / bề mặt")
//
//   node scripts/materials-0137-backfill.mjs            # dò khô, chỉ in báo cáo
//   node scripts/materials-0137-backfill.mjs --apply    # ghi thật
//
// AN TOÀN (cùng nếp bom-material-match / import-po-file-refs):
//   1. Mặc định DÒ KHÔ; --apply mới ghi.
//   2. CHỈ ĐIỀN Ô TRỐNG — không đè giá trị đang có (kể cả khác nhau thì báo).
//   3. Khớp tên bằng ĐÚNG bộ khoá server chặn trùng (src/lib/material-key.ts):
//      mức CHẮC (sureKey trùng) tự áp; mức MỜ (namesAlike) CHỈ IN cho người rà
//      — gán bừa một cách-mở sai là m² và tiền của mọi đơn sau sai theo.
//   4. Hai sheet nói khác nhau về cùng một mã → không ghi, in ra để người chọn.

import { createRequire } from 'node:module'
import { loadEnv, client, chunk } from './products-lib.mjs'
import { sureKey, namesAlike, MIN_KEY_LEN } from '../src/lib/material-key.ts'

const require = createRequire(import.meta.url)
const XLSX = require('xlsx')

const APPLY = process.argv.includes('--apply')
const DL = 'C:/Users/HP/Downloads'
const PO = 'E:/PO'
// Thứ tự ≈ thời gian (LSX 01 → 04) — file sau thắng khi trùng và ô còn trống.
// E:/PO là bộ "FORM ĐẶT HÀNG MỚI" (45 sheet) — nguồn giàu nhất, đặt sau cùng.
const FILES = [
  `${DL}/Copy of LSX 01.26.27( 17976 HG-MX) 1.xlsx`,
  `${DL}/THEO DÕI  VẬT TƯ - LSX 01.26.xlsx`,
  `${DL}/Copy of LSX 02.26.27( 17984 HG-MX).xlsx`,
  `${DL}/THEO DÕI VẬT TƯ - LSX 02.26.xlsx`,
  `${DL}/Copy of LSX 03.26.27( 17994 HG-MX).xls`,
  `${DL}/LSX 04 + BẢNG KÊ VT.xlsx`,
  `${PO}/LSX 01.26.27( 17976 HG-MX) theo form đặt hàng mới.xlsx`,
  `${PO}/LSX 02.26.27( 17976 HG-MX) INOX.xlsx`,
  `${PO}/LSX 02.26.27( 17984 HG-MX)  theo form đặt hàng mới.xlsx`,
  `${PO}/LSX 03.26.27( 17994 HG-MX) theo form đặt hàng mới.xls`,
  `${PO}/LSX 04 + BẢNG KÊ VT.xlsx`,
  `${PO}/LSX 04.26.27( 18005 HG-MX) BIỂU MẪU TÍNH NHÔM ĐẶT NCC.xls`,
  `${PO}/YOTRIO-01-BIỂU MẪU TÍNH NHÔM ĐẶT NCC.xlsx`,
  `${PO}/THEO DÕI VẬT TƯ - LSX 02.26.xlsx`,
]

const s = (v) => (v == null ? '' : String(v).replace(/\s+/g, ' ').trim())
const nod = (v) =>
  s(v)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
const numOf = (v) => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

/** "AD"/"MR"/"ĐK" từ đủ kiểu viết trong sổ ("AD (âm dương)", "Đối khẩu"…). */
function openStyleOf(v) {
  const t = nod(v)
  if (!t) return null
  if (/^ad\b|am duong/.test(t)) return 'AD'
  if (/^mr\b|mot manh/.test(t)) return 'MR'
  if (/^dk\b|doi khau/.test(t)) return 'ĐK'
  return null
}

// ── Bóc dòng (tên → giá trị 0137) từ mọi sheet của 6 file ───────────────────

/** Mỗi entry: { name, open_style?, pcs?, finish?, src } */
const found = []

for (const file of FILES) {
  let wb
  try {
    wb = XLSX.readFile(file, { dense: true })
  } catch (e) {
    console.log(`!! bỏ qua ${file}: ${e.message}`)
    continue
  }
  const short = file.split('/').pop()
  for (const sheetName of wb.SheetNames) {
    const rows = wb.Sheets[sheetName]['!data'] ?? []
    // Tìm dòng tiêu đề trong 30 dòng đầu.
    for (let r = 0; r < Math.min(rows.length, 30); r++) {
      const head = (rows[r] ?? []).map((c) => nod(c?.v))
      const colName = head.findIndex((t) => /ten (hang hoa|san pham|sp)/.test(t))
      if (colName < 0) continue

      const colOpen = head.findIndex((t) => /cach mo/.test(t))
      const colPcs = head.findIndex((t) => /pcs\s*\/?\s*(ctn|cart|thung)/.test(t))
      const colFinish = head.findIndex((t) => /mau\s*\/\s*be mat|^be mat$/.test(t))
      if (colOpen < 0 && colPcs < 0 && colFinish < 0) continue

      /*
       * Sheet inox/nhôm tấm: cột "Tên SP/vật tư" ghi tên SẢN PHẨM ("Bàn CN
       * Keros"), danh tính VẬT TƯ nằm ở "Quy cách / Thông số KT" ("Inox tấm
       * 304/2B x 3.0") — khớp danh mục phải bằng cột đó, không phải cột tên.
       */
      const colSpec = head.findIndex((t) => /quy cach/.test(t))
      const nameCol = colFinish >= 0 && colSpec >= 0 ? colSpec : colName

      const src = `${short} [${sheetName}]`
      for (let i = r + 1; i < rows.length; i++) {
        const row = rows[i] ?? []
        const name = s(row[nameCol]?.v)
        // Hết bảng: dòng trống hoặc dòng tổng.
        if (!name) continue
        if (/^(tong|cong)\b/.test(nod(name))) break
        const entry = { name, src }
        if (colOpen >= 0) entry.open_style = openStyleOf(row[colOpen]?.v)
        if (colPcs >= 0) {
          const p = numOf(row[colPcs]?.v)
          entry.pcs = p != null && p > 0 && Number.isInteger(p) ? p : null
        }
        if (colFinish >= 0) entry.finish = s(row[colFinish]?.v) || null
        if (entry.open_style || entry.pcs || entry.finish) found.push(entry)
      }
      break // một sheet chỉ đọc một bảng
    }
  }
}

console.log(`Bóc được ${found.length} dòng mang thông số 0137 từ ${FILES.length} file.`)

// ── Gộp theo TÊN (sổ lặp cùng mặt hàng nhiều kỳ) + phát hiện mâu thuẫn ──────

/** key sổ → { name, open_style, pcs, finish, srcs, conflict: [] } */
const byName = new Map()
for (const e of found) {
  const key = sureKey(e.name)
  if (key.length < MIN_KEY_LEN) continue
  const cur = byName.get(key) ?? {
    name: e.name,
    open_style: null,
    pcs: null,
    finish: null,
    srcs: new Set(),
    conflict: [],
  }
  for (const f of ['open_style', 'pcs', 'finish']) {
    if (e[f] == null) continue
    if (cur[f] == null) cur[f] = e[f]
    else if (String(cur[f]) !== String(e[f])) {
      cur.conflict.push(`${f}: "${cur[f]}" vs "${e[f]}" (${e.src})`)
    }
  }
  cur.srcs.add(e.src)
  byName.set(key, cur)
}
console.log(`Gộp còn ${byName.size} mặt hàng riêng biệt.`)

// ── Nạp danh mục (phân trang — supabase-js trần 1.000 dòng/lượt) ────────────

loadEnv(import.meta.url)
const db = await client(import.meta.url)
const materials = []
for (let from = 0; ; from += 1000) {
  const { data, error } = await db
    .from('warehouse_materials')
    .select('id, code, name, open_style, pcs_per_ctn, finish')
    .range(from, from + 999)
  if (error) throw error
  materials.push(...data)
  if (data.length < 1000) break
}
console.log(`Danh mục: ${materials.length} vật tư.`)

const matBySure = new Map()
for (const m of materials) {
  const k = sureKey(m.name)
  if (k.length < MIN_KEY_LEN) continue
  if (!matBySure.has(k)) matBySure.set(k, [])
  matBySure.get(k).push(m)
}

// ── Đối chiếu → bản vá ──────────────────────────────────────────────────────

const patches = [] // { id, code, name, set: {...}, src }
const fuzzy = [] // mức MỜ — chỉ in
const conflicts = []
const skippedHave = [] // ô đã có giá trị (hiện tại = 0 mã, nhưng chạy lại phải an toàn)
let unmatched = 0

for (const [key, e] of byName) {
  if (e.conflict.length > 0) {
    conflicts.push(`- "${e.name}": ${e.conflict.join(' · ')}`)
    continue
  }
  let hits = matBySure.get(key) ?? []
  if (hits.length === 0) {
    const alike = materials.filter((m) => namesAlike(e.name, m.name))
    if (alike.length === 1) {
      fuzzy.push(
        `- "${e.name}" ≈ ${alike[0].code} — ${alike[0].name} (${[...e.srcs][0]})`,
      )
    } else {
      unmatched++
    }
    continue
  }
  if (hits.length > 1) {
    conflicts.push(
      `- "${e.name}" khớp ${hits.length} mã: ${hits.map((h) => h.code).join(', ')}`,
    )
    continue
  }
  const m = hits[0]
  const set = {}
  if (e.open_style && m.open_style == null) set.open_style = e.open_style
  else if (e.open_style && m.open_style !== e.open_style)
    skippedHave.push(
      `- ${m.code} open_style đang "${m.open_style}", sổ nói "${e.open_style}"`,
    )
  if (e.pcs && m.pcs_per_ctn == null) set.pcs_per_ctn = e.pcs
  else if (e.pcs && Number(m.pcs_per_ctn) !== e.pcs)
    skippedHave.push(`- ${m.code} pcs đang ${m.pcs_per_ctn}, sổ nói ${e.pcs}`)
  if (e.finish && m.finish == null) set.finish = e.finish.slice(0, 100)
  else if (e.finish && m.finish !== e.finish)
    skippedHave.push(`- ${m.code} finish đang "${m.finish}", sổ nói "${e.finish}"`)
  if (Object.keys(set).length > 0) {
    patches.push({ id: m.id, code: m.code, name: m.name, set, src: [...e.srcs][0] })
  }
}

// ── Báo cáo ─────────────────────────────────────────────────────────────────

const cnt = { open_style: 0, pcs_per_ctn: 0, finish: 0 }
for (const p of patches) for (const k of Object.keys(p.set)) cnt[k]++
console.log(`\n== KẾT QUẢ ==`)
console.log(`Ghi được (mức CHẮC, ô trống): ${patches.length} mã`)
console.log(
  `  · cách mở: ${cnt.open_style} · pcs/thùng: ${cnt.pcs_per_ctn} · bề mặt: ${cnt.finish}`,
)
console.log(`Mức MỜ (chỉ in, người rà):    ${fuzzy.length}`)
console.log(`Mâu thuẫn giữa các sổ:        ${conflicts.length}`)
console.log(`Ô đã có giá trị khác sổ:      ${skippedHave.length}`)
console.log(`Không khớp mã nào:            ${unmatched}`)

for (const p of patches) {
  console.log(
    `  ${p.code} — ${p.name.slice(0, 50)} ← ${JSON.stringify(p.set)}  (${p.src})`,
  )
}
if (fuzzy.length) console.log(`\n-- MỜ --\n${fuzzy.join('\n')}`)
if (conflicts.length) console.log(`\n-- MÂU THUẪN --\n${conflicts.join('\n')}`)
if (skippedHave.length) console.log(`\n-- ĐÃ CÓ GIÁ TRỊ --\n${skippedHave.join('\n')}`)

if (!APPLY) {
  console.log('\nDò khô — chưa ghi gì. Chạy lại với --apply để ghi.')
  process.exit(0)
}

for (const batch of chunk(patches, 50)) {
  for (const p of batch) {
    const { error } = await db.from('warehouse_materials').update(p.set).eq('id', p.id)
    if (error) throw new Error(`${p.code}: ${error.message}`)
  }
}
console.log(`\nĐÃ GHI ${patches.length} mã.`)
