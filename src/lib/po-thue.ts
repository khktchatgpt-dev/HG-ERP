/**
 * KIỂU THUẾ CỦA ĐƠN MUA — một lựa chọn thay cho hai ô "VAT %" + "giá gồm VAT"
 * (B1 bản vẽ Đầu đơn, 11/10/2026). Logic thuần, client dùng được.
 *
 * Hai ô rời từng nằm xa nhau trong hàng ẩn sau nút "VND · VAT 8% ▾": đổi % mà
 * quên ô tick là tổng tiền sai lặng lẽ (PO-2026-0091). Đo 142 đơn chưa huỷ: chỉ
 * có năm kiểu thật — 8% chưa gồm (87), 10% chưa gồm (18), không VAT (15), 10%
 * đã gồm (7), 8% đã gồm (3). Và 27/32 NCC có từ 2 đơn trở lên LUÔN dùng một
 * kiểu, nên mặc định theo NCC chứ không theo mẫu đơn như trước.
 */

export type KieuThue = { readonly rate: number; readonly incl: boolean }

/** Năm kiểu thật, nhiều đơn trước. */
export const KIEU_THUE: readonly KieuThue[] = [
  { rate: 8, incl: false },
  { rate: 10, incl: false },
  { rate: 10, incl: true },
  { rate: 8, incl: true },
  { rate: 0, incl: false },
]

/** Thuế 0% thì "đã gồm" hay "chưa gồm" như nhau — luôn quy về chưa gồm. */
export function chuanThue(rate: number | null | undefined, incl: boolean): KieuThue {
  const r = rate == null || !Number.isFinite(rate) ? 0 : rate
  return { rate: r, incl: r === 0 ? false : incl }
}

export const khoaThue = (k: KieuThue): string => `${k.rate}|${k.incl ? 1 : 0}`

export function tuKhoaThue(s: string): KieuThue | null {
  const m = /^(\d+(?:\.\d+)?)\|([01])$/.exec(s)
  return m ? chuanThue(Number(m[1]), m[2] === '1') : null
}

export function nhanThue(k: KieuThue): string {
  if (k.rate === 0) return 'Không VAT'
  return `VAT ${String(k.rate).replace('.', ',')}% · giá ${k.incl ? 'đã gồm' : 'chưa gồm'}`
}

const vn = (n: number) => Math.round(n).toLocaleString('vi-VN')

/** Phép tính mẫu trên 1.000.000 — người chọn thấy ngay kiểu này làm tổng ra bao nhiêu. */
export function viDuThue(k: KieuThue): string {
  if (k.rate === 0) return 'không cộng thuế — không lấy hoá đơn GTGT, hoặc hàng nhập'
  if (k.incl)
    return `tổng 1.000.000 → trong đó thuế ${vn(1e6 - 1e6 / (1 + k.rate / 100))}`
  const t = (1e6 * k.rate) / 100
  return `1.000.000 tiền hàng → ${vn(t)} thuế → tổng ${vn(1e6 + t)}`
}

/** Thuế theo NCC, tính từ các đơn chưa huỷ của NCC đó (server: posRepo.taxBySupplier). */
export type ThueNcc = {
  /** Kiểu của đơn GẦN NHẤT. */
  rate: number
  incl: boolean
  /** Số đơn của NCC mang đúng kiểu này. */
  n: number
  /** Số kiểu khác nhau NCC từng dùng — > 1 thì nhắc người soạn nhìn lại. */
  kieu: number
}

export type ThueMacDinh = KieuThue & { nguon: 'don' | 'ho_so'; n?: number; kieu?: number }

/**
 * Mặc định khi chọn NCC: đơn gần nhất của NCC → VAT khai trong hồ sơ NCC
 * (giá chưa gồm) → null (giữ mặc định của mẫu đơn như trước).
 */
export function thueMacDinh(i: {
  ncc?: ThueNcc | null
  nccVat?: number | null
}): ThueMacDinh | null {
  if (i.ncc) return { ...chuanThue(i.ncc.rate, i.ncc.incl), nguon: 'don', n: i.ncc.n, kieu: i.ncc.kieu } // prettier-ignore
  if (i.nccVat != null) return { ...chuanThue(i.nccVat, false), nguon: 'ho_so' }
  return null
}

/** Dòng nhắc nhỏ bên ô Thuế — nói vì sao ô đang mang kiểu này. */
export function goiYThue(cur: KieuThue, md: ThueMacDinh | null): string | null {
  if (!md) return null
  const khop = khoaThue(cur) === khoaThue(md)
  if (md.nguon === 'ho_so') return khop ? 'theo hồ sơ NCC' : null
  const lap = (md.kieu ?? 1) > 1 ? ` · NCC từng dùng ${md.kieu} kiểu` : ''
  return khop ? `theo ${md.n} đơn trước của NCC${lap}` : `NCC thường: ${nhanThue(md)}`
}

/**
 * Bản NGẮN của `goiYThue` để đứng cạnh ô trên hàng đầu đơn — đo 12/10 ở 1536px:
 * bản dài đẩy ô Thuế rớt xuống hàng thứ hai. Bản dài vẫn ở `title`.
 */
export function goiYThueNgan(cur: KieuThue, md: ThueMacDinh | null): string | null {
  if (!md) return null
  const khop = khoaThue(cur) === khoaThue(md)
  if (md.nguon === 'ho_so') return khop ? 'theo hồ sơ NCC' : null
  if (!khop) return `NCC thường ${md.rate === 0 ? 'không VAT' : `${md.rate}%${md.incl ? ' đã gồm' : ''}`}` // prettier-ignore
  return (md.kieu ?? 1) > 1 ? `theo NCC (${md.kieu} kiểu)` : 'theo NCC'
}
