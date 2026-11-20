/**
 * THẺ TREO MẪU SHOWROOM — logic THUẦN (bản vẽ duyệt 19/11/2026,
 * https://claude.ai/artifact/HyVmMJMPEpMjeoFao19xQC v2; phiếu 101026 của PKD).
 *
 * Chỉ quyết định thẻ IN GÌ; vẽ thẻ ở `thu-vien/in-the/the-treo.tsx`. Luật đã chốt:
 *  - Q2: KHÔNG in tên khách / mã hàng của khách (khách khác đến showroom đọc
 *    được thẻ) — chỉ khi người in bật ô "In tên khách".
 *  - Q3: dòng tiếng Anh chỉ lấy "Mô tả EN"; nhãn của thẻ luôn hai thứ tiếng.
 *  - Q5: thiếu dữ liệu vẫn in; kích thước thiếu thì ô để trống (ghi tay), chất
 *    liệu thiếu thì bỏ dòng. "xác nhận sau" coi như trống.
 *  - Số kích thước in TRẦN (1940), không dấu nghìn: "1.940" khách nước ngoài đọc
 *    thành 1,94.
 */
import QRCode from 'qrcode'
import { SHOWROOM_ZONES, type ShowroomZone } from './showroom'

/** Khu showroom (0304) — thứ tự in / sắp xếp. */
export { SHOWROOM_ZONES, type ShowroomZone } from './showroom'

/** Số thẻ mỗi tờ A4: 2 = A5 dọc (A4 ngang, mặc định), 4 = A6 (A4 dọc). */
export type TheMoiTo = 2 | 4

/** Dữ liệu SP cần để in một thẻ (service đọc từ technical_products). */
export type TheNguon = {
  id: string
  code: string
  name: string
  description_en: string | null
  frame_material: string | null
  length_mm: number | null
  width_mm: number | null
  height_mm: number | null
  tech_spec: Record<string, unknown> | null
  customer_name: string | null
  customer_item_code: string | null
  image_url: string | null
  showroom_zone: string | null
  showroom_sample: boolean
  showroom_tagged_at: string | null
  /** Ô tóm tắt đóng gói (jsonb `packing`): qty_per_carton, carton_*_cm, cbm, loading_40hc, nw_kg, gw_kg. */
  packing?: Record<string, unknown> | null
  net_weight_kg?: number | null
  origin_country?: string | null
}

export type TheDong = { vi: string; en: string; value: string }

/** Thẻ đã quyết xong nội dung — component chỉ việc vẽ. */
export type TheTreo = {
  id: string
  code: string
  name: string
  en: string | null
  dims: { l: number; w: number; h: number } | null
  /** Kích thước quy inch (1 in = 25,4 mm), một chữ số lẻ — khách Mỹ/Anh đọc inch. */
  inch: string | null
  rows: TheDong[]
  /** Đóng gói + trọng lượng — chỉ dòng có dữ liệu. */
  pack: TheDong[]
  /** Đơn vị sản xuất — tên CÔNG TY, không phải quốc gia (chủ dự án 19/11/2026). */
  origin: string
  khu: string | null
  khach: string | null
  image_url: string | null
}

const FRAME: Record<string, [string, string]> = {
  AL: ['Nhôm', 'Aluminium'],
  IR: ['Sắt', 'Steel'],
  IN: ['Inox', 'Stainless steel'],
  WD: ['Gỗ', 'Wood'],
  RA: ['Mây nhựa đan', 'Synthetic rattan'],
  GL: ['Kính', 'Glass'],
  MX: ['Hỗn hợp', 'Mixed'],
}

/** Khoá trong `tech_spec` (thông số in LSX) → nhãn hai thứ tiếng, đúng thứ tự in. */
const SPEC: [key: string, vi: string, en: string][] = [
  ['wood', 'Gỗ', 'Wood'],
  ['paint', 'Sơn', 'Finish'],
  ['fabric', 'Vải', 'Fabric'],
  ['cushion', 'Nệm', 'Cushion'],
  ['glass', 'Kính', 'Glass'],
]

