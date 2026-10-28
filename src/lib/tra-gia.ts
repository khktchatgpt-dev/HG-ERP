/**
 * TRA GIÁ VẬT TƯ (28/10/2026) — bộ máy THUẦN của màn `/mua-hang/tra-gia`.
 *
 * Người mua dán / gõ danh sách món sắp mua → mỗi món: quy cách khớp, các NCC
 * từng bán + giá gần nhất, ai rẻ nhất; món chưa mua bao giờ thì NCC từng bán
 * CÙNG LOẠI. Bản vẽ được duyệt 28/10: https://claude.ai/artifact/5hQcWMCXKLVf24LSGWqLTk
 *
 * NGUỒN DUY NHẤT LÀ DÒNG ĐƠN MUA — bảng giá khai tay mới 10 dòng (đo 28/10).
 * Gom theo QUY CÁCH (`lib/quy-cach`), không theo mã: một quy cách nhôm có tới 5
 * mã của 3 NCC.
 *
 * Server nạp dòng (`tra-gia.repo`) rồi gọi các hàm ở đây; để thuần cho test và
 * để client đọc được kiểu mà không import gì từ `@/modules`.
 */
import { expandAbbrevs, nod, sureKey } from './material-key'
import { poLineAmount, type PriceBasis } from './po-line'
import { docQuyCach, khopKim, type QuyCach, type QuyCachKim } from './quy-cach'
import { searchTokens } from './search-text'

/** Đơn từ Đã duyệt trở đi — giá đã chốt (câu Q2 của bản vẽ). Nháp / chờ duyệt bày mờ, không xếp hạng. */
export const GIA_CHOT: ReadonlySet<string> = new Set([
  'approved',
  'ordered',
  'confirmed',
  'in_transit',
  'partial',
  'received',
])

/** Một dòng đơn mua đã nạp — `tra-gia.repo` dựng, đơn huỷ đã bỏ. */
export type TgDong = {
  line_id: string
  po_id: string
  po_code: string
  status: string
  /** Ngày đặt (ordered_at), chưa gửi thì ngày lập — yyyy-mm-dd. */
  at: string
  supplier_id: string
  supplier_name: string
  material_id: string
  code: string
  name: string
  unit: string
  group_name: string | null
  sub_group: string | null
  /** Mẫu đơn (`po_template`) — quyết định đọc quy cách kim loại hay không. */
  template: string | null
  finish: string | null
  qty: number
  qty2: number | null
  unit2: string | null
  unit_price: number | null
  price_basis: string | null
  currency: string
}

export type TgGia = {
  gia: number
  /** Đơn vị của giá: 'kg', 'm³' khi quy được, còn lại ĐVT của dòng. */
  dv: string
  /** Giá quy từ giá theo cây / tấm — bày phép tính nguyên văn cho người xem kiểm. */
  quy: { gia_goc: number; dv_goc: string; moi: number; dv_moi: string } | null
}

/**
 * Giá để SO của một dòng. Kim loại / xốp quy về đ/kg, đ/m³ bằng THÀNH TIỀN ÷
 * khối lượng của chính dòng — dòng tính theo cây cũng so được với dòng theo kg.
 * Không quy được thì giữ giá theo ĐVT (và không xếp hạng chung với đ/kg).
 */
export function giaSo(d: TgDong, qc: QuyCach): TgGia | null {
  if (d.unit_price == null || !(d.unit_price > 0)) return null
  const theoDv2 = d.price_basis === 'unit2'
  if (qc.dv && d.unit2 === qc.dv && d.qty2 != null && d.qty2 > 0 && d.qty > 0) {
    const tien = poLineAmount({
      qty_ordered: d.qty,
      unit_price: d.unit_price,
      price_basis: d.price_basis as PriceBasis | null,
      qty2: d.qty2,
    })
    return {
      gia: tien / d.qty2,
      dv: qc.dv,
      quy: theoDv2 ? null : { gia_goc: d.unit_price, dv_goc: d.unit, moi: d.qty2 / d.qty, dv_moi: qc.dv }, // prettier-ignore
    }
  }
  return { gia: d.unit_price, dv: theoDv2 && d.unit2 ? d.unit2 : d.unit, quy: null }
}

type DongX = TgDong & { qc: QuyCach; gia: TgGia | null; hay: string }

export type TgChiMuc = { dong: DongX[]; theoKey: Map<string, DongX[]> }

