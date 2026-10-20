/**
 * LÝ DO XUẤT KHO — bộ mã, không phải ô chữ tự do.
 *
 * VÌ SAO CẦN MÃ. Lý do xuất quyết định TIỀN ĐI VỀ ĐÂU:
 *
 *   · cấp cho sản xuất  → vào giá thành LỆNH đó;
 *   · sửa máy, dùng nội bộ → chi phí chung, không thuộc lệnh nào;
 *   · huỷ / hỏng        → tổn thất, kế toán ghi khác hẳn.
 *
 * Ô chữ tự do thì không nhóm được. Hai người gõ "cấp SX" và "xuất cho tổ phôi"
 * là cùng một việc mà báo cáo đếm thành hai loại, và kế toán cuối kỳ phải ngồi
 * đọc từng phiếu đoán ý. Đây đúng là việc SAP dùng movement type để làm (261
 * cấp cho lệnh · 201 dùng nội bộ · 551 huỷ) — bộ dưới đây là bản rút gọn cho
 * một xưởng nội thất, không chép nguyên 300 mã của SAP.
 *
 * KHÔNG ĐẶT CHECK CONSTRAINT Ở DB, cùng lối với `doc_counters.kind`: thêm một
 * lý do mới là sửa danh sách này, không phải chạy migration. Zod ở biên API giữ
 * hàng rào, và `nhanLyDo` không nhận ra mã lạ thì trả chính chuỗi đó chứ không
 * làm vỡ màn của dữ liệu cũ.
 */

export const LY_DO_XUAT = [
  {
    ma: 'sx',
    nhan: 'Cấp cho sản xuất',
    goiY: 'Cấp vật tư theo định mức của lệnh',
    /** Vào giá thành lệnh. */
    vaoGiaThanhLenh: true,
  },
  {
    ma: 'bu-hao',
    nhan: 'Cấp bù hao hụt',
    goiY: 'Tổ báo hỏng / thiếu giữa chừng, cấp thêm ngoài định mức',
    vaoGiaThanhLenh: true,
  },
  {
    ma: 'sua-may',
    nhan: 'Sửa chữa · bảo trì',
    goiY: 'Máy móc, nhà xưởng, xe nâng',
    vaoGiaThanhLenh: false,
  },
  {
    ma: 'mau',
    nhan: 'Làm mẫu · showroom',
    goiY: 'Hàng mẫu, mẫu gửi khách',
    vaoGiaThanhLenh: false,
  },
  {
    ma: 'noi-bo',
    nhan: 'Dùng nội bộ',
    goiY: 'Văn phòng, bảo hộ lao động, vệ sinh',
    vaoGiaThanhLenh: false,
  },
  {
    ma: 'huy',
    nhan: 'Huỷ · hỏng không dùng được',
    goiY: 'Vật tư hỏng, hết hạn — ghi rõ nguyên nhân',
    vaoGiaThanhLenh: false,
  },
  {
    ma: 'khac',
    nhan: 'Khác',
    goiY: 'Bắt buộc ghi rõ ở ô diễn giải',
    vaoGiaThanhLenh: false,
  },
] as const

export type MaLyDoXuat = (typeof LY_DO_XUAT)[number]['ma']

const THEO_MA = new Map(LY_DO_XUAT.map((x) => [x.ma as string, x]))

export function laMaLyDoXuat(x: string): x is MaLyDoXuat {
  return THEO_MA.has(x)
}

/**
 * Nhãn để bày. Mã lạ (dữ liệu cũ, hoặc mã bị gỡ khỏi danh sách) trả về CHÍNH
 * NÓ — thà hiện một chuỗi khó hiểu còn hơn hiện ô trống làm người đọc tưởng
 * phiếu không có lý do.
 */
export function nhanLyDo(ma: string | null | undefined): string | null {
  if (!ma) return null
  return THEO_MA.get(ma)?.nhan ?? ma
}

/** Lý do này có đi vào giá thành của lệnh sản xuất không. */
export function vaoGiaThanhLenh(ma: string | null | undefined): boolean {
  return !!ma && (THEO_MA.get(ma)?.vaoGiaThanhLenh ?? false)
}

/**
 * "Khác" BẮT BUỘC ghi rõ — không thì nó thành cái thùng rác nuốt mọi phiếu và
 * bộ mã mất luôn tác dụng.
 */
export function thieuDienGiai(
  ma: string | null | undefined,
  dienGiai: string | null | undefined,
): boolean {
  return ma === 'khac' && !dienGiai?.trim()
}

/**
 * Lý do ĐỀ XUẤT theo loại phiếu xuất: xuất theo lệnh thì gần như luôn là cấp
 * cho sản xuất — điền sẵn để người dùng khỏi chọn lại mỗi lần.
 */
export function lyDoMacDinh(kind: 'lsx' | 'daily'): MaLyDoXuat | '' {
  return kind === 'lsx' ? 'sx' : ''
}
