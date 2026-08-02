// Rút hồ sơ NHÀ CUNG CẤP THẬT từ các file ĐƠN ĐẶT HÀNG của phòng Cung ứng và nạp
// vào `supply_suppliers` (đang chỉ có 5 NCC seed demo).
//
//   node scripts/suppliers-import.mjs                          # dry-run: chỉ in
//   node scripts/suppliers-import.mjs --src "E:/PO"            # thư mục nguồn khác
//   node scripts/suppliers-import.mjs --json ncc.json          # xuất JSON để rà
//   node scripts/suppliers-import.mjs --apply                  # ghi vào DB
//
// Vì sao cần: mã viết tắt trên số đơn (`3/2026-HG/TTL`) chính là NCC. Không có
// danh sách NCC thật thì không sinh được số ĐH theo nếp phòng đang dùng, và mọi
// đơn trong app phải chọn từ 5 NCC demo không có thật.
//
// Nguồn: mỗi file = 1 LSX, mỗi sheet "Đơn hàng …" = 1 đơn gửi 1 NCC. Khối đầu
// sheet có sẵn: tên đầy đủ (dòng "Kính gửi"), địa chỉ, MST, người liên hệ.
//
// Những chỗ file gốc "bẩn" mà script phải chịu được:
//   · HAI kiểu khối đầu. Mẫu cũ: nhãn và giá trị nằm CHUNG một ô
//     ("Kính gửi: Công Ty TNHH Nhôm Tiến Đạt"). Mẫu mới: nhãn một ô, giá trị ở ô
//     kế bên ("Kính gửi:" ‖ "CÔNG TY CỔ PHẦN HAPPYCO").
//   · Dòng đầu sheet là hồ sơ HOÀNG GIA (MST 4100644894) — chỉ đọc từ dòng
//     "Kính gửi" trở xuống, và chặn cứng MST đó, kẻo nạp chính mình thành NCC.
//   · "Kính gửi: : Công ty …" (hai dấu hai chấm) và "MST: 0311147703 ‖ LSX 02".
//   · Số ĐH bốn kiểu: "ĐH : HG/TĐ" · "ĐH 03 : HG/TW" · "ĐH : 01HG/KVP" ·
//     "04/202 (HG-PQ)" → chỉ lấy đoạn sau HG/ hoặc HG-.
//   · MÃ KHÔNG KHỚP TÊN (lỗi copy sheet của người lập): sheet Kim Vĩnh Phú mang
//     "ĐH : HG/GA", sheet Việt Ý mang MST của Nhôm Hoàng Gia HN. Script KHÔNG tự
//     đoán bên nào đúng — gom theo MST, còn mã lệch thì in ra mục XUNG ĐỘT để
//     người rà quyết. Nạp mã sai vào `code` là hỏng số ĐH của cả năm.
//   · `supply_suppliers.code` UNIQUE: một mã (vd TW) xuất hiện ở hai pháp nhân
//     (Đoàn Gia, Ngô Sơn) → chỉ NCC dùng mã đó nhiều nhất được giữ `code`, phần
//     còn lại nạp với code = null + ghi chú, thay vì để insert vỡ.
//
// Không import gì từ src/ để chạy được bằng `node` trần.

import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import * as XLSX from 'xlsx'
import { client } from './products-lib.mjs'

const args = process.argv.slice(2)
const flag = (name, dflt) => {
  const i = args.indexOf(name)
  return i >= 0 ? (args[i + 1] ?? dflt) : dflt
}
const SRC = flag('--src', 'E:/PO')
const JSON_OUT = flag('--json', null)
const APPLY = args.includes('--apply')

/** MST của chính Hoàng Gia — xuất hiện ở đầu MỌI sheet, không phải NCC. */
const SELF_TAX = '4100644894'

/**
 * NCC chỉ xuất hiện trong HỒ SƠ KỸ THUẬT (thư mục A_Lân), không có đơn đặt nào
 * trong `E:\PO` nên bộ quét ở dưới không thấy. Nguồn: bảng quy cách nhôm (cột
 * "Nhà cung cấp" của từng quy cách) và bảng khuôn nhôm.
 *
 * `Thép Giang Sơn Thịnh` CỐ Ý không có ở đây: DB đã có "Công Ty TNHH đầu tư Thép
 * Sơn Giang Thịnh" — đảo thứ tự chữ, nhiều khả năng là một, cần người xác nhận
 * chứ không nạp thành hai pháp nhân.
 */
