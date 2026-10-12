/**
 * HÀNG VỀ — logic thuần cho màn `/warehouse/nhap` (Kho đợt 2 · Bước 1, bản vẽ
 * https://claude.ai/artifact/AVjPo69BkZc9N9NNydvWER, chủ dự án duyệt 12/10/2026).
 *
 * MỘT DÒNG = MỘT ĐƠN, xếp mốc bằng `incomingBucket` — ĐÚNG hàm của Theo dõi đơn
 * hàng bên Cung ứng (Q1). Bản 16/09 đếm theo ĐỢT và gồm cả đơn `approved` (NCC
 * chưa xác nhận), nên hai phòng nhìn cùng một kho mà thấy hai con số: 29 đơn ở
 * Cung ứng, số khác ở Kho (đo 12/10/2026). Đợt không mất đi — nó thành cột "Đợt"
 * (`dotKeTiep`), nói đợt nào sắp tới và đợt nào đã nhập trước hạn.
 */
import type { IncomingBucket } from '@/lib/supply-watch'

/** Một đơn đang về — dữ liệu đã nạp sẵn, không chạm DB. */
export type HangVeRow = {
  po_id: string
  po_code: string
  supplier_name: string
  /** Lệnh chính của đơn; null = đơn ngoài lệnh. */
  lsx_code: string | null
  /** Lệnh phụ của đơn gộp lệnh (0125) — hiện "+n lệnh". */
  extra_lsx: string[]
  /** Mẫu đơn (`supply_purchase_orders.template`) — lọc Loại hàng. */
  template: string
  /** Mốc hẹn — tính ở server bằng `incomingBucket`, cùng hàm badge + Theo dõi. */
  bucket: IncomingBucket
  /** yyyy-mm-dd, hẹn giao của ĐƠN; null = chưa hẹn. */
  expected_at: string | null
  /** Dòng vật tư đã nhận đủ / tổng dòng vật tư (dòng tự do không tính). */
  lines_done: number
  lines_total: number
  /** Người mua phụ trách — thủ kho biết gọi ai khi hàng sai/thiếu (Q6). */
  owner_name: string | null
  dot: DotKeTiep | null
  /** Sự cố giao hàng còn mở của đơn (sổ 0213) — nhãn "N sự cố" (Bước 3). */
  su_co_mo: number
}

/** Một đợt giao còn mở (planned/arrived) cùng các dòng đơn nó chở. */
export type DotMo = {
  /** id đợt — nút Nhận hàng mở form `?dot=` đúng đợt kế tiếp. */
  id: string
  seq: number
  /** yyyy-mm-dd */
  date: string
  arrived: boolean
  line_ids: string[]
}

export type DotKeTiep = {
  /** Số đợt còn sống (trừ huỷ) của đơn — mẫu số của "Đợt 2/4". */
  so_dot: number
  /** Đợt sớm nhất còn hàng chưa về; null = mọi đợt mở đều đã nhập đủ. */
  ke_tiep: { id: string; seq: number; date: string; arrived: boolean } | null
  /** Đợt mở có hẹn TRƯỚC đợt kế tiếp mà hàng của nó đã nhập đủ (nhận sớm, phiếu chưa nối đợt). */
  da_nhap_truoc: number[]
}

/**
 * Đợt kế tiếp của một đơn. Đợt mở (planned/arrived) mà MỌI dòng nó chở đã hết
 * phần chờ (`qty_open` ≤ 0) là đợt đã nhập trước — chuyện có thật: PO-2026-0100
 * đợt 1 hẹn 12/10 mà 6 dòng đã vào PNK-2026-0099 ngày 06/10, đợt vẫn `planned`.
 * Bày nó thành "đợt sắp tới" là bắt thủ kho chờ một chuyến xe không tới.
 *
 * Dòng không có trong `lineOpen` coi như CÒN chờ — thiếu số thì nghiêng về
 * "còn hàng tới", không tự tuyên bố đợt đã xong.
 */
