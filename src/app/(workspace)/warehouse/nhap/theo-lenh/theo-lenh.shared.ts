import type { KdTinh } from '@/lib/kho-don-theo-lenh'

/**
 * Dùng chung ba tầng Kho · đơn mua theo lệnh: ① danh sách lệnh → ② trang một
 * lệnh → ③ trang một đơn. Không chạm DB — client + server cùng import.
 */
export const URL_THEO_LENH = '/warehouse/nhap/theo-lenh'
export const lenhHref = (lsxId: string) => `${URL_THEO_LENH}/${lsxId}`
/** Trang một đơn; mở từ trang lệnh thì mang lệnh theo (cột "phần của lệnh"). */
export const donHref = (poId: string, lsxId?: string | null) =>
  `/warehouse/don-mua/${poId}${lsxId ? `?lenh=${lsxId}` : ''}`

export const LA_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const TINH_NHAN: Record<KdTinh, string> = {
  du: 'Về đủ',
  mot_phan: 'Về một phần',
  chua_ve: 'Chưa về',
  chua_dat: 'Chưa đặt',
  huy: 'Đơn huỷ có phiếu nhập',
}

const DUOC_NHAN = new Set(['confirmed', 'in_transit', 'partial'])

/**
 * Vì sao chưa nhận hàng được đơn này — nói TẠI CHỖ (dưới đầu trang), không chỉ
 * tooltip. `null` = nhận được.
 */
export function lyDoKhoaNhan(
  d: { po_code: string; status: string; tinh: KdTinh } | null,
  canEdit: boolean,
): string | null {
  if (!d) return 'Chọn một đơn trong bảng trước'
  if (d.tinh === 'huy') return `${d.po_code} đã huỷ — Kho không nhận hàng cho đơn huỷ`
  if (d.tinh === 'chua_dat')
    return `${d.po_code} chưa được duyệt nên chưa nhận được. Người đặt bên Cung ứng phải gửi duyệt trước`
  if (d.tinh === 'du') return `${d.po_code} đã nhận đủ — không còn hàng để nhận`
  if (!DUOC_NHAN.has(d.status))
    return `${d.po_code} đã duyệt nhưng NCC chưa xác nhận — chờ Cung ứng ghi NCC xác nhận`
  if (!canEdit) return 'Chỉ phòng Kho ghi phiếu nhập'
  return null
}
