/**
 * BỔ SUNG QUY CÁCH TỪ TÊN VẬT TƯ — 12.904/12.991 vật tư đang trống `spec`
 * trong khi tên đã chứa sẵn kích thước ("Inox hộp 60x60x1.0li", "Nhôm ø34
 * T1.8", "Bulong 6x60x13 xi đen"…). Quy cách trống thì dòng đơn đặt hàng
 * không tự điền được (08/08/2026).
 *
 *   node scripts/materials-spec-from-name.mjs            # dry-run: chỉ in đề xuất
 *   node scripts/materials-spec-from-name.mjs --apply    # ghi DB + backup
 *
 * Nguyên tắc:
 *   - CHỈ điền dòng spec đang TRỐNG — không bao giờ ghi đè quy cách đã khai.
 *   - Chỉ nhận pattern đủ tự tin: chuỗi ≥2 số nối bằng x/×/* (kèm đơn vị
 *     li/ly/mm/zem/m), hoặc phi/ø/Φ + số, hoặc que-dây hàn "D2.5".
 *     Số đơn lẻ kiểu "Máy khoan 13mm" KHÔNG lấy — dễ vơ nhầm thông số máy.
 *   - Chuẩn hoá đầu ra: x → ×, phi/ø → Φ, dấu phẩy thập phân → chấm.
 *   - --apply lưu backup [{id, code, name, spec_cũ}] vào supabase/backups/
 *     trước khi ghi — đảo lại được bằng tay nếu cần.
 */
import { writeFileSync } from 'node:fs'
import { client, chunk } from './products-lib.mjs'

const APPLY = process.argv.includes('--apply')

// ── Bóc quy cách từ tên ──────────────────────────────────────────────────────

const NUM = String.raw`\d+(?:[.,]\d+)?`
// cm đứng TRƯỚC m để "90cm" không bị ăn cụt thành "90c"+"m"; thiếu cm là mất
// đơn vị thật ("890x800x90cm" → 90 trần — 90 gì?).
const UNIT = String.raw`(?:mm|cm|ly|li|lĩ|zem)`
// Một mắt xích "× số (đơn vị)". Tên import từ Excel có cả "1510\*910\*120mm"
// (dấu * bị escape thành \*) nên separator cho phép \ đứng trước.
const LINK = String.raw`\s*\\*[x×*]{1,2}\s*${NUM}\s*(?:${UNIT}|m\b)?`

// Chuỗi ≥2 số: "60x60x1.0li", "2.95X1200X2400", "V50x50x5x890mm", "khổ 1200x2400"
const CHAIN = new RegExp(
  String.raw`(?:\b(?:khổ|kt):?\s+)?(?:\bV\s*)?\b${NUM}\s*${UNIT}?(?:${LINK}){1,4}`,
  'iu',
)
// phi/ø/Φ + số, có thể nối chuỗi: "phi 25x0.6mm", "ø34", "phi 6".
// Lookbehind chặn chữ dính liền trước — "Delphi 170" KHÔNG phải "phi 170".
const PHI = new RegExp(
  String.raw`(?<![A-Za-zÀ-ỹ])(?:phi|ø|Ø|Φ)\s*${NUM}\s*${UNIT}?(?:${LINK}){0,3}`,
  'iu',
)
// Que/dây hàn: "D2.5" — chỉ khi tên có chữ "hàn" (tránh vơ mã hàng D27…)
const WELD = new RegExp(String.raw`\bD\s?${NUM}\b`, 'iu')

// Đuôi mở rộng ngay SAU đoạn khớp: độ dày T1.8 / "dày 3mm" / "L=1800mm"
const EXTS = [
  new RegExp(String.raw`^[\s,]*T\s?${NUM}`, 'iu'),
  new RegExp(String.raw`^[\s,]*dày\s*${NUM}\s*${UNIT}?`, 'iu'),
  new RegExp(String.raw`^[\s,]*L\s*=?\s*\d+\s*(?:mm|m)\b`, 'iu'),
]

