/**
 * ĐÈN "KỊP SX?" — cột L của sổ "Tổng hợp ĐH": so ngày hàng VỀ của đơn đặt với
 * HẠN VẬT TƯ PHẢI VỀ của lệnh (production_orders.materials_due_at — 0126).
 *
 * Công thức sổ: (ngày về thực tế ?? ngày về dự kiến) > hạn → 🔴 Trễ SX;
 * ≥ hạn − 2 ngày → 🟡 Sát hạn; còn lại 🟢 Kịp. Đơn ĐÃ VỀ ĐỦ coi là xong —
 * trễ hay không đã xảy ra rồi, đèn cảnh báo là để hành động, không phải để trách.
 *
 * Logic thuần (todayIso truyền vào) — testable, dùng chung server/client.
 */

export type PoFit = 'late' | 'tight' | 'ok'

const TIGHT_DAYS = 2

export function assessPoFit(
  po: { status: string; expected_at: string | null },
  materialsDueAt: string | null | undefined,
): PoFit | null {
  if (!materialsDueAt) return null
  if (po.status === 'cancelled' || po.status === 'received') return null
  if (!po.expected_at) return null
  const expected = po.expected_at.slice(0, 10)
  if (expected > materialsDueAt) return 'late'
  if (expected >= addDays(materialsDueAt, -TIGHT_DAYS)) return 'tight'
  return 'ok'
}

/** Cộng/trừ ngày trên chuỗi yyyy-mm-dd (UTC — tránh lệch múi giờ). */
function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/**
 * Tiến độ VỀ KHO theo DÒNG của đơn — "về 3/5 dòng" thay vì cộng số lượng chéo
 * đơn vị (500 con + 3 kg là con số vô nghĩa). Dòng xong = còn thiếu ≤ 0, đúng
 * cách view supply_po_line_status định nghĩa.
 */
export function lineProgress(lines: { qty_missing: number }[]): {
  done: number
  total: number
} {
  return {
    done: lines.filter((l) => l.qty_missing <= 0).length,
    total: lines.length,
  }
}