/** Đọc quy cách + giá một lần cho cả tập dòng, rồi tra bao nhiêu món cũng được. */
export function lapChiMuc(rows: readonly TgDong[]): TgChiMuc {
  const dong = rows.map((d) => {
    const qc = docQuyCach(d.name, { template: d.template, group: d.group_name, finish: d.finish }) // prettier-ignore
    return { ...d, qc, gia: giaSo(d, qc), hay: expandAbbrevs(nod(`${d.name} ${d.code}`)) }
  })
  const theoKey = new Map<string, DongX[]>()
  for (const d of dong) theoKey.set(d.qc.key, [...(theoKey.get(d.qc.key) ?? []), d])
  return { dong, theoKey }
}

/** Một NCC từng bán quy cách này. */
export type TgNcc = {
  supplier_id: string
  supplier_name: string
  gia: number
  dv: string
  currency: string
  quy: TgGia['quy']
  at: string
  po_id: string
  po_code: string
  status: string
  /** false = đơn nháp / chờ duyệt: giá chưa chốt, không xếp hạng, không chọn được. */
  chot: boolean
  /** Có cùng đơn vị + tiền tệ với nhóm đem so (xếp hạng được). */
  so_duoc: boolean
  /** Mã vật tư NCC này đã dùng cho quy cách (mọi lần trong kỳ). */
  ma: string[]
  /** Tên trên dòng gần nhất — để soát quy cách gom có đúng không. */
  ten: string
  bien: string | null
  so_dong: number
}

/** NCC từng bán CÙNG LOẠI, cho món chưa mua bao giờ. */
export type TgGoiY = {
  supplier_id: string
  supplier_name: string
  /** Chỉ có khi giá theo kg / m³ (dùng làm giá tham khảo được); món theo cái thì null. */
  gia: number | null
  dv: string | null
  at: string
  so_dong: number
  /** Vài quy cách / tên đã bán — để người mua biết NCC này bán cỡ nào. */
  mau: string[]
}

export type TgUngVien = { key: string; label: string; so_ncc: number; so_dong: number }

/**
 * ok    — ≥ 2 NCC có giá chốt, so được
 * one   — 1 NCC có giá chốt
 * mo_ho — khớp nhiều quy cách, người mua phải chọn (`ung_vien`)
 * moi   — chưa mua quy cách này (trong kỳ), có NCC cùng loại để gợi ý
 * trong — không khớp gì, không có gợi ý
 */
export type TgTrangThai = 'ok' | 'one' | 'mo_ho' | 'moi' | 'trong'

export type TgKetQua = {
  text: string
  trang_thai: TgTrangThai
  quy_cach: {
    key: string
    label: string
    loai: QuyCach['loai']
    dv: string | null
  } | null
  /** Số mã vật tư khác nhau đang trỏ vào quy cách này. */
  so_ma: number
  nhom: string | null
  /** Giá chốt so được (rẻ → đắt), rồi giá chốt khác đơn vị, rồi đơn nháp. */
  ncc: TgNcc[]
  re_nhat: number | null
  /** Đơn vị của nhóm đem so — 'kg', 'cái'… */
  dv_so: string | null
  ung_vien: TgUngVien[]
  so_ung_vien: number
  goi_y: TgGoiY[]
  /** Gợi ý theo loại nào: "Nhôm ống tròn", hoặc tên nhóm con. */
  goi_y_theo: string | null
}

const moiTruoc = (
  a: { at: string; po_code: string },
  b: { at: string; po_code: string },
) => (a.at === b.at ? (a.po_code < b.po_code ? 1 : -1) : a.at < b.at ? 1 : -1)

