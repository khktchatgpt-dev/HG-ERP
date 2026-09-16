/**
 * PHIẾU XUẤT THEO THỰC TẾ LẤY — logic thuần của form `/warehouse/xuat`
 * (Bước 2 Kho). Không so định mức (chủ dự án chốt 16/09/2026): sổ chỉ cần
 * biết xuất mã gì, bao nhiêu, cho lệnh hay tổ nào. Server
 * (`stockService.createIssueDoc`) vẫn là người quyết: guard trạng thái lệnh,
 * guard tồn, guard giữ chỗ, mã X1 tự gắn cho lệnh.
 */

import { maTheoHuong, type MaLyDoKho } from './kho-ma-ly-do'

export type LoaiXuat = 'lsx' | 'daily'

/** Vật tư vừa chọn từ ô tìm — phần tối thiểu màn cần, không kéo cả hồ sơ. */
export type VatTuChon = {
  id: string
  code: string
  name: string
  unit: string
}

export type DongXuat = VatTuChon & {
  /** Tồn dùng được (`qty_ok`) lúc thêm dòng — null = chưa tra được. */
  qty_ok: number | null
  qty: number
  note: string
}

/**
 * Mã lý do cho XUẤT LẺ: hướng ra, không cần duyệt, không phải cấp theo lệnh
 * (X1 — đường "Cho lệnh SX" đã gắn tự động), không phải trả NCC / kiểm kê
 * (hai đường đó có màn riêng). Còn lại: X2 bù hao ngoài định mức (vẫn gắn
 * lệnh), X6 dùng chung / sửa chữa, X7 khác.
 */
export const LY_DO_XUAT_LE: readonly MaLyDoKho[] = maTheoHuong('out').filter(
  (x) =>
    x.ma !== 'X1' &&
    !x.canDuyet &&
    !x.doiUng.includes('po_line') &&
    !x.doiUng.includes('stocktake'),
)

/** Mã lý do này có đòi gắn LỆNH không (X2 có, X6/X7 không). */
export function lyDoCanLenh(ma: string | null): boolean {
  return !!ma && LY_DO_XUAT_LE.some((x) => x.ma === ma && x.doiUng.includes('lsx'))
}

/**
 * Thêm một mã vào lưới. MỘT MÃ MỘT DÒNG: chọn lại mã đã có thì không đẻ dòng
 * thứ hai (hai dòng cùng mã là hai lần trừ tồn mà người đọc chỉ thấy một) —
 * trả về chỉ số dòng cũ để màn nhảy tới ô số của nó.
 */
export function themDong(
  rows: DongXuat[],
  vt: VatTuChon,
  qty_ok: number | null,
): { rows: DongXuat[]; index: number; trung: boolean } {
  const i = rows.findIndex((r) => r.id === vt.id)
  if (i >= 0) return { rows, index: i, trung: true }
  return {
    rows: [...rows, { ...vt, qty_ok, qty: 0, note: '' }],
    index: rows.length,
    trung: false,
  }
}

export function tinhTongXuat(rows: DongXuat[]): { so_dong: number; tong: number } {
  let so_dong = 0
  let tong = 0
  for (const r of rows) {
    if (r.qty > 0) {
      so_dong++
      tong += r.qty
    }
  }
  return { so_dong, tong }
}

/** Xuất quá tồn dùng được — trả phần thiếu, null khi đủ hoặc chưa tra được tồn. */
export function thieuTon(r: Pick<DongXuat, 'qty' | 'qty_ok'>): number | null {
  if (r.qty_ok == null) return null
  return r.qty > r.qty_ok ? r.qty - r.qty_ok : null
}