const TECH_SUPPLIERS = [
  {
    name: 'Công ty TNHH Nhôm Phong Gia Phát',
    short_name: 'Phong Gia Phát',
    code: 'PGP',
    note: 'Hồ sơ kỹ thuật · bảng quy cách nhôm — cung cấp 161 quy cách; mã PGP đã thấy ở cột NCC của bảng kê vật tư',
  },
  {
    name: 'CÔNG TY TNHH THƯƠNG MẠI SẢN XUẤT NHÔM PHÚ THÀNH',
    short_name: 'Phú Thành',
    code: 'PT',
    address: 'F12-F13, Đường số 9, KCN Hải Sơn, X. Đức Hòa Hạ, Đức Hòa, Long An',
    email: 'co.phuthanh@yahoo.com',
    phone: '072. 3817766',
    note: 'Hồ sơ kỹ thuật · PROFILE NHÔM PHONG GIA PHÁT.xlsx (sheet bảng chuẩn) · Fax 072.3817733',
  },
  {
    name: 'Nhôm Xuân Kỳ',
    short_name: 'Xuân Kỳ',
    code: 'XK',
    note: 'Hồ sơ kỹ thuật · bảng khuôn nhôm — khuôn cũ, file ghi "chuyển sang Tiến Đạt"',
  },
  {
    name: 'ALANMI',
    short_name: 'ALANMI',
    code: 'ALM',
    note: 'Hồ sơ kỹ thuật · bảng khuôn nhôm',
  },
  // Bốn nơi GIỮ KHUÔN, lấy từ "Tổng Hợp Khuôn Nhôm 2020 … MỚI.xlsx" (15 sheet,
  // mỗi NCC một sheet + cột "Khách hàng"). Mã khuôn tự xác nhận nhà mở khuôn:
  // MH-HG1230 → Mien Hua, YH-G6 → YngHua.
  {
    name: 'Mien Hua',
    short_name: 'Mien Hua',
    code: 'MH',
    note: 'Hồ sơ kỹ thuật · tổng hợp khuôn nhôm — khuôn mã MH-*',
  },
  {
    name: 'YngHua',
    short_name: 'YngHua',
    code: 'YH',
    note: 'Hồ sơ kỹ thuật · tổng hợp khuôn nhôm — khuôn mã YH-*',
  },
  {
    name: 'Nhôm Phú Mỹ',
    short_name: 'Phú Mỹ',
    code: 'PM',
    note: 'Hồ sơ kỹ thuật · tổng hợp khuôn nhôm (sheet riêng)',
  },
  {
    name: 'HHT',
    short_name: 'HHT',
    code: 'HHT',
    note: 'Hồ sơ kỹ thuật · tổng hợp khuôn nhôm (sheet riêng)',
  },
]

/**
 * Mã viết tắt CHỐT TAY (user quyết 01/08/2026) cho những chỗ file gốc dùng một
 * mã cho hai pháp nhân — `supply_suppliers.code` là UNIQUE nên phải chọn.
 * Bên không giữ mã vẫn được nạp hồ sơ, chỉ để `code` trống + ghi mã trên đơn vào
 * ghi chú, chờ Cung ứng đặt mã mới.
 *
 * Khớp theo tên (bỏ dấu) chứ không theo MST: có NCC chưa khai MST, và có hai
 * pháp nhân DÙNG CHUNG một MST do sheet chép nhầm.
 */
const CODE_RULES = [
  { match: /tien dat/, code: 'TĐ' }, // nhôm, 7 đơn — giữ TĐ
  { match: /thong dat/, code: null }, // inox, cũng ghi HG/TĐ trên đơn
  { match: /kim vinh phu/, code: 'KVP' }, // 1 sheet ghi "01HG/KVP" → GA là lỗi copy
  { match: /gia anh/, code: 'GA' },
  { match: /ngo son/, code: 'TW' },
  { match: /taiwant/, code: null }, // cùng MST với Ngô Sơn, giữ hồ sơ riêng
  { match: /doan gia/, code: null }, // pháp nhân khác, sheet mượn mã TW
  { match: /cat tuong/, code: 'CT' }, // 10 đơn — giữ CT
  { match: /son giang thinh/, code: null }, // sheet SƠN THỊNH mượn mã CT
]

