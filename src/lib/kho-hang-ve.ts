/**
 * HÀNG VỀ — logic thuần cho màn `/warehouse/nhap` (Bước 1 Kho).
 *
 * Trả lời đúng một câu: "xe nào đang tới, cái nào trễ?". Tách khỏi màn để
 * chip đếm, làn hiện và số ở đầu trang dùng CÙNG MỘT hàm — số trên chip là
 * lời hứa: bấm vào phải ra đúng chừng ấy dòng.
 *
 * MỘT DÒNG = MỘT LẦN XE TỚI. Đơn có đợt giao thì mỗi đợt một dòng (một đơn
 * ba đợt là ba lần đi nhận). Đơn đã gửi NCC mà CHƯA khai đợt vẫn là một dòng,
 * vì NCC Việt Nam giao "khi có xe" là chuyện thường và thủ kho vẫn phải ngóng
 * — giấu tập đó đi là bắt họ nhớ bằng đầu.
 *
 * NGÀY ĐỂ XẾP LÀN: ngày hẹn của ĐỢT nếu có đợt; không có đợt thì lấy hẹn giao
 * của ĐƠN (cùng nguồn với màn Nhận hàng của Mua hàng). Không có cả hai →
 * làn "Chưa hẹn ngày".
 */

export type HangVeLane = 'late' | 'today' | 'soon' | 'no_eta'

export const HANG_VE_LANES: readonly HangVeLane[] = ['late', 'today', 'soon', 'no_eta']

export const HANG_VE_LANE: Record<
  HangVeLane,
  { label: string; tone: 'stop' | 'warn' | 'primary' | 'muted'; why: string }
> = {
  late: { label: 'Quá hẹn', tone: 'stop', why: 'Qua ngày hẹn mà chưa nhận.' },
  today: { label: 'Hôm nay', tone: 'warn', why: 'Hẹn giao đúng hôm nay.' },
  soon: { label: 'Sắp tới', tone: 'primary', why: 'Đã hẹn ngày, chưa tới.' },
  no_eta: {
    label: 'Chưa hẹn ngày',
    tone: 'muted',
    why: 'Đã gửi NCC nhưng chưa chốt ngày giao — NCC giao khi có xe.',
  },
}

/** Một dòng hàng về — dữ liệu đã nạp sẵn, không chạm DB. */
export type HangVeRow = {
  /** id đợt giao, hoặc id đơn khi chưa có đợt. */
  key: string
  po_id: string
  po_code: string
  supplier_name: string
  lsx_code: string | null
  shipment_id: string | null
  seq: number | null
  /** NCC đã báo xe tới (đợt `arrived`). */
  arrived: boolean
  /** yyyy-mm-dd — ngày hẹn của đợt, hoặc của đơn; null = chưa hẹn. */
  date: string | null
  /** Số dòng · tổng SL của ĐỢT (null khi chưa có đợt — cả đơn còn mở). */
  line_count: number | null
  total_qty: number | null
  /** Tiến độ về kho của cả ĐƠN theo dòng (0126). */
  lines_done: number
  lines_total: number
}

/** Số ngày từ hôm nay tới ngày hẹn — âm = đã qua. Cả hai là yyyy-mm-dd. */
export function soNgayToi(date: string, today: string): number {
  const a = Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10))
  const b = Date.UTC(+today.slice(0, 4), +today.slice(5, 7) - 1, +today.slice(8, 10))
  return Math.round((a - b) / 86_400_000)
}

export function laneOf(date: string | null, today: string): HangVeLane {
  if (!date) return 'no_eta'
  if (date < today) return 'late'
  if (date === today) return 'today'
  return 'soon'
}

/**
 * Dòng phụ "vì sao đáng chú ý" — nói điều dòng ấy CẦN người nhận biết, không
 * lặp lại trạng thái. Trễ thì nói trễ mấy ngày; xe tới thì nói xe tới.
 */
export function whyOf(
  row: Pick<HangVeRow, 'date' | 'arrived' | 'seq'>,
  today: string,
): {
  text: string
  tone: 'stop' | 'warn' | 'muted'
} {
  const parts: string[] = []
  let tone: 'stop' | 'warn' | 'muted' = 'muted'
  if (row.arrived) {
    parts.push('NCC báo xe đã tới')
    tone = 'warn'
  }
  if (row.date) {
    const d = soNgayToi(row.date, today)
    if (d < 0) {
      parts.unshift(`trễ ${-d} ngày`)
      tone = 'stop'
    } else if (d > 0) parts.push(`còn ${d} ngày`)
  } else {
    parts.push('chưa chốt ngày giao')
  }
  if (row.seq != null) parts.push(`đợt ${row.seq}`)
  return { text: parts.join(' · '), tone }
}

/** Đếm theo làn trên TOÀN TẬP — chip đếm bằng hàm này, làn hiện bằng hàm này. */
export function demTheoLan(
  rows: HangVeRow[],
  today: string,
): Record<HangVeLane | 'all', number> {
  const c: Record<HangVeLane | 'all', number> = {
    late: 0,
    today: 0,
    soon: 0,
    no_eta: 0,
    all: rows.length,
  }
  for (const r of rows) c[laneOf(r.date, today)]++
  return c
}

/** Xếp trong làn: ngày sớm trước; cùng ngày thì xe đã tới trước; rồi theo mã đơn. */
export function xepTrongLan(a: HangVeRow, b: HangVeRow): number {
  const da = a.date ?? '9999-99-99'
  const db = b.date ?? '9999-99-99'
  if (da !== db) return da < db ? -1 : 1
  if (a.arrived !== b.arrived) return a.arrived ? -1 : 1
  return a.po_code < b.po_code ? -1 : a.po_code > b.po_code ? 1 : 0
}

export function khopTimKiem(row: HangVeRow, needle: string): boolean {
  const n = needle.trim().toLowerCase()
  if (!n) return true
  return [row.po_code, row.supplier_name, row.lsx_code]
    .filter(Boolean)
    .some((v) => String(v).toLowerCase().includes(n))
}
