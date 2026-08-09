// RÀ HỒ SƠ SẢN PHẨM ↔ KHO FILE BKQC ("All Bom") — chỉ BÁO CÁO, không tự nạp.
//
//   node scripts/bom-gap-report.mjs
//
// Trả lời 3 câu cho từng SP trong hệ thống:
//   1. Đã có BOM trong ERP chưa (số dòng technical_product_parts)?
//   2. Có FILE BKQC nào trong thư mục "All Bom" khớp mã không (khớp theo
//      code_legacy kiểu 21600-217 hoặc mã HG kiểu C0005HG-AL nằm trong tên file)?
//   3. Hồ sơ thiếu gì (ảnh, BOM)?
// Kèm chiều ngược: file BKQC không khớp SP nào (SP chưa khai trong hệ thống).

import { readdirSync } from 'node:fs'
import { client } from './products-lib.mjs'

const BOM_DIR = 'C:/Users/HP/Downloads/All Bom'

const db = await client(import.meta.url)

// ── Sản phẩm trong hệ ───────────────────────────────────────────────────────
const products = []
for (let from = 0; ; from += 1000) {
  const { data, error } = await db
    .from('technical_products')
    .select('id, code, code_legacy, name, customer_name, bom_status, image_file_id')
    .order('code')
    .range(from, from + 999)
  if (error) throw new Error(error.message)
  products.push(...data)
  if (data.length < 1000) break
}
const { data: partRows, error: pe } = await db
  .from('technical_product_parts')
  .select('product_id')
  .limit(20000)
if (pe) throw new Error(pe.message)
const partCount = new Map()
for (const r of partRows)
  partCount.set(r.product_id, (partCount.get(r.product_id) ?? 0) + 1)

// ── File BKQC ───────────────────────────────────────────────────────────────
const files = readdirSync(BOM_DIR).filter((f) => /\.(xlsx|xls)$/i.test(f))
// Mã trong TÊN FILE: legacy "21600-217" / HG "C0005HG-AL" (có thể nhiều mã một file).
const codesOf = (f) => [
  ...(f.match(/\b\d{5}-\d{3}\b/g) ?? []),
  ...(f.match(/\b[A-Z]\d{4}HG-[A-Z]{2}\b/gi) ?? []).map((c) => c.toUpperCase()),
]
const fileByCode = new Map()
for (const f of files) {
  for (const c of codesOf(f)) {
    if (!fileByCode.has(c)) fileByCode.set(c, [])
    fileByCode.get(c).push(f)
  }
}

// ── Đối chiếu ───────────────────────────────────────────────────────────────
const rows = products.map((p) => {
  const codes = [p.code, p.code_legacy].filter(Boolean).map((c) => c.toUpperCase())
  const bkqc = codes.flatMap((c) => fileByCode.get(c) ?? [])
  return {
    code: p.code,
    legacy: p.code_legacy ?? '',
    name: p.name,
    customer: p.customer_name ?? '',
    bomRows: partCount.get(p.id) ?? 0,
    bomStatus: p.bom_status ?? '',
    hasImage: !!p.image_file_id,
    bkqcFiles: [...new Set(bkqc)],
  }
})

const noBom = rows.filter((r) => r.bomRows === 0)
const noBomWithFile = noBom.filter((r) => r.bkqcFiles.length > 0)
const noBomNoFile = noBom.filter((r) => r.bkqcFiles.length === 0)
const noImage = rows.filter((r) => !r.hasImage)

const matchedCodes = new Set(
  rows.flatMap((r) => [r.code, r.legacy].filter(Boolean).map((c) => c.toUpperCase())),
)
const orphanFiles = files.filter((f) => {
  const cs = codesOf(f)
  return cs.length > 0 && !cs.some((c) => matchedCodes.has(c))
})
const noCodeFiles = files.filter((f) => codesOf(f).length === 0)

console.log(
  `SẢN PHẨM trong hệ: ${rows.length} · file BKQC trong "All Bom": ${files.length}`,
)
console.log(
  `\n━━ 1. SP CHƯA CÓ BOM nhưng CÓ FILE BKQC khớp mã — nạp được ngay (${noBomWithFile.length}):`,
)
for (const r of noBomWithFile) {
  console.log(
    `  ${r.code}${r.legacy ? ` (${r.legacy})` : ''} — ${r.name} [${r.customer}]`,
  )
  for (const f of r.bkqcFiles.slice(0, 2)) console.log(`      ↳ ${f}`)
}
console.log(
  `\n━━ 2. SP CHƯA CÓ BOM và KHÔNG tìm thấy file BKQC theo mã (${noBomNoFile.length}) — Kỹ thuật bổ sung tay / dò file theo tên:`,
)
for (const r of noBomNoFile.slice(0, 60)) {
  console.log(
    `  ${r.code}${r.legacy ? ` (${r.legacy})` : ''} — ${r.name} [${r.customer}]`,
  )
}
if (noBomNoFile.length > 60) console.log(`  … và ${noBomNoFile.length - 60} SP nữa`)
console.log(`\n━━ 3. SP thiếu ẢNH (${noImage.length}):`)
for (const r of noImage.slice(0, 40)) console.log(`  ${r.code} — ${r.name}`)
if (noImage.length > 40) console.log(`  … và ${noImage.length - 40} SP nữa`)
console.log(
  `\n━━ 4. File BKQC CÓ MÃ nhưng mã KHÔNG có trong hệ (${orphanFiles.length}) — SP chưa khai hồ sơ:`,
)
for (const f of orphanFiles.slice(0, 40)) console.log(`  ? ${f}`)
if (orphanFiles.length > 40) console.log(`  … và ${orphanFiles.length - 40} file nữa`)
console.log(
  `\n━━ 5. File BKQC KHÔNG đọc được mã từ tên file (${noCodeFiles.length}) — đặt tên tự do, dò tay:`,
)
for (const f of noCodeFiles.slice(0, 40)) console.log(`  ~ ${f}`)
if (noCodeFiles.length > 40) console.log(`  … và ${noCodeFiles.length - 40} file nữa`)
