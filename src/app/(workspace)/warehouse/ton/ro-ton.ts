/**
 * BẢY RỔ của màn Tồn kho — để ở module KHÔNG `'use client'`.
 *
 * BẪY (dính 16/09/2026, đã có y hệt ở `mua-hang/vat-tu`): để hằng này trong
 * `TonKhoScreen.tsx` thì Next biến MỌI export của file đó thành
 * client-reference, và server component đọc `RO_TON.includes` ra
 * "is not a function" — trang 500 ngay khi mở.
 */

export const RO_TON = ['has', 'low', 'out', 'qc', 'blocked', 'short', 'all'] as const
export type RoTon = (typeof RO_TON)[number]

export const RO_NHAN: Record<RoTon, string> = {
  has: 'Đang có tồn',
  low: 'Dưới mức',
  out: 'Hết dùng được',
  qc: 'Chờ kiểm',
  blocked: 'Khoá',
  short: 'Thiếu cho lệnh',
  all: 'Cả danh mục',
}
