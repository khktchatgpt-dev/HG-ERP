import type { BadgeTone } from '@/components/Badge'
import type { DieEventType, DieStatus } from '@/modules/dept/technical/dies.repo'

/**
 * Nhãn tiếng Việt của trạng thái khuôn — NGUỒN DUY NHẤT cho cả thư viện lẫn
 * hồ sơ. Hai màn gọi tên khác nhau cho cùng một trạng thái là cách chắc chắn
 * để người dùng tưởng đó là hai thứ.
 */
export const DIE_STATUS_LABEL: Record<DieStatus, string> = {
  pending: 'Chờ mở khuôn',
  active: 'Đang dùng',
  rarely_used: 'Ít dùng',
  broken: 'Khuôn hư',
  replaced: 'Khuôn cũ (đã thay)',
  retired: 'Đã bỏ',
  unknown: 'Chưa rõ tình trạng',
}

/**
 * MÀU CHỈ MÃ HOÁ VÒNG ĐỜI, không phải mức độ "xấu".
 *
 * `unknown` để `amber` chứ không `red`: chưa biết không phải là hỏng — 58 mã
 * rơi vào đây chỉ vì bốn file cũ không ai ghi, tô đỏ hết là màn đỏ rực rồi
 * người dùng thôi nhìn màu.
 */
export const DIE_STATUS_TONE: Record<DieStatus, BadgeTone> = {
  pending: 'amber',
  active: 'green',
  rarely_used: 'gray',
  broken: 'red',
  replaced: 'gray',
  retired: 'gray',
  unknown: 'amber',
}

export const DIE_EVENT_LABEL: Record<DieEventType, string> = {
  opened: 'Mở khuôn',
  modified: 'Sửa / bỏ gân',
  transferred: 'Chuyển nơi giữ',
  broken: 'Báo hư',
  replaced: 'Thay bằng mã khác',
  retired: 'Bỏ hẳn',
  reopened: 'Mở lại',
  note: 'Ghi chú',
}

/** Tiền VNĐ. Không kèm ký hiệu — nơi gọi tự thêm ₫ cho hợp ngữ cảnh. */
export const money = (v: number) => v.toLocaleString('vi-VN')

/** kg/m in 3 số lẻ: 0,289 và 0,29 là hai con số khác nhau với người cân nhôm. */
export const kgPerM = (v: number) =>
  v.toLocaleString('vi-VN', { minimumFractionDigits: 3, maximumFractionDigits: 4 })

/** "2024-10-24" → "24/10/2024". Chuỗi rỗng khi không có ngày — đừng bịa. */
export const viDate = (iso: string | null) => {
  if (!iso) return ''
  const [y, m, d] = iso.slice(0, 10).split('-')
  return y && m && d ? `${d}/${m}/${y}` : ''
}
