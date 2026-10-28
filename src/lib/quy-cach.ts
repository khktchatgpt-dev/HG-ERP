/**
 * ĐỌC QUY CÁCH TỪ TÊN VẬT TƯ — để so giá CÙNG một mặt hàng qua nhiều NCC
 * (28/10/2026, màn Tra giá vật tư).
 *
 * Vì sao không so theo MÃ: mỗi chiều dài cây, mỗi NCC lại đẻ một mã. Đo 28/10:
 * "Nhôm phi 25 dày 1.0" = 5 mã (NH-0003/0573/0574/0607/0608) của 3 NCC — mở hồ
 * sơ mã nào cũng chỉ thấy MỘT NCC. Theo mã chỉ 29/535 mã (5%) từng mua của ≥ 2
 * NCC, tức gần như không có gì để so.
 *
 * Ba loại khoá, KHÔNG gộp bừa:
 *   · KIM LOẠI (nhôm / thép / inox thanh, ống, tấm) — vật liệu + dạng + kích
 *     thước + độ dày + cờ (mềm, có gân, kẽm). BỎ chiều dài cây: cùng thanh 20×20
 *     dày 1.0 cắt 5,48 m hay 5,8 m vẫn là một mặt hàng, giá tính theo kg.
 *   · PROFILE RIÊNG của NCC (TD-B477, QM-…, TW-HG05) — không có quy cách chung,
 *     chỉ gom các chiều dài cây của CHÍNH profile đó.
 *   · CÒN LẠI — tên chuẩn hoá (`sureKey`) trong nhóm hàng, gạt lớp xi ("xi đen",
 *     "xi trắng") ra làm BIẾN THỂ: cùng con bulông 6×20×13, khác lớp mạ thì vẫn
 *     so chung, màn bày biến thể cạnh từng NCC để người mua tự cân.
 *
 * Bản đầu viết trong `scripts/tong-hop-gia-ncc-truyen-1021.ts` (21/10) cho đơn
 * của một người; dời vào đây khi thành tính năng cho cả phòng — thêm inox, nhôm
 * la, profile TW, và lớp "còn lại" (bản script coi mọi thứ không phải xốp/phụ
 * kiện là thép).
 */
import { expandAbbrevs, nod, sureKey } from './material-key'

export type VatLieu = 'Nhôm' | 'Thép' | 'Inox'
export type DangKim = 'tròn' | 'vuông' | 'hộp' | 'oval' | 'tấm' | 'la'

export type QuyCachKim = {
  vl: VatLieu
  dang: DangKim
  /** Cạnh / đường kính, mm. Tấm: rỗng (khổ tấm không phải quy cách giá). */
  dims: number[]
  /** Độ dày, mm. `null` = tên không ghi (người gõ thiếu — có thể khớp nhiều quy cách). */
  t: number | null
  /** Cờ làm đổi giá: 'mềm', 'có gân', 'kẽm'. */
  co: string[]
}

export type QuyCach = {
  loai: 'kim' | 'profile' | 'xop' | 'khac'
  /** Khoá gom: hai dòng cùng khoá là CÙNG một mặt hàng để so giá. */
  key: string
  /** Tên người đọc: "Nhôm ống phi 25 · dày 1.0". */
  label: string
  /** Đơn vị quy giá để so — kg / m³; `null` = so theo ĐVT của dòng. */
  dv: 'kg' | 'm³' | null
  kim?: QuyCachKim
  /** Biến thể đã gạt khỏi khoá ("xi đen") — chỉ để bày, không để gom. */
  bien?: string | null
}

export type DocQuyCachOpt = {
  /** Mẫu đơn của dòng (`po_template`): 'aluminium' / 'metal_kg' là kim loại, 'foam' là xốp. */
  template?: string | null
  /** Nhóm hàng của vật tư (`warehouse_materials.group_name`). */
  group?: string | null
  /** Bề mặt / lớp phủ ghi riêng trên dòng — "kẽm" ở đây cũng là cờ giá. */
  finish?: string | null
}

