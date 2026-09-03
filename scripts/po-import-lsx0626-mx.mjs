// NẠP ĐƠN ĐẶT NCC TỪ FILE LSX 06/26-27 (HG-MX) — 03/09/2026.
//
//   node scripts/po-import-lsx0626-mx.mjs <file.xls>            # dò khô, in bảng
//   node scripts/po-import-lsx0626-mx.mjs <file.xls> --apply    # ghi
//
// File chị Nga gửi có 13 sheet: 1 lệnh sản xuất, 1 bảng kê vật tư, và 10 ĐƠN
// ĐẶT HÀNG gửi NCC (sheet `Sheet3` là bản nháp chép dở của đơn Kimpack — CỐ Ý
// bỏ, nó chỉ có mã SP và số lượng, không tên hàng, không giá).
//
// LUẬT NẠP — giữ nguyên từ đợt 01/09 (user chốt), vì lý do vẫn còn nguyên:
//   · MỌI ĐƠN Ở BẬC NHÁP, `ordered_at` = null. Đơn nạp từ file mà khoe "đã gửi
//     NCC" là hệ thống khẳng định một việc chưa ai làm.
//   · Ngày ghi trên tờ đơn giữ trong `note` ("Ngày trên đơn: …"), không nhét vào
//     `ordered_at`.
//   · Dòng đơn PHẢI trỏ vào vật tư danh mục (FK not null, trừ mẫu gỗ).
//   · `qty_basis` chỉ nhận: none · bar_m · per_unit · area · volume · manual.
//
// KHỚP VẬT TƯ — ba bậc, và bậc nào cũng KHÔNG ĐOÁN BỪA:
//   1. Ghép tên + cột "Vật liệu" + "Quy cách" của chính file rồi so với danh mục
//      (bỏ dấu, bỏ dấu câu). Trúng đúng MỘT mã → dùng.
//   2. `sureKey` trùng (chỉ lệch dấu câu/viết tắt) → dùng.
//   3. Không ứng viên nào → KHAI VẬT TƯ MỚI, bật `needs_review` để Cung ứng rà.
//   Nhiều ứng viên ngang nhau (điển hình: file ghi "Cục chặn", danh mục có bản
//   đen và bản xám) → BỎ DÒNG và in ra để người mua chọn. Chọn nhầm màu là sai
//   mã, sai giá, sai tồn — thà thiếu dòng còn hơn.
//
// MẪU ĐƠN theo đúng bộ cột của từng sheet: 8 đơn ngũ kim/vải dùng `accessory`
// (Vật liệu · Quy cách · SL đơn hàng), đơn Kimpack dùng `carton` (Cách mở ·
// Pcs/thùng · QC lọt lòng · m² · đơn giá/m²). Đơn vải vẫn `accessory` chứ không
// `rattan`: rattan có ô "Định mức" nhưng nhãn mẫu là "Dây mây / rope", đọc trên
// màn hình sẽ tưởng gõ nhầm; định mức m/sp của vải đưa vào ghi chú dòng.

import { readFileSync } from 'node:fs'
import XLSX from 'xlsx'
import { client } from './products-lib.mjs'
import { sureKey, MIN_KEY_LEN, prefixForGroup } from '../src/lib/material-key.ts'
// KHÔNG import `src/lib/supplier-code.ts`: nó import nội bộ không kèm đuôi file
// nên `node` trần không nạp được. Chép lại đúng luật (chữ đầu của phần tên
// riêng, trùng thì nối số) — dùng đúng một lần, cho một NCC còn thiếu.
const SUP_PHRASES = ['cong ty', 'co phan', 'san xuat', 'thuong mai', 'dich vu', 'co khi']
const SUP_ABBR = new Set([
  'tnhh',
  'cty',
  'mtv',
  'cp',
  'sx',
  'tm',
  'dv',
  'th',
  'va',
  'xnk',
])
function nextSupplierCode(name, taken) {
  let rest = norm(name)
  for (const p of SUP_PHRASES) rest = rest.replaceAll(p, ' ')
  const words = rest
    .split(' ')
    .filter(Boolean)
    .filter((w) => !SUP_ABBR.has(w))
  if (words.length === 0) return ''
  const base =
    words.length === 1
      ? words[0].slice(0, 3).toUpperCase()
      : words
          .slice(0, 4)
          .map((w) => w[0])
          .join('')
          .toUpperCase()
  const used = new Set(
    [...taken]
      .map((c) =>
        String(c ?? '')
          .trim()
          .toUpperCase(),
      )
      .filter(Boolean),
  )
  if (!used.has(base)) return base
  for (let i = 2; i < 100; i++) if (!used.has(`${base}${i}`)) return `${base}${i}`
  return ''
}