// ── tiện ích chuỗi ────────────────────────────────────────────────────────────

const norm = (v) =>
  String(v ?? '')
    .replace(/\s+/g, ' ')
    .trim()

/** Bỏ dấu + hạ chữ thường, chỉ để SO NHÃN — giá trị luôn giữ nguyên văn. */
const nod = (v) =>
  norm(v)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()

const isLabel = (cell, re) => re.test(nod(cell))

/**
 * Giá trị của một nhãn: phần sau dấu ":" trong chính ô đó (mẫu cũ), hoặc ô
 * không rỗng kế tiếp cùng dòng (mẫu mới).
 */
function valueOf(row, i) {
  const cell = norm(row[i])
  const inline = cell
    .replace(/^[^:]*:/, '')
    .replace(/^[:\s]+/, '')
    .trim()
  if (inline) return inline
  for (let j = i + 1; j < row.length; j++) {
    const v = norm(row[j])
    if (v) return v
  }
  return ''
}

const RE = {
  to: /^k[ií]nh\s*g[uử]i|^kinh gui/,
  addr: /^dia chi/,
  tax: /^mst|^ma so thue/,
  contact: /^nguoi lien he|^dt\b|^sdt|^dien thoai|^tel/,
}

/** Số thuế: 10 số, có thể kèm "-001". Bỏ mọi thứ đi kèm ("… ‖ LSX 02"). */
function taxOf(s) {
  const m = norm(s).match(/\b(\d{9,10}(?:\s*-\s*\d{3})?)\b/)
  if (!m) return ''
  const t = m[1].replace(/\s+/g, '')
  // Ô MST định dạng SỐ thì Excel nuốt số 0 đầu: 0107595790 → "107595790".
  // Không bù lại thì cùng một NCC ra hai MST khác nhau và tách thành hai hồ sơ.
  return /^\d{9}(-\d{3})?$/.test(t) ? '0' + t : t
}

/** "0931 468 214 (Gặp Thi)" → { phone: '0931 468 214', name: 'Thi' } */
function contactOf(s) {
  const t = norm(s)
  if (!t) return { phone: '', name: '' }
  const phone = (t.match(/(?:\+?84|0)[\d\s.\-()]{7,}/) || [''])[0]
    .replace(/[()]/g, '')
    .trim()
  const paren = t.match(/\(([^)]+)\)/)
  let name = paren
    ? paren[1]
    : t
        .replace(phone, '')
        .replace(/[-–—:]/g, '')
        .trim()
  name = name
    .replace(/^(g[ăặ]p)\s+/i, '')
    .replace(/\bs[đd]t\b\.?/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (/^\d/.test(name) || name.length > 60) name = ''
  return { phone, name }
}

/**
 * Mã viết tắt trên số ĐH: HG/TĐ · 01HG/KVP · (HG-PQ) · HG/HGHN · HG/3/2.
 * Cho phép "/" trong mã vì Bao bì 3/2 mang mã "3/2" — cắt ở "/" đầu thì thành "3".
 */
function codeOf(text) {
  const m = norm(text).match(/HG\s*[/-]\s*([A-Za-zÀ-ỹĐđ0-9]+(?:\/\d+)?)/)
  return m ? m[1].toUpperCase().replace(/[.,;]+$/, '') : ''
}

/** Tên ngắn suy từ tên sheet: "Đơn hàng Tiến Đạt (3)" → "Tiến Đạt". */
function shortFromSheet(sheet) {
  const s = norm(sheet)
    .replace(/^đ[ơo]n h[àa]ng/i, '')
    .replace(/\((?:LSX[^)]*|\d+)\)/gi, '')
    .replace(/[()]/g, '')
    .trim()
  if (s.length < 2 || /^\d+$/.test(s)) return ''
  // Tên sheet nhiều khi là ghi chú của người lập ("chưa đặt", "Sheet1"), không
  // phải tên NCC — thà bỏ trống còn hơn nạp rác vào short_name.
  if (/^(chua|sheet|tong hop|bang ke|don hang|moi|new)/.test(nod(s))) return ''
  return s
}