const KIM_TEMPLATES = new Set(['aluminium', 'metal_kg'])
const num = (s: string) => Number(s.replace(',', '.'))
const fmtT = (t: number) => (Number.isInteger(t) ? t.toFixed(1) : String(t))
const fmtD = (d: number) => String(d).replace('.', ',')

/** Bỏ chiều dài cây: "dài 5.48m", "(dài 5.8 mét)", "(5.5m)", "mềm 4.6m", "x6m", "dài 5.8". */
function boChieuDai(s: string): string {
  return s
    .replace(/\(?\s*dài\s*[\d.,]+\s*(m(ét)?)?\s*\)?/g, ' ')
    .replace(/\(\s*[\d.,]+\s*m\s*\)/g, ' ')
    .replace(/\s[\d.,]+\s*m\s*$/g, ' ')
    .replace(/x\s*[\d.,]+\s*m\b/g, ' ')
}

function laKim(s: string, opt: DocQuyCachOpt): boolean {
  const g = (opt.group ?? '').toLowerCase()
  if (opt.template && KIM_TEMPLATES.has(opt.template)) return true
  if (/^(nhôm|sắt|thép|inox)/.test(g)) return true
  // Không biết mẫu đơn (người gõ ở ô tra): nhận theo chữ trong tên.
  if (!opt.template && !opt.group) return /\b(nhôm|thép|sắt|inox)\b/.test(s)
  return false
}

function vatLieu(s: string, group: string | null | undefined): VatLieu {
  const g = (group ?? '').toLowerCase()
  if (/inox/.test(s) || g.startsWith('inox')) return 'Inox'
  if (/nhôm/.test(s) || g.startsWith('nhôm')) return 'Nhôm'
  return 'Thép'
}

/** Kim loại — null khi tên không đọc ra được kích thước nào (để rơi về lớp "còn lại"). */
function docKim(s0: string, opt: DocQuyCachOpt): QuyCach | null {
  const s = boChieuDai(s0)
    .replace(/\*/g, 'x')
    .replace(/(\d+)\s*dem\b/g, (_, d) => String(Number(d) / 10))
  const vl = vatLieu(s, opt.group)
  const co: string[] = []
  if (/mềm/.test(s)) co.push('mềm')
  if (/gân/.test(s)) co.push('có gân')
  if (/kẽm/.test(s) || /kẽm/i.test(opt.finish ?? '')) co.push('kẽm')
  const nums = (s.match(/\d+(?:[.,]\d+)?/g) ?? []).map(num)
  if (nums.length === 0) return null

  let dang: DangKim
  let dims: number[]
  let t: number | null
  if (/tấm/.test(s)) {
    dang = 'tấm'
    dims = []
    t = nums.find((n) => n <= 20) ?? null
  } else if (/\bla\b/.test(s)) {
    dang = 'la'
    const [a, b] = nums
    t = b == null ? null : Math.min(a, b)
    dims = [b == null ? a : Math.max(a, b)]
  } else if (/oval/.test(s)) {
    dang = 'oval'
    dims = nums.slice(0, 2)
    t = nums[2] ?? null
  } else if (/ống|phi|ø/.test(s)) {
    dang = 'tròn'
    dims = nums.slice(0, 1)
    t = nums[1] ?? null
  } else if (/vuông/.test(s) && nums.length <= 2) {
    // "Nhôm vuông 20 x1.0" — một cạnh là đủ.
    dang = 'vuông'
    dims = [nums[0], nums[0]]
    t = nums[1] ?? null
  } else {
    dims = nums.slice(0, 2)
    t = nums[2] ?? null
    // "Nhôm 25x25xT1.0": không ghi dạng — hai cạnh bằng nhau là vuông.
    // "Thép hộp vuông 20x40": hai cạnh khác nhau thì là hộp, dù tên có chữ vuông.
    dang = dims.length === 2 && dims[0] === dims[1] ? 'vuông' : 'hộp'
    if (dims.length < 2) return null
  }

  const kt =
    dang === 'tròn'
      ? `ống phi ${fmtD(dims[0])}`
      : dang === 'tấm'
        ? 'tấm'
        : dang === 'la'
          ? `la ${fmtD(dims[0])}`
          : `${dang} ${dims.map(fmtD).join('×')}`
  const label = [`${vl} ${kt}`, t != null ? `dày ${fmtT(t)}` : null, ...co]
    .filter(Boolean)
    .join(' · ')
  return {
    loai: 'kim',
    key: `kim|${vl}|${dang}|${dims.join('x')}|${t ?? '?'}|${co.join(',')}`,
    label,
    dv: 'kg',
    kim: { vl, dang, dims, t, co },
  }
}