const FILE = process.argv[2]
const APPLY = process.argv.includes('--apply')
if (!FILE) {
  console.error('Thiếu đường dẫn file .xls')
  process.exit(1)
}

const LSX_CODE = '06/26-27 - MX'
const OWNER_EMAIL = 'kehoach1@hoanggia.de' // Đặng Thị Thanh Nga

/** sheet → mẫu đơn + nhóm cho vật tư khai mới. */
const SHEETS = {
  ATP: { template: 'accessory' },
  TTL: { template: 'accessory' },
  'tân phát': { template: 'accessory' },
  MT: { template: 'accessory' },
  TV: { template: 'accessory' },
  'T.nguyên': { template: 'accessory' },
  TN2: { template: 'accessory' },
  BB: { template: 'carton', group: 'Bao bì - đóng gói - tem nhãn' },
  'VẢI PH': { template: 'accessory', group: 'Vải - da - chỉ - phụ liệu may' },
  'VẢI TDS': { template: 'accessory', group: 'Vải - da - chỉ - phụ liệu may' },
}

const norm = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

const num = (v) => {
  if (v == null || v === '') return null
  const n = Number(String(v).replace(/[^\d.-]/g, ''))
  return Number.isFinite(n) ? n : null
}

/** Nhóm cho vật tư khai mới, suy từ tên — cùng luật với đợt phân nhóm 03/09. */
function groupFor(name, fallback) {
  const n = norm(name)
  if (fallback) return fallback
  if (/^(vit|vis|bulon|bu long|tan |dinh |ldn|lds|eru|oc |ty ren|long den)/.test(n))
    return 'Bu lông - vít - đinh - liên kết'
  return 'Phụ kiện nội thất'
}

