import type { BangKeRow } from './lsx-bang-ke'

/**
 * BẢNG KÊ GỌN (khu Mua hàng, 29/09/2026 — artboard 18/18b đã duyệt).
 *
 * Đo lúc dựng: 9 lệnh đang chạy, 0/95 SP đã xác nhận định mức (toàn hệ thống
 * 1/807) → trạng thái cũ (`status`) gần như mọi dòng là "Ngoài định mức", không
 * nói gì với người mua. Bản gọn phân loại theo TIẾN ĐỘ ĐƠN của chính mã — thứ có
 * thật hôm nay — còn số "Cần" chỉ hiện khi có, và nói rõ khi là số nháp.
 */
export type TinhTrang = 'chua_dat' | 'nhap' | 'cho_duyet' | 'dang_ve' | 'da_ve'

export const TINH_TRANG: Record<
  TinhTrang,
  { label: string; tone: 'stop' | 'warn' | 'done' | 'neutral' }
> = {
  chua_dat: { label: 'Chưa đặt', tone: 'stop' },
  nhap: { label: 'Nháp', tone: 'warn' },
  cho_duyet: { label: 'Chờ duyệt', tone: 'warn' },
  dang_ve: { label: 'Đang về', tone: 'neutral' },
  da_ve: { label: 'Đã về', tone: 'done' },
}
export const THU_TU: TinhTrang[] = ['chua_dat', 'nhap', 'cho_duyet', 'dang_ve', 'da_ve']

type Facts = Pick<BangKeRow, 'ordered' | 'pending' | 'draft' | 'received'>

/**
 * Bước XA NHẤT mà mã đã đi: còn hàng đang về thì là "Đang về" dù đã nhận một
 * phần; không còn gì đang về mà đã nhận → "Đã về"; rồi tới chờ duyệt, nháp.
 */
export function tinhTrang(r: Facts): TinhTrang {
  if (r.ordered > 0) return 'dang_ve'
  if (r.received > 0) return 'da_ve'
  if (r.pending > 0) return 'cho_duyet'
  if (r.draft > 0) return 'nhap'
  return 'chua_dat'
}

/**
 * Số "Cần" để hiện: chỉ từ định mức ĐÃ xác nhận / định hình / nhập tay; số từ
 * định mức nháp trả kèm cờ `nhap` (màn in hổ phách + chữ "nháp"). null = trống.
 */
export function canHien(
  r: Pick<BangKeRow, 'source' | 'qty_needed' | 'draft_needed'>,
): { qty: number; nhap: boolean } | null {
  if (r.source === 'bom_draft') {
    const q = r.qty_needed > 0 ? r.qty_needed : r.draft_needed
    return q > 0 ? { qty: q, nhap: true } : null
  }
  if (r.source === 'none') return null
  return r.qty_needed > 0 ? { qty: r.qty_needed, nhap: false } : null
}

export function demTinhTrang(rows: readonly Facts[]): Record<TinhTrang, number> {
  const out = { chua_dat: 0, nhap: 0, cho_duyet: 0, dang_ve: 0, da_ve: 0 }
  for (const r of rows) out[tinhTrang(r)]++
  return out
}
