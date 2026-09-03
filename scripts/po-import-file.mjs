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

const OWNER_EMAIL = 'kehoach1@hoanggia.de' // Đặng Thị Thanh Nga

/**
 * Khách trên mã lệnh — để đọc dòng "LSX 01/26-27 (YOTRIO)" trên tờ đơn ra đúng
 * lệnh trong hệ thống. Mỗi file dùng một cách viết khác nhau (IBIZA/IBEZA,
 * HG-YTO, HG-MX), nên gom từ khoá về một mối ở đây.
 */
const CUSTOMER_ALIASES = {
  MX: ['mx', 'merxx'],
  YOTRIO: ['yotrio', 'yto'],
  ROSCO: ['rosco', 'ibiza', 'ibeza', 'chelsea'],
  BUN: ['bun', 'bunning'],
  JAWOLL: ['jawoll'],
  LAURA: ['laura'],
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
  for (const sheet of wb.SheetNames) {
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
    // Sheet nào là ĐƠN? Có số ĐH và có bảng dòng hàng. Sheet lệnh, bảng kê vật
    // tư, sheet nháp chép dở… đều rớt ở đây mà không cần khai tên từng cái.
    const soDh = (findAfter(/Số ĐH/i) || '').replace(/^.*Số ĐH\s*:?\s*/i, '')
    if (!soDh) continue
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
      // Cột "số lượng ĐẶT" mỗi người đặt một tên; "SỐ LƯỢNG" trần cũng là nó
      // (sheet nệm, sheet vải của VIPORA) nên phải nhận nốt.
      qty: col(/SL (Cần đăt|Cần đặt|Đặt hàng|mét CẦN ĐẶT|cần đặt)|^SỐ LƯỢNG/i),
      unit: col(/^ĐVT$/i),
      price: col(/Đơn giá \(VND\)/i),
      note: col(/^Ghi chú$/i),
      dm: col(/^Đm\s*\/?\s*sp$|Định mức|^đm\s*\//i),
      metres: col(/SL mét\/ ĐH/i),
      // carton
      open: col(/Cách mở/i),
      pcs: col(/Pcs\s*\/?\s*Ctn/i),
      inner: col(/QC lọt lòng/i),
      m2: col(/^M2$/i),
      priceM2: col(/Đgiá\s*\/M2/i),
      // Phiếu bao bì ghi đơn giá theo THÙNG hoặc theo TẤM tuỳ mặt hàng (thùng
      // carton vs giấy lót tổ ong) — bỏ sót "Tấm" là cả đơn về 0 đồng.
      priceCtn: col(/Đgiá\/\s*(Thùng|Tấm)/i),
    }
    const lines = []
    let carried = '' // tên của dòng trên, cho các dòng nối tiếp
    for (const r of flat.slice(h + 1)) {
      if (r.some((c) => /Cộng tiền hàng|ĐIỀU KHOẢN/i.test(String(c)))) break
      let name = String(r[C.name] ?? '').trim()
      /*
       * DÒNG NỐI TIẾP: đơn vải của VIPORA ghi tên MỘT LẦN rồi các dòng dưới chỉ
       * có định mức và số lượng cho từng cách dùng ("ghế bank 1 · 1.65 m/sp",
       * "bộ 3 · 4.95 m/sp"). Bỏ chúng là mất 2/3 số mét phải mua.
       */
      const unitCell = C.unit >= 0 ? String(r[C.unit] ?? '').trim() : ''
      const priceCell = C.price >= 0 ? num(r[C.price]) : null
      // Dòng nối tiếp phải có ĐVT hoặc đơn giá thật; dòng cộng cuối bảng cũng
      // mang số lượng (tổng mét) nhưng ĐVT ghi "0" và không có đơn giá.
      if (
        !name &&
        carried &&
        num(r[C.qty]) &&
        (priceCell || (unitCell && unitCell !== '0'))
      )
        name = carried
      if (!name || /^0$/.test(name)) continue
      carried = name
      // "code : VPR-F258" là MÃ NCC in trên phiếu chứ không phải tên hàng —
      // ghép thành tên đọc được cho danh mục, giữ nguyên mã để tra cứu.
      if (/^code\s*:/i.test(name)) {
        const codeOnly = name.replace(/^code\s*:\s*/i, '').trim()
        const unit = C.unit >= 0 ? String(r[C.unit] ?? '') : ''
        name = /mét|met|m$/i.test(unit) ? `Vải ${codeOnly}` : codeOnly
      }
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
    /*
     * MẪU ĐƠN suy từ CHÍNH BỘ CỘT của sheet, không khai tay từng sheet: có "QC
     * lọt lòng / Đgiá M2" là phiếu bao bì carton, còn lại là phụ kiện. Cột quyết
     * định cách dòng được nhập và in ra, nên đọc cột là cách chắc nhất.
     */
    const template = C.inner >= 0 || C.priceM2 >= 0 ? 'carton' : 'accessory'
    const group =
      template === 'carton'
        ? 'Bao bì - đóng gói - tem nhãn'
        : /vải|vai/i.test(sheet) || lines.every((l) => /^vải/i.test(l.name))
          ? 'Vải - da - chỉ - phụ liệu may'
          : null

    orders.push({
      sheet,
      template,
      group,
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
const owner = (users ?? [])[0]
if (!owner) throw new Error(`Không thấy tài khoản ${OWNER_EMAIL}`)

/**
 * LỆNH SẢN XUẤT của tờ đơn, đọc từ dòng "LSX …" ghi trên chính nó.
 *
 * Mỗi người viết một kiểu: "LSX 01/26-27 (YOTRIO)", "LSX 1 - ROSCO IBIZA",
 * "LSX 5.26.27 HG-MX", "LSX 02+03/26-27 (HG-MX)". Cần CẢ HAI mảnh mới dám gắn:
 * SỐ lệnh và KHÁCH. Thiếu một trong hai → trả null, đơn nằm ngoài lệnh.
 *
 * Vì sao khắt khe: số lệnh lặp lại qua từng niên độ, đợt nạp 01/09 đã gắn nhầm
 * "LSX 07+08/25-26" vào lệnh 08/26-27 và cộng tiền vào một lệnh không liên quan.
 * Nhiều lệnh trên một đơn ("02+03") thì lấy lệnh ĐẦU và ghi nguyên câu vào note.
 */
function resolveLsx(ref) {
  const raw = String(ref ?? '')
  if (!raw) return null
  const n = norm(raw)
  const cust = Object.entries(CUSTOMER_ALIASES).find(([, kws]) =>
    kws.some((k) => new RegExp(`(^| )${k}( |$)`).test(n)),
  )?.[0]
  if (!cust) return null
  const numMatch = raw.match(
    /(\d{1,2})\s*(?:[+.]\s*\d{1,2}\s*)*\s*[/.]?\s*2[67]\s*-\s*2[67]/,
  )
  const loose = numMatch ? numMatch[1] : (raw.match(/LSX\s*0?(\d{1,2})/i)?.[1] ?? null)
  if (!loose) return null
  const code = `${String(loose).padStart(2, '0')}/26-27 - ${cust}`
  return (lsxs ?? []).find((l) => l.code === code) ?? null
}

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
  `File: ${FILE.split(/[\\/]/).pop()} · Người phụ trách: ${owner.name} · ${orders.length} đơn\n`,
)

// Đơn đã nạp rồi thì bỏ qua — chạy lại script trên cùng file không đẻ đơn đôi.
const { data: existingPos } = await sb
  .from('supply_purchase_orders')
  .select('code, supplier_doc_no')
  .limit(2000)
const takenDocs = new Set(
  (existingPos ?? []).map((p) => norm(p.supplier_doc_no ?? '')).filter(Boolean),
)

const plan = []
for (const o of orders) {
  // Sheet theo dõi / sheet nháp lọt vào vì có chữ "Số ĐH" ở đâu đó nhưng không
  // có dòng hàng nào — không phải đơn.
  if (o.lines.length === 0) {
    console.log(`${o.sheet.padEnd(9)} — không có dòng hàng, bỏ qua`)
    continue
  }
  if (takenDocs.has(norm(o.soDh))) {
    console.log(
      `${o.sheet.padEnd(9)} ${String(o.soDh).padEnd(20)} — ĐÃ NẠP TRƯỚC ĐÓ, bỏ qua`,
    )
    continue
  }
  const sup = matchSupplier(o.supplierName, o.mst, sups ?? [])
  const lsx = resolveLsx(o.lsxRef)
  const rows = []
  for (const l of o.lines) {
    const m = matchMaterial(l, index)
    rows.push({ ...l, match: m })
  }
  plan.push({ ...o, sup, lsx, rows })
  const link = rows.filter((r) => r.match.hit).length
  const create = rows.filter((r) => r.match.how === 'chưa có').length
  const skip = rows.filter((r) => r.match.how === 'nhiều ứng viên').length
  const tien = rows.reduce((s, r) => s + (r.price ?? 0) * r.qty, 0)
  console.log(
    `${o.sheet.padEnd(9)} ${String(o.soDh).padEnd(20)} ${o.template.padEnd(9)} ` +
      `${rows.length} dòng (khớp ${link} · khai mới ${create} · CHỜ CHỌN ${skip}) ` +
      `· ${tien.toLocaleString('vi-VN')} đ · ${lsx ? lsx.code : '⟨ngoài lệnh⟩'} · NCC ${sup.hit ? (sup.hit.code ?? sup.hit.name.slice(0, 22)) : '✗ ' + sup.how}`,
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
    /*
     * Dò lại NCC ngay trước khi ghi: bảng khớp tính một lần từ đầu, mà một NCC
     * có thể đứng ở NHIỀU sheet (VIPORA có ba đơn Đ1/Đ2/Đ3). Không dò lại thì
     * đơn thứ hai và thứ ba mỗi cái khai một hồ sơ NCC mới cho cùng công ty.
     */
    const retry = matchSupplier(o.supplierName, o.mst, sups ?? [])
    if (retry.hit) {
      o.sup = retry
    } else {
      /*
       * Chỉ khai NCC mới khi ô "Kính gửi" thật sự là TÊN DOANH NGHIỆP. Sheet nội
       * bộ ghi "Theo HD số:" vào đúng ô đó — khai theo là danh mục NCC có một
       * dòng rác mang tên một câu nói.
       */
      const looksLikeCompany =
        /(công ty|cty|doanh nghiệp|cơ sở|co\.,|ltd|jsc|corp)/i.test(
          o.supplierName ?? '',
        ) ||
        String(o.supplierName ?? '')
          .trim()
          .split(/\s+/).length >= 4
      if (!looksLikeCompany) {
        console.log(`BỎ ${o.sheet}: "${o.supplierName}" không giống tên NCC`)
        continue
      }
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
  }
  // 1. Khai vật tư còn thiếu.
  for (const r of o.rows.filter((x) => x.match.how === 'chưa có')) {
    /*
     * Cùng một vật tư có thể đứng ở NHIỀU DÒNG của cùng tờ đơn (đơn vải VIPORA:
     * một mã vải, ba định mức cho ba sản phẩm). Bảng khớp tính một lần từ đầu
     * nên dòng thứ hai vẫn mang cờ "chưa có" — dò lại danh mục ngay trước khi
     * ghi, không thì mỗi dòng đẻ một mã.
     */
    const again = index.find((m) => m.n === norm(r.name))
    if (again) {
      r.match = { hit: again, how: 'vừa khai' }
      continue
    }
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
      production_order_id: o.lsx?.id ?? null,
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