// ---------------------------------------------------------------- đọc file ---
function parseWorkbook(path) {
  const wb = XLSX.read(readFileSync(path), { type: 'buffer', cellDates: true })
  const orders = []
  for (const [sheet, cfg] of Object.entries(SHEETS)) {
    if (!wb.Sheets[sheet]) {
      console.warn(`  ! không thấy sheet "${sheet}"`)
      continue
    }
    const rows = XLSX.utils
      .sheet_to_json(wb.Sheets[sheet], { header: 1, blankrows: false, defval: '' })
      .map((r) =>
        r.map((c) => (c instanceof Date ? c : String(c).replace(/\s+/g, ' ').trim())),
      )
    const flat = rows.map((r) => r.map((c) => (c instanceof Date ? c.toISOString() : c)))

    const findAfter = (re) => {
      for (const r of flat) {
        const i = r.findIndex((c) => re.test(String(c)))
        if (i >= 0) {
          const v = r.slice(i + 1).find((c) => String(c).trim())
          if (v) return String(v).trim()
          const inline = String(r[i])
            .replace(re, '')
            .replace(/^[:\s]+/, '')
            .trim()
          if (inline) return inline
        }
      }
      return ''
    }
    const soDh = (findAfter(/Số ĐH/i) || '').replace(/^.*Số ĐH\s*:?\s*/i, '')
    const supplierName = findAfter(/^Kính gửi/i)
    const mst = findAfter(/^MST:?$/i)
    const ngay = (
      flat.flat().find((c) => /Gia Lai,\s*[Nn]gày/.test(String(c))) ?? ''
    ).replace(/.*?[Nn]gày\s*/, '')
    const terms = {
      quality: findAfter(/^Tiêu chuẩn chất lượng/i),
      place: findAfter(/^Địa điểm giao hàng/i),
      payment: findAfter(/^Hình thức thanh toán/i),
      invoice: findAfter(/^Chứng từ thanh toán/i),
      lead: findAfter(/^Thời gian giao hàng/i),
    }
    const lsxRef = flat.flat().find((c) => /^LSX\s/i.test(String(c))) ?? ''
    const address = findAfter(/^Địa chỉ:?$/i)
    const contact = findAfter(/^Người liên hệ/i)

    const h = flat.findIndex((r) => r.some((c) => /^STT$/i.test(String(c))))
    if (h < 0) continue
    const head = flat[h].map((c) => String(c))
    const col = (re) => head.findIndex((c) => re.test(c))
    const C = {
      code: col(/^Mã SP$/i),
      name: col(/Tên sản phẩm|Tên hàng hóa/i),
      grade: col(/^Vật liệu$/i),
      spec: col(/Quy cách \/ Thông số/i),
      demand: col(/SL (Đơn Hàng|ĐH|đơn Hàng)/i),
      onhand: col(/^Tồn Kho$/i),
      qty: col(/SL (Cần đăt|Cần đặt|Đặt hàng|mét CẦN ĐẶT|cần đặt)/i),
      unit: col(/^ĐVT$/i),
      price: col(/Đơn giá \(VND\)/i),
      note: col(/^Ghi chú$/i),
      dm: col(/^Đm\s*\/?\s*sp$/i),
      metres: col(/SL mét\/ ĐH/i),
      // carton
      open: col(/Cách mở/i),
      pcs: col(/Pcs\s*\/?\s*Ctn/i),
      inner: col(/QC lọt lòng/i),
      m2: col(/^M2$/i),
      priceM2: col(/Đgiá\s*\/M2/i),
      priceCtn: col(/Đgiá\/\s*Thùng/i),
    }
    const lines = []
    for (const r of flat.slice(h + 1)) {
      if (r.some((c) => /Cộng tiền hàng|ĐIỀU KHOẢN/i.test(String(c)))) break
      const name = String(r[C.name] ?? '').trim()
      if (!name || /^0$/.test(name)) continue
      const qty = num(r[C.qty]) ?? num(r[C.demand])
      if (!qty) continue
      lines.push({
        name,
        product_code: C.code >= 0 ? String(r[C.code] ?? '').trim() : '',
        grade: C.grade >= 0 ? String(r[C.grade] ?? '').trim() : '',
        spec: C.spec >= 0 ? String(r[C.spec] ?? '').trim() : '',
        demand: num(r[C.demand]),
        onhand: num(r[C.onhand]),
        qty,
        unit: C.unit >= 0 ? String(r[C.unit] ?? '').trim() : '',
        price: num(r[C.price]) ?? num(r[C.priceCtn]),
        note: [
          C.note >= 0 ? String(r[C.note] ?? '').trim() : '',
          C.dm >= 0 && num(r[C.dm]) ? `ĐM ${num(r[C.dm])} ${r[C.unit] || 'm'}/sp` : '',
        ]
          .filter(Boolean)
          .join(' · '),
        open: C.open >= 0 ? String(r[C.open] ?? '').trim() : '',
        pcs: C.pcs >= 0 ? num(r[C.pcs]) : null,
        inner:
          C.inner >= 0
            ? [num(r[C.inner]), num(r[C.inner + 1]), num(r[C.inner + 2])]
            : null,
        m2: C.m2 >= 0 ? num(r[C.m2]) : null,
        priceM2: C.priceM2 >= 0 ? num(r[C.priceM2]) : null,
      })
    }
    orders.push({
      sheet,
      ...cfg,
      soDh,
      supplierName,
      mst,
      ngay,
      terms,
      lsxRef,
      address,
      contact,
      lines,
    })
  }
  return orders
}

// -------------------------------------------------------------- khớp NCC ----
const STOPW = new Set([
  'cong',
  'ty',
  'tnhh',
  'cp',
  'co',
  'phan',
  'sx',
  'tm',
  'dv',
  'mtv',
  'th',
  'va',
  'xnk',
])
const tailWords = (s) =>
  norm(s)
    .split(' ')
    .filter((w) => w && !STOPW.has(w))
    .slice(-3)
    .join(' ')

