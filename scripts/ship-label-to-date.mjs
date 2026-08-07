/**
 * Quy đổi ĐỢT XUẤT từ nhãn chữ sang NGÀY (chủ dự án chốt 07/08/2026).
 *
 *   node scripts/ship-label-to-date.mjs            # dump + in kế hoạch, KHÔNG ghi
 *   node scripts/ship-label-to-date.mjs --apply    # ghi thật
 *
 * Vì sao: ô "Đợt xuất" ở DÒNG lệnh trước đây nhận text tự do (ô cùng nghĩa ở
 * NHÓM thì đã là ô chọn ngày), nên dữ liệu thật lẫn ba kiểu khác nhau — không
 * lọc, không xếp, không cảnh báo hạn được. Nay ô nhập đã đổi thành chọn ngày;
 * script này dọn nốt phần dữ liệu cũ.
 *
 * Ba quy tắc, đúng theo dữ liệu thật đã rà (33 nhãn):
 *   1. `w37.26` (31 dòng) → THỨ HAI của tuần ISO đó = 2026-09-07. Lấy đầu tuần
 *      làm mốc: xưởng đọc ra "phải xong trước ngày này".
 *   2. `11/01/27` (1 dòng + 1 nhóm) → đã có sẵn `ship_date` 2027-01-11 khớp
 *      từng ngày, nhãn chỉ là bản in lại → xoá nhãn, giữ ngày.
 *   3. Đoạn ghi chú dài (1 dòng, "DỰ KIẾN kiểm hàng 5/10… Xuất hàng 10/10/2026…
 *      Với điều kiện các test report PASS") → KHÔNG phải đợt xuất mà là điều
 *      kiện giao: ngày xuất 2026-10-10 vào `ship_date`, toàn bộ chữ dồn sang
 *      `note` của dòng (nối vào note cũ nếu có) — không mất chữ nào.
 *
 * CHỈ ĐỘNG VÀO DÒNG/NHÓM CÓ ship_label. Bản ghi đã là ngày thuần thì không đụng.
 * Chạy lại vô hại: xong lượt đầu thì không còn nhãn nào để đổi.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const env = readFileSync('.env.local', 'utf8')
for (const line of env.split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  { auth: { persistSession: false } },
)

const APPLY = process.argv.includes('--apply')

function die(msg) {
  console.error(`\n✗ ${msg}`)
  process.exit(1)
}

/** Thứ Hai của tuần ISO `w<tuần>.<yy>` — vd w37.26 → 2026-09-07. */
function isoWeekMonday(week, year) {
  // 4/1 luôn nằm trong tuần ISO 1 → lùi về thứ Hai của tuần đó rồi cộng tuần.
  const jan4 = new Date(Date.UTC(year, 0, 4))
  const dow = jan4.getUTCDay() || 7 // CN = 7
  const week1Mon = new Date(jan4)
  week1Mon.setUTCDate(jan4.getUTCDate() - (dow - 1))
  const d = new Date(week1Mon)
  d.setUTCDate(week1Mon.getUTCDate() + (week - 1) * 7)
  return d.toISOString().slice(0, 10)
}

/**
 * Đọc một nhãn ra { date, note }. `date` null = không suy được ngày.
 * Trả `null` nghĩa là nhãn không khớp quy tắc nào → script DỪNG chứ không đoán.
 */
