/**
 * Rổ của Sổ phiếu kho — module KHÔNG `'use client'` (bẫy hằng client-reference).
 */

export const RO_PHIEU = ['all', 'receipt', 'issue', 'stocktake', 'reversed'] as const
export type RoPhieu = (typeof RO_PHIEU)[number]

export const RO_PHIEU_NHAN: Record<RoPhieu, string> = {
  all: 'Tất cả',
  receipt: 'Phiếu nhập',
  issue: 'Phiếu xuất',
  stocktake: 'Kiểm kê',
  reversed: 'Đã bị đảo',
}
