/**
 * ĐÃ VỀ — đọc KẾT QUẢ một lần nhận hàng (phiếu nhập theo đơn mua) thành việc
 * phải làm. Logic thuần cho màn Theo dõi đơn hàng › Đã về (01/10/2026, bản vẽ
 * G3 canvas "Cung ứng · Hàng về", chủ dự án duyệt).
 *
 * Một phiếu có thể mang NHIỀU kết quả cùng lúc (vừa thiếu kg vừa sai quy cách).
 * Thứ tự trả về = thứ tự người mua nên gỡ: cái chặn Kế toán chốt tiền trước.
 *
 * "Còn thiếu" chỉ gắn vào phiếu MỚI NHẤT của đơn: đơn nhận ba lần mà còn thiếu
 * thì việc "giao bù / chốt thiếu" là một, không phải ba.
 */
import { kgDuKien, lechKg } from './can-kg'

/**
 * Dấu trong LÝ DO của phiếu đảo khi đảo để SỬA (hộp "Sửa phiếu nhập", 02/10/2026):
 * phân biệt với đảo hẳn (hàng trả về, ghi nhầm đơn) — chỉ đảo-để-sửa mới chờ lập lại.
 */
export const DAU_SUA_PHIEU = 'Sửa phiếu nhập'

/** Phiếu nhập LẬP LẠI để sửa phiếu nào — đọc từ ghi chú "Sửa lại PNK-… (đã đảo bởi …)". */
export function suaLaiTu(note: string | null | undefined): string | null {
  return note?.match(/Sửa lại (PNK-[0-9-]+)/)?.[1] ?? null
}

/** Ngưỡng lệch kg đáng nói (%) — dưới mức này là sai số cân, không phải chuyện. */
export const NGUONG_LECH_KG = 3

export type DongNhanVe = {
  movement_id: string
  material_code: string
  unit: string
  qty: number
  /** 'blocked' = sai quy cách, vào kệ khoá. */
  stock_status: string
  /** Kg cân thực đã ghi; null = chưa cân. */
  qty2_actual: number | null
  /** Dòng phải ghi kg cân (nhôm / thép trả tiền theo kg — `lib/can-kg`). */
  can_kg: boolean
  /** SL đặt + tổng kg của dòng đơn — để suy kg dự kiến của lần này. */
  qty_ordered: number
  kg_don: number | null
}

export type PhieuNhanVe = {
  doc_id: string
  /** Phiếu đã bị đảo — còn trong sổ nhưng hết hiệu lực. */
  reversed: boolean
  /** Đảo để SỬA mà chưa có phiếu lập lại — việc phải làm. */
  cho_lap_lai?: boolean
  lines: DongNhanVe[]
  /** Trạng thái đơn HIỆN TẠI ('partial' | 'received' | …). */
  po_status: string
  /** Phiếu mới nhất (còn hiệu lực) của đơn này trong tập đang xem. */
  latest_for_po: boolean
  /** Số dòng đơn còn chờ (qty_open > 0, chưa chốt thiếu) — của CẢ ĐƠN. */
  po_open_lines: number
  /** Số dòng của phiếu mà dòng đơn tương ứng đang nhận VƯỢT số đặt. */
  over_lines: number
}

export type KetQuaKind =
  'da_dao' | 'thieu_kg' | 'thieu' | 'sai_quy_cach' | 'vuot' | 'chenh_kg' | 'du'

export type KetQua = {
  kind: KetQuaKind
  /** Nhãn ngắn bày trên dòng. */
  text: string
  /** Việc người mua phải làm — câu trả lời "giờ làm gì". */
  viec: string
  /** true = vào làn "Cần xử lý". */
  can_xu_ly: boolean
  tone: 'stop' | 'warn' | 'done' | 'neutral'
}

/** Kg dự kiến của MỘT dòng nhận — suy theo tỉ lệ số lượng trên dòng đơn. */
export function kgDuKienDong(l: DongNhanVe): number | null {
  return kgDuKien(l.qty, { qty_ordered: l.qty_ordered, qty2: l.kg_don })
}

/** Dòng phải cân mà chưa có kg cân. */
export function dongThieuKg(p: Pick<PhieuNhanVe, 'lines'>): DongNhanVe[] {
  return p.lines.filter((l) => l.can_kg && !(Number(l.qty2_actual) > 0))
}

export function ketQuaPhieu(p: PhieuNhanVe): KetQua[] {
  if (p.reversed && p.cho_lap_lai)
    return [
      {
        kind: 'da_dao',
        text: 'Đã đảo để sửa — chưa lập lại',
        viec: 'Lập lại phiếu nhập đúng số (số cũ đã điền sẵn)',
        can_xu_ly: true,
        tone: 'warn',
      },
    ]
  if (p.reversed)
    return [
      {
        kind: 'da_dao',
        text: 'Đã đảo phiếu',
        viec: 'Phiếu hết hiệu lực — không còn trong tồn',
        can_xu_ly: false,
        tone: 'neutral',
      },
    ]
  const out: KetQua[] = []
  // Thiếu kg cân KHÔNG còn là việc phải làm (02/10/2026 — lib/can-kg).
  if (p.latest_for_po && p.po_status === 'partial' && p.po_open_lines > 0)
    out.push({
      kind: 'thieu',
      text: `Còn thiếu ${p.po_open_lines} dòng`,
      viec: 'NCC giao bù (hẹn đợt mới), hay chốt thiếu?',
      can_xu_ly: true,
      tone: 'stop',
    })
  const khoa = p.lines.filter((l) => l.stock_status === 'blocked').length
  if (khoa > 0)
    out.push({
      kind: 'sai_quy_cach',
      text: `Sai quy cách ${khoa} dòng · vào kệ khoá`,
      viec: 'NCC đổi hàng, trả lại, hay nhận kèm giảm giá',
      can_xu_ly: true,
      tone: 'warn',
    })
  if (p.over_lines > 0)
    out.push({
      kind: 'vuot',
      text: `Nhận vượt ${p.over_lines} dòng`,
      viec: 'Đã ghi lý do khi nhận — xem lại khi đối chiếu hoá đơn',
      can_xu_ly: false,
      tone: 'warn',
    })
  const lech = p.lines
    .map((l) => (l.qty2_actual ? lechKg(l.qty2_actual, kgDuKienDong(l)) : null))
    .filter((v): v is number => v != null && Math.abs(v) >= NGUONG_LECH_KG)
  if (lech.length > 0) {
    const max = lech.reduce((a, b) => (Math.abs(b) > Math.abs(a) ? b : a))
    out.push({
      kind: 'chenh_kg',
      text: `Chênh kg ${max > 0 ? '+' : ''}${max.toLocaleString('vi-VN')}% so với đơn`,
      viec: `Kế toán trả theo kg cân; lệch ≥ ${NGUONG_LECH_KG}% thì báo NCC`,
      can_xu_ly: false,
      tone: 'warn',
    })
  }
  if (out.length === 0)
    out.push({
      kind: 'du',
      text:
        p.po_status === 'received'
          ? `Đủ · ${p.lines.length} dòng`
          : `Nhận ${p.lines.length} dòng · đơn còn chờ`,
      viec: '',
      can_xu_ly: false,
      tone: p.po_status === 'received' ? 'done' : 'neutral',
    })
  return out
}

/** Phiếu này có thuộc làn "Cần xử lý" không. */
export function canXuLy(p: PhieuNhanVe): boolean {
  return ketQuaPhieu(p).some((k) => k.can_xu_ly)
}
