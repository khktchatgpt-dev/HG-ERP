import { chuanTen } from './bom-chua-ma'
import { convertPartNeed, type PartQuantities } from './bom-unit'
import { namesAlike, nod, softKey } from './material-key'
import { xuatTruoc, type NplLenh, type NplRow } from './npl-theo-lenh'

/**
 * CÒN PHẢI ĐẶT — tab đầu màn NPL theo lệnh (bản vẽ 3, duyệt 21/11/2026:
 * https://claude.ai/artifact/7pdeBVx9PykFpfZAK8x33K). Logic thuần: số cần từ
 * định mức, trừ số đã lên đơn của CHÍNH lệnh.
 *
 * CHỈ NGŨ KIM + BAO BÌ (chủ dự án chốt 21/11): khung (nhôm, sắt) và gỗ không đặt
 * theo định mức — gỗ giao NCC làm theo mẫu, chi tiết khung là để định hình SP.
 *
 *  · Q3 định mức CHƯA xác nhận vẫn dùng (0/122 SP đã xác nhận lúc chốt) — thanh
 *    trạng thái nói rõ.
 *  · Q5 mã định mức chưa lên đơn mà đơn của lệnh có MÃ KHÁC tên gần giống (hai mã
 *    một món, NK-0221 / DCC0028): KHÔNG tự trừ, ghi "Có thể là …".
 *  · Q6 "đã lên đơn" = mọi đơn chưa huỷ của lệnh (gồm nháp), theo đúng luật chia /
 *    gộp lệnh của các tab theo đơn (`NplRow` dựng từ `buildNpl`). Đặt dư không báo.
 */

/** Loại định mức (`group_code`) đặt mua theo định mức. */
export const KIND_THEO_DINH_MUC = ['NGU_KIM', 'PACKAGING'] as const
export type KindTheoDinhMuc = (typeof KIND_THEO_DINH_MUC)[number]
const LA_KIND = new Set<string>(KIND_THEO_DINH_MUC)

/** Dòng lệnh: SP nào, bao nhiêu cái (một SP có thể ở nhiều dòng → cộng). */
export type CanDongLenh = { lsx_id: string; product_id: string; qty: number }
export type CanSp = {
  id: string
  code: string
  /** Định mức đã xác nhận (`bom_checked_at` hoặc hồ sơ khoá) — như bảng kê. */
  xac_nhan?: boolean
}
export type CanPart = PartQuantities & {
  product_id: string
  material_code: string | null
  part_name: string | null
  group_code: string | null
}
export type CanMat = {
  id: string
  code: string
  name: string
  unit: string
  group_name: string | null
  default_bar_length_m: number | null
}

export type NplCanSp = {
  sp_id: string
  sp_code: string
  /** Định mức / 1 SP, đã quy về đơn vị mua (cộng mọi chi tiết dùng mã này). */
  per: number
  sl: number
  can: number
  /** Tên chi tiết — "vị trí lắp" (Tay vịn, LK hộp trượt…). */
  vi_tri: string[]
}

export type NplCan = {
  lsx_id: string
  material_id: string
  ma: string
  ten: string
  dvt: string
  nhom: string | null
  can: number
  sp: NplCanSp[]
}

export type TinhCanKq = {
  cans: NplCan[]
  /** Tên định mức chưa gắn mã kho (hoặc mã không có trong danh mục), đếm tên × lệnh. */
  chuaMa: Record<KindTheoDinhMuc, number>
  /** Dòng có mã nhưng không quy đổi được sang đơn vị mua. */
  chanQuyDoi: number
}

const r4 = (n: number) => Math.round(n * 10_000) / 10_000

/**
 * Số CẦN mỗi (lệnh, vật tư) = Σ định mức/SP (đã quy đổi đơn vị mua) × SL SP của
 * lệnh — cùng phép `convertPartNeed` với bảng kê. Chỉ ngũ kim + bao bì.
 */