function matchSupplier(name, mst, suppliers) {
  const digits = String(mst ?? '').replace(/\D/g, '')
  if (digits) {
    const byTax = suppliers.filter(
      (s) => String(s.tax_no ?? '').replace(/\D/g, '') === digits,
    )
    if (byTax.length === 1) return { hit: byTax[0], how: 'MST' }
  }
  const key = tailWords(name)
  if (!key) return { hit: null, how: 'không đủ tên' }
  const hits = suppliers.filter((s) => tailWords(s.name) === key)
  if (hits.length === 1) return { hit: hits[0], how: '3 từ cuối' }
  const loose = suppliers.filter((s) => norm(s.name).includes(key))
  if (loose.length === 1) return { hit: loose[0], how: 'chứa 3 từ cuối' }
  // 2 từ cuối: file viết "DỆT MAY XNK PHỤNG HƯNG", danh mục ghi "… XUẤT KHẨU
  // PHỤNG HƯNG" — ba từ cuối lệch ở chỗ viết tắt, hai từ cuối thì trùng.
  const key2 = norm(name)
    .split(' ')
    .filter((w) => w && !STOPW.has(w))
    .slice(-2)
    .join(' ')
  if (key2) {
    const two = suppliers.filter((s) => norm(s.name).includes(key2))
    if (two.length === 1) return { hit: two[0], how: '2 từ cuối' }
  }
  return {
    hit: null,
    how: hits.length + loose.length > 1 ? 'nhiều ứng viên' : 'không thấy',
  }
}

// ------------------------------------------------------------ khớp vật tư ---
/*
 * "HỌ HÀNG GẦN" — dùng để quyết định: khai vật tư mới, hay bắt người chọn?
 *
 * Cùng KÍCH THƯỚC và cùng phần lõi tên (bỏ màu / vật liệu / xi mạ) thì gần như
 * chắc là một món, chỉ khác cách gọi: "Bộ thanh trượt nhựa đen" vs "Bộ Thanh
 * trượt màu đen" — khai mới là đẻ mã trùng nghĩa. Ngược lại KHÁC SỐ ĐO thì là
 * món khác hẳn: "Nút chân 30x60" không phải họ hàng của "Nút chặn lỗ", và "Nút
 * phi 49" không phải "Nút phi 34" — chặn ở đây chỉ tổ bắt người ngồi chọn giữa
 * những thứ không liên quan.
 */
const NOISE = new Set([
  'den',
  'xam',
  'nau',
  'trang',
  'vang',
  'xanh',
  'do',
  'kem',
  'mau',
  'sac',
  'nhua',
  'sat',
  'inox',
  'dong',
  'thep',
  'xi',
  '7m',
  'xt',
  'ms',
  'li',
  'ly',
  'bo',
  'cai',
  'con',
  'hang',
  'tran',
  'loai',
])
const coreTokens = (s) => s.split(' ').filter((t) => t.length > 1 && !NOISE.has(t))
const isDim = (t) => /\d/.test(t)

function isKin(a, b) {
  const A = coreTokens(a)
  const B = coreTokens(b)
  const dimA = A.filter(isDim).join(' ')
  const dimB = B.filter(isDim).join(' ')
  // Số đo phải khớp: một bên có số mà bên kia khác số → hai món khác nhau.
  if (dimA !== dimB) return false
  const wordA = A.filter((t) => !isDim(t))
  const wordB = B.filter((t) => !isDim(t))
  const shared = wordA.filter((t) => wordB.includes(t))
  if (shared.length < 2) return false
  // Phần chữ của bên này phải nằm gọn trong bên kia (chỉ khác ở chữ đã lọc).
  return shared.length === wordA.length || shared.length === wordB.length
}

