/**
 * ĐIỀU CHỈNH CHẤM CÔNG — lớp đặt lên lượt máy (bản vẽ DieuChinh.dc.html, câu 22–25
 * duyệt 17/10/2026). Hàm thuần, dùng chung bảng tổ, trang một người, file Excel.
 *
 * Lượt máy KHÔNG bao giờ sửa. Chỉ điều chỉnh ĐÃ DUYỆT làm đổi kết quả; chờ duyệt chỉ
 * được đếm (`choDuyet`) để ô hiện viền gạch đứt.
 */

export type LoaiDc = 'add_punch' | 'leave' | 'ignore_punch'
/**
 * `holiday` KHÔNG phải loại phiếu (không có trong `LOAI_NGHI`, schema phiếu chặn): chỉ lõi
 * tính công gán cho ngày lễ của bộ phận "Đủ công" — lương trả theo hệ số "Nghỉ lễ".
 */
export type LoaiNghi =
  'annual' | 'sick' | 'personal' | 'business_trip' | 'unpaid' | 'holiday'
export type TinhTrangDc = 'pending' | 'approved' | 'rejected' | 'cancelled'

/** Loại nghỉ Nhân sự chọn được trên phiếu điều chỉnh. */
export const LOAI_NGHI: LoaiNghi[] = [
  'annual',
  'sick',
  'personal',
  'business_trip',
  'unpaid',
]
export const TEN_NGHI: Record<LoaiNghi, string> = {
  annual: 'Nghỉ phép',
  sick: 'Nghỉ ốm',
  personal: 'Việc riêng có báo',
  business_trip: 'Công tác',
  unpaid: 'Nghỉ không lương',
  holiday: 'Nghỉ lễ',
}
/** Ký hiệu ngắn trên ô bảng tổ. */
export const KY_NGHI: Record<LoaiNghi, string> = {
  annual: 'P',
  sick: 'Ô',
  personal: 'R',
  business_trip: 'CT',
  unpaid: 'KL',
  holiday: 'L',
}
export const TEN_TINH_TRANG: Record<TinhTrangDc, string> = {
  pending: 'Chờ duyệt',
  approved: 'Đã duyệt',
  rejected: 'Từ chối',
  cancelled: 'Đã rút',
}
/** Nhãn "máy" của lượt bổ sung — để người đọc thấy ngay lượt nào không phải máy ghi. */
export const MAY_BO_SUNG = 'Bổ sung'

export type DieuChinh = {
  id: string
  /** Mã nhân viên. */
  ma: string
  ngay: string
  loai: LoaiDc
  /** 'HH:MM:SS' — giờ bổ sung / giờ lượt bỏ qua. */
  gio: string | null
  chieu: 'in' | 'out' | null
  nghi: LoaiNghi | null
  lyDo: string
  canCu: string | null
  tinhTrang: TinhTrangDc
  nguoiGui: string | null
  /** Tài khoản người gửi — so với `QuyenDieuChinh.toi` để không tự duyệt phiếu mình. */
  guiId?: string | null
  luc: string
  nguoiDuyet: string | null
  lucDuyet: string | null
  ghiChuDuyet: string | null
}

/** Câu tả một điều chỉnh — cột Nội dung, gợi ý ô, Excel. */
export function moTaDc(d: Pick<DieuChinh, 'loai' | 'gio' | 'chieu' | 'nghi'>): string {
  const g = d.gio?.slice(0, 5) ?? ''
  if (d.loai === 'leave') return d.nghi ? TEN_NGHI[d.nghi] : 'Nghỉ có lý do'
  if (d.loai === 'ignore_punch') return `Bỏ qua lượt ${g}`
  return `Bổ sung lượt ${d.chieu === 'in' ? 'vào' : 'ra'} ${g}`
}

export type SauDieuChinh<L> = {
  luot: (L | { gio: string; may: string; lap: number })[]
  /** Nghỉ có lý do đã duyệt — ngày đó không tính vắng. */
  nghi: LoaiNghi | null
  /** Có ít nhất một điều chỉnh đã duyệt. */
  daSua: boolean
  /** Số điều chỉnh đang chờ duyệt. */
  choDuyet: number
}