export function dotKeTiep(
  dots: DotMo[],
  soDot: number,
  lineOpen: ReadonlyMap<string, number>,
): DotKeTiep | null {
  // Có đợt mà không đợt nào còn mở: lịch đã hẹn hết, phần còn lại NCC chưa hẹn.
  if (dots.length === 0)
    return soDot > 0 ? { so_dot: soDot, ke_tiep: null, da_nhap_truoc: [] } : null
  const xep = [...dots].sort((a, b) =>
    a.date !== b.date ? (a.date < b.date ? -1 : 1) : a.seq - b.seq,
  )
  const xong = (d: DotMo) =>
    d.line_ids.length > 0 && d.line_ids.every((id) => (lineOpen.get(id) ?? 1) <= 0)
  const daNhapTruoc: number[] = []
  for (const d of xep) {
    if (!xong(d))
      return {
        so_dot: soDot,
        ke_tiep: { id: d.id, seq: d.seq, date: d.date, arrived: d.arrived },
        da_nhap_truoc: daNhapTruoc,
      }
    daNhapTruoc.push(d.seq)
  }
  return { so_dot: soDot, ke_tiep: null, da_nhap_truoc: daNhapTruoc }
}

/** Số ngày từ hôm nay tới ngày hẹn — âm = đã qua. Cả hai là yyyy-mm-dd. */
export function soNgayToi(date: string, today: string): number {
  const a = Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10))
  const b = Date.UTC(+today.slice(0, 4), +today.slice(5, 7) - 1, +today.slice(8, 10))
  return Math.round((a - b) / 86_400_000)
}

/**
 * Ngày hẹn cách hôm nay quá một năm — gần như chắc là gõ nhầm (PO-2026-0085 hẹn
 * 03/10/2610, đo 12/10/2026). Màn gắn nhãn thay vì tô quá hẹn / "còn 213.000
 * ngày"; mốc vẫn giữ theo `incomingBucket` để số khớp Cung ứng (Q5).
 */
export function ngayBatThuong(date: string | null, today: string): boolean {
  return date != null && Math.abs(soNgayToi(date, today)) > 365
}

/**
 * Đơn không có dòng vật tư nào (chỉ dòng tự do — gỗ theo mã SP): không vào tồn
 * kho, form nhận từ chối (`unknown_line`), Cung ứng nghiệm thu ngoài sổ. Màn
 * vẫn bày đơn (thủ kho cần biết có xe tới) nhưng khoá Nhận hàng kèm lý do.
 */
export function chiDongTuDo(row: Pick<HangVeRow, 'lines_total'>): boolean {
  return row.lines_total === 0
}

/** Xếp: hẹn sớm trước (chưa hẹn cuối), cùng ngày theo mã đơn. */
export function xepHangVe(a: HangVeRow, b: HangVeRow): number {
  const da = a.expected_at ?? '9999-99-99'
  const db = b.expected_at ?? '9999-99-99'
  if (da !== db) return da < db ? -1 : 1
  return a.po_code < b.po_code ? -1 : a.po_code > b.po_code ? 1 : 0
}

/**
 * dd/mm, thêm năm khi khác năm của `today`. Không đọc đồng hồ máy: server và
 * trình duyệt phải ra cùng chữ (lệch là lỗi hydrate quanh giao thừa).
 */
export function ngay(iso: string, today: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-')
  return y === today.slice(0, 4) ? `${d}/${m}` : `${d}/${m}/${y}`
}

/** Chữ đầu mô tả khi Kho KHÔNG nhận lô hàng (Q1 bản vẽ B3: lựa chọn, không phải loại mới). */
export const TU_CHOI_NHAN = '[Từ chối nhận]'

/**
 * Dựng thân POST `pos/[id]/issues` từ hộp Báo sự cố của Kho (Kho đợt 2 · Bước 3).
 * Trả `{ loi }` khi chưa gửi được — cùng luật `issueSchema` của route (mô tả ≥ 5
 * ký tự, SL không âm), nói TRƯỚC khi bấm thay vì để route trả 400.
 */
export function thanSuCo(f: {
  kind: string | null
  tuChoi: boolean
  poLineId: string | null
  qty: string
  moTa: string
}):
  | {
      body: {
        kind: string
        po_line_id: string | null
        qty: number | null
        description: string
      }
    }
  | { loi: string } {
  if (!f.kind) return { loi: 'Chọn loại sự cố' }
  const mo = f.moTa.trim()
  if (mo.length < 5) return { loi: 'Mô tả sự cố ít nhất 5 ký tự' }
  const q = f.qty.trim() ? Number(f.qty.replace(/\./g, '').replace(',', '.')) : null
  if (q != null && (!Number.isFinite(q) || q < 0))
    return { loi: 'Số lượng phải là số không âm' }
  return {
    body: {
      kind: f.kind,
      po_line_id: f.poLineId || null,
      qty: q,
      description: f.tuChoi ? `${TU_CHOI_NHAN} ${mo}` : mo,
    },
  }
}
