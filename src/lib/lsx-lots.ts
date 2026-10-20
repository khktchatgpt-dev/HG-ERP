/**
 * LÔ XUẤT CỦA SALE (sales_ship_lots, 0222) LÀ NGUỒN CHUẨN cho "đợt xuất" của
 * lệnh — chốt D1 (07/10/2026). Trước đó ngày xuất nằm ở 5 nơi (đầu lệnh, nhóm,
 * dòng lệnh, lô, hạn đơn) và mỗi màn đọc một nơi. Nay:
 *   · lệnh CÓ lô  → đợt xuất của dòng = các lô chứa SP đó (nhãn tuần + ngày);
 *                   hạn xuất đầu lệnh = lô sớm nhất (tự tính khi lưu lô).
 *   · lệnh KHÔNG lô → giữ ngày của dòng/nhóm như cũ (dữ liệu cũ vẫn in được).
 * Nhóm lệnh chỉ còn là cấu trúc in (PO / bộ sưu tập), không còn là lịch xuất.
 * Logic thuần, dùng chung cho phiếu in, Excel, màn chi tiết, sổ lệnh.
 */
import { shipWeekLabel } from './ship-week'

export type LotLite = {
  seq: number
  po_no: string | null
  po_ref: string | null
  ship_date: string | null
  lines: { product_key: string; qty: number }[]
}

export const fmtDVn = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y.slice(2)}`
}

/** Khoá SP của dòng lệnh = mã SP gọn khoảng trắng (cùng khoá với `khoaSp` của kế hoạch xuất). */
export const lotKey = (productCode: string | null | undefined) =>
  (productCode ?? '').replace(/\s+/g, ' ').trim()

/** Hạn xuất đầu lệnh suy từ lô: ngày sớm nhất trong các lô có ngày; không lô có ngày → null. */
export function lsxShipDateFromLots(lots: readonly LotLite[]): string | null {
  const dates = lots.map((l) => l.ship_date).filter((d): d is string => !!d)
  if (!dates.length) return null
  return dates.sort()[0]
}

/**
 * Chữ "đợt xuất" của MỘT dòng theo lô: "w47.26 · 20/11/26 (PO 123) · w49.26 · 04/12/26".
 * Lô không ngày thì in "chưa chốt lịch". Dòng không nằm lô nào → ''.
 */
export function lotShipText(
  productCode: string | null | undefined,
  lots: readonly LotLite[],
): string {
  const k = lotKey(productCode)
  if (!k) return ''
  const mine = lots
    .filter((l) => l.lines.some((x) => lotKey(x.product_key) === k && x.qty > 0))
    .sort(
      (a, b) =>
        (a.ship_date ?? '9999').localeCompare(b.ship_date ?? '9999') || a.seq - b.seq,
    )
  return mine
    .map((l) => {
      const po = l.po_ref || l.po_no
      const when = l.ship_date
        ? `${shipWeekLabel(l.ship_date)} · ${fmtDVn(l.ship_date)}`
        : 'chưa chốt lịch'
      return po ? `${when} (${po})` : when
    })
    .join(' · ')
}

/**
 * Áp lô lên bộ nhóm/dòng của lệnh trước khi in/xuất Excel/bày màn: dòng có lô →
 * `ship_label` = chữ theo lô, `ship_date` = null (để `shipText` in label). Dòng
 * không có lô hoặc lệnh chưa chia lô → giữ nguyên. Không ghi DB.
 */
export function applyLotsToGroups<
  L extends {
    product_code: string | null
    ship_date: string | null
    ship_label: string | null
  },
  G extends { lines: L[] },
>(groups: readonly G[], lots: readonly LotLite[]): G[] {
  if (!lots.length) return [...groups]
  return groups.map((g) => ({
    ...g,
    lines: g.lines.map((l) => {
      const t = lotShipText(l.product_code, lots)
      return t ? { ...l, ship_label: t, ship_date: null } : l
    }),
  }))
}

/** Lô kế tiếp chưa qua: lô có ngày ≥ hôm nay sớm nhất; không có → lô muộn nhất đã qua. */
export function nextLot(lots: readonly LotLite[], today: string): LotLite | null {
  const dated = lots
    .filter((l) => l.ship_date)
    .sort((a, b) => a.ship_date!.localeCompare(b.ship_date!))
  if (!dated.length) return null
  return dated.find((l) => l.ship_date! >= today) ?? dated[dated.length - 1]
}
