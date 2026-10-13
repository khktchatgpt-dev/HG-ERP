/**
 * ĐỀ NGHỊ MUA VẬT TƯ — luật thuần dùng chung server + màn (0236, bản vẽ
 * https://claude.ai/artifact/6bFb19HuFtSzT8y2wqT17g, duyệt 13/10/2026).
 *
 * Một chỗ cho: nhãn trạng thái, AI ĐANG GIỮ phiếu (DN-0), điều kiện gửi duyệt
 * (nói vướng gì TẠI CHỖ, không cho bấm rồi mới báo lỗi), tổng tiền dự kiến.
 */

export type DeNghiStatus = 'draft' | 'pending' | 'approved' | 'ordering' | 'done' | 'cancelled' // prettier-ignore

export const DE_NGHI_NHAN: Record<DeNghiStatus, string> = {
  draft: 'Nháp',
  pending: 'Chờ duyệt',
  approved: 'Đã duyệt',
  ordering: 'Đang nhập',
  done: 'Xong',
  cancelled: 'Đã huỷ',
}

/** Tone của nhãn trạng thái (kit `Tag`): chỉ mã hoá vòng đời. */
export const DE_NGHI_TONE: Record<
  DeNghiStatus,
  'neutral' | 'warn' | 'run' | 'done' | 'stop'
> = {
  draft: 'neutral',
  pending: 'warn',
  approved: 'run',
  ordering: 'run',
  done: 'done',
  cancelled: 'neutral',
}

/** Ai đang giữ phiếu ở trạng thái này — câu "phiếu kẹt ở ai" của sổ DN-4. */
export function dangO(s: DeNghiStatus, biTuChoi = false): string {
  switch (s) {
    case 'draft':
      return biTuChoi ? 'Kho (sửa theo lý do từ chối)' : 'Kho (đang soạn)'
    case 'pending':
      return 'Lãnh đạo (chờ duyệt)'
    case 'approved':
      return 'Kho (đi mua theo số duyệt)'
    case 'ordering':
      return 'Kho (đã nhập một phần)'
    case 'done':
    case 'cancelled':
      return '—'
  }
}

export type DongDeNghi = {
  material_id: string | null
  name: string
  unit: string
  qty: number | null
  unit_price: number | null
}

/**
 * Vướng gì khi GỬI DUYỆT — rỗng = gửi được. Mỗi câu nói rõ dòng nào để màn
 * nhảy tới (`dong` = chỉ số 0-based, null = lỗi cả phiếu).
 */
export function vuongGuiDuyet(
  lines: readonly DongDonGui[],
): { dong: number | null; cau: string }[] {
  const out: { dong: number | null; cau: string }[] = []
  const coDong = lines.filter((l) => !dongTrong(l))
  if (coDong.length === 0) out.push({ dong: null, cau: 'Phiếu chưa có dòng vật tư nào' })
  lines.forEach((l, i) => {
    if (dongTrong(l)) return
    if (!l.name.trim()) out.push({ dong: i, cau: `Dòng ${i + 1} thiếu tên vật tư` })
    else if (!l.unit.trim())
      out.push({ dong: i, cau: `Dòng ${i + 1} (${l.name}) thiếu đơn vị tính` })
    else if (!(Number(l.qty) > 0))
      out.push({ dong: i, cau: `Dòng ${i + 1} (${l.name}) chưa có số lượng` })
  })
  return out
}
type DongDonGui = Pick<DongDeNghi, 'name' | 'unit' | 'qty' | 'material_id'>

/** Dòng bỏ trống hoàn toàn (chưa gõ gì) — bỏ qua khi lưu / gửi. */
export function dongTrong(l: Pick<DongDeNghi, 'name' | 'qty' | 'material_id'>): boolean {
  return !l.material_id && !l.name.trim() && !(Number(l.qty) > 0)
}

/**
 * Mức VAT chọn được trên dòng (Đ7 · 0239). 0 = KHÔNG VAT (tiệm không xuất hoá
 * đơn). Chủ dự án 14/10: một phiếu có cả dòng có VAT lẫn dòng không VAT → VAT
 * theo dòng, không theo phiếu.
 */
export const VAT_CHON = [0, 5, 8, 10] as const

export const vatNhan = (v: number | null | undefined) => (v ? `VAT ${v}%` : 'Không VAT')

type DongTien = Pick<DongDeNghi, 'qty' | 'unit_price'> & {
  vat_rate?: number | null
  approved_qty?: number | null
}

/**
 * TỔNG DỰ KIẾN của phiếu (VND): tiền hàng + VAT từng dòng + phí vận chuyển cả
 * phiếu (Đ7). `theoDuyet` = tính theo số lãnh đạo duyệt (null = số đề nghị).
 * Dòng chưa có giá không cộng — `thieuGia` đếm để chân bảng nói thật.
 */
export function tongDuKien(
  lines: readonly DongTien[],
  phiVanChuyen = 0,
  opt: { theoDuyet?: boolean } = {},
): { hang: number; vat: number; vc: number; tong: number; thieuGia: number } {
  let hang = 0
  let vat = 0
  let thieuGia = 0
  for (const l of lines) {
    const q = Number(opt.theoDuyet ? (l.approved_qty ?? l.qty) : l.qty) || 0
    if (q <= 0) continue
    if (l.unit_price == null) {
      thieuGia++
      continue
    }
    const t = q * l.unit_price
    hang += t
    vat += (t * (Number(l.vat_rate) || 0)) / 100
  }
  const vc = Math.max(0, Number(phiVanChuyen) || 0)
  hang = Math.round(hang)
  vat = Math.round(vat)
  return { hang, vat, vc, tong: hang + vat + vc, thieuGia }
}

/** "15:18 13/10" theo giờ VN — ghép tay: toLocaleString vi-VN ra "13-10" ở vài máy. */
export function gio(iso: string | null | undefined): string {
  if (!iso) return ''
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Ho_Chi_Minh',
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(new Date(iso))
      .map((x) => [x.type, x.value]),
  )
  return `${p.hour}:${p.minute} ${p.day}/${p.month}`
}