/** Đoán mẫu đơn theo bộ cột của bảng hàng — cùng bảng mã với src/lib/po-template.ts. */
function templateOf(headerText) {
  const h = nod(headerText)
  if (/pcs\/ctn|lot long|cach mo|thung|carton/.test(h)) return 'carton'
  if (/kg\/m|so cay|cay du/.test(h)) return 'aluminium'
  if (/tong so kg|trong luong cay|kg\/dv|kich thuoc/.test(h)) return 'metal_kg'
  if (/dm\/sp|hao hut|hh %|ton kho|quy cach/.test(h)) return 'accessory'
  return 'simple'
}

// ── quét file ─────────────────────────────────────────────────────────────────

/** Một sheet đơn → hồ sơ NCC, hoặc null nếu sheet không phải đơn đặt. */
function scanSheet(rows, file, sheet) {
  const head = rows.slice(0, 16)
  const kg = (() => {
    for (let r = 0; r < head.length; r++)
      for (let c = 0; c < head[r].length; c++)
        if (isLabel(head[r][c], RE.to)) return { r, c }
    return null
  })()
  if (!kg) return null

  // Có sheet ô nhãn để trống còn ô kế bên chứa CẢ nhãn lẫn tên
  // ("Kính gửi: Công ty TNHH Aluminum Việt Eco") → bóc nhãn thêm lần nữa.
  let name = valueOf(head[kg.r], kg.c)
  if (RE.to.test(nod(name)))
    name = norm(name.replace(/^[^:]*:/, '')).replace(/^[:\s]+/, '')
  if (!name || name.length < 4) return null

  const rec = {
    file,
    sheet,
    name,
    short_name: shortFromSheet(sheet),
    code: '',
    tax_no: '',
    address: '',
    contact_name: '',
    contact_phone: '',
    template: 'simple',
    items: [],
  }

  // Mã viết tắt: lấy quanh khối đầu (dòng "ĐH …" có thể nằm trên hoặc dưới
  // dòng "Kính gửi" tuỳ mẫu).
  for (const row of head.slice(0, kg.r + 4)) {
    const c = codeOf(row.map(norm).join(' '))
    if (c) {
      rec.code = c
      break
    }
  }

  // Địa chỉ / MST / liên hệ: CHỈ từ dòng "Kính gửi" trở xuống — phía trên là
  // hồ sơ Hoàng Gia.
  for (let r = kg.r; r < Math.min(kg.r + 6, head.length); r++) {
    const row = head[r]
    for (let c = 0; c < row.length; c++) {
      const cell = row[c]
      if (!rec.address && isLabel(cell, RE.addr)) rec.address = valueOf(row, c)
      else if (!rec.tax_no && isLabel(cell, RE.tax)) rec.tax_no = taxOf(valueOf(row, c))
      else if (!rec.contact_phone && isLabel(cell, RE.contact)) {
        const { phone, name: cn } = contactOf(valueOf(row, c))
        rec.contact_phone = phone
        rec.contact_name = cn
      }
    }
  }
  if (rec.tax_no === SELF_TAX) rec.tax_no = ''
  // Địa chỉ có thể dính đuôi ghi chú LSX ở ô kế bên — cắt phần đó đi.
  rec.address = rec.address.replace(/\s*(LSX|Theo HD)\b.*$/i, '').trim()

  // Bảng hàng: dòng header có "Stt" + cột tiền/số lượng.
  const hi = rows.findIndex(
    (r) =>
      /\bstt\b/.test(nod(r.join(' '))) && /so luong|sl\b|don gia/.test(nod(r.join(' '))),
  )
  if (hi >= 0) {
    const header = rows[hi].map(norm)
    rec.template = templateOf(header.join(' '))
    const ci = header.findIndex((h) => /ten san pham|ten vat tu|chi tiet/.test(nod(h)))
    if (ci >= 0)
      rec.items = rows
        .slice(hi + 1, hi + 6)
        .map((r) => norm(r[ci]))
        .filter(Boolean)
        .slice(0, 3)
  }
  return rec
}