function nccCuaKey(lines: readonly DongX[]): {
  ncc: TgNcc[]
  re: number | null
  dv: string | null
} {
  const by = new Map<string, DongX[]>()
  for (const d of lines)
    if (d.gia) by.set(d.supplier_id, [...(by.get(d.supplier_id) ?? []), d])
  const ncc: TgNcc[] = []
  for (const ls of by.values()) {
    const sorted = [...ls].sort(moiTruoc)
    const chot = sorted.filter((d) => GIA_CHOT.has(d.status))
    // Giá chốt gần nhất; NCC chỉ có đơn nháp thì bày đơn nháp (mờ) để người mua biết đang có giá chào.
    const d = chot[0] ?? sorted[0]
    ncc.push({
      supplier_id: d.supplier_id,
      supplier_name: d.supplier_name,
      gia: d.gia!.gia,
      dv: d.gia!.dv,
      currency: d.currency,
      quy: d.gia!.quy,
      at: d.at,
      po_id: d.po_id,
      po_code: d.po_code,
      status: d.status,
      chot: chot.length > 0,
      so_duoc: false,
      ma: [...new Set(ls.map((x) => x.code))].sort(),
      ten: d.name,
      bien: d.qc.bien ?? null,
      so_dong: chot.length || sorted.length,
    })
  }
  // Nhóm đem so = cặp (đơn vị, tiền tệ) có nhiều NCC chốt nhất — so táo với táo.
  const dem = new Map<string, number>()
  for (const n of ncc) if (n.chot) dem.set(`${n.dv}|${n.currency}`, (dem.get(`${n.dv}|${n.currency}`) ?? 0) + 1) // prettier-ignore
  const chinh = [...dem.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
  for (const n of ncc) n.so_duoc = n.chot && `${n.dv}|${n.currency}` === chinh
  const hang = (n: TgNcc) => (n.so_duoc ? 0 : n.chot ? 1 : 2)
  ncc.sort((a, b) => hang(a) - hang(b) || (hang(a) === 1 ? moiTruoc(a, b) : a.gia - b.gia || moiTruoc(a, b))) // prettier-ignore
  const so = ncc.filter((n) => n.so_duoc)
  return { ncc, re: so[0]?.gia ?? null, dv: chinh ? chinh.split('|')[0] : null }
}

const HO_KIM: Record<QuyCachKim['dang'], string> = {
  tròn: 'ống tròn',
  vuông: 'hộp',
  hộp: 'hộp',
  oval: 'oval',
  tấm: 'tấm',
  la: 'la',
}

/** Mỗi NCC một dòng gợi ý: giá chốt gần nhất trong tập `ds`, bỏ NCC đã có trong `bo`. */
function gomGoiY(
  ds: readonly DongX[],
  coGia: (d: DongX) => boolean,
  mau: (d: DongX) => string,
  bo: ReadonlySet<string>,
): TgGoiY[] {
  const by = new Map<string, DongX[]>()
  for (const d of ds)
    if (!bo.has(d.supplier_id) && GIA_CHOT.has(d.status) && d.gia)
      by.set(d.supplier_id, [...(by.get(d.supplier_id) ?? []), d])
  return [...by.values()]
    .map((ls) => {
      const sorted = [...ls].sort(moiTruoc)
      const d = sorted[0]
      return {
        supplier_id: d.supplier_id,
        supplier_name: d.supplier_name,
        gia: coGia(d) ? d.gia!.gia : null,
        dv: coGia(d) ? d.gia!.dv : null,
        at: d.at,
        so_dong: ls.length,
        mau: [...new Set(sorted.map(mau))].slice(0, 4),
      }
    })
    .sort((a, b) => (a.gia ?? Infinity) - (b.gia ?? Infinity) || b.so_dong - a.so_dong)
}

/** Dòng đơn khớp chữ người gõ: mã → quy cách kim loại → từng từ trong tên. */
function khopDong(text: string, q: QuyCach, cm: TgChiMuc): DongX[] {
  const t = text.trim()
  if (/^[a-z]{1,5}-?\d{2,6}$/i.test(t)) {
    const theoMa = cm.dong.filter((d) => d.code.toLowerCase() === t.toLowerCase())
    if (theoMa.length) return theoMa
  }
  if (q.loai === 'kim' && q.kim) {
    const go = q.kim
    return cm.dong.filter((d) => d.qc.kim && khopKim(go, d.qc.kim))
  }
  const toks = searchTokens(expandAbbrevs(nod(t)), 8)
  if (toks.length === 0) return []
  return cm.dong.filter((d) => toks.every((k) => d.hay.includes(k)))
}

const UNG_VIEN_TOI_DA = 8

/**
 * TRA MỘT MÓN.
 *
 * `key` — người mua đã chọn một quy cách cụ thể (sau khi màn hỏi lại vì mơ hồ).
 * `nhomCon` — nhóm / nhóm con của mã danh mục khớp chữ gõ (service tìm giúp) —
 * nguồn gợi ý NCC cho món không phải kim loại mà chưa mua lần nào.
 */
export function traMon(
  text: string,
  cm: TgChiMuc,
  opt: { key?: string | null; nhomCon?: { group: string; sub: string } | null } = {},
): TgKetQua {
  const q = docQuyCach(text)
  const rong: TgKetQua = {
    text,
    trang_thai: 'trong',
    quy_cach: null,
    so_ma: 0,
    nhom: null,
    ncc: [],
    re_nhat: null,
    dv_so: null,
    ung_vien: [],
    so_ung_vien: 0,
    goi_y: [],
    goi_y_theo: null,
  }

  const khop = opt.key ? (cm.theoKey.get(opt.key) ?? []) : khopDong(text, q, cm)
  const keys = [...new Set(khop.map((d) => d.qc.key))]

  // Gõ đủ đúng tên một quy cách thì nhận luôn, không bắt chọn.
  const dungTen = keys.filter(
    (k) => sureKey(cm.theoKey.get(k)![0].qc.label) === sureKey(text),
  )
  const key = keys.length === 1 ? keys[0] : dungTen.length === 1 ? dungTen[0] : null

  if (keys.length > 1 && !key) {
    const ung_vien = keys
      .map((k) => {
        const ls = cm.theoKey.get(k)!
        return { key: k, label: ls[0].qc.label, so_ncc: new Set(ls.map((d) => d.supplier_id)).size, so_dong: ls.length } // prettier-ignore
      })
      .sort((a, b) => b.so_ncc - a.so_ncc || b.so_dong - a.so_dong)
    return { ...rong, trang_thai: 'mo_ho', ung_vien: ung_vien.slice(0, UNG_VIEN_TOI_DA), so_ung_vien: keys.length } // prettier-ignore
  }

  let kq: TgKetQua = rong
  if (key) {
    const ls = cm.theoKey.get(key)!
    const { ncc, re, dv } = nccCuaKey(ls)
    const soChot = ncc.filter((n) => n.chot).length
    const qc = ls[0].qc
    kq = {
      ...rong,
      trang_thai: soChot >= 2 ? 'ok' : soChot === 1 ? 'one' : 'trong',
      quy_cach: { key, label: qc.label, loai: qc.loai, dv: qc.dv },
      so_ma: new Set(ls.map((d) => d.code)).size,
      nhom: ls[0].group_name,
      ncc,
      re_nhat: re,
      dv_so: dv,
    }
    if (soChot > 0) return kq
  }

  // Chưa có giá chốt cho quy cách này → NCC từng bán CÙNG LOẠI.
  const bo = new Set(kq.ncc.filter((n) => n.chot).map((n) => n.supplier_id))
  const kimGo = (key ? cm.theoKey.get(key)![0].qc.kim : null) ?? q.kim
  let goi_y: TgGoiY[] = []
  let goi_y_theo: string | null = null
  if (kimGo) {
    // Kim loại tính theo kg nên giá đ/kg của NCC trên cỡ khác dùng làm giá tham khảo được.
    const ho = HO_KIM[kimGo.dang]
    const cung = cm.dong.filter((d) => d.qc.kim?.vl === kimGo.vl && HO_KIM[d.qc.kim.dang] === ho && d.gia?.dv === 'kg') // prettier-ignore
    goi_y = gomGoiY(
      cung,
      () => true,
      (d) => d.qc.label.replace(`${kimGo.vl} `, ''),
      bo,
    )
    goi_y_theo = `${kimGo.vl} ${ho}`
  } else {
    // Nhóm con của chính quy cách (chỉ có đơn nháp) đáng tin hơn mã danh mục đoán theo chữ.
    const d0 = key ? cm.theoKey.get(key)![0] : null
    const g = d0?.sub_group ? { group: d0.group_name ?? '', sub: d0.sub_group } : (opt.nhomCon ?? null) // prettier-ignore
    if (g) {
      const cung = cm.dong.filter(
        (d) => d.group_name === g.group && d.sub_group === g.sub,
      )
      // Món tính theo cái / bộ: giá cỡ khác không nói gì về món này → chỉ bày tên NCC (Q3).
      // Giá theo kg / m³ (xốp) thì dùng làm giá tham khảo được.
      goi_y = gomGoiY(cung, (d) => d.gia?.dv === 'kg' || d.gia?.dv === 'm³', (d) => d.qc.label, bo) // prettier-ignore
      goi_y_theo = g.sub
    }
  }
  return {
    ...kq,
    trang_thai: goi_y.length ? 'moi' : 'trong',
    nhom: kq.nhom ?? opt.nhomCon?.group ?? null,
    goi_y,
    goi_y_theo,
  }
}