function matchMaterial(line, mats) {
  const full = norm([line.name, line.grade, line.spec].filter(Boolean).join(' '))
  const bare = norm(line.name)
  const exact = mats.filter((m) => m.n === bare || m.n === full)
  if (exact.length === 1) return { hit: exact[0], how: 'trùng tên' }
  const key = sureKey(line.name)
  if (key.length >= MIN_KEY_LEN) {
    const sure = mats.filter((m) => m.key === key)
    if (sure.length === 1) return { hit: sure[0], how: 'trùng chắc' }
  }
  // Chứa đủ mọi từ của tên (+ màu/vật liệu nếu file có ghi) — chấm điểm để tách
  // "Nút chân 30x60 đen" khỏi "Nút chân 30x60 xám".
  const toks = full.split(' ').filter((t) => t.length > 1)
  let cands = toks.length ? mats.filter((m) => toks.every((t) => m.n.includes(t))) : []
  if (cands.length !== 1) {
    const bt = bare.split(' ').filter((t) => t.length > 1)
    const byName = bt.length ? mats.filter((m) => bt.every((t) => m.n.includes(t))) : []
    if (byName.length === 1) cands = byName
    else if (byName.length > 1)
      return { hit: null, how: 'nhiều ứng viên', cands: byName.slice(0, 5) }
    else if (cands.length > 1)
      return { hit: null, how: 'nhiều ứng viên', cands: cands.slice(0, 5) }
  }
  if (cands.length === 1) return { hit: cands[0], how: 'chứa đủ từ' }
  /*
   * TRƯỚC KHI KHAI MỚI: có "họ hàng gần" trong danh mục không? Có thì để NGƯỜI
   * chọn, vì khai mới lúc đó là đẻ thêm một mã trùng nghĩa — đúng cái "rừng mã
   * trùng" mà cả hệ thống đang phải đi dọn.
   */
  const kin = mats.filter((m) => isKin(bare, m.n))
  if (kin.length > 0) return { hit: null, how: 'nhiều ứng viên', cands: kin.slice(0, 5) }
  return { hit: null, how: 'chưa có' }
}

// ------------------------------------------------------------------ chạy ----
const sb = await client(import.meta.url)

const [{ data: lsxs }, { data: users }, { data: sups }] = await Promise.all([
  sb.from('production_orders').select('id, code').limit(500),
  sb.from('users').select('id, name, email').eq('email', OWNER_EMAIL),
  sb.from('supply_suppliers').select('id, code, name, tax_no, currency, payment_terms'),
])
const lsx = (lsxs ?? []).find((l) => l.code === LSX_CODE)
const owner = (users ?? [])[0]
if (!lsx) throw new Error(`Không thấy lệnh ${LSX_CODE}`)
if (!owner) throw new Error(`Không thấy tài khoản ${OWNER_EMAIL}`)

const mats = []
for (let from = 0; ; from += 1000) {
  const { data } = await sb
    .from('warehouse_materials')
    .select('id, code, name, unit, group_name')
    .eq('is_active', true)
    .order('id')
    .range(from, from + 999)
  mats.push(...data)
  if (data.length < 1000) break
}
const index = mats.map((m) => ({ ...m, n: norm(m.name), key: sureKey(m.name) }))

const orders = parseWorkbook(FILE)
console.log(
  `Lệnh: ${lsx.code} · Người phụ trách: ${owner.name} · ${orders.length} đơn trong file\n`,
)

const plan = []
for (const o of orders) {
  const sup = matchSupplier(o.supplierName, o.mst, sups ?? [])
  const rows = []
  for (const l of o.lines) {
    const m = matchMaterial(l, index)
    rows.push({ ...l, match: m })
  }
  plan.push({ ...o, sup, rows })
  const link = rows.filter((r) => r.match.hit).length
  const create = rows.filter((r) => r.match.how === 'chưa có').length
  const skip = rows.filter((r) => r.match.how === 'nhiều ứng viên').length
  const tien = rows.reduce((s, r) => s + (r.price ?? 0) * r.qty, 0)
  console.log(
    `${o.sheet.padEnd(9)} ${String(o.soDh).padEnd(20)} ${o.template.padEnd(9)} ` +
      `${rows.length} dòng (khớp ${link} · khai mới ${create} · CHỜ CHỌN ${skip}) ` +
      `· ${tien.toLocaleString('vi-VN')} đ · NCC ${sup.hit ? (sup.hit.code ?? sup.hit.name.slice(0, 22)) : '✗ ' + sup.how}`,
  )
  for (const r of rows.filter((x) => x.match.how === 'nhiều ứng viên'))
    console.log(
      `            ⚠ "${r.name}" (SL ${r.qty}) → ${r.match.cands.map((c) => c.code).join(' / ')}`,
    )
}