function scanDir(dir) {
  const out = []
  for (const f of readdirSync(dir)) {
    if (!/\.xlsx?$/i.test(f) || /^~\$/.test(f)) continue
    const wb = XLSX.read(readFileSync(join(dir, f)), { type: 'buffer' })
    for (const sheet of wb.SheetNames) {
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheet], {
        header: 1,
        blankrows: false,
        defval: '',
        raw: false,
      })
      const rec = scanSheet(rows, f, sheet)
      if (rec) out.push(rec)
    }
  }
  return out
}

// ── gom nhóm ──────────────────────────────────────────────────────────────────

/** Khoá gom: MST nếu có, không thì tên đã chuẩn hoá (bỏ dấu, bỏ loại hình cty). */
function nameKey(name) {
  return nod(name)
    .replace(
      /\b(cong ty|cty|tnhh|co phan|cp|mtv|sx|tm|dv|dich vu|thuong mai|san xuat|xuat nhap khau|xnk|th|va|-)\b/g,
      ' ',
    )
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Hai tên có phải một pháp nhân không — dùng để quyết CÓ gộp theo MST hay không.
 * "Cty TNHH Nhôm Tiến Đạt" vs "Nhôm Tiến Đạt" → một. "Nhôm Việt Ý" vs
 * "CP SX & XNK nhôm Hoàng Gia" → hai, dù file ghi CHUNG một MST (sheet copy quên
 * sửa). Gộp bừa theo MST là mất hẳn một NCC khỏi danh sách.
 */
function sameEntity(a, b) {
  if (a === b) return true
  if (a.includes(b) || b.includes(a)) return true
  const ta = new Set(a.split(' ').filter((w) => w.length > 1))
  const tb = new Set(b.split(' ').filter((w) => w.length > 1))
  if (!ta.size || !tb.size) return false
  const hit = [...ta].filter((w) => tb.has(w)).length
  return hit / Math.min(ta.size, tb.size) >= 0.6
}

function group(records) {
  // Tên → MST (từ những sheet khai đủ cả hai) để sheet thiếu MST vẫn gom đúng,
  // nhưng chỉ nhận MST của sheet có TÊN tương thích.
  const taxByName = new Map()
  for (const r of records) {
    const k = nameKey(r.name)
    if (r.tax_no && !taxByName.has(k)) taxByName.set(k, r.tax_no)
  }
  const groups = new Map()
  for (const r of records) {
    const k = nameKey(r.name)
    // Sheet không ghi MST vẫn gom được nhờ tên đã gặp ở sheet khác.
    const tax = r.tax_no || taxByName.get(k) || ''
    // Khoá gom = MST, nhưng chỉ khi mọi tên mang MST đó là một pháp nhân.
    const twinName = [...taxByName.entries()].find(([n, t]) => t === tax && n !== k)?.[0]
    const key = tax && (!twinName || sameEntity(k, twinName)) ? tax : k
    if (!groups.has(key))
      groups.set(key, {
        key,
        names: new Map(),
        codes: new Map(),
        taxes: new Set(),
        addresses: new Set(),
        contacts: new Set(),
        shorts: new Map(),
        templates: new Map(),
        items: new Set(),
        sheets: [],
      })
    const g = groups.get(key)
    const bump = (m, v) => v && m.set(v, (m.get(v) ?? 0) + 1)
    bump(g.names, r.name)
    bump(g.codes, r.code)
    bump(g.shorts, r.short_name)
    bump(g.templates, r.template)
    if (r.tax_no) g.taxes.add(r.tax_no)
    if (r.address) g.addresses.add(r.address)
    if (r.contact_phone || r.contact_name)
      g.contacts.add([r.contact_phone, r.contact_name].filter(Boolean).join(' — '))
    r.items.forEach((i) => g.items.add(i))
    g.sheets.push(`${r.file} › ${r.sheet}`)
  }
  const top = (m) =>
    [...m.entries()].sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)[0]?.[0] ??
    ''
  return [...groups.values()]
    .map((g) => {
      const name = top(g.names)
      const rule = CODE_RULES.find((r) => r.match.test(nod(name)))
      return {
        name,
        code: rule ? (rule.code ?? '') : top(g.codes),
        codeRuled: !!rule,
        short_name: top(g.shorts),
        tax_no: [...g.taxes][0] ?? '',
        address: [...g.addresses].sort((a, b) => b.length - a.length)[0] ?? '',
        contact: [...g.contacts][0] ?? '',
        template: top(g.templates),
        orders: g.sheets.length,
        items: [...g.items].slice(0, 3),
        allNames: [...g.names.keys()],
        allCodes: [...g.codes.keys()],
        allTaxes: [...g.taxes],
        sheets: g.sheets,
      }
    })
    .sort((a, b) => b.orders - a.orders)
}