/** Lớp xi / mạ ở cuối tên — biến thể, không phải mặt hàng khác. */
// Không dùng `\b` ở đuôi: với JS nó chỉ hiểu chữ ASCII, "xi đỏ" sẽ trượt.
const BIEN = /,?\s*\b(xi|xy|mạ)\s+(trắng|đen|vàng|bạc|đỏ|xanh|cầu vồng)(?=$|[\s,;.)])/

export function docQuyCach(name: string, opt: DocQuyCachOpt = {}): QuyCach {
  const s0 = name.toLowerCase().normalize('NFC').replace(/\s+/g, ' ').trim()

  if (opt.template === 'foam' || /^mút|xốp/.test((opt.group ?? '').toLowerCase())) {
    const k = sureKey(boChieuDai(s0))
    return { loai: 'xop', key: `xop|${k}`, label: name.trim(), dv: 'm³' }
  }

  if (laKim(s0, opt)) {
    // Profile riêng của NCC (TD-A648, QM-HGGL-…, DTBD05, TW-HG05) — không có quy cách chung.
    if (/\b(td|qm|dtbd|tw)[\s-]?[a-z]*\d/.test(s0)) {
      const goc = boChieuDai(s0).replace(/\s+/g, ' ').trim()
      return { loai: 'profile', key: `profile|${sureKey(goc)}`, label: `${name.trim().replace(/\s*\(?dài[^)]*\)?\s*$/i, '')} (profile riêng)`, dv: 'kg' } // prettier-ignore
    }
    const k = docKim(s0, opt)
    if (k) return k
  }

  const m = s0.match(BIEN)
  const bien = m ? `${m[1]} ${m[2]}` : null
  const goc = m ? s0.replace(BIEN, ' ') : s0
  const sach = name
    .replace(m ? new RegExp(BIEN.source, 'i') : /$^/, ' ')
    .replace(/\s+/g, ' ')
    .replace(/[\s,]+$/, '')
    .trim()
  return {
    loai: 'khac',
    key: `khac|${nod(opt.group) || '—'}|${sureKey(expandAbbrevs(goc))}`,
    label: sach,
    dv: null,
    bien,
  }
}

/**
 * Quy cách người GÕ có khớp quy cách của một DÒNG đơn không — kim loại thôi.
 *
 * Gõ thiếu độ dày ("thép hộp 20x40") thì khớp mọi độ dày → màn hỏi lại. Cờ
 * người gõ ghi ra (mềm, kẽm) thì dòng phải có; người gõ không ghi thì không
 * loại — để "nhôm hộp 25x50 1.2" vẫn tìm ra hàng "nhôm mềm" duy nhất đã mua.
 */
export function khopKim(go: QuyCachKim, dong: QuyCachKim): boolean {
  if (go.vl !== dong.vl || go.dang !== dong.dang) return false
  if (go.dims.length !== dong.dims.length || go.dims.some((d, i) => d !== dong.dims[i]))
    return false
  if (go.t != null && go.t !== dong.t) return false
  return go.co.every((c) => dong.co.includes(c))
}
