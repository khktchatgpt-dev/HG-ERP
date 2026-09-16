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

export type DauPhieuXuat = {
  loai: LoaiXuat
  lsx_id: string
  ly_do: string
  /** Tổ lấy (cho lệnh) hoặc bộ phận nhận (xuất lẻ). */
  to: string
  nguoi_lay: string
  doc_date: string
}

export type KiemXuat =
  | { ok: true }
  | {
      ok: false
      reason:
        | 'thieu_lenh'
        | 'thieu_ly_do'
        | 'thieu_to'
        | 'khong_dong'
        | 'so_khong_hop_le'
        | 'vuot_ton'
      message: string
      /** Ô phải sửa: tên ô đầu phiếu, hoặc chỉ số dòng. */
      focus: 'lenh' | 'ly_do' | 'to' | number
    }

/**
 * Vì sao CHƯA ghi sổ được — theo thứ tự câu hỏi của đầu phiếu (1 xuất cho →
 * 2 lệnh / lý do → 3 tổ) rồi tới lưới. Câu nào cũng chỉ được tới ô phải sửa.
 * Vượt tồn chặn ở đây vì server cũng chặn (không có đường "xuất âm").
 */
export function kiemTruocGhiSoXuat(head: DauPhieuXuat, rows: DongXuat[]): KiemXuat {
  if (head.loai === 'daily' && !head.ly_do) {
    return {
      ok: false,
      reason: 'thieu_ly_do',
      message: 'Chưa chọn lý do xuất lẻ',
      focus: 'ly_do',
    }
  }
  if (head.loai === 'lsx' || lyDoCanLenh(head.ly_do)) {
    if (!head.lsx_id) {
      return {
        ok: false,
        reason: 'thieu_lenh',
        message: 'Chưa chọn lệnh sản xuất',
        focus: 'lenh',
      }
    }
  }
  if (!head.to.trim()) {
    return {
      ok: false,
      reason: 'thieu_to',
      message: head.loai === 'lsx' ? 'Chưa chọn tổ lấy' : 'Chưa chọn bộ phận nhận',
      focus: 'to',
    }
  }
  const iSai = rows.findIndex((r) => !Number.isFinite(r.qty) || r.qty < 0)
  if (iSai >= 0) {
    return {
      ok: false,
      reason: 'so_khong_hop_le',
      message: `Dòng ${iSai + 1} ${rows[iSai].code}: số Lần này không hợp lệ`,
      focus: iSai,
    }
  }
  if (!rows.some((r) => r.qty > 0)) {
    return {
      ok: false,
      reason: 'khong_dong',
      message:
        rows.length === 0
          ? 'Chưa có dòng nào — tìm mã ở ô cuối lưới'
          : 'Chưa dòng nào có số Lần này',
      focus: rows.length === 0 ? -1 : 0,
    }
  }
  const iVuot = rows.findIndex((r) => thieuTon(r) != null)
  if (iVuot >= 0) {
    const r = rows[iVuot]
    return {
      ok: false,
      reason: 'vuot_ton',
      message: `${r.code} xuất ${r.qty} nhưng tồn dùng được ${r.qty_ok} — sửa số hoặc bỏ dòng`,
      focus: iVuot,
    }
  }
  return { ok: true }
}

/** Xuất quá tồn dùng được — trả phần thiếu, null khi đủ hoặc chưa tra được tồn. */
export function thieuTon(r: Pick<DongXuat, 'qty' | 'qty_ok'>): number | null {
  if (r.qty_ok == null) return null
  return r.qty > r.qty_ok ? r.qty - r.qty_ok : null
}
