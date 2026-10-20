/**
 * MÃ LÝ DO KHO — một bộ từ vựng cho cả nhập, xuất và chuyển.
 *
 * VÌ SAO CẦN MÃ. "Vì sao có dòng sổ này" hôm nay tán ra ba chỗ: `docs.kind` +
 * `movements.ref_type` + ô `reason` người gõ tay. Hai người gõ "cấp SX" và
 * "xuất cho tổ phôi" là cùng một việc mà báo cáo đếm thành hai loại, và không
 * chỗ nào ràng buộc nổi "xuất huỷ thì bắt buộc có lý do".
 *
 * Ý đáng chép của movement type SAP không phải con số 300 mã, mà là MỘT MÃ
 * QUYẾT ĐỊNH BA THỨ CÙNG LÚC:
 *
 *   · `requires`       — trường đối ứng nào BẮT BUỘC (và do đó lưới soạn phiếu
 *                        hiện cột nào: cột là hệ quả, không phải cấu hình riêng);
 *   · `needsApproval`  — phiếu này có phải đi duyệt không;
 *   · `affectsCost`    — tiền có vào giá thành LỆNH không, hay là chi phí chung.
 *
 * MÃ NẰM TRÊN DÒNG SỔ, không trên phiếu (migration 0197 ghi lý do đo được).
 *
 * NGUỒN LUẬT LÀ FILE NÀY, bảng `warehouse_reason_codes` giữ toàn vẹn FK. Hai
 * bên có test canh khớp (`kho-ma-ly-do.test.ts` đọc thẳng file SQL seed) — nếu
 * không canh thì đúng là hai nguồn một sự thật, thứ nửa sau của bộ mã này sinh
 * ra để dẹp.
 */

/** Trường đối ứng một mã có thể đòi. */
export type DoiUngKho =
  'po_line' | 'lsx' | 'supplier' | 'bin_from' | 'stocktake' | 'department' | 'reason'

export type HuongKho = 'in' | 'out' | 'move'

export type MaLyDoKho = {
  readonly ma: string
  readonly nhan: string
  readonly huong: HuongKho
  readonly doiUng: readonly DoiUngKho[]
  readonly canDuyet: boolean
  readonly vaoGiaThanhLenh: boolean
}

export const MA_LY_DO_KHO = [
  {
    ma: 'N1',
    nhan: 'Nhập mua theo đơn',
    huong: 'in',
    doiUng: ['po_line'],
    canDuyet: false,
    vaoGiaThanhLenh: true,
  },
  {
    ma: 'N2',
    nhan: 'Nhập mua ngoài đơn',
    huong: 'in',
    doiUng: ['supplier', 'reason'],
    canDuyet: false,
    vaoGiaThanhLenh: true,
  },
  {
    ma: 'N3',
    nhan: 'Nhập lại vật tư thừa từ SX',
    huong: 'in',
    doiUng: ['lsx'],
    canDuyet: false,
    vaoGiaThanhLenh: true,
  },
  {
    ma: 'N4',
    nhan: 'Nhập thừa sau kiểm kê',
    huong: 'in',
    doiUng: ['stocktake'],
    canDuyet: true,
    vaoGiaThanhLenh: false,
  },
  {
    ma: 'X1',
    nhan: 'Cấp cho lệnh SX',
    huong: 'out',
    doiUng: ['lsx'],
    canDuyet: false,
    vaoGiaThanhLenh: true,
  },
  {
    ma: 'X2',
    nhan: 'Cấp bù hao ngoài định mức',
    huong: 'out',
    doiUng: ['lsx', 'reason'],
    canDuyet: false,
    vaoGiaThanhLenh: true,
  },
  {
    ma: 'X3',
    nhan: 'Trả hàng NCC',
    huong: 'out',
    doiUng: ['po_line', 'reason'],
    canDuyet: false,
    vaoGiaThanhLenh: true,
  },
  {
    ma: 'X4',
    nhan: 'Xuất huỷ · phế liệu',
    huong: 'out',
    doiUng: ['reason'],
    canDuyet: true,
    vaoGiaThanhLenh: false,
  },
  {
    ma: 'X5',
    nhan: 'Xuất thiếu sau kiểm kê',
    huong: 'out',
    doiUng: ['stocktake'],
    canDuyet: true,
    vaoGiaThanhLenh: false,
  },
  {
    ma: 'X6',
    nhan: 'Xuất dùng chung · sửa chữa',
    huong: 'out',
    doiUng: ['department'],
    canDuyet: false,
    vaoGiaThanhLenh: false,
  },
  {
    ma: 'X7',
    nhan: 'Xuất khác',
    huong: 'out',
    doiUng: ['reason'],
    canDuyet: false,
    vaoGiaThanhLenh: false,
  },
  {
    ma: 'C1',
    nhan: 'Chuyển vị trí',
    huong: 'move',
    doiUng: ['bin_from'],
    canDuyet: false,
    vaoGiaThanhLenh: false,
  },
  {
    ma: 'C2',
    nhan: 'Mở khoá sau kiểm hàng',
    huong: 'move',
    doiUng: [],
    canDuyet: false,
    vaoGiaThanhLenh: false,
  },
  {
    ma: 'C3',
    nhan: 'Khoá hàng hỏng · sai quy cách',
    huong: 'move',
    doiUng: ['reason'],
    canDuyet: true,
    vaoGiaThanhLenh: false,
  },
] as const satisfies readonly MaLyDoKho[]

