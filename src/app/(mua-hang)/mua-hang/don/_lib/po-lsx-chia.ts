import {
  boLenhKhoiChia,
  chiaNhieuDong,
  chiaTheoNhuCau,
  lenhNgan,
  rescaleSplit,
  splitProblem,
  type LsxNeedShare,
  type LsxSplit,
} from '@/lib/po-lsx-split'
import type { Line, Num } from './po-line'

/**
 * CHIA SL ĐẶT CHO TỪNG LỆNH TRÊN MÀN SOẠN ĐƠN GỘP (10/10/2026).
 *
 * "Gộp lệnh khi mua thì làm sao biết lệnh nào bao nhiêu" — đo: 11 đơn gộp, 113
 * dòng, 0 dòng chia. Ô chia nằm khuất trong khay chi tiết dòng. Nay máy chia sẵn
 * theo nhu cầu từng lệnh khi gõ SL đặt, chia lại khi SL đổi hoặc gỡ lệnh, và lưới
 * bày cột "Chia lệnh". Toán ở `@/lib/po-lsx-split` (có test); đây chỉ là lớp nối
 * với `Line` của màn.
 */

type ByLsx = { production_order_id: string; need: number; needed: number }[]

/** Nhu cầu dùng để chia: còn phải đặt của từng lệnh; mọi lệnh đều 0 thì theo "cần". */
export function needShares(byLsx: ByLsx | undefined): LsxNeedShare[] {
  if (!byLsx?.length) return []
  const conThieu = byLsx.some((b) => b.need > 0)
  return byLsx.map((b) => ({
    production_order_id: b.production_order_id,
    need: conThieu ? b.need : b.needed,
  }))
}

export function splitOf(l: Pick<Line, 'lsx_split'>): LsxSplit[] {
  return Object.entries(l.lsx_split ?? {})
    .map(([id, v]) => ({ production_order_id: id, qty: v === '' ? 0 : Number(v) }))
    .filter((x) => x.qty > 0)
}

const rec = (a: LsxSplit[]): Record<string, Num> =>
  Object.fromEntries(a.map((x) => [x.production_order_id, x.qty]))

/**
 * Phần chia mới của dòng `i` sau khi SL đặt đổi:
 *  · dòng đã có chia → giữ tỉ lệ (người mua chỉnh tay thì tôn trọng);
 *  · chưa chia → chia theo nhu cầu, TRỪ phần các dòng cùng mã đã chia (một mã
 *    nằm nhiều dòng không được ăn trọn nhu cầu hai lần);
 *  · KHÔNG có số nhu cầu nào (dòng thêm tay, lệnh chưa có định mức) → để TRỐNG:
 *    máy không biết thì đừng ghi như đã biết — ô vẫn báo "chưa chia" để người
 *    mua chia tay. (Nhu cầu có mà các lệnh đã đủ → phần đặt thêm về lệnh chính.)
 */
export function tuChiaDong(
  lines: Line[],
  i: number,
  needs: LsxNeedShare[],
  mainLsxId: string | null,
): Record<string, Num> {
  const l = lines[i]
  const qty = Number(l.qty) || 0
  if (qty <= 0) return {}
  const cu = splitOf(l)
  if (cu.length > 0) return rec(rescaleSplit(cu, qty))
  const daChia = new Map<string, number>()
  lines.forEach((o, k) => {
    if (k === i || !l.material_id || o.material_id !== l.material_id) return
    for (const s of splitOf(o)) daChia.set(s.production_order_id, (daChia.get(s.production_order_id) ?? 0) + s.qty) // prettier-ignore
  })
  const con = needs.map((n) => ({ production_order_id: n.production_order_id, need: Math.max(n.need - (daChia.get(n.production_order_id) ?? 0), 0) })) // prettier-ignore
  if (!needs.some((n) => n.need > 0)) return {}
  const out = chiaTheoNhuCau(qty, con, mainLsxId)
  if (out.length > 0) return rec(out)
  // Có nhu cầu nhưng các dòng cùng mã đã chia hết → phần đặt thêm là dư, về lệnh chính.
  return mainLsxId ? { [mainLsxId]: qty } : {}
}

/**
 * NÚT "CHIA THEO NHU CẦU": chia lại cả đơn — mỗi mã gom mọi dòng của nó rồi chia
 * trên tổng (`chiaNhieuDong`). `chiDongChuaChia` = chỉ điền dòng còn trống, giữ
 * phần người mua đã gõ tay. Mã KHÔNG có số nhu cầu → để nguyên (chia tay).
 */
