import type { RoLenh } from '@/lib/kho-ton-lenh'

/**
 * Kiểu dữ liệu page → TonLenhScreen (Kho đợt 2 · B5). File KHÔNG `'use client'`
 * để server component dùng được (bẫy client-reference, xem `ro-ton.ts`).
 */

/** Một dòng danh sách: một lệnh đã có hàng về. */
export type LenhDong = {
  id: string
  code: string
  khach: string | null
  xong: boolean
  /** Trạng thái lệnh — nhãn đúng như ô chọn lệnh của Xuất hàng (`nhanTrangThaiLenh`). */
  status: string
  ship_date: string | null
  /** Ngày VN (YYYY-MM-DD) của lần ghi xuất gần nhất — page đã đổi từ mốc UTC. */
  xuat_cuoi: string | null
  ma_ve: number
  xuat_du: number
  con_kho: number
  thieu: number
  het: number
  ro: Record<RoLenh, boolean>
}

/** Một mã của một lệnh — ngăn chi tiết. */
export type MaChiTiet = {
  lsx_id: string
  material_id: string
  code: string
  name: string
  unit: string
  ve: number
  xuat: number
  con: number
  /** Phần tồn dùng được chia cho lệnh này (Q2). */
  chia: number
  /** Tồn dùng được của cả kho. */
  ton: number
  /** Lệnh khác đang được chia tồn của mã này. */
  chung: string[]
}

/** Theo mã: lệnh nào được chia bao nhiêu (cột "Của lệnh"). */
export type CuaLenh = { lsx_id: string; code: string; qty: number }[]

/** "06/26-27 - MX" → "06-MX": mã lệnh gọn cho cột hẹp. Mã lạ giữ nguyên. */
export function lenhGon(code: string): string {
  const m = /^(\d+)\/\d+-\d+\s*-\s*(.+)$/.exec(code)
  return m ? `${m[1]}-${m[2]}` : code
}