export function tinhCan(input: {
  dongLenh: CanDongLenh[]
  sps: CanSp[]
  parts: CanPart[]
  mats: CanMat[]
}): TinhCanKq {
  const spCode = new Map(input.sps.map((s) => [s.id, s.code]))
  const matByCode = new Map(input.mats.map((m) => [m.code.trim().toUpperCase(), m]))
  const slTheoLenh = new Map<string, Map<string, number>>() // product → lệnh → SL
  for (const d of input.dongLenh) {
    const m = slTheoLenh.get(d.product_id) ?? new Map<string, number>()
    m.set(d.lsx_id, (m.get(d.lsx_id) ?? 0) + (Number(d.qty) || 0))
    slTheoLenh.set(d.product_id, m)
  }

  const acc = new Map<string, NplCan>()
  const chuaMa = new Set<string>()
  let chanQuyDoi = 0
  for (const p of input.parts) {
    if (!LA_KIND.has(p.group_code ?? '')) continue
    const lenhs = slTheoLenh.get(p.product_id)
    if (!lenhs) continue
    const mat = p.material_code
      ? matByCode.get(p.material_code.trim().toUpperCase())
      : null
    if (!mat) {
      const ten = chuanTen(p.part_name ?? '')
      if (ten) for (const lsx of lenhs.keys()) chuaMa.add(`${lsx}|${p.group_code}|${ten}`)
      continue
    }
    const conv = convertPartNeed(p, {
      unit: mat.unit,
      default_bar_length_m: mat.default_bar_length_m,
    })
    if (!conv.ok) {
      chanQuyDoi += 1
      continue
    }
    if (conv.qty_per_unit <= 0) continue
    for (const [lsx, sl] of lenhs) {
      const key = `${lsx}|${mat.id}`
      const c =
        acc.get(key) ??
        acc
          .set(key, {
            lsx_id: lsx,
            material_id: mat.id,
            ma: mat.code,
            ten: mat.name,
            dvt: mat.unit,
            nhom: mat.group_name,
            can: 0,
            sp: [],
          })
          .get(key)!
      let s = c.sp.find((x) => x.sp_id === p.product_id)
      if (!s) {
        s = {
          sp_id: p.product_id,
          sp_code: spCode.get(p.product_id) ?? '',
          per: 0,
          sl,
          can: 0,
          vi_tri: [],
        }
        c.sp.push(s)
      }
      s.per = r4(s.per + conv.qty_per_unit)
      s.can = r4(s.per * sl)
      if (p.part_name && !s.vi_tri.includes(p.part_name)) s.vi_tri.push(p.part_name)
    }
  }
  const cans = [...acc.values()]
  for (const c of cans) c.can = r4(c.sp.reduce((t, s) => t + s.can, 0))

  const dem: Record<KindTheoDinhMuc, number> = { NGU_KIM: 0, PACKAGING: 0 }
  for (const k of chuaMa) dem[k.split('|')[1] as KindTheoDinhMuc] += 1
  return { cans, chuaMa: dem, chanQuyDoi }
}

export type NplConTT = 'chua_co_don' | 'dat_thieu' | 'gan_ten' | 'du'

export type NplConDon = {
  po_id: string
  po_code: string
  status: string
  supplier: string
  assignee: string | null
  dat: number
  ve: number
}

export type NplCon = NplCan & {
  key: string
  lsx_code: string
  dat: number
  /** Còn phải đặt = cần − đã lên đơn (≥ 0). */
  con: number
  tt: NplConTT
  don: NplConDon[]
  /** Dòng đơn của lệnh có tên gần giống — chỉ khi mã định mức chưa lên đơn nào. */
  gan: { material_id: string | null; ma: string; ten: string; dat: number; po_id: string; po_code: string }[] // prettier-ignore
}

/** Khoá lỏng: bỏ lớp xi/sơn/màu, bulong = bulon, "tám rút" = "tán rút". */
function khoaLong(s: string): string | null {
  return softKey(
    nod(s)
      .replace(/\b(xi|son|mau)\b/g, ' ')
      .replace(/\bbulong\b|\bbl\b/g, 'bulon')
      .replace(/\btam rut\b/g, 'tan rut'),
  )
}

