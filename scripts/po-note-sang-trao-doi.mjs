// DỜI GHI CHÚ NỘI BỘ KHỎI Ô IN LÊN PHIẾU → MỤC TRAO ĐỔI (doc_notes, internal) — 27/09/2026.
//
//   node scripts/po-note-sang-trao-doi.mjs            # dò khô
//   node scripts/po-note-sang-trao-doi.mjs --apply    # ghi
//
// Vì sao: phiếu in gửi NCC (print/supply/PoPrintSheet) in NGUYÊN VĂN ô ghi chú
// đơn + cột "Ghi chú" từng dòng. Các script nạp đơn (01/09 → 27/09) đã dùng hai
// ô đó để ghi chú NỘI BỘ: "Nạp từ file…", "ghi hộ duyệt giấy", "⚠ tờ sai công
// thức…", "Chọn mã: … là mã trùng nghĩa". In phiếu ra là NCC đọc hết.
//
// Làm gì:
//   · ô ghi chú ĐƠN: chuyển cả đoạn sang một ghi chú Trao đổi (audience internal,
//     NCC không thấy), rồi để trống ô. Ngày ghi chú = ngày tạo đơn, để nó đứng
//     đầu dòng trao đổi đúng thứ tự thời gian. Người ghi = người phụ trách đơn.
//   · ghi chú DÒNG: giữ phần CỦA TỜ ĐƠN ("1/ 100 bàn polywood (8c/sp)") — NCC cần
//     đọc; bỏ phần nội bộ ("Chọn mã: …", "STT 3 tờ", "Tờ tính SL lẻ …") và chép
//     phần bỏ vào cùng ghi chú Trao đổi của đơn đó.
// Không mất chữ nào: mọi thứ gỡ khỏi phiếu đều nằm lại ở Trao đổi. Chạy lại an
// toàn — đơn đã trống ô ghi chú và dòng đã sạch thì bỏ qua.
import { client } from './products-lib.mjs'

const APPLY = process.argv.includes('--apply')
const sb = await client(import.meta.url)
const TODAY = '27/09/2026'
const FALLBACK_EMAIL = 'kehoach1@hoanggia.de'

async function every(table, cols, q = (x) => x) {
  const out = []
  for (let f = 0; ; f += 1000) {
    const { data, error } = await q(sb.from(table).select(cols)).range(f, f + 999)
    if (error) throw error
    out.push(...data)
    if (data.length < 1000) return out
  }
}

/*
 * Tách ghi chú dòng thành [phần của tờ, phần nội bộ]. Đoạn ngăn bằng " · ";
 * đoạn nội bộ nhận ra bằng mẫu mà CÁC SCRIPT NẠP tự sinh (không đoán nội dung
 * người gõ). Từ "Chọn mã:" trở đi là nội bộ hết (lý do chọn mã có thể chứa " · ").
 */
const INTERNAL_SEG = [
  /^STT \d+ tờ$/,
  /^đơn giá .*\(theo tờ\)$/,
  /^Tờ tính SL lẻ /,
  /^Tờ ghi đơn giá /,
  /^Tờ có \d+ ô lạc /,
]
export function splitLineNote(note) {
  const i = note.indexOf('Chọn mã:')
  const head = i >= 0 ? note.slice(0, i) : note
  const tail = i >= 0 ? note.slice(i).trim() : ''
  const keep = []
  const drop = []
  for (const seg of head
    .split(' · ')
    .map((s) => s.trim())
    .filter(Boolean))
    (INTERNAL_SEG.some((re) => re.test(seg)) ? drop : keep).push(seg)
  if (tail) drop.push(tail)
  return { keep: keep.join(' · ') || null, drop }
}

const [pos, lines, { data: fb }] = await Promise.all([
  every(
    'supply_purchase_orders',
    'id, code, status, note, created_at, created_by, assigned_to',
  ),
  every(
    'supply_purchase_order_lines',
    'id, po_id, sort_order, note, material:warehouse_materials(code)',
    (q) => q.not('note', 'is', null),
  ),
  sb.from('users').select('id').eq('email', FALLBACK_EMAIL),
])
const fallbackId = fb?.[0]?.id
if (!fallbackId) throw new Error('không thấy tài khoản dự phòng')

const lineFix = new Map() // po_id → [{ id, keep, drop, label }]
for (const l of lines) {
  const { keep, drop } = splitLineNote(l.note)
  if (drop.length === 0) continue
  const arr = lineFix.get(l.po_id) ?? []
  arr.push({
    id: l.id,
    keep,
    drop,
    label: `Dòng ${l.sort_order + 1}${l.material?.code ? ` (${l.material.code})` : ''}`,
  })
  lineFix.set(l.po_id, arr)
}

const plan = pos
  .map((p) => ({ p, note: p.note?.trim() || null, fixes: lineFix.get(p.id) ?? [] }))
  .filter((x) => x.note || x.fixes.length)
  .sort((a, b) => a.p.code.localeCompare(b.p.code))

let nNotes = 0
let nLines = 0
for (const { p, note, fixes } of plan) {
  nNotes++
  nLines += fixes.length
  console.log(
    `${p.code} [${p.status}]${note ? ` · ghi chú đơn ${note.length} ký tự` : ''}${fixes.length ? ` · ${fixes.length} dòng` : ''}`,
  )
  for (const f of fixes.slice(0, 2))
    console.log(
      `     ${f.label}: giữ "${f.keep ?? ''}" · dời "${f.drop.join(' · ').slice(0, 70)}"`,
    )
}
console.log(
  `\n${nNotes} đơn · ${nLines} dòng sẽ được làm sạch; mọi chữ gỡ ra nằm ở Trao đổi (nội bộ).`,
)
if (!APPLY) {
  console.log('(dò khô — thêm --apply để ghi)')
  process.exit(0)
}

for (const { p, note, fixes } of plan) {
  const body = [
    `Ghi chú lúc nạp đơn — chuyển từ ô Ghi chú (ô này in lên phiếu gửi NCC) sang đây ngày ${TODAY}.`,
    note ? `\n${note}` : '',
    fixes.length
      ? `\nGhi chú nội bộ trên dòng hàng:\n${fixes.map((f) => `· ${f.label}: ${f.drop.join(' · ')}`).join('\n')}`
      : '',
  ].join('')
  const { data: ins, error: ne } = await sb
    .from('doc_notes')
    .insert({
      doc_type: 'po',
      doc_id: p.id,
      author_id: p.assigned_to ?? p.created_by ?? fallbackId,
      audience: 'internal',
      body,
      created_at: p.created_at,
    })
    .select('id')
    .single()
  if (ne) throw new Error(`${p.code} ghi Trao đổi: ${ne.message}`)
  // Chỉ dọn SAU KHI ghi chú Trao đổi đã nằm chắc trong DB.
  for (const f of fixes) {
    const { error } = await sb
      .from('supply_purchase_order_lines')
      .update({ note: f.keep })
      .eq('id', f.id)
    if (error)
      throw new Error(
        `${p.code} ${f.label}: ${error.message} (Trao đổi ${ins.id} đã ghi)`,
      )
  }
  if (note) {
    const { error } = await sb
      .from('supply_purchase_orders')
      .update({ note: null })
      .eq('id', p.id)
    if (error)
      throw new Error(`${p.code} ô ghi chú: ${error.message} (Trao đổi ${ins.id} đã ghi)`)
  }
  console.log(`  ✓ ${p.code}`)
}
console.log('\nXong.')
