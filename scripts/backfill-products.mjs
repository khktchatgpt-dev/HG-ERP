// Backfill thư viện SP: quy đổi kích thước mm -> cm (điền đủ Dài×Rộng×Cao) +
// xuất xứ mặc định "Vietnam". Dry-run mặc định; --apply để ghi.
//
//   node scripts/backfill-products.mjs --manifest <path>
//   node scripts/backfill-products.mjs --manifest <path> --apply
//
// Nguồn dims là MM (đã kiểm: 700mm = mô tả "70cm"); cột packing.*_cm là CM.
// dimw->w_cm, dimd->l_cm (sâu≈dài), dimh->h_cm. Chuỗi "760/935" (gập/mở) lấy số
// đầu. Giữ nguyên nw_kg/gw_kg. origin_country chỉ set khi đang trống.

import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const argv = process.argv.slice(2)
const APPLY = argv.includes('--apply')
const arg = (n) => {
  const i = argv.indexOf(n)
  return i >= 0 ? argv[i + 1] : null
}
const MANIFEST = arg('--manifest')
if (!MANIFEST) {
  console.error('✗ cần --manifest')
  process.exit(1)
}

function loadEnv() {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SECRET_KEY) return
  let txt
  try {
    txt = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
  } catch {
    return
  }
  for (const line of txt.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}
loadEnv()
const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  { auth: { persistSession: false } },
)
const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'))

const firstNum = (s) => {
  const m = String(s).match(/-?\d+(\.\d+)?/)
  return m ? parseFloat(m[0]) : null
}
const mmToCm = (mm) => (mm && mm > 0 ? Math.round((mm / 10) * 10) / 10 : null)

async function main() {
  const { data: existing, error } = await sb
    .from('technical_products')
    .select('id, code, packing, origin_country')
  if (error) throw error
  const byCode = new Map(existing.map((e) => [e.code, e]))

  const plan = []
  for (const p of manifest) {
    const cur = byCode.get(p.code)
    if (!cur) continue
    const dr = p.dims_raw || {}
    const dims = {
      w_cm: mmToCm(firstNum(dr.dimw)),
      l_cm: mmToCm(firstNum(dr.dimd)),
      h_cm: mmToCm(firstNum(dr.dimh)),
    }
    // packing mới = giữ nw/gw cũ + dims quy đổi (bỏ khóa null)
    const packing = { ...(cur.packing || {}) }
    for (const k of ['w_cm', 'l_cm', 'h_cm']) {
      if (dims[k] != null) packing[k] = dims[k]
    }
    const patch = {}
    if (JSON.stringify(packing) !== JSON.stringify(cur.packing || {}))
      patch.packing = packing
    if (!cur.origin_country) patch.origin_country = 'Vietnam'
    if (Object.keys(patch).length) plan.push({ id: cur.id, code: p.code, patch, dims })
  }

  console.log(`\n=== BACKFILL ${APPLY ? '**APPLY**' : 'DRY-RUN'} ===`)
  console.log(`SP cần cập nhật: ${plan.length}/${manifest.length}`)
  console.log('\nVí dụ 8 SP:')
  for (const it of plan.slice(0, 8)) {
    const d = it.dims
    console.log(
      `  ${it.code}: kt(cm)=${d.l_cm ?? '—'}×${d.w_cm ?? '—'}×${d.h_cm ?? '—'} | xuất xứ=${it.patch.origin_country ?? '(giữ)'}`,
    )
  }
  if (!APPLY) {
    console.log('\nChạy lại --apply để ghi.')
    return
  }

  let ok = 0,
    fail = 0
  for (const it of plan) {
    const { error } = await sb.from('technical_products').update(it.patch).eq('id', it.id)
    if (error) {
      console.error(`✗ ${it.code}: ${error.message}`)
      fail++
    } else ok++
  }
  console.log(`\nXONG: cập nhật ok=${ok} fail=${fail}`)
}
main().catch((e) => {
  console.error(e)
  process.exit(1)
})
