// GỘP NHÓM VẬT TƯ CŨ CỦA APP VÀO 14 NHÓM CHUẨN CỦA SỔ CUNG ỨNG.
//
//   node scripts/materials-group-merge.mjs           # dry-run, in bảng
//   node scripts/materials-group-merge.mjs --apply   # đổi group_name
//
// Sau khi nạp sổ Drive, danh mục có 29 nhóm: 14 nhóm chuẩn của sổ sống cạnh 15
// nhóm cũ do app tự đặt. Cùng một thứ nằm hai chỗ — `Nhôm` (496) cạnh
// `Sắt thép - inox - nhôm - tôn` (2.102), `Bao bì` (52) cạnh
// `Bao bì - đóng gói - tem nhãn` (893). Người soạn đơn lọc theo nhóm thì mất
// nửa danh mục mà không biết.
//
// CHỈ ĐỔI `group_name`, không đụng gì khác: mã, tên, barem, mẫu đơn giữ nguyên,
// dòng vẫn là dòng cũ nên chứng từ (nếu sau này có) không đứt.
//
// LƯU Ý — nhóm quyết định phạm vi SO TRÙNG TÊN lúc tạo vật tư mới
// (`scopedSureKey`). Gộp nhóm là mở rộng phạm vi đó: hai dòng cùng tên ở hai
// nhóm cũ sau khi gộp sẽ thành trùng. Script in ra các cặp đó trước khi ghi.

import { client, chunk } from './products-lib.mjs'
import { sureKey, MIN_KEY_LEN } from '../src/lib/material-key.ts'

const APPLY = process.argv.includes('--apply')

/** Nhóm cũ của app → nhóm chuẩn của sổ. */
const MERGE = {
  Nhôm: 'Sắt thép - inox - nhôm - tôn',
  Sắt: 'Sắt thép - inox - nhôm - tôn',
  Inox: 'Sắt thép - inox - nhôm - tôn',
  'Khuôn nhôm': 'Cơ khí - vòng bi - khuôn',
  'Bao bì': 'Bao bì - đóng gói - tem nhãn',
  'Xốp - mút - bì nhựa': 'Mút - xốp - nệm - gòn',
  'Mây - dây': 'Vải - mây - chỉ - sợi',
  Kính: 'Gỗ - kính - nhựa tấm',
  'Gỗ & ván': 'Gỗ - kính - nhựa tấm',
  Sơn: 'Sơn - dầu - keo - hoá chất',
  'Hoá chất': 'Sơn - dầu - keo - hoá chất',
  'Sơn & hoá chất': 'Sơn - dầu - keo - hoá chất',
}

/**
 * "Ngũ kim - phụ kiện" phải TÁCH: sổ chia làm hai nhóm khác nhau. Xét theo tên
 * từng món — vít/bu lông/tán/đinh về nhóm liên kết, còn lại về phụ kiện nội thất.
 */
function nguKim(name) {
  const n = String(name).toLowerCase()
  return /vít|bu ?lon|bu ?lông|tán |đinh |lđn|lđs|long đền|lông đền|ty ren|\beru\b|ốc |rive/.test(
    n,
  )
    ? 'Bu lông - vít - đinh - liên kết'
    : 'Phụ kiện nội thất'
}

/**
 * ĐẶT TÊN VẬT LIỆU VÀO ĐẦU TÊN — bắt buộc trước khi gộp Nhôm/Sắt/Inox.
 *
 * Danh mục cũ của app gọi theo TIẾT DIỆN trần: "Hộp 25x50x1", "Phi 25x1li",
 * "Vuông 25x1li". Nhôm và inox dùng chung tiết diện nên tên y hệt nhau, và
 * NHÓM là thứ duy nhất phân biệt. Gộp ba nhóm mà không đổi tên thì
 * `IX-0002 "Hộp 25x50x1"` (inox) đụng `NH-0080 "Hộp 25x50x1li"` (nhôm) — đúng
 * ca mà `materials-dedupe.mjs` viết ra để cảnh báo, giá chênh nhiều lần.
 *
 * Sổ Cung ứng vốn viết đủ vật liệu ("Thép hộp mạ kẽm 20x40x1.0mm"), nên thêm
 * tiền tố cũng là đưa app về đúng cách gọi của sổ.
 */
const VAT_LIEU = { Nhôm: 'Nhôm', Sắt: 'Sắt', Inox: 'Inox' }
function themVatLieu(name, group) {
  const w = VAT_LIEU[group]
  if (!w) return null
  // Đã có chữ vật liệu ở bất kỳ đâu trong tên thì thôi, không nhồi hai lần.
  const n = name.toLowerCase()
  if (n.includes(w.toLowerCase())) return null
  return `${w} ${name.charAt(0).toLowerCase()}${name.slice(1)}`
}

const sb = await client(import.meta.url)