export function chiaCaDon(
  lines: Line[],
  needsOf: (materialId: string) => LsxNeedShare[],
  mainLsxId: string | null,
  chiDongChuaChia: boolean,
): Line[] {
  const key = (k: number) => String(k)
  const nhom = new Map<string, number[]>()
  lines.forEach((l, k) => {
    if (!(Number(l.qty) > 0)) return
    if (chiDongChuaChia && splitOf(l).length > 0) return
    const g = l.material_id || `tu-do-${k}`
    nhom.set(g, [...(nhom.get(g) ?? []), k])
  })
  const moi = new Map<number, Record<string, Num>>()
  for (const [mat, idx] of nhom) {
    if (!needsOf(mat).some((n) => n.need > 0)) continue
    // Phần các dòng CÙNG MÃ đang giữ nguyên chia (chế độ chỉ điền dòng trống).
    const giu = new Map<string, number>()
    if (chiDongChuaChia)
      lines.forEach((o, k) => {
        if (idx.includes(k) || o.material_id !== mat) return
        for (const s of splitOf(o)) giu.set(s.production_order_id, (giu.get(s.production_order_id) ?? 0) + s.qty) // prettier-ignore
      })
    const needs = needsOf(mat).map((n) => ({ production_order_id: n.production_order_id, need: Math.max(n.need - (giu.get(n.production_order_id) ?? 0), 0) })) // prettier-ignore
    const chia = chiaNhieuDong(idx.map((k) => ({ key: key(k), qty: Number(lines[k].qty) || 0 })), needs, mainLsxId) // prettier-ignore
    for (const k of idx) {
      const s = chia.get(key(k)) ?? []
      const tong = s.reduce((a, x) => a + x.qty, 0)
      const q = Number(lines[k].qty) || 0
      // Phần không ai cần (đặt dư hết nhu cầu) đã nằm ở lệnh chính trong
      // chiaNhieuDong; mã không có nhu cầu nào thì trọn lệnh chính.
      moi.set(k, s.length && Math.abs(tong - q) < 1e-6 ? rec(s) : mainLsxId ? { [mainLsxId]: q } : {}) // prettier-ignore
    }
  }
  return lines.map((l, k) => (moi.has(k) ? { ...l, lsx_split: moi.get(k)! } : l))
}

/** Gỡ lệnh khỏi đơn / đơn còn một lệnh: dọn phần chia của mọi dòng cho khớp. */
export function donChiaTheoLenh(lines: Line[], lsxIds: string[]): Line[] {
  let doi = false
  const out = lines.map((l) => {
    const cu = splitOf(l)
    if (cu.length === 0) return l
    if (lsxIds.length < 2) {
      doi = true
      return { ...l, lsx_split: {} }
    }
    const moi = boLenhKhoiChia(cu, lsxIds, Number(l.qty) || 0)
    if (moi === cu) return l
    doi = true
    return { ...l, lsx_split: rec(moi) }
  })
  return doi ? out : lines
}

/** Lỗi chia của dòng (tổng ≠ SL đặt) — null khi ổn hoặc chưa chia. */
export function loiChia(l: Pick<Line, 'lsx_split' | 'qty'>): string | null {
  const s = splitOf(l)
  return s.length ? splitProblem(Number(l.qty) || 0, s) : null
}

/** Nhãn ngắn của lệnh — một nguồn với phiếu in, xem `@/lib/po-lsx-split`. */
export { lenhNgan }

/** Chữ của ô "Chia lệnh": `01 LAURA 800 · 02 LAURA 550`. */
export function chiaText(
  l: Pick<Line, 'lsx_split'>,
  lsxs: { id: string; code: string }[],
): string {
  return splitOf(l)
    .map(
      (s) =>
        `${lenhNgan(lsxs.find((x) => x.id === s.production_order_id)?.code ?? '?')} ${s.qty.toLocaleString('vi-VN')}`,
    ) // prettier-ignore
    .join(' · ')
}

/**
 * Nhãn SIÊU NGẮN của lệnh cho cột "Lệnh" trên lưới (bản vẽ Chia lệnh A): chỉ số
 * lệnh "08", "09" — tên khách đã ở tiêu đề mục Chia lệnh và khung LSX. Hai lệnh
 * cùng số khác khách (01 LAURA + 01 GIGA) thì ghi đủ "01 LAURA".
 */
export function nhanLenh(lsxs: { id: string; code: string }[]): Map<string, string> {
  const so = (code: string) => /^(\d+)\//.exec(code.trim())?.[1] ?? null
  const dem = new Map<string, number>()
  for (const x of lsxs) {
    const s = so(x.code)
    if (s) dem.set(s, (dem.get(s) ?? 0) + 1)
  }
  return new Map(
    lsxs.map((x) => {
      const s = so(x.code)
      return [x.id, s && dem.get(s) === 1 ? s : lenhNgan(x.code)]
    }),
  )
}