/**
 * Ghép số cần với dòng đơn (`NplRow` — đã chia / gộp lệnh) theo (lệnh, vật tư).
 * Dòng đơn gần tên chỉ xét những mã mà định mức của lệnh KHÔNG cần (mã đó đã là
 * nhu cầu riêng thì không phải "mã khác của cùng một món").
 */
export function buildConPhaiDat(
  cans: NplCan[],
  rows: NplRow[],
  lenhById: Map<string, NplLenh>,
): NplCon[] {
  const rowsCuaLenh = new Map<string, NplRow[]>()
  for (const r of rows) {
    const l = rowsCuaLenh.get(r.lsx_id) ?? []
    l.push(r)
    rowsCuaLenh.set(r.lsx_id, l)
  }
  const canCuaLenh = new Map<string, Set<string>>()
  for (const c of cans) {
    const s = canCuaLenh.get(c.lsx_id) ?? new Set<string>()
    s.add(c.material_id)
    canCuaLenh.set(c.lsx_id, s)
  }
  return cans.map((c) => {
    const cua = rowsCuaLenh.get(c.lsx_id) ?? []
    const mine = cua.filter((r) => r.material_id === c.material_id)
    const dat = r4(mine.reduce((t, r) => t + r.dat, 0))
    const can = canCuaLenh.get(c.lsx_id)!
    const k = khoaLong(c.ten)
    const gan = mine.length
      ? []
      : cua.filter(
          (r) =>
            !(r.material_id && can.has(r.material_id)) &&
            (namesAlike(r.ten, c.ten) || (!!k && khoaLong(r.ten) === k)),
        )
    const tt: NplConTT = !mine.length
      ? gan.length
        ? 'gan_ten'
        : 'chua_co_don'
      : dat + 1e-6 < c.can
        ? 'dat_thieu'
        : 'du'
    return {
      ...c,
      key: `${c.lsx_id}|${c.material_id}`,
      lsx_code: lenhById.get(c.lsx_id)?.code ?? '',
      dat,
      con: r4(Math.max(c.can - dat, 0)),
      tt,
      don: mine.map((r) => ({
        po_id: r.po_id,
        po_code: r.po_code,
        status: r.status,
        supplier: r.supplier,
        assignee: r.assignee,
        dat: r.dat,
        ve: r.ve,
      })),
      gan: gan.map((r) => ({
        material_id: r.material_id,
        ma: r.ma,
        ten: r.ten,
        dat: r.dat,
        po_id: r.po_id,
        po_code: r.po_code,
      })),
    }
  })
}

/** Lệnh đang chạy mà tab không so được — dòng cuối tab (Q6), để rỗng không bị đọc là "đủ". */
export type NplKhongSo = { id: string; code: string; ly_do: string }

export function lenhKhongSo(
  lenh: NplLenh[],
  cans: NplCan[],
  spCuaLenh: Map<string, { sp: number; coDinhMuc: number }>,
): NplKhongSo[] {
  const co = new Set(cans.map((c) => c.lsx_id))
  return lenh
    .filter((l) => !co.has(l.id))
    .sort(xuatTruoc)
    .map((l) => {
      const s = spCuaLenh.get(l.id) ?? { sp: 0, coDinhMuc: 0 }
      const ly_do =
        s.sp === 0
          ? 'Lệnh chưa có sản phẩm'
          : s.coDinhMuc === 0
            ? `Chưa có định mức (0/${s.sp} SP)`
            : `Định mức chưa gắn mã ngũ kim, bao bì (${s.coDinhMuc}/${s.sp} SP có định mức)`
      return { id: l.id, code: l.code, ly_do }
    })
}

/** Dòng tab hiện: mọi tình trạng trừ "đủ"; đặt thiếu / gần tên lên trước, rồi còn nhiều trước. */
export function conPhaiDat(con: NplCon[]): NplCon[] {
  const hang = (t: NplConTT) => (t === 'dat_thieu' ? 0 : t === 'gan_ten' ? 1 : 2)
  return con
    .filter((c) => c.tt !== 'du')
    .sort((a, b) => hang(a.tt) - hang(b.tt) || b.con - a.con || a.ma.localeCompare(b.ma))
}