async function readAll() {
  const out = []
  for (let from = 0; from < 40_000; from += 1000) {
    const { data, error } = await sb
      .from('warehouse_materials')
      .select('id, code, name, group_name')
      .order('code')
      .range(from, from + 999)
    if (error) throw new Error(error.message)
    out.push(...(data ?? []))
    if ((data ?? []).length < 1000) break
  }
  return out
}

const all = await readAll()
const plan = []
const rename = []
for (const m of all) {
  const g = m.group_name ?? ''
  const ten = themVatLieu(m.name, g)
  if (ten) rename.push({ ...m, ten })
  let to = MERGE[g]
  if (g === 'Ngũ kim - phụ kiện' || g === 'Ngũ kim') to = nguKim(m.name)
  if (!to || to === g) continue
  plan.push({ ...m, to, ten: ten ?? m.name })
}

console.log(`── ĐỔI TÊN (thêm vật liệu vào đầu): ${rename.length} ──`)
for (const r of rename.slice(0, 6)) console.log(`  ${r.code}  "${r.name}"  →  "${r.ten}"`)
if (rename.length > 6) console.log(`  … còn ${rename.length - 6} dòng`)
console.log()

const byMove = {}
for (const p of plan) {
  const k = `${p.group_name} → ${p.to}`
  byMove[k] = (byMove[k] ?? 0) + 1
}

console.log(
  `danh mục: ${all.length} vật tư · ${new Set(all.map((m) => m.group_name)).size} nhóm`,
)
console.log(`\n── SẼ CHUYỂN: ${plan.length} ──`)
for (const [k, n] of Object.entries(byMove).sort((a, b) => b[1] - a[1]))
  console.log(`  ${String(n).padStart(5)}  ${k}`)

/*
 * Gộp nhóm mở rộng phạm vi so trùng — hai dòng cùng tên ở hai nhóm cũ giờ nằm
 * chung một nhóm. Không xoá gì, nhưng phải in ra để biết danh mục có bao nhiêu
 * cặp cần rà, và để lần tạo vật tư sau bị chặn thì người dùng hiểu vì sao.
 */
const sau = new Map()
const clash = []
const tenMoi = new Map(rename.map((r) => [r.id, r.ten]))
for (const m of all) {
  const g = plan.find((p) => p.id === m.id)?.to ?? m.group_name ?? ''
  const k = sureKey(tenMoi.get(m.id) ?? m.name)
  if (k.length < MIN_KEY_LEN) continue
  const key = `${g.toLowerCase()}::${k}`
  const prev = sau.get(key)
  if (prev && prev.group_name !== m.group_name) clash.push([prev, m, g])
  else if (!prev) sau.set(key, m)
}
console.log(`\n── TRÙNG TÊN MỚI SINH RA sau khi gộp: ${clash.length} ──`)
for (const [a, b, g] of clash.slice(0, 12))
  console.log(
    `  ${a.code} "${a.name.slice(0, 30)}" (${a.group_name})  ≡  ${b.code} "${b.name.slice(0, 30)}" (${b.group_name})  → ${g}`,
  )
if (clash.length > 12) console.log(`  … còn ${clash.length - 12} cặp`)
console.log('  (KHÔNG xoá dòng nào — chỉ là danh sách cần rà)')

const nhomSau = new Set(
  all.map((m) => plan.find((p) => p.id === m.id)?.to ?? m.group_name),
)
console.log(`\nsau khi gộp: ${nhomSau.size} nhóm`)

if (!APPLY) {
  console.log('\n(dry-run — thêm --apply để ghi)')
  process.exit(0)
}

// Đổi tên TRƯỚC khi gộp nhóm: gộp xong mới đổi thì có một khoảng danh mục đang
// ở trạng thái "hai vật liệu cùng tên, cùng nhóm".
let renamed = 0
for (const r of rename) {
  const { error } = await sb
    .from('warehouse_materials')
    .update({ name: r.ten })
    .eq('id', r.id)
  if (error) {
    console.error(`✗ đổi tên ${r.code}: ${error.message}`)
    process.exit(1)
  }
  renamed++
  if (renamed % 200 === 0) console.log(`  … đổi tên ${renamed}/${rename.length}`)
}
console.log(`✓ đã đổi tên ${renamed}`)

let ok = 0
const byTarget = new Map()
for (const p of plan) {
  const list = byTarget.get(p.to) ?? []
  list.push(p.id)
  byTarget.set(p.to, list)
}
for (const [to, ids] of byTarget) {
  for (const part of chunk(ids, 200)) {
    const { error } = await sb
      .from('warehouse_materials')
      .update({ group_name: to })
      .in('id', part)
    if (error) {
      console.error(`✗ ${to}: ${error.message}`)
      process.exit(1)
    }
    ok += part.length
  }
  console.log(`  ✓ ${to}: ${ids.length}`)
}
console.log(`\n✓ đã chuyển ${ok} vật tư`)
