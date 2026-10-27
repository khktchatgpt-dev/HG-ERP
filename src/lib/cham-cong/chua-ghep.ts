import { boSo0 } from './ghep-ten'

/**
 * MÃ QUẸT MÁY CHƯA CÓ HỒ SƠ — đưa vào file xuất như một "người" tạm (27/10/2026).
 *
 * ERP không tự tạo nhân viên từ máy (15/10/2026: tên máy đẻ ra 139 hồ sơ rác), nên người mới
 * quẹt máy mà Nhân sự chưa lập hồ sơ thì Bảng công không có dòng — và file Chi tiết / Tổng hợp
 * cũng thiếu họ (27/10: 3 người mới, 6 mã, chị Nhân sự "xuất file phải đầy đủ"). Nay các mã đó
 * đi vào file ở nhóm cuối `NHOM_CHUA_GHEP`, tên ghi đúng như máy ghi, để Nhân sự thấy mà ghép.
 *
 * Mã trùng số với một nhân viên đã có (cùng số khác tên ở máy kia, `needs_review`) thì KHÔNG
 * đưa vào: giờ của họ sẽ trộn vào người kia theo khoá `ma|ngày`. Nhân sự xử lý ở Mã trên máy & ca.
 */
export const NHOM_CHUA_GHEP = '(mã máy chưa có hồ sơ)'

type DongVao = { ma: string; ten: string; daGhep: boolean }

/** Danh sách "người" tạm từ các dòng chưa ghép: mỗi mã một người, tên như máy ghi. */
export function nhanSuChuaGhep<T extends DongVao>(
  dong: T[],
  maDaCo: Iterable<string>,
): { ma: string; ten: string; boPhan: string }[] {
  const co = new Set([...maDaCo].map(boSo0))
  const m = new Map<string, string>()
  for (const r of dong) {
    if (r.daGhep || co.has(boSo0(r.ma))) continue
    const ten = r.ten.trim()
    if (!m.has(r.ma) || (!m.get(r.ma) && ten)) m.set(r.ma, ten)
  }
  return [...m]
    .sort(([a], [b]) => a.localeCompare(b, 'vi', { numeric: true }))
    .map(([ma, ten]) => ({ ma, ten: ten || `Mã máy ${ma}`, boPhan: NHOM_CHUA_GHEP }))
}

/** Dòng lượt của các mã đó, đánh dấu đã ghép để `tinhKyGioCong` nhận. */
export function dongChuaGhep<T extends DongVao>(dong: T[], ma: Iterable<string>): T[] {
  const chon = new Set(ma)
  return dong
    .filter((r) => !r.daGhep && chon.has(r.ma))
    .map((r) => ({ ...r, daGhep: true }))
}