// ── in ────────────────────────────────────────────────────────────────────────

const line = (n = 100) => '─'.repeat(n)

function report(list, records) {
  console.log(
    `\nQuét ${SRC}: ${records.length} sheet đơn → ${list.length} nhà cung cấp\n`,
  )
  for (const g of list) {
    console.log(line())
    const codeTag = g.codeRuled ? ' [chốt tay]' : ''
    console.log(`${g.code || '(để trống)'}${codeTag}  ·  ${g.name}`)
    console.log(`  MST        : ${g.tax_no || '—'}`)
    console.log(`  Địa chỉ    : ${g.address || '—'}`)
    console.log(`  Liên hệ    : ${g.contact || '—'}`)
    console.log(`  Tên ngắn   : ${g.short_name || '—'}`)
    console.log(`  Mẫu đơn    : ${g.template}   ·  ${g.orders} đơn`)
    if (g.items.length) console.log(`  Hàng       : ${g.items.join(' · ')}`)
    if (g.allNames.length > 1)
      console.log(`  ⚠ tên khác : ${g.allNames.slice(1).join(' | ')}`)
    if (g.allCodes.length > 1) console.log(`  ⚠ mã khác  : ${g.allCodes.join(' | ')}`)
    if (g.allTaxes.length > 1) console.log(`  ⚠ MST khác : ${g.allTaxes.join(' | ')}`)
  }

  // Một mã dùng cho nhiều pháp nhân — `code` là UNIQUE nên phải chốt tay.
  const byCode = new Map()
  for (const g of list) {
    if (!g.code) continue
    if (!byCode.has(g.code)) byCode.set(g.code, [])
    byCode.get(g.code).push(g)
  }
  const dup = [...byCode.entries()].filter(([, gs]) => gs.length > 1)
  if (dup.length) {
    console.log('\n' + line())
    console.log('XUNG ĐỘT MÃ (cần bạn chốt — cột `code` là UNIQUE):')
    for (const [code, gs] of dup) {
      console.log(`  ${code}:`)
      for (const g of gs)
        console.log(
          `    · ${g.name} (${g.tax_no || 'chưa có MST'}) — ${g.orders} đơn: ${g.sheets[0]}`,
        )
    }
  }
  // Cùng MST nhưng khác pháp nhân — sheet copy quên sửa MST. Không tự gộp.
  const byTax = new Map()
  for (const g of list) {
    if (!g.tax_no) continue
    if (!byTax.has(g.tax_no)) byTax.set(g.tax_no, [])
    byTax.get(g.tax_no).push(g)
  }
  const dupTax = [...byTax.entries()].filter(([, gs]) => gs.length > 1)
  if (dupTax.length) {
    console.log('\n' + line())
    console.log('CÙNG MST, KHÁC TÊN (một trong hai sheet chép nhầm — cần bạn chốt):')
    for (const [tax, gs] of dupTax) {
      console.log(`  ${tax}:`)
      for (const g of gs) console.log(`    · ${g.name} — ${g.orders} đơn: ${g.sheets[0]}`)
    }
  }

  const noTax = list.filter((g) => !g.tax_no)
  if (noTax.length) {
    console.log('\nCHƯA CÓ MST (file không ghi):')
    for (const g of noTax) console.log(`  · ${g.code || '—'} ${g.name} — ${g.sheets[0]}`)
  }
}

// ── nạp DB ────────────────────────────────────────────────────────────────────

