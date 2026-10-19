/**
 * BÁO KHO HÀNG SẮP VỀ (Kho B8b, bản vẽ BLV-2 duyệt 19/10/2026 Q4/Q5:
 * https://claude.ai/artifact/PvUSfGoMDrT7nMjGz4yezC). Thuần, có test.
 *
 * Đo 19/10: 52 đơn NCC xác nhận / 30 ngày (~2/ngày). Báo hết thì Kho tắt chuông.
 * Nên chỉ báo khi CÓ VIỆC CHO KHO: lô hẹn trong `NGAY_BAO` ngày tới (kể cả đã
 * quá hẹn), và mọi lần dời hẹn một lô đang chờ.
 */

export const NGAY_BAO = 3

const congNgay = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
const dm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`

/** NCC xác nhận: báo khi hẹn giao ≤ hôm nay + 3 ngày. Chưa có ngày → không báo. */
export function baoKhiXacNhan(expected: string | null, today: string): boolean {
  return expected != null && expected <= congNgay(today, NGAY_BAO)
}

/** Dời hẹn: báo khi ngày thật sự đổi. */
export function baoKhiDoiHen(from: string | null, to: string): boolean {
  return from !== to
}

export function tieuDeXacNhan(
  code: string,
  ncc: string,
  expected: string,
  today: string,
): string {
  const khi = expected < today ? `đã quá hẹn ${dm(expected)}` : expected === today ? 'hẹn giao hôm nay' : `hẹn giao ${dm(expected)}` // prettier-ignore
  return `${code} · ${ncc} ${khi}`
}

export function tieuDeDoiHen(
  code: string,
  ncc: string,
  from: string | null,
  to: string,
  dot: string | null,
  reason: string | null,
): string {
  const phan = dot ? ` (${dot})` : ''
  const doi = from ? `${dm(from)} → ${dm(to)}` : `sang ${dm(to)}`
  return `${code}${phan} · ${ncc} dời hẹn ${doi}${reason ? ` — ${reason}` : ''}`
}

/** Người nhận: mọi người có vai Kho, trừ chính người bấm (Q5). */
export function nguoiNhan(kho: readonly { id: string }[], actorId: string): string[] {
  return [...new Set(kho.map((u) => u.id))].filter((id) => id !== actorId)
}
