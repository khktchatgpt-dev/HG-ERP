// MỞ HỒ SƠ 2 NHÀ CUNG CẤP còn thiếu, đọc từ tập scan dh-09182026013924.pdf.
//
//   node scripts/ncc-truyen-0918.mjs           # DRY-RUN
//   node scripts/ncc-truyen-0918.mjs --apply   # ghi thật
//
// Bảy nhà cung cấp trong tập đơn đã có hồ sơ; hai nhà này chưa. Chỉ lấy đúng những
// gì KHỐI ĐỊA CHỈ trên tờ đơn ghi — tờ Kim Tuấn bỏ trống ô MST nên để null, không
// suy từ đâu khác.
import { client } from './products-lib.mjs'

const APPLY = process.argv.includes('--apply')
const NGUON = 'Mở hồ sơ từ tập scan đơn đặt hàng anh Truyền ký, nhận 18/09/2026.'

const MOI = [
  {
    code: 'KT',
    name: 'CÔNG TY TNHH KINH DOANH SẮT THÉP KIM TUẤN',
    tax_no: null,
    address: '258 Lạc Long Quân, Phường Quy Nhơn Bắc, Tỉnh Gia Lai',
    note: NGUON + ' Tờ đơn (ĐH số 02/2026 ngày 09/09/2026) bỏ trống ô MST — cần bổ sung.',
  },
  {
    code: 'KOM',
    name: 'CÔNG TY TNHH TM - DV THÉP KHU ÔNG MAI',
    tax_no: '0301935688',
    address: 'C3 Khu nhà ở Thương mại, 319 Lý Thường Kiệt, P. Phú Thọ, TP. HCM',
    note: NGUON + ' Theo tờ ĐH số 01/2026 ngày 07/09/2026.',
  },
]

const db = await client(import.meta.url)
console.log(APPLY ? '⚙ GHI THẬT\n' : '🔍 DRY-RUN (chưa ghi gì)\n')

const { data: daCo } = await db.from('supply_suppliers').select('id, code, name, tax_no')
const mst = (s) => String(s ?? '').replace(/[^0-9]/g, '')
const dungMa = new Set(daCo.map((s) => s.code).filter(Boolean))

for (const n of MOI) {
  // Tra MST trước — tra theo tên là cách chắc chắn đẻ bản trùng.
  const theoMst = n.tax_no
    ? daCo.find((s) => mst(s.tax_no) && mst(s.tax_no) === mst(n.tax_no))
    : null
  if (theoMst) {
    console.log(`  = đã có (MST ${n.tax_no}): ${theoMst.name}`)
    continue
  }
  const theoTen = daCo.find(
    (s) => s.name.trim().toLowerCase() === n.name.trim().toLowerCase(),
  )
  if (theoTen) {
    console.log(`  = đã có (trùng tên): ${theoTen.name}`)
    continue
  }
  let code = n.code
  while (dungMa.has(code)) code += '2'
  dungMa.add(code)
  console.log(`  + MỚI: ${code.padEnd(5)} ${n.name}`)
  console.log(`          MST ${n.tax_no ?? '(tờ đơn để trống)'}`)
  console.log(`          ${n.address}`)
  if (!APPLY) continue
  const { error } = await db.from('supply_suppliers').insert({
    code,
    name: n.name,
    tax_no: n.tax_no,
    address: n.address,
    type: 'Vật tư',
    status: 'active',
    country: 'Việt Nam',
    currency: 'VND',
    is_active: true,
    can_order: true,
    note: n.note,
  })
  if (error) throw new Error(`${n.name}: ${error.message}`)
  console.log(`          → ghi xong`)
}

if (APPLY) {
  console.log('\n── ĐỐI CHIẾU SAU KHI GHI ──')
  for (const n of MOI) {
    const { data } = await db
      .from('supply_suppliers')
      .select('code, name, tax_no, address')
      .eq('name', n.name)
      .maybeSingle()
    console.log(data ? `  ✓ ${data.code} ${data.name}` : `  ✗ ${n.name}: không tìm thấy`)
  }
  console.log('\n✓ Xong.\n')
} else {
  console.log('\nChạy lại với --apply để ghi.\n')
}