async function apply(list) {
  const sb = await client(import.meta.url)
  const { data: existing, error } = await sb
    .from('supply_suppliers')
    .select(
      'id, code, name, tax_no, address, phone, contact_name, contact_phone, short_name, note',
    )
  if (error) throw error

  const byTax = new Map(existing.filter((s) => s.tax_no).map((s) => [s.tax_no, s]))
  const byName = new Map(existing.map((s) => [nameKey(s.name), s]))
  const codeTaken = new Set(existing.filter((s) => s.code).map((s) => s.code))

  // MST bị hai pháp nhân dùng chung (sheet chép nhầm) — vẫn nạp cả hai nhưng
  // ghi chú rõ, để người dùng đối chiếu giấy tờ chứ không âm thầm chọn hộ.
  const taxCount = new Map()
  for (const g of list)
    if (g.tax_no) taxCount.set(g.tax_no, (taxCount.get(g.tax_no) ?? 0) + 1)

  let added = 0,
    patched = 0,
    skippedCode = 0
  for (const g of list) {
    const hit = (g.tax_no && byTax.get(g.tax_no)) || byName.get(nameKey(g.name))
    let code = g.code || null
    if (code && codeTaken.has(code) && hit?.code !== code) {
      code = null // mã đã có chủ — để trống, in ra để chốt tay
      skippedCode++
    }
    const row = {
      name: g.name.slice(0, 200),
      code,
      short_name: g.short_name || null,
      tax_no: g.tax_no || null,
      address: g.address || null,
      contact_name: g.contact.split(' — ')[1] || null,
      contact_phone: g.contact.split(' — ')[0] || null,
      note: [
        `Rút từ đơn đặt thật: ${g.sheets[0]}`,
        g.allCodes.length && (!code || g.allCodes.length > 1)
          ? `mã trên đơn: ${g.allCodes.join('/')}`
          : '',
        !code && g.allCodes.length ? 'mã đã có NCC khác dùng — chờ Cung ứng đặt mã' : '',
        taxCount.get(g.tax_no) > 1 ? 'MST trùng với NCC khác — CẦN XÁC MINH' : '',
        `mẫu đơn hay dùng: ${g.template}`,
      ]
        .filter(Boolean)
        .join(' · '),
    }
    if (!hit) {
      const { error: e } = await sb.from('supply_suppliers').insert(row)
      if (e) {
        console.error(`  ✗ ${g.name}: ${e.message}`)
        continue
      }
      if (code) codeTaken.add(code)
      added++
    } else {
      // Chỉ ĐIỀN Ô TRỐNG, không ghi đè dữ liệu người dùng đã sửa trên app.
      const patch = {}
      for (const [k, v] of Object.entries(row))
        if (v && k !== 'note' && !hit[k]) patch[k] = v
      if (!Object.keys(patch).length) continue
      if (patch.code && codeTaken.has(patch.code)) delete patch.code
      const { error: e } = await sb
        .from('supply_suppliers')
        .update(patch)
        .eq('id', hit.id)
      if (e) {
        console.error(`  ✗ ${g.name}: ${e.message}`)
        continue
      }
      patched++
    }
  }
  // NCC chỉ có trong hồ sơ kỹ thuật — không đơn nào trong E:\PO nhắc tới.
  let techAdded = 0
  for (const t of TECH_SUPPLIERS) {
    if (byName.get(nameKey(t.name))) continue
    if (existing.some((s) => nameKey(s.name).includes(nameKey(t.short_name)))) continue
    const code = t.code && !codeTaken.has(t.code) ? t.code : null
    const { error: e } = await sb.from('supply_suppliers').insert({ ...t, code })
    if (e) {
      console.error(`  ✗ ${t.name}: ${e.message}`)
      continue
    }
    if (code) codeTaken.add(code)
    techAdded++
  }

  console.log(
    `\n✓ thêm ${added} (từ đơn đặt) + ${techAdded} (từ hồ sơ kỹ thuật)` +
      ` · bổ sung ô trống ${patched} · bỏ mã trùng ${skippedCode}`,
  )
}

// ── chạy ──────────────────────────────────────────────────────────────────────

const records = scanDir(SRC)
const list = group(records)
report(list, records)
if (JSON_OUT) {
  writeFileSync(JSON_OUT, JSON.stringify({ records, list }, null, 2), 'utf8')
  console.log(`\n→ ${JSON_OUT}`)
}
if (APPLY) await apply(list)
else console.log('\n(dry-run — thêm --apply để ghi vào supply_suppliers)')