/** Giá trị coi như CHƯA có: "xác nhận sau", "chưa rõ", "-", "?", "0". */
const CHUA_CO = /xác nhận sau|^chưa (rõ|có|xác định)|^[-–?.\s0]*$/i

/**
 * THẺ IN TIẾNG ANH (chủ dự án 19/11/2026: "thông tin đều là tiếng Anh", tên SP tạm
 * giữ tiếng Việt). Thông số in LSX đang gõ tiếng Việt → bảng dịch các giá trị
 * ĐANG CÓ trong DB (đo 19/11: 58 giá trị), khớp không phân biệt hoa thường /
 * khoảng trắng; giá trị mới chưa có trong bảng thì dịch theo từ (`TU`).
 */
const DICH: Record<string, string> = {
  'dán giấy': 'Wood-grain film',
  'dán giấy mã bha-78810': 'Wood-grain film BHA-78810',
  'đen cát': 'Sand black',
  'graphit - khung tay - giấy dán giả gỗ': 'Graphite; armrests: wood-grain film',
  'ht 7238 sơn nâu': 'Brown powder coat HT 7238',
  'màu bạc': 'Silver',
  'màu đen như mẫu ở nhà máy': 'Black (as factory sample)',
  'màu đỏ pt-3373': 'Red PT-3373',
  'màu graphit h-sm-9608': 'Graphite H-SM-9608',
  'sơn đen': 'Black powder coat',
  'sơn graphit': 'Graphite powder coat',
  'sơn nâu': 'Brown powder coat',
  'sơn xám cát pt-7476': 'Sand grey PT-7476',
  'acacia fsc 100% màu 142': 'Acacia FSC 100%, colour 142',
  'acacia fsc 100% màu 39': 'Acacia FSC 100%, colour 39',
  'acacia fsc 100% màu óc chó': 'Acacia FSC 100%, walnut colour',
  'bạch đàn fsc': 'Eucalyptus FSC',
  'gỗ keo - non fsc': 'Acacia (non-FSC)',
  'thanh chằng gỗ bạch đàn thay bằng sắt dán giấy':
    'Steel braces with wood-grain film (instead of eucalyptus)',
  'kính cường lực 8mm': 'Tempered glass 8 mm',
  'kính dán sơn màu sữa , kính dán': 'Milky painted laminated glass',
  'kính dán sơn xám dolphin': 'Dolphin grey painted laminated glass',
  'kính màu đen': 'Black glass',
  'kính màu sữa': 'Milky glass',
  'kính màu sữa, kính dán': 'Milky laminated glass',
  'kính mờ': 'Frosted glass',
  'kính nâu': 'Brown glass',
  'kính sơn xám dolphin , kính dán': 'Dolphin grey painted laminated glass',
  'kính sơn xám dolphin, kính dán': 'Dolphin grey painted laminated glass',
  'màu đen': 'Black',
  'màu hồng': 'Pink',
  'màu kem': 'Cream',
  'màu kem 230gr olefin': 'Cream, olefin 230 g/m²',
  'màu xanh': 'Blue',
  'nệm dày 5cm · vải: coastal drift (br34)': '5 cm cushion, fabric Coastal Drift (BR34)',
  'nệm dày 5cm · vải: stormstone (12934-a)': '5 cm cushion, fabric Stormstone (12934-A)',
  'poly 230gr ukfr': 'Polyester 230 g/m², UKFR',
  'poly 250gr - uv80h kem vàng m1393-pm75':
    'Polyester 250 g/m², UV 80 h, cream yellow M1393-PM75',
  'relax xám': 'Relax grey',
  'vải đen': 'Black fabric',
}

