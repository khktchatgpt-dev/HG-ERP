import { fmtMoney } from './po-line'
/**
 * SỐ CỦA MỘT HẠNG MỤC NGOÀI SẢN XUẤT (0230, B3 bản vẽ Đầu đơn) — logic thuần.
 *
 * Mọi con số ở danh sách, hồ sơ hạng mục và màn ký của Giám đốc đi qua MỘT hàm
 * này, để "đã tiêu bao nhiêu" chỉ có một nghĩa:
 *  - Đã đặt = tổng thanh toán (gồm VAT) các đơn đã rời nháp, trừ đơn huỷ.
 *  - Nháp đếm riêng — chưa ai ký, chưa phải tiền đã cam kết.
 *  - Đã về / hoá đơn / đã trả lấy NGUYÊN số mục Tài chính của từng đơn
 *    (`poFinanceForPo`), không tính lại kiểu khác.
 *  - Chỉ cộng đơn CÙNG tiền tệ với hạng mục; đơn tiền khác đếm riêng, không quy đổi.
 */

export type HangMucDon = {
  status: string
  currency: string
  /** Tổng thanh toán của đơn (gồm VAT) — `poMoneyOf(...).grandTotal`. */
  gross: number
  /** Số mục Tài chính của đơn; null = chưa đọc được (đơn nháp không cần). */
  received_net: number | null
  invoiced_gross: number | null
  paid: number | null
  /** Quá hẹn giao (`assessPoLate` = overdue). */
  overdue: boolean
  /** Dòng đã về mà phiếu nhập không có giá — tiền về của chúng đang tính 0 (mục Tài chính: "thiếu giá"). */
  missing_price_lines?: number
  /** Đọc mục Tài chính của đơn bị lỗi — số về / hoá đơn / trả của đơn này CHƯA có trong tổng. */
  finance_error?: boolean
}

export type HangMucSo = {
  /** Đơn đã rời nháp, chưa huỷ, cùng tiền tệ. */
  n: number
  nhap: number
  nhap_gross: number
  ordered: number
  received_net: number
  invoiced_gross: number
  paid: number
  /** Hoá đơn gồm VAT − đã trả. */
  owed: number
  overdue: number
  /** Đơn khác tiền tệ — không cộng vào số nào ở trên. */
  khac_tien_te: number
  /** Đơn có hàng về mà phiếu nhập THIẾU GIÁ — "đã về" của chúng tính 0, phải nói ra. */
  thieu_gia: number
  /** Đơn đọc tài chính lỗi — tổng về / hoá đơn / trả đang thiếu phần của chúng. */
  loi_tai_chinh: number
  /** Đơn đã có hoá đơn NCC (ô "Đã có hoá đơn · 2 / 4 đơn"). */
  co_hoa_don: number
  /** % dự toán đã đặt; null khi không có dự toán. */
  pct: number | null
}

const r2 = (n: number) => Math.round(n * 100) / 100

export function soHangMuc(
  hm: { budget: number | null; currency: string },
  dons: readonly HangMucDon[],
): HangMucSo {
  const so: HangMucSo = { n: 0, nhap: 0, nhap_gross: 0, ordered: 0, received_net: 0, invoiced_gross: 0, paid: 0, owed: 0, overdue: 0, khac_tien_te: 0, thieu_gia: 0, loi_tai_chinh: 0, co_hoa_don: 0, pct: null } // prettier-ignore
  for (const d of dons) {
    if (d.status === 'cancelled') continue
    if (d.currency !== hm.currency) {
      so.khac_tien_te++
      continue
    }
    if (d.status === 'draft') {
      so.nhap++
      so.nhap_gross += d.gross
      continue
    }
    so.n++
    so.ordered += d.gross
    so.received_net += d.received_net ?? 0
    so.invoiced_gross += d.invoiced_gross ?? 0
    so.paid += d.paid ?? 0
    if (d.overdue) so.overdue++
    if ((d.missing_price_lines ?? 0) > 0) so.thieu_gia++
    if (d.finance_error) so.loi_tai_chinh++
    if ((d.invoiced_gross ?? 0) > 0.005) so.co_hoa_don++
  }
  so.ordered = r2(so.ordered)
  so.nhap_gross = r2(so.nhap_gross)
  so.received_net = r2(so.received_net)
  so.invoiced_gross = r2(so.invoiced_gross)
  so.paid = r2(so.paid)
  so.owed = r2(so.invoiced_gross - so.paid)
  so.pct = hm.budget && hm.budget > 0 ? Math.round((so.ordered / hm.budget) * 100) : null
  return so
}