export type MaLyDo = (typeof MA_LY_DO_KHO)[number]['ma']

const THEO_MA = new Map<string, MaLyDoKho>(MA_LY_DO_KHO.map((x) => [x.ma, x]))

export function laMaLyDo(x: string): x is MaLyDo {
  return THEO_MA.has(x)
}

export function timMaLyDo(ma: string | null | undefined): MaLyDoKho | null {
  return (ma && THEO_MA.get(ma)) || null
}

/** Mã của một hướng, đã xếp thứ tự bày — dùng cho ô chọn ở màn soạn phiếu. */
export function maTheoHuong(huong: HuongKho): readonly MaLyDoKho[] {
  return MA_LY_DO_KHO.filter((x) => x.huong === huong)
}

/**
 * Nhãn để bày. Mã lạ (dữ liệu cũ, hoặc mã bị gỡ khỏi danh sách) trả về CHÍNH
 * NÓ — thà hiện một chuỗi khó hiểu còn hơn hiện ô trống làm người đọc tưởng
 * dòng này không có lý do.
 */
export function nhanLyDo(ma: string | null | undefined): string | null {
  if (!ma) return null
  return THEO_MA.get(ma)?.nhan ?? ma
}

/** Lý do này có đi vào giá thành của lệnh sản xuất không. */
export function vaoGiaThanhLenh(ma: string | null | undefined): boolean {
  return !!timMaLyDo(ma)?.vaoGiaThanhLenh
}

export function canDuyet(ma: string | null | undefined): boolean {
  return !!timMaLyDo(ma)?.canDuyet
}

export function doiUngBatBuoc(ma: string | null | undefined): readonly DoiUngKho[] {
  return timMaLyDo(ma)?.doiUng ?? []
}

/**
 * Đối ứng nào còn THIẾU — trả về danh sách, không trả boolean: màn soạn phiếu
 * phải nói thiếu CÁI GÌ và gỡ thế nào, không được chỉ nói "chưa hợp lệ"
 * (luật kiểm của `/design-lab`: hành động bị chặn phải nói vướng gì).
 */
export function doiUngConThieu(
  ma: string | null | undefined,
  daCo: Partial<Record<DoiUngKho, unknown>>,
): readonly DoiUngKho[] {
  return doiUngBatBuoc(ma).filter((k) => {
    const v = daCo[k]
    return typeof v === 'string' ? !v.trim() : v == null
  })
}

/**
 * ÁNH XẠ LỊCH SỬ — suy mã cho 265 dòng ghi TRƯỚC Đợt 3.
 *
 * Sổ kho chỉ cộng thêm, không sửa lùi (cùng luật 0194), nên `reason_code` của
 * dòng cũ để null và chỗ ĐỌC suy ra tại chỗ. Nhờ vậy bộ lọc "tháng này có bao
 * nhiêu phiếu huỷ" vẫn đếm được lịch sử mà không ai viết lại lịch sử.
 *
 * Suy được tới đâu thì nói tới đó: `adjust` và `daily` KHÔNG suy được sang mã
 * nào — `adjust` gộp cả kiểm kê lệch lẫn sửa tay, `daily` chỉ nói "xuất lẻ" chứ
 * không nói xuất cho việc gì. Trả null cho chúng là câu trả lời ĐÚNG; đoán bừa
 * thành X7 là bịa ra một con số cho báo cáo kế toán.
 */
export function suyMaTuLichSu(
  refType: string | null | undefined,
  direction: 'in' | 'out' | null | undefined,
): MaLyDo | null {
  switch (refType) {
    case 'po':
      // out + po_line_id = trả NCC (0010: nhập theo PO luôn là in).
      return direction === 'out' ? 'X3' : 'N1'
    case 'lsx':
      // in = hoàn kho vật tư thừa (K2), out = cấp cho lệnh.
      return direction === 'out' ? 'X1' : 'N3'
    case 'external':
      return direction === 'out' ? null : 'N2'
    case 'transfer':
      return 'C1'
    default:
      return null
  }
}
