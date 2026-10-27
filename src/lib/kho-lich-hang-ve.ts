/**
 * LỊCH HÀNG VỀ của Kho › Nhận hàng (27/10/2026, bản vẽ
 * https://claude.ai/artifact/5iNGTXFgVaL9ZLcNJEEpVp — chủ dự án chốt "Kho chỉ cần
 * nắm thông tin đơn Cung ứng quản lý, không can thiệp"). Dải ô thay hàng tab mốc
 * hẹn: Quá hẹn · Hôm nay · TỪNG NGÀY trong 7 ngày tới · Sau đó · (Chưa hẹn) · Tất cả.
 *
 * Số chính của ô đếm đơn ĐANG VỀ theo `bucket` server tính bằng `incomingBucket`
 * (cùng hàm badge menu + Theo dõi đơn hàng): 7 ô ngày cộng lại đúng rổ "7 ngày
 * tới". Số phụ "+N sắp đặt" đếm đơn GĐ đã duyệt mà NCC chưa xác nhận, xếp ngày
 * bằng `etaBucket` (cùng luật ngày) và KHÔNG cộng vào số chính — đơn chưa ai
 * xác nhận thì không phải "hàng đang về".
 */

import type { IncomingBucket } from './supply-watch'
import { soNgayToi } from './kho-hang-ve'

/** Ô của dải: một rổ mốc hẹn, hoặc MỘT ngày trong 7 ngày tới (`d:yyyy-mm-dd`). */
export type OLichKey = 'tat_ca' | IncomingBucket | `d:${string}`

/** Đơn GĐ đã duyệt, NCC chưa xác nhận trên máy — Kho chỉ xem, không nhận được. */
export type SapDatRow = {
  po_id: string
  po_code: string
  supplier_name: string
  lsx_code: string | null
  extra_lsx: string[]
  template: string
  /** yyyy-mm-dd — ngày hẹn ghi trên đơn; null = chưa hẹn. */
  expected_at: string | null
  /** Mốc theo ngày hẹn — `etaBucket`, cùng luật ngày với đơn đang về. */
  bucket: IncomingBucket
  /** Số dòng vật tư của đơn. */
  lines_total: number
  owner_name: string | null
  /** yyyy-mm-dd — ngày GĐ duyệt; null = đơn cũ không có dấu. */
  approved_at: string | null
}

type CoMoc = { bucket: IncomingBucket; expected_at: string | null }

const THU = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']

/** "T6 30/10" — thứ tính theo lịch, không theo múi giờ máy. */
export function thuNgay(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`)
  return `${THU[d.getUTCDay()]} ${iso.slice(8, 10)}/${iso.slice(5, 7)}`
}

function congNgay(iso: string, n: number): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/** 7 ngày SAU hôm nay — đúng khoảng rổ "week" của `incomingBucket` (horizon 7). */
export function bayNgayToi(today: string): string[] {
  return [1, 2, 3, 4, 5, 6, 7].map((i) => congNgay(today, i))
}

/** Ô mà một đơn thuộc về: rổ của nó, riêng rổ 7 ngày tới tách theo ngày. */
export function oCua(bucket: IncomingBucket, expected_at: string | null): OLichKey {
  return bucket === 'week' && expected_at ? `d:${expected_at.slice(0, 10)}` : bucket
}

/** Đơn có khớp ô đang chọn không. `week` (mở từ `?hen=week`) = cả 7 ô ngày. */
export function khopO(key: OLichKey, r: CoMoc): boolean {
  if (key === 'tat_ca') return true
  if (key.startsWith('d:')) return oCua(r.bucket, r.expected_at) === key
  return r.bucket === key
}

export type OLich = {
  key: OLichKey
  nhan: string
  /** Đơn đang về trong ô (trên tập đã lọc các trục khác). */
  n: number
  /** Đơn sắp đặt trong ô — chỉ xem, không cộng vào `n`. */
  sapDat: number
  loai: 'tre' | 'nay' | 'ngay' | 'sau' | 'chua' | 'tat'
}

/**
 * Dựng dải ô. Ô "Chưa hẹn" chỉ có khi có đơn (hôm 27/10: 0) — ô rỗng thường trực
 * là một con số người đọc phải lướt qua mà không mang tin gì.
 */
export function dungLich(
  dangVe: readonly CoMoc[],
  sapDat: readonly CoMoc[],
  today: string,
): OLich[] {
  const o = (key: OLichKey, nhan: string, loai: OLich['loai']): OLich => ({
    key,
    nhan,
    loai,
    n: dangVe.filter((r) => khopO(key, r)).length,
    sapDat: sapDat.filter((r) => khopO(key, r)).length,
  })
  const out = [
    o('overdue', 'Quá hẹn', 'tre'),
    o('today', `Hôm nay ${today.slice(8, 10)}/${today.slice(5, 7)}`, 'nay'),
    ...bayNgayToi(today).map((d) => o(`d:${d}`, thuNgay(d), 'ngay')),
    o('later', 'Sau đó', 'sau'),
  ]
  const chua = o('no_eta', 'Chưa hẹn', 'chua')
  if (chua.n + chua.sapDat > 0) out.push(chua)
  out.push(o('tat_ca', 'Tất cả', 'tat'))
  return out
}

/** Nhãn nhóm khi gom theo mốc hẹn. */
export function nhanO(key: OLichKey, today: string): string {
  if (key.startsWith('d:')) return thuNgay(key.slice(2))
  const nhan: Record<string, string> = {
    overdue: 'Quá hẹn',
    today: `Hôm nay · ${thuNgay(today)}`,
    week: '7 ngày tới',
    later: 'Sau đó',
    no_eta: 'Chưa hẹn',
    tat_ca: 'Tất cả',
  }
  return nhan[key] ?? key
}

/** Khoá xếp nhóm: quá hẹn → hôm nay → từng ngày → sau đó → chưa hẹn. */
export function thuTuO(key: OLichKey): string {
  if (key.startsWith('d:')) return `2${key.slice(2)}`
  const thu: Record<string, string> = { overdue: '0', today: '1', week: '3', later: '4', no_eta: '5', tat_ca: '6' } // prettier-ignore
  return thu[key] ?? '9'
}

/** Ô gần nhất sau hôm nay có đơn đang về — "việc tiếp" khi ô đang chọn rỗng. */
export function oCoHangGanNhat(lich: readonly OLich[], tru: OLichKey): OLich | null {
  return (
    lich.find(
      (o) => (o.loai === 'nay' || o.loai === 'ngay' || o.loai === 'sau') && o.n > 0 && o.key !== tru, // prettier-ignore
    ) ?? null
  )
}

/** Số ngày đơn đã chờ NCC xác nhận, đếm từ ngày GĐ duyệt. */
export function ngayChoXacNhan(approved_at: string | null, today: string): number | null {
  return approved_at ? Math.max(0, -soNgayToi(approved_at.slice(0, 10), today)) : null
}

/** Ô hợp lệ từ `?hen=` (trang Hôm nay, thông báo hàng sắp về mở thẳng đúng mốc). */
export function docHen(v: string | null): OLichKey | null {
  if (!v) return null
  if (['tat_ca', 'overdue', 'today', 'week', 'later', 'no_eta'].includes(v))
    return v as OLichKey
  return /^d:\d{4}-\d{2}-\d{2}$/.test(v) ? (v as OLichKey) : null
}