/** Từ 90% dự toán là nhắc — chỉ CẢNH BÁO, không chặn đơn nào (Q4 bản vẽ). */
export const NGUONG_DU_TOAN = 90

/**
 * "CẦN CHÚ Ý" — mỗi cờ một câu, đếm bằng đúng số của `soHangMuc`. Thứ tự: nặng
 * trước. `lenhCuaKhach`: lệnh đang chạy của khách mà tên hạng mục "Đơn khách chưa
 * ra lệnh" nhắc tới — đã có lệnh thì nên đóng hạng mục, đơn sau đặt theo lệnh.
 */
export function canChuY(
  hm: { status: string; kind: string; budget: number | null; currency: string },
  so: HangMucSo,
  lenhCuaKhach: readonly string[] = [],
): string[] {
  if (hm.status !== 'open') return []
  const out: string[] = []
  if (hm.budget != null && hm.budget > 0) {
    const vuot = so.ordered - hm.budget
    if (vuot > 0.005) out.push(`vượt dự toán ${tienCo(vuot, hm.currency)}`)
    else if ((so.pct ?? 0) >= NGUONG_DU_TOAN) out.push(`đã đặt ${so.pct}% dự toán`)
  }
  if (so.overdue > 0) out.push(`${so.overdue} đơn quá hẹn`)
  if (so.thieu_gia > 0)
    out.push(`${so.thieu_gia} đơn phiếu nhập thiếu giá — "đã về" chưa đủ`)
  if (so.loi_tai_chinh > 0) out.push(`${so.loi_tai_chinh} đơn chưa đọc được số tài chính`)
  if (lenhCuaKhach.length > 0)
    out.push(`đã có lệnh ${lenhCuaKhach.join(', ')} — đóng hạng mục?`)
  return out
}

const tienCo = (n: number, cur: string) =>
  cur === 'VND' ? fmtMoney(n, cur) : `${fmtMoney(n, cur)} ${cur}`

/**
 * Luật hạng mục của đơn ngoài lệnh (0230) — thuần để test được; pos.service gọi.
 * Trả câu lỗi, hoặc null khi hợp lệ.
 *  - Hạng mục phải có thật.
 *  - Phải đang mở — TRỪ khi đơn giữ nguyên hạng mục cũ (đóng hạng mục không làm
 *    hỏng nháp đang dở của nó).
 */
export function loiHangMuc(
  pj: { code: string; status: string } | null,
  projectId: string,
  hienCo?: string | null,
): string | null {
  if (!pj) return 'Hạng mục không tồn tại'
  if (pj.status !== 'open' && projectId !== hienCo)
    return `Hạng mục ${pj.code} đã đóng — mở lại ở trang Hạng mục, hoặc chọn hạng mục khác`
  return null
}

/** Đơn ngoài lệnh lên bàn ký / đi NCC phải thuộc một hạng mục. */
export function thieuViec(po: {
  production_order_id: string | null
  project_id?: string | null
}): boolean {
  // prettier-ignore
  return !po.production_order_id && !po.project_id
}

/**
 * Lệnh đang chạy mà tên khách nằm trong tên hạng mục "Đơn khách chưa ra lệnh".
 * Khớp bỏ dấu, không phân biệt hoa thường; tên khách < 3 ký tự bỏ qua (quá dễ
 * khớp nhầm).
 */
export function lenhCuaKhach(
  hm: { kind: string; name: string },
  lenh: readonly { code: string; customer_name: string | null }[],
): string[] {
  if (boDau(hm.kind) !== boDau('Đơn khách chưa ra lệnh')) return []
  const ten = boDau(hm.name)
  return lenh
    .filter((l) => {
      const kh = boDau(l.customer_name ?? '').trim()
      return kh.length >= 3 && ten.includes(kh)
    })
    .map((l) => l.code)
}

const boDau = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase() // prettier-ignore

/**
 * Ô DỰ TOÁN: "300.000.000" (kiểu VN) và "300,000,000" (dán từ Excel máy kiểu Mỹ)
 * đều ra 300000000; "1,5" → 1,5 (phẩy là thập phân). Trống → null. Sai → undefined.
 */
export function docTienDuToan(v: string): number | null | undefined {
  const s = v.replace(/\s/g, '')
  if (!s) return null
  const kieuMy = /^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)
  const t = kieuMy ? s.replace(/,/g, '') : s.replace(/\./g, '').replace(',', '.')
  const n = Number(t)
  return Number.isFinite(n) && n >= 0 ? n : undefined
}