const totalNew = plan.flatMap((o) => o.rows).filter((r) => r.match.how === 'chưa có')
console.log(`\nVật tư sẽ khai mới: ${totalNew.length}`)
for (const r of totalNew.slice(0, 30))
  console.log(`   ${r.name}${r.unit ? ` (${r.unit})` : ''}`)

if (!APPLY) {
  console.log('\n(dò khô — thêm --apply để ghi)')
  process.exit(0)
}

// ------------------------------------------------------------------ ghi -----
const created = { mats: 0, pos: 0, lines: 0 }
for (const o of plan) {
  if (!o.sup.hit) {
    /*
     * NCC chưa có trong danh mục thì KHAI MỚI từ chính đầu tờ đơn (tên, MST,
     * địa chỉ, người liên hệ) — thà hồ sơ sơ sài rồi bổ sung, còn hơn bỏ nguyên
     * một đơn 40 triệu ra ngoài hệ thống. Mã cấp theo luật chung.
     * Còn "nhiều ứng viên" thì KHÔNG tự chọn: hai NCC tên gần giống nhau mà gán
     * nhầm là công nợ chạy sang người khác.
     */
    if (o.sup.how !== 'không thấy') {
      console.log(`BỎ ${o.sheet}: NCC "${o.supplierName}" — ${o.sup.how}, cần chọn tay`)
      continue
    }
    const supCode = nextSupplierCode(
      o.supplierName,
      (sups ?? []).map((s) => s.code ?? ''),
    )
    const { data: ns, error: se } = await sb
      .from('supply_suppliers')
      .insert({
        code: supCode || null,
        name: o.supplierName,
        tax_no: o.mst || null,
        address: o.address || null,
        note: o.contact ? `Người liên hệ: ${o.contact}` : null,
        status: 'active',
        is_active: true,
        can_order: true,
        created_by: owner.id,
        updated_by: owner.id,
      })
      .select('id, code, name, currency')
      .single()
    if (se) throw new Error(`khai NCC "${o.supplierName}": ${se.message}`)
    sups.push(ns)
    o.sup = { hit: ns, how: 'khai mới' }
    console.log(`  + NCC mới ${ns.code} — ${ns.name}`)
  }
  // 1. Khai vật tư còn thiếu.
  for (const r of o.rows.filter((x) => x.match.how === 'chưa có')) {
    const group = groupFor(r.name, o.group)
    const siblings = index.filter((m) => m.group_name === group)
    const count = new Map()
    for (const m of siblings) {
      const hit = m.code?.match(/^([A-Z]{2,3})-?\d+$/)
      if (hit) count.set(hit[1], (count.get(hit[1]) ?? 0) + 1)
    }
    const prefix =
      [...count.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ??
      prefixForGroup(group) ??
      'VT'
    /*
     * Số kế tiếp phải lấy theo SỐ, không theo thứ tự chuỗi: danh mục có cả
     * "PKN0378" lẫn "NK-0171", mà '-' đứng trước '0' trong bảng mã nên
     * `order('code' desc)` trả về bản KHÔNG gạch nối và cấp lại đúng số vừa
     * dùng — lần chạy đầu vấp ngay lỗi trùng khoá ở đây.
     * Dạng mã cũng theo số đông của chính nhóm (có gạch nối hay không, mấy chữ số).
     */
    const { data: siblingCodes } = await sb
      .from('warehouse_materials')
      .select('code')
      .like('code', `${prefix}%`)
      .limit(2000)
    let no = 0
    let dashed = 0
    let width = 4
    for (const row of siblingCodes ?? []) {
      const m = String(row.code ?? '').match(/^([A-Z]+)(-?)(\d+)$/)
      if (!m || m[1] !== prefix) continue
      no = Math.max(no, Number(m[3]))
      if (m[2]) dashed++
      width = Math.max(width, m[3].length)
    }
    const sep = dashed > (siblingCodes?.length ?? 0) / 2 ? '-' : ''
    const code = `${prefix}${sep}${String(no + 1).padStart(width, '0')}`
    const { data: ins, error } = await sb
      .from('warehouse_materials')
      .insert({
        code,
        name: r.name,
        unit: r.unit || 'Cái',
        group_name: group,
        spec: r.spec || null,
        material_grade: r.grade || null,
        po_template: o.template,
        needs_review: true,
        is_active: true,
      })
      .select('id, code, name, group_name')
      .single()
    if (error) throw new Error(`khai vật tư "${r.name}": ${error.message}`)
    r.match = { hit: ins, how: 'khai mới' }
    index.push({ ...ins, n: norm(ins.name), key: sureKey(ins.name) })
    created.mats++
  }

  // 2. Đầu đơn.
  const { data: code, error: ce } = await sb.rpc('next_doc_code', { p_kind: 'PO' })
  if (ce) throw new Error(`cấp số đơn: ${ce.message}`)
  const noteParts = [
    `Nạp từ file "${FILE.split(/[\\/]/).pop()}" (sheet ${o.sheet}).`,
    o.ngay ? `Ngày trên đơn: ${o.ngay}.` : '',
    o.lsxRef ? `Ghi trên đơn: ${o.lsxRef}.` : '',
  ]
  const pending = o.rows.filter((r) => r.match.how === 'nhiều ứng viên')
  if (pending.length)
    noteParts.push(
      `CHƯA NẠP ${pending.length} dòng vì file không ghi màu/quy cách, cần chọn mã: ` +
        pending.map((r) => `${r.name} (SL ${r.qty})`).join('; '),
    )
  const { data: po, error: pe } = await sb
    .from('supply_purchase_orders')
    .insert({
      code,
      production_order_id: lsx.id,
      supplier_id: o.sup.hit.id,
      status: 'draft',
      template: o.template,
      currency: o.sup.hit.currency ?? 'VND',
      vat_rate: 8,
      price_includes_vat: false,
      supplier_doc_no: o.soDh || null,
      note: noteParts.filter(Boolean).join(' '),
      terms_quality: o.terms.quality || null,
      terms_delivery_place: o.terms.place || null,
      terms_payment: o.terms.payment || null,
      terms_invoice: o.terms.invoice || null,
      terms_lead_time: o.terms.lead || null,
      signer_role: 'NGƯỜI LẬP',
      created_by: owner.id,
      assigned_to: owner.id,
    })
    .select('id, code')
    .single()
  if (pe) throw new Error(`tạo đơn ${o.sheet}: ${pe.message}`)
  created.pos++

  // 3. Dòng hàng.
  const rows = o.rows.filter((r) => r.match.hit)
  const payload = rows.map((r, i) => ({
    po_id: po.id,
    material_id: r.match.hit.id,
    qty_ordered: r.qty,
    unit_price: r.price ?? 0,
    sort_order: i,
    qty_basis: 'manual',
    price_basis: 'unit',
    spec: r.spec || null,
    material_grade: r.grade || null,
    qty_demand: r.demand ?? null,
    qty_on_hand: r.onhand ?? null,
    note: r.note || null,
    ...(o.template === 'carton'
      ? {
          product_code: r.product_code || null,
          open_style: r.open || null,
          pcs_per_ctn: r.pcs ?? null,
          inner_l_mm: r.inner?.[0] ?? null,
          inner_w_mm: r.inner?.[1] ?? null,
          inner_h_mm: r.inner?.[2] ?? null,
          area_m2: r.m2 ?? null,
          price_per_m2: r.priceM2 ?? null,
          carton_basis: 'ctn',
        }
      : {}),
  }))
  const { error: le } = await sb.from('supply_purchase_order_lines').insert(payload)
  if (le) throw new Error(`dòng đơn ${po.code}: ${le.message}`)
  created.lines += payload.length
  console.log(`  ✓ ${po.code} ${o.sheet} — ${payload.length} dòng`)
}
console.log(
  `\nXong: ${created.pos} đơn · ${created.lines} dòng · ${created.mats} vật tư khai mới.`,
)