function parseLabel(label, shipDate) {
  const raw = label.trim()

  // 1. Tuần: w37.26 / W37.2026
  const wk = raw.match(/^w\s*(\d{1,2})\s*[.\/-]\s*(\d{2}|\d{4})$/i)
  if (wk) {
    const week = Number(wk[1])
    const yy = Number(wk[2])
    const year = yy < 100 ? 2000 + yy : yy
    if (week < 1 || week > 53) return null
    return { date: isoWeekMonday(week, year), note: null, kind: `tuần ${week}/${year}` }
  }

  // 2. Ngày viết tay dd/mm/yy — chỉ nhận khi đã có ship_date TRÙNG KHỚP, tức
  //    nhãn chỉ là bản in lại. Lệch nhau thì dừng, để người xem quyết.
  const dmy = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/)
  if (dmy) {
    const [, d, m, y] = dmy
    const year = Number(y) < 100 ? 2000 + Number(y) : Number(y)
    const iso = `${year}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    if (shipDate && shipDate.slice(0, 10) !== iso) return null
    return { date: iso, note: null, kind: 'ngày viết tay (trùng ship_date)' }
  }

  // 3. Đoạn ghi chú dài có nêu ngày xuất hàng → lấy ngày, chữ về note.
  const xuat = raw.match(/xu[âấ]t\s*h[àa]ng\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/i)
  if (xuat) {
    const [, d, m, y] = xuat
    const iso = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    return { date: iso, note: raw, kind: 'ghi chú dài → tách ngày xuất' }
  }

  return null
}

async function sel(table, cols, apply = (q) => q) {
  const { data, error } = await apply(sb.from(table).select(cols))
  if (error) die(`${table}: ${error.message}`)
  return data
}

// ── 1. Gom việc ────────────────────────────────────────────────────────────
const lines = await sel(
  'production_order_lines',
  'id, product_code, ship_label, ship_date, note',
  (q) => q.not('ship_label', 'is', null),
)
const groups = await sel(
  'production_order_groups',
  'id, title, ship_label, ship_date',
  (q) => q.not('ship_label', 'is', null),
)

const plan = []
const unknown = []
for (const [table, rows] of [
  ['production_order_lines', lines],
  ['production_order_groups', groups],
]) {
  for (const r of rows) {
    const parsed = parseLabel(r.ship_label, r.ship_date)
    if (!parsed) {
      unknown.push({ table, label: r.ship_label, id: r.id })
      continue
    }
    plan.push({
      table,
      id: r.id,
      label: r.ship_label,
      nhan: r.product_code ?? r.title ?? r.id,
      ...parsed,
      noteCu: r.note ?? null,
    })
  }
}

if (unknown.length) {
  die(
    `Có ${unknown.length} nhãn không đọc ra ngày được — DỪNG, không đoán bừa:\n` +
      unknown.map((u) => `    [${u.table}] ${JSON.stringify(u.label)}`).join('\n') +
      `\n  Bổ sung quy tắc vào parseLabel() hoặc sửa tay các bản ghi này.`,
  )
}

// ── 2. Dump ────────────────────────────────────────────────────────────────
mkdirSync('supabase/backups', { recursive: true })
const path = 'supabase/backups/2026-08-07_ship-label-to-date.json'
writeFileSync(
  path,
  JSON.stringify(
    {
      note: 'Nhãn đợt xuất dạng chữ TRƯỚC khi quy đổi sang ngày (07/08/2026). Khôi phục = ghi lại ship_label/ship_date/note theo id.',
      lines,
      groups,
      plan,
    },
    null,
    2,
  ),
  'utf8',
)
console.log(`Đã dump → ${path}\n`)

const byKind = new Map()
for (const p of plan) byKind.set(p.kind, (byKind.get(p.kind) ?? 0) + 1)
for (const [kind, n] of byKind) console.log(`  ${kind}: ${n} bản ghi`)

console.log('\nChi tiết:')
for (const p of plan) {
  const noteFlag = p.note ? ' + chuyển chữ sang Ghi chú' : ''
  console.log(
    `  [${p.table === 'production_order_lines' ? 'dòng ' : 'nhóm '}] ${String(p.nhan).padEnd(16)} ` +
      `${JSON.stringify(p.label).slice(0, 34).padEnd(36)} → ${p.date}${noteFlag}`,
  )
}

if (!APPLY) {
  console.log('\n(chưa ghi — chạy lại với --apply để thực hiện)')
  process.exit(0)
}

// ── 3. Ghi ─────────────────────────────────────────────────────────────────
let n = 0
for (const p of plan) {
  const patch = { ship_date: p.date, ship_label: null }
  if (p.note) {
    patch.note = [p.noteCu, p.note].filter(Boolean).join('\n')
  }
  const { error } = await sb.from(p.table).update(patch).eq('id', p.id)
  if (error) die(`${p.table} ${p.nhan}: ${error.message}`)
  n += 1
}
console.log(`\n✓ Đã quy đổi ${n} bản ghi sang ngày`)
