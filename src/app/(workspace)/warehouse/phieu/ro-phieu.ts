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
  // Cả phiếu gốc đã bị đảo lẫn phiếu đảo — đọc được trọn từng cặp (K5, 28/10/2026).
  reversed: 'Đã đảo',
}

/*
 * PHIẾU ĐẢO KHÔNG THUỘC TAB NHẬP / XUẤT (K5, 28/10/2026 — chạy kịch bản thử Kho).
 * Đảo phiếu nhập lưu `kind: 'issue'` (mã PXK, hàng ra) nên đếm theo kind là tab
 * "Phiếu xuất 28" có 10 phiếu đảo của phiếu nhập — thủ kho đọc thành 28 lần xuất.
 * Tab Nhập / Xuất nay chỉ phiếu GỐC; phiếu đảo nằm ở tab "Đã đảo" cùng phiếu gốc
 * của nó (lọc trên TOÀN SỔ — trước đó tab này chỉ lọc trong trang đang xem).
 */

/** Số trên từng tab — bằng đúng số dòng tab đó bày (`locRo`). */
export function demRo(d: {
  /** Mọi phiếu trên sổ. */
  total: number
  /** Phiếu nhập / xuất GỐC (không tính phiếu đảo). */
  receipt: number
  issue: number
  /** Số phiếu đảo (cả hai chiều). */
  dao: number
  /** Số phiếu gốc đã bị đảo. */
  goc: number
  thieu: number
}): Record<RoPhieu, number> {
  return {
    all: d.total,
    receipt: d.receipt,
    issue: d.issue,
    // Chỉ phiếu nhập / xuất mới đảo được, nên phần còn lại là kiểm kê.
    stocktake: d.total - d.receipt - d.issue - d.dao,
    thieu_ncc: d.thieu,
    reversed: d.goc + d.dao,
  }
}

/** Bộ lọc danh sách của một tab. */
export function locRo(
  ro: RoPhieu,
  tap: { thieu: string[]; goc: Iterable<string>; dao: string[] },
): { kind?: 'receipt' | 'issue' | 'stocktake'; goc_only?: boolean; ids?: string[] } {
  switch (ro) {
    case 'receipt':
    case 'issue':
      return { kind: ro, goc_only: true }
    case 'stocktake':
      return { kind: 'stocktake' }
    case 'thieu_ncc':
      return { ids: tap.thieu }
    case 'reversed':
      return { ids: [...tap.goc, ...tap.dao] }
    default:
      return {}
  }
}