/** Dịch theo từ cho giá trị chưa có trong bảng — thứ tự: cụm dài trước. */
const TU: [RegExp, string][] = [
  [/màu óc chó/gi, 'walnut colour'],
  [/xám cát/gi, 'sand grey'],
  [/đen cát/gi, 'sand black'],
  [/(màu |sơn )?đen/gi, 'black'],
  [/(màu |sơn )?trắng/gi, 'white'],
  [/(màu |sơn )?xám/gi, 'grey'],
  [/(màu |sơn )?nâu/gi, 'brown'],
  [/(màu |sơn )?bạc/gi, 'silver'],
  [/(màu )?kem/gi, 'cream'],
  [/(màu )?sữa/gi, 'milky'],
  [/kính cường lực/gi, 'tempered glass'],
  [/kính dán/gi, 'laminated glass'],
  [/kính/gi, 'glass'],
  [/gỗ keo/gi, 'acacia'],
  [/bạch đàn/gi, 'eucalyptus'],
  [/dán giấy|giấy dán giả gỗ/gi, 'wood-grain film'],
  [/sơn tĩnh điện|sơn/gi, 'powder coat'],
  [/vải/gi, 'fabric'],
  [/nệm/gi, 'cushion'],
  [/dày/gi, 'thick'],
  [/màu/gi, 'colour'],
]

const VIET = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i

/** Giá trị thông số → tiếng Anh. Chỉ mã / đã là tiếng Anh thì giữ nguyên. */
export function dichGiaTri(v: string): string {
  const s = gon(v)
  const hit = DICH[s.toLowerCase()]
  if (hit) return hit
  if (!VIET.test(s)) return s
  let out = s
  for (const [re, en] of TU) out = out.replace(re, en)
  out = out.replace(/\s+/g, ' ').trim()
  return out.charAt(0).toUpperCase() + out.slice(1)
}

const so = (v: unknown): number | null => {
  const n = Number(v)
  return v == null || v === '' || !Number.isFinite(n) || n <= 0 ? null : n
}
/** Số in lên thẻ: bỏ số 0 thừa, dấu chấm thập phân (khách nước ngoài đọc). */
const fmt = (n: number, d = 2) => String(Math.round(n * 10 ** d) / 10 ** d)

/** Đóng gói + trọng lượng từ ô tóm tắt `packing` (+ KL tịnh của hồ sơ). */
function dongGoi(p: TheNguon): TheDong[] {
  const pk = p.packing ?? {}
  const out: TheDong[] = []
  const l = so(pk.carton_l_cm)
  const w = so(pk.carton_w_cm)
  const h = so(pk.carton_h_cm)
  const q = so(pk.qty_per_carton)
  if (l && w && h)
    out.push({
      vi: 'Thùng',
      en: 'Carton',
      value: `${fmt(l, 1)} × ${fmt(w, 1)} × ${fmt(h, 1)} cm${q ? ` · ${fmt(q, 0)} pc/ctn` : ''}`,
    })
  const cbm = so(pk.cbm)
  const hc = so(pk.loading_40hc)
  if (cbm || hc)
    out.push({
      vi: 'Khối · 40HC',
      en: 'CBM · 40HC',
      value: [cbm && `${fmt(cbm, 3)} m³`, hc && `${fmt(hc, 0)} pcs/40HC`]
        .filter(Boolean)
        .join(' · '),
    })
  const nw = so(pk.nw_kg) ?? so(p.net_weight_kg)
  const gw = so(pk.gw_kg)
  if (nw || gw)
    out.push({
      vi: 'Trọng lượng',
      en: 'N.W. / G.W.',
      value: `${nw ? fmt(nw, 1) : '—'} / ${gw ? fmt(gw, 1) : '—'} kg`,
    })
  return out
}

const gon = (v: unknown): string =>
  String(v ?? '')
    .replace(/\s+/g, ' ')
    .trim()

/** Khung: ưu tiên cột `frame_material`, thiếu thì đọc đuôi mã (…HG-AL). XX = không in. */
export function frameOf(
  frame_material: string | null,
  code: string,
): [vi: string, en: string] | null {
  const m = (frame_material ?? /HG-([A-Z]{2})$/.exec(code)?.[1] ?? '').toUpperCase()
  return FRAME[m] ?? null
}

/** Dòng chân thẻ: ai sản xuất. */
export const NHA_SAN_XUAT = 'Manufactured by Hoang Gia Co., Ltd.'

const duong = (n: number | null): n is number => n != null && Number(n) > 0

