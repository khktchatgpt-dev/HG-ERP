/**
 * MÃ VẬT TƯ ĐANG NẰM Ở ĐÂU (05/10/2026, bản vẽ Bản 11 · V2).
 *
 * Quyết định "Xoá hẳn" hay chỉ "Ngừng dùng" dựa vào đúng con số này: mã còn
 * dính một chứng từ nào thì xoá là mất dấu vết (đơn mua, sổ kho, định mức trỏ
 * vào hư không), nên chỉ được ngừng dùng. Đếm ở `materialsRepo.usage` theo mọi
 * bảng có khoá ngoại tới `warehouse_materials` — kể cả bảng DB để CASCADE
 * (vật tư của khuôn) hay SET NULL (kế hoạch vật tư lệnh): DB không chặn những
 * bảng đó, xoá là chúng lặng lẽ mất dòng, nên càng phải chặn ở service.
 *
 * Bốn nhóm đầu là bốn ô trên panel; `other` gom phần còn lại (nhu cầu lệnh,
 * kế hoạch vật tư lệnh) — vẫn tính là "đã dùng".
 */
export type MaterialUsage = {
  /** Dòng đơn mua. */
  po: number
  /** Sổ kho: dòng nhập/xuất · dòng kiểm kê. */
  stock: number
  /** Định mức: dòng BOM · vật tư của khuôn · vật tư công đoạn SX. */
  bom: number
  /** Giá NCC đã ghi. */
  prices: number
  /** Nhu cầu lệnh · kế hoạch vật tư lệnh. */
  other: number
}

export const usageTotal = (u: MaterialUsage) =>
  u.po + u.stock + u.bom + u.prices + u.other

/** "1 đơn mua · 1 phiếu kho" — chỉ nhóm khác 0; rỗng khi chưa dùng ở đâu. */
export function usageText(u: MaterialUsage): string {
  return [
    [u.po, 'dòng đơn mua'],
    [u.stock, 'dòng sổ kho'],
    [u.bom, 'dòng định mức'],
    [u.prices, 'giá NCC'],
    [u.other, 'dòng kế hoạch lệnh'],
  ]
    .filter(([n]) => (n as number) > 0)
    .map(([n, t]) => `${(n as number).toLocaleString('vi-VN')} ${t}`)
    .join(' · ')
}
