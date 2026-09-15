// MỞ HỒ SƠ 4 NHÀ CUNG CẤP CÒN THIẾU (từ file đơn hàng của Cung ứng, 15/09/2026).
//
//   node scripts/ncc-bo-sung-0915.mjs           # DRY-RUN
//   node scripts/ncc-bo-sung-0915.mjs --apply   # ghi thật
//
// Bốn nơi này xuất hiện trên đơn đặt hàng THẬT của phòng Cung ứng nhưng chưa có
// trong danh mục, nên đơn của họ không nạp vào hệ thống được. Thông tin lấy
// nguyên từ đầu đơn: tên, mã số thuế, người liên hệ, địa chỉ.
//
// Đối chiếu trước khi mở: tra theo MÃ SỐ THUẾ rồi mới tới tên. Tra theo tên là
// cách chắc chắn đẻ bản trùng — danh mục đã có sẵn những cặp kiểu "Cty TNHH
// Tiến Đạt" / "Tiến Đạt" trỏ cùng một nơi, mỗi bản giữ một nửa lịch sử mua.
import { client } from './products-lib.mjs'


/*
  CHÉP NGUYÊN QUY TẮC CẤP MÃ của `src/lib/supplier-code.ts` — không import được
  vì file TS đó dùng đường dẫn không đuôi, node trần không giải được. Chép thì
  phải chép ĐỦ: bỏ CỤM từ pháp lý trước, rồi mới bỏ từ viết tắt đứng lẻ. Bỏ theo
  từ lẻ là hỏng, vì "cổ phần" và "cơ khí" cùng bỏ dấu thành "co".
*/
const PHRASES = [
  'cong ty', 'co phan', 'trach nhiem huu han', 'mot thanh vien', 'san xuat',
  'thuong mai', 'dich vu', 'xuat nhap khau', 'tong hop', 'doanh nghiep tu nhan',
  'doanh nghiep', 'tap doan', 'nha may', 'chi nhanh', 'cua hang', 'co so',
  'dau tu', 'phat trien',
]
const ABBR = new Set([
  'tnhh','cty','mtv','cp','ctcp','dn','sx','tm','dv','tmdv','xnk','th','va',
  'and','ltd','jsc','corp','company','group',
])
const chuan = (s) =>
  String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[đĐ]/g, 'd').toLowerCase().trim()
function maTu(name) {
  const flat = chuan(name).replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
  let rest = flat
  for (const ph of PHRASES) rest = rest.replaceAll(ph, ' ')
  const words = flat.split(/\s+/).filter(Boolean)
  const core = rest.split(/\s+/).filter((w) => w && !ABBR.has(w))
  const use = core.length > 0 ? core : words
  if (use.length === 0) return ''
  if (use.length === 1) return use[0].slice(0, 3).toUpperCase()
  return use.slice(0, 4).map((w) => w[0]).join('').toUpperCase()
}
function nextSupplierCode(name, taken) {
  const base = maTu(name)
  if (!base) return ''
  const used = new Set([...taken].map((c) => String(c).trim().toUpperCase()).filter(Boolean))
  if (!used.has(base)) return base
  for (let i = 2; i < 100; i++) if (!used.has(`${base}${i}`)) return `${base}${i}`
  return ''
}

const APPLY = process.argv.includes('--apply')

const MOI = [
  {
    name: 'CƠ SỞ HÀ BÍCH',
    tax_no: '5218101590',
    contact_name: 'Chị Hà Bích',
    contact_phone: '0905600200',
    type: 'Nguyên vật liệu',
    note: 'Bì nhựa PE đóng nệm. Nguồn: đơn 1/2026-HG/HB, LSX 6.26.27 (HG-MERXX).',
  },
  {
    name: 'CÔNG TY TNHH SX TM DV CƠ KHÍ GIA HƯNG PHÚC',
    tax_no: null,
    contact_name: 'Chị Vy',
    contact_phone: '0932142231',
    type: 'Nguyên vật liệu',
    note: 'Nắp tăng đơ, chân đế. Nguồn: đơn 1/2026-HG/HP, LSX 2 - ROSCO CHELSEA. Chưa có MST trên đơn.',
  },
  {
    name: 'CÔNG TY TNHH SX TM DỊCH VỤ HARDWARE AN THỊNH PHÁT',
    tax_no: '3703468397',
    contact_name: 'Ms Hà',
    contact_phone: '0394761391',
    type: 'Nguyên vật liệu',
    note: 'Tán hàn M6. Nguồn: đơn 1/2026-HG/HP, LSX 2 - ROSCO IBIZA.',
  },
  {
    name: 'CÔNG TY TNHH QUỐC HÙNG',
    tax_no: null,
    contact_name: 'Ms Hà',
    contact_phone: '0394761391',
    type: 'Nguyên vật liệu',
    note: 'Tăng đơ hoa mai. Nguồn: đơn 1/2026-HG/HP, LSX 2 - ROSCO IBIZA. Chưa có MST trên đơn.',
  },
]

const n = (s) =>
  String(s ?? '')
    .replace(/\s+/g, ' ')
    .trim()
const mst = (s) => n(s).replace(/[^\d]/g, '')
const key = (s) =>
  n(s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(
      /\b(cong ty|cty|tnhh|mtv|co phan|cp|sx|tm|dv|th|xnk|dntn|co so|doanh nghiep tu nhan|san xuat|thuong mai|dich vu)\b/g,
      ' ',
    )
    .replace(/[^a-z0-9]/g, '')

const db = await client(import.meta.url)
const { data: ncc, error } = await db
  .from('supply_suppliers')
  .select('id, code, name, tax_no')
if (error) throw new Error(error.message)

console.log(
  `\n${APPLY ? '⚙ GHI THẬT' : '🔍 DRY-RUN (chưa ghi gì)'} — mở hồ sơ NCC còn thiếu\n`,
)

const codes = ncc.map((s) => s.code ?? '').filter(Boolean)
let tao = 0
for (const m of MOI) {
  const trung =
    (m.tax_no && mst(m.tax_no).length >= 10
      ? ncc.find((s) => mst(s.tax_no) === mst(m.tax_no))
      : null) ?? ncc.find((s) => key(s.name) === key(m.name))
  if (trung) {
    console.log(`  = ${m.name.slice(0, 48)} — đã có (${trung.code ?? trung.name})`)
    continue
  }
  const code = nextSupplierCode(m.name, codes)
  codes.push(code)
  tao++
  console.log(
    `  + ${code.padEnd(10)} ${m.name.slice(0, 52)}${m.tax_no ? ` · MST ${m.tax_no}` : ' · chưa có MST'}`,
  )
  if (!APPLY) continue
  const { error: e } = await db.from('supply_suppliers').insert({
    code,
    name: m.name,
    tax_no: m.tax_no,
    contact_name: m.contact_name,
    contact_phone: m.contact_phone,
    phone: m.contact_phone,
    type: m.type,
    status: 'active',
    country: 'Việt Nam',
    currency: 'VND',
    is_active: true,
    can_order: true,
    note: m.note + ' Mở theo rà file Cung ứng 15/09/2026.',
  })
  if (e) throw new Error(`${m.name}: ${e.message}`)
}

console.log(`\n  ${tao} nhà cung cấp sẽ mở mới.`)
if (!APPLY) console.log('\nChạy lại với --apply để ghi.\n')
else console.log('\n✓ Xong.\n')