/** Áp các điều chỉnh (của MỘT người MỘT ngày) lên lượt máy. */
export function apDieuChinh<L extends { gio: string; may: string }>(
  luot: L[],
  dcs: readonly Pick<DieuChinh, 'loai' | 'gio' | 'nghi' | 'tinhTrang'>[],
): SauDieuChinh<L> {
  const duyet = dcs.filter((d) => d.tinhTrang === 'approved')
  const choDuyet = dcs.filter((d) => d.tinhTrang === 'pending').length
  if (!duyet.length) return { luot, nghi: null, daSua: false, choDuyet }
  let out: SauDieuChinh<L>['luot'] = [...luot]
  let nghi: LoaiNghi | null = null
  for (const d of duyet) {
    if (d.loai === 'leave') nghi = d.nghi
    else if (d.loai === 'ignore_punch' && d.gio) {
      const i = out.findIndex((l) => l.gio.slice(0, 5) === d.gio!.slice(0, 5))
      if (i >= 0) out = out.filter((_, j) => j !== i)
    } else if (d.loai === 'add_punch' && d.gio)
      out = [
        ...out,
        { gio: d.gio.length === 5 ? `${d.gio}:00` : d.gio, may: MAY_BO_SUNG, lap: 1 },
      ]
  }
  out.sort((a, b) => (a.gio < b.gio ? -1 : a.gio > b.gio ? 1 : 0))
  return { luot: out, nghi, daSua: true, choDuyet }
}

/** Gom điều chỉnh theo `ma|ngay`, bỏ đã rút / từ chối. */
export function theoNguoiNgay(dcs: readonly DieuChinh[]): Map<string, DieuChinh[]> {
  const m = new Map<string, DieuChinh[]>()
  for (const d of dcs) {
    if (d.tinhTrang === 'cancelled' || d.tinhTrang === 'rejected') continue
    const k = `${d.ma}|${d.ngay}`
    m.set(k, [...(m.get(k) ?? []), d])
  }
  return m
}

// ── Gợi ý bổ sung lượt ───────────────────────────────────────────────────────

/** Mốc "lượt rạng sáng" mặc định (05:00, cùng `caDemDen` của gio-khung) khi màn không có bản cách tính. */
export const CA_DEM_DEN_MAC_DINH = 5 * 60

export type GoiYBoSung = {
  /** Lượt bổ sung thuộc NGÀY HÔM TRƯỚC: ngày chỉ có một lượt rạng sáng = giờ ra của ca đêm, thiếu lượt vào tối hôm trước. */
  ngayTruoc: boolean
  chieu: 'in' | 'out'
  /** 'HH:MM' */
  gio: string
}

const phutCua = (gio: string) => Number(gio.slice(0, 2)) * 60 + Number(gio.slice(3, 5))

/**
 * Gợi ý mặc định cho ngăn "Bổ sung lượt quẹt" theo lượt máy của ngày (chủ dự án 23/10/2026):
 *   · một lượt ≤ `caDemDen` (rạng sáng)  → thiếu lượt VÀO tối HÔM TRƯỚC, gợi ý 21:00
 *   · một lượt buổi sáng                   → thiếu lượt ra, gợi ý 16:00
 *   · một lượt từ trưa trở đi              → thiếu lượt vào, gợi ý 07:00
 *   · còn lại (0 hoặc ≥ 2 lượt)            → như cũ: vào 07:00 hôm nay
 */
export function goiYBoSung(
  luot: readonly { gio: string }[],
  caDemDen = CA_DEM_DEN_MAC_DINH,
): GoiYBoSung {
  if (luot.length === 1) {
    const p = phutCua(luot[0].gio)
    if (p <= caDemDen) return { ngayTruoc: true, chieu: 'in', gio: '21:00' }
    if (p < 12 * 60) return { ngayTruoc: false, chieu: 'out', gio: '16:00' }
    return { ngayTruoc: false, chieu: 'in', gio: '07:00' }
  }
  return { ngayTruoc: false, chieu: luot.length ? 'out' : 'in', gio: luot.length ? '16:00' : '07:00' }
}

/** Một lượt rạng sáng (≤ mốc ca đêm) — ca đêm thiếu lượt vào hôm trước. */
export const laLuotRangSang = (
  luot: readonly { gio: string }[],
  caDemDen = CA_DEM_DEN_MAC_DINH,
) => luot.length === 1 && phutCua(luot[0].gio) <= caDemDen
