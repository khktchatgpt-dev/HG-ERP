/**
 * NGÀY CHỨNG TỪ PHIẾU NHẬP — lùi được bao xa (05/10/2026, chủ dự án duyệt).
 *
 * Trước đây: lùi ≤ 7 ngày, cứng, chỉ báo SAU khi bấm Ghi sổ. Giai đoạn đang
 * đưa dữ liệu cũ lên hệ thống thì luật đó chặn việc thật: hàng về từ hai tuần
 * trước phải nhờ ghi hộ bằng script (PNK-2026-0056…0058, 0061…0077). Tệ hơn,
 * "Sửa số lượng" của phiếu cũ hơn 7 ngày ĐẢO được nhưng LẬP LẠI bị chặn —
 * phiếu cũ đã đảo mà không có phiếu thay.
 *
 * Luật mới, MỘT chỗ cho cả form (báo ngay tại ô) lẫn server (zod):
 *  · tương lai: chặn;
 *  · lùi 0–7 ngày: bình thường;
 *  · lùi 8–60 ngày: được, BẮT lý do — lý do in lên phiếu;
 *  · lùi > 60 ngày: chặn;
 *  · phiếu LẬP LẠI để sửa (`laLapLai`): giữ đúng ngày của phiếu cũ, không
 *    giới hạn — server tự kiểm phiếu cũ có thật và đã đảo (stock.service).
 *
 * So bằng NGÀY LỊCH (chuỗi yyyy-mm-dd theo giờ VN), không bằng mili-giây —
 * bản cũ lấy `Date.now() - new Date(iso)` nên lệch 7 tiếng quanh nửa đêm.
 */

export const LUI_TU_DO = 7
export const LUI_TOI_DA = 60

export type KetQuaNgay =
  | { muc: 'ok'; lui: number }
  | { muc: 'can_ly_do'; lui: number; message: string }
  | { muc: 'chan'; lui: number; message: string }

/** Số ngày lịch từ `docDate` tới `today` (dương = lùi về trước). */
export function soNgayLui(docDate: string, today: string): number {
  const d = (s: string) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10))
  return Math.round((d(today) - d(docDate)) / 86_400_000)
}

export function kiemNgayChungTu(p: {
  docDate: string | null | undefined
  today: string
  lyDo?: string | null
  laLapLai?: boolean
}): KetQuaNgay {
  if (!p.docDate) return { muc: 'ok', lui: 0 }
  const lui = soNgayLui(p.docDate, p.today)
  if (p.laLapLai) return { muc: 'ok', lui }
  if (lui < 0)
    return { muc: 'chan', lui, message: 'Ngày chứng từ không được ở tương lai' }
  if (lui > LUI_TOI_DA)
    return {
      muc: 'chan',
      lui,
      message: `Ngày chứng từ lùi ${lui} ngày — chỉ lùi được tối đa ${LUI_TOI_DA} ngày`,
    }
  if (lui > LUI_TU_DO && !p.lyDo?.trim())
    return {
      muc: 'can_ly_do',
      lui,
      message: `Ngày chứng từ lùi ${lui} ngày — ghi lý do nhập lùi ngày`,
    }
  return { muc: 'ok', lui }
}

/** Câu ghi vào ghi chú phiếu (in lên 01-VT) khi nhập lùi quá `LUI_TU_DO` ngày. */
export function ghiChuLuiNgay(lui: number, lyDo: string): string {
  return `[Nhập lùi ${lui} ngày] ${lyDo.trim()}`
}