/** Thẻ sẽ thiếu gì — cùng một hàm cho cột cảnh báo, ô lọc và số đếm. */
export function theThieu(
  p: Pick<TheNguon, 'length_mm' | 'width_mm' | 'height_mm' | 'image_url'>,
): {
  kt: boolean
  anh: boolean
} {
  return {
    kt: !(duong(p.length_mm) && duong(p.width_mm) && duong(p.height_mm)),
    anh: !p.image_url,
  }
}

export function buildThe(p: TheNguon, opt: { khach: boolean }): TheTreo {
  const rows: TheDong[] = []
  const fr = frameOf(p.frame_material, p.code)
  if (fr) rows.push({ vi: 'Khung', en: 'Frame', value: fr[1] })
  const ts = p.tech_spec ?? {}
  for (const [key, vi, en] of SPEC) {
    const v = gon(ts[key])
    if (v && !CHUA_CO.test(v)) rows.push({ vi, en, value: dichGiaTri(v) })
  }
  const kt = theThieu(p).kt
  const inch = (mm: unknown) => fmt(Number(mm) / 25.4, 1)
  const en = gon(p.description_en)
  const khach = opt.khach
    ? [gon(p.customer_name), gon(p.customer_item_code)].filter(Boolean).join(' · ') ||
      null
    : null
  return {
    id: p.id,
    code: p.code,
    name: gon(p.name),
    en: en || null,
    dims: kt
      ? null
      : {
          l: Math.round(Number(p.length_mm)),
          w: Math.round(Number(p.width_mm)),
          h: Math.round(Number(p.height_mm)),
        },
    inch: kt
      ? null
      : `${inch(p.length_mm)} × ${inch(p.width_mm)} × ${inch(p.height_mm)} in`,
    rows,
    pack: dongGoi(p),
    origin: NHA_SAN_XUAT,
    khu: p.showroom_zone || null,
    khach,
    image_url: p.image_url,
  }
}

/** Thứ tự in: theo khu (A1 → K2, chưa có khu cuối) rồi theo mã — xấp thẻ ra đúng từng khu để đi treo. */
export function sapTheoKhu<T extends Pick<TheNguon, 'code' | 'showroom_zone'>>(
  rows: T[],
): T[] {
  const rank = (z: string | null) => {
    const i = SHOWROOM_ZONES.indexOf((z ?? '') as ShowroomZone)
    return i < 0 ? SHOWROOM_ZONES.length : i
  }
  return [...rows].sort(
    (a, b) =>
      rank(a.showroom_zone) - rank(b.showroom_zone) || a.code.localeCompare(b.code),
  )
}

/** Ngày treo thẻ `dd/mm/yyyy` theo giờ VN (UTC+7) — tất định, server và client ra cùng chữ. */
export function ngayVn(ts: string | null): string {
  if (!ts) return ''
  const d = new Date(new Date(ts).getTime() + 7 * 3_600_000).toISOString()
  return `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`
}

/** Chia thẻ thành từng tờ A4. */
export function chiaTo<T>(items: T[], moiTo: TheMoiTo): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += moiTo) out.push(items.slice(i, i + moiTo))
  return out
}

/** Số tờ A4 cần cho n thẻ. */
export const soTo = (n: number, moiTo: TheMoiTo) => Math.ceil(n / moiTo)

/**
 * QR thành MỘT đường SVG (mỗi ô đen một ô vuông, gộp các ô liền nhau theo
 * hàng) — vẽ ngay khi render, không cần chờ bất đồng bộ, in ra nét.
 */
export function qrPath(text: string): { size: number; d: string } {
  const m = QRCode.create(text, { errorCorrectionLevel: 'M' }).modules
  const n = m.size
  let d = ''
  for (let y = 0; y < n; y++) {
    let x = 0
    while (x < n) {
      if (!m.get(y, x)) {
        x++
        continue
      }
      const start = x
      while (x < n && m.get(y, x)) x++
      d += `M${start} ${y}h${x - start}v1h${start - x}z`
    }
  }
  return { size: n, d }
}
