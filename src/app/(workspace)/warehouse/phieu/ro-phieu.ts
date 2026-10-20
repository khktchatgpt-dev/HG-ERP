/**
 * Rổ của Sổ phiếu kho — module KHÔNG `'use client'` (bẫy hằng client-reference).
 */

export const RO_PHIEU = [
  'all',
  'receipt',
  'issue',
  'stocktake',
  'thieu_ncc',
  'reversed',
] as const
export type RoPhieu = (typeof RO_PHIEU)[number]

export const RO_PHIEU_NHAN: Record<RoPhieu, string> = {
  all: 'Tất cả',
  receipt: 'Phiếu nhập',
  issue: 'Phiếu xuất',
  stocktake: 'Kiểm kê',
  // Việc của Kho (Kho đợt 2 · Bước 2b, 12/10/2026): người nhận cầm tờ giao hàng NCC.
  thieu_ncc: 'Thiếu số phiếu NCC',
  reversed: 'Đã bị đảo',
}
