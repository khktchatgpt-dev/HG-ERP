/**
 * ĐỢT GIAO nhìn từ phía Kho — logic thuần (Bước 1 Kho, việc 6).
 *
 * Một đơn nhiều mã có thể về nhiều đợt, mỗi đợt một ngày, mỗi đợt chỉ chở
 * một phần mã. Dữ liệu đã có từ 0152/0153 (`supply_po_shipments` +
 * `supply_po_shipment_lines`), nhưng form nhận hàng trước việc 6 chỉ điền
 * sẵn số mà không nói dòng nào thuộc đợt nào. Ở đây trả lời hai câu:
 *   · dòng này thuộc đợt nào (đang nhận / đợt sau / đã nhận rồi / chưa xếp)?
 *   · cả đơn có lịch giao ra sao?
 */

export type DotGiao = {
  id: string
  seq: number
  /** yyyy-mm-dd */
  expected_date: string
  status: 'planned' | 'arrived' | 'received' | 'cancelled'
  lines: { po_line_id: string; qty: number }[]
}

export type NhanDot =
  | { kind: 'this'; seq: number; qty: number }
  | { kind: 'other'; seq: number; date: string; qty: number; arrived: boolean }
  | { kind: 'done'; seq: number; date: string }
  | { kind: 'none' }

/**
 * Nhãn đợt cho từng dòng đơn. Thứ tự ưu tiên: thuộc đợt ĐANG NHẬN → thuộc một
 * đợt CHƯA nhận (sớm nhất) → chỉ nằm trong đợt ĐÃ nhận → chưa xếp đợt.
 */
export function nhanDot(
  poLineIds: string[],
  dots: DotGiao[],
  currentId: string | null,
): Map<string, NhanDot> {
  const out = new Map<string, NhanDot>()
  const song = dots.filter((d) => d.status === 'planned' || d.status === 'arrived')
  const xong = dots.filter((d) => d.status === 'received')
  const cur = currentId ? dots.find((d) => d.id === currentId) : undefined
  for (const id of poLineIds) {
    const trongCur = cur?.lines.find((l) => l.po_line_id === id)
    if (cur && trongCur) {
      out.set(id, { kind: 'this', seq: cur.seq, qty: trongCur.qty })
      continue
    }
    const khac = song
      .filter((d) => d.id !== currentId && d.lines.some((l) => l.po_line_id === id))
      .sort((a, b) => (a.expected_date < b.expected_date ? -1 : 1))[0]
    if (khac) {
      out.set(id, {
        kind: 'other',
        seq: khac.seq,
        date: khac.expected_date,
        qty: khac.lines.find((l) => l.po_line_id === id)!.qty,
        arrived: khac.status === 'arrived',
      })
      continue
    }
    const daNhan = xong
      .filter((d) => d.lines.some((l) => l.po_line_id === id))
      .sort((a, b) => b.seq - a.seq)[0]
    if (daNhan) {
      out.set(id, { kind: 'done', seq: daNhan.seq, date: daNhan.expected_date })
      continue
    }
    out.set(id, { kind: 'none' })
  }
  return out
}

export type LichDot = {
  id: string
  seq: number
  date: string
  status: DotGiao['status']
  /** Đợt đang mở trên form. */
  current: boolean
  /** Câu ngắn hiện trên dải lịch. */
  label: string
  tone: 'done' | 'stop' | 'warn' | 'primary' | 'muted'
}

/** Lịch giao cả đơn, xếp theo số đợt; đợt huỷ bỏ đi. */
export function lichDot(
  dots: DotGiao[],
  currentId: string | null,
  today: string,
): LichDot[] {
  return dots
    .filter((d) => d.status !== 'cancelled')
    .sort((a, b) => a.seq - b.seq)
    .map((d) => {
      const current = d.id === currentId
      let label: string
      let tone: LichDot['tone']
      if (d.status === 'received') {
        label = 'đã nhận'
        tone = 'done'
      } else if (current) {
        label = 'đang nhận'
        tone = 'primary'
      } else if (d.expected_date < today) {
        label = 'quá hẹn'
        tone = 'stop'
      } else if (d.expected_date === today) {
        label = d.status === 'arrived' ? 'xe đã tới' : 'hôm nay'
        tone = 'warn'
      } else {
        label = d.status === 'arrived' ? 'xe đã tới' : 'sắp tới'
        tone = 'muted'
      }
      return {
        id: d.id,
        seq: d.seq,
        date: d.expected_date,
        status: d.status,
        current,
        label,
        tone,
      }
    })
}

/** Mã vật tư của một đợt cho hàng đợi: 2 mã đầu + "+n". */
export function tomTatMa(codes: string[], max = 2): string {
  if (codes.length === 0) return ''
  const dau = codes.slice(0, max).join(', ')
  return codes.length > max ? `${dau} +${codes.length - max}` : dau
}