/** Chuẩn hoá đoạn quy cách đã bóc. */
function normalize(s) {
  return s
    .replace(/(?:phi|ø|Ø)\s*/giu, 'Φ')
    .replace(/\s*\\*[x×*]{1,2}\s*/gi, '×') // cả X hoa lẫn dấu \* của tên import Excel
    .replace(/(\d),(\d)/g, '$1.$2')
    .replace(/\s+/g, ' ')
    .replace(/[,;.\s]+$/g, '')
    .trim()
}

/** Tên → quy cách đề xuất, null nếu không đủ tự tin. */
export function specFromName(name) {
  const n = String(name ?? '')
  let m = n.match(PHI) ?? n.match(CHAIN)
  if (!m && /hàn/iu.test(n)) m = n.match(WELD)
  if (!m) return null
  let spec = m[0]
  // Nới sang phải cho các đuôi T#/dày/L= dính liền sau đoạn khớp.
  let rest = n.slice(m.index + m[0].length)
  for (let guard = 0; guard < 3; guard++) {
    const ext = EXTS.map((r) => rest.match(r)).find(Boolean)
    if (!ext) break
    spec += ` ${ext[0].replace(/^[\s,]+/, '')}`
    rest = rest.slice(ext[0].length)
  }
  const out = normalize(spec)
  // Chặn rác: phải còn số, đủ dài ("Φ6" là quy cách thật), không phải nguyên tên.
  if (out.length < 2 || !/\d/.test(out)) return null
  if (out === normalize(n)) return null
  return out
}

// ── Chạy ─────────────────────────────────────────────────────────────────────

async function main() {
  const db = await client(import.meta.url)

  // Nạp toàn bộ vật tư đang trống spec (phân trang 1000 — mặc định max-rows).
  const rows = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .from('warehouse_materials')
      .select('id, code, name, spec')
      .eq('is_active', true)
      .or('spec.is.null,spec.eq.')
      .order('code')
      .range(from, from + 999)
    if (error) throw new Error(error.message)
    rows.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }

  const proposals = []
  for (const r of rows) {
    const spec = specFromName(r.name)
    if (spec) proposals.push({ ...r, spec_new: spec })
  }

  console.log(`Vật tư trống quy cách: ${rows.length}`)
  console.log(`Bóc được từ tên:       ${proposals.length}`)
  console.log('\nMẫu 40 dòng đầu:')
  for (const p of proposals.slice(0, 40)) {
    console.log(`  ${p.code}  ${p.name}`)
    console.log(`      → ${p.spec_new}`)
  }

  if (!APPLY) {
    console.log('\nDry-run — chưa ghi gì. Chạy lại với --apply để cập nhật.')
    return
  }

  // Backup trước khi ghi.
  const stamp = new Date().toISOString().slice(0, 10)
  const backupPath = new URL(
    `../supabase/backups/${stamp}_materials-spec-from-name.json`,
    import.meta.url,
  )
  writeFileSync(
    backupPath,
    JSON.stringify(
      proposals.map(({ id, code, name, spec }) => ({ id, code, name, spec_old: spec })),
      null,
      2,
    ),
  )
  console.log(`\nĐã lưu backup ${proposals.length} dòng → supabase/backups/`)

  let done = 0
  for (const batch of chunk(proposals, 50)) {
    await Promise.all(
      batch.map(async (p) => {
        const { error } = await db
          .from('warehouse_materials')
          .update({ spec: p.spec_new })
          .eq('id', p.id)
          .or('spec.is.null,spec.eq.') // chốt chặn lần cuối: chỉ ghi dòng còn trống
        if (error) throw new Error(`${p.code}: ${error.message}`)
      }),
    )
    done += batch.length
    if (done % 1000 < 50) console.log(`  đã ghi ${done}/${proposals.length}…`)
  }
  console.log(`✓ Đã cập nhật quy cách cho ${done} vật tư.`)
}

// Cho phép import specFromName từ test mà không chạy main.
if (
  process.argv[1] &&
  import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop())
) {
  main().catch((e) => {
    console.error('✗', e.message)
    process.exit(1)
  })
}
