/**
 * DANH MỤC LOẠI PHIẾU DUYỆT — một chỗ khai cho Hộp ký (H1, bản vẽ
 * https://claude.ai/artifact/XDy5RfHWzAfAAoULJpobBB, Q23–Q28 duyệt 14/10/2026).
 *
 * Chủ dự án 14/10: "bên trang của giám đốc không phân loại ra sao sẽ dễ bị rối
 * lắm vì sau này sẽ có rất nhiều yêu cầu duyệt". Trước đây thêm một loại phiếu
 * là sửa ~4 chỗ (kiểu `kind`, nhãn, icon, chip lọc, số đếm). Nay: thêm MỘT mục ở
 * `LOAI_PHIEU` + một nhánh lấy phiếu trong `execService.signBox` — Hộp ký, chip
 * theo phòng, khối theo loại, bản điện thoại đều đọc từ đây.
 *
 * Luật thuần, dùng chung server + màn (không chạm DB).
 */

/** Phòng TRÌNH phiếu — chip lọc của Hộp ký, thứ tự cố định (Q25: người ký quen vị trí). */
export const PHONG_TRINH = ['mua_hang', 'kho', 'san_xuat', 'ban_hang'] as const
export type PhongTrinh = (typeof PHONG_TRINH)[number]

export const PHONG_NHAN: Record<PhongTrinh, string> = {
  mua_hang: 'Mua hàng',
  kho: 'Kho',
  san_xuat: 'Sản xuất',
  ban_hang: 'Bán hàng',
}

export type LoaiPhieu = 'po' | 'dnm' | 'lsx' | 'quote'

export type KhaiLoai = {
  /** Nhãn ngắn — chip, tag trong khối "Cần ký trước". */
  nhan: string
  /** Tên khối trong Hộp ký. */
  ten: string
  phong: PhongTrinh
  /** Thứ tự khối (nhỏ trước). Cùng phòng thì đứng liền nhau. */
  thuTu: number
  /**
   * Ký nhanh nhiều phiếu được không (Q26 — chỉ trong MỘT khối). Lệnh SX luôn
   * mở ra đọc (BOM, giá, hạn giao); đơn mua giá trị lớn chặn riêng theo cờ `big`.
   */
  kyNhanh: boolean
  /** Sổ tra cứu loại này (không đếm — Q27); null = chưa có trang sổ riêng. */
  so: string | null
  /**
   * Nhãn các cột thay đổi theo loại — hàng tiêu đề riêng của khối (bảng dùng
   * chung một lưới cột, mỗi khối nói cột đó nghĩa là gì với loại của nó).
   */
  cot: { doiTac: string; noiDung: string; boiCanh: string; hen: string; giaTri: string }
}

export const LOAI_PHIEU: Record<LoaiPhieu, KhaiLoai> = {
  po: {
    nhan: 'Đơn mua',
    ten: 'Đơn mua NCC',
    phong: 'mua_hang',
    thuTu: 10,
    kyNhanh: true,
    so: null,
    cot: { doiTac: 'Nhà cung cấp', noiDung: 'Mua gì', boiCanh: 'Lệnh SX', hen: 'Hẹn giao', giaTri: 'Giá trị (gồm VAT)' }, // prettier-ignore
  },
  dnm: {
    nhan: 'Đề nghị mua',
    ten: 'Đề nghị mua vật tư',
    phong: 'kho',
    thuTu: 20,
    kyNhanh: true,
    so: '/duyet/de-nghi',
    cot: { doiTac: 'Bộ phận', noiDung: 'Nội dung · lưu ý', boiCanh: 'Lệnh SX', hen: 'Cần trước', giaTri: 'Tổng dự kiến' }, // prettier-ignore
  },
  lsx: {
    nhan: 'Lệnh SX',
    ten: 'Lệnh sản xuất',
    phong: 'san_xuat',
    thuTu: 30,
    kyNhanh: false,
    so: null,
    cot: { doiTac: 'Khách', noiDung: 'Đơn hàng · sản phẩm', boiCanh: '—', hen: 'Giao', giaTri: 'Giá trị đơn' }, // prettier-ignore
  },
  quote: {
    nhan: 'Báo giá',
    ten: 'Báo giá',
    phong: 'ban_hang',
    thuTu: 40,
    kyNhanh: true,
    so: null,
    cot: {
      doiTac: 'Khách',
      noiDung: 'Nội dung',
      boiCanh: '—',
      hen: 'Hiệu lực',
      giaTri: '—',
    },
  },
}

/** Các loại theo thứ tự khối. */
export const LOAI_THEO_THU_TU = (Object.keys(LOAI_PHIEU) as LoaiPhieu[]).sort(
  (a, b) => LOAI_PHIEU[a].thuTu - LOAI_PHIEU[b].thuTu,
)

/** Chờ từ bao nhiêu ngày thì vào khối "Cần ký trước" (Q24). */
export const CHO_LAU = 3

type PhieuGap = {
  waiting_days: number
  late_sign?: unknown | null
  po?: { eta_late_days: number } | null
}

/**
 * Vì sao phiếu phải KÝ TRƯỚC (Q24) — null = không gấp. Thứ tự ưu tiên câu:
 * ký bù (hàng đã đi) > hẹn giao đã qua > chờ lâu. Giá trị lớn KHÔNG tính —
 * nó chỉ mang dấu khoá trong khối của nó, không thì khối này đầy đơn mua lớn.
 */
export function vungGap(
  i: PhieuGap,
): { ma: 'ky_bu' | 'qua_hen' | 'cho_lau'; cau: string } | null {
  if (i.late_sign) return { ma: 'ky_bu', cau: 'ký bù — hàng đã đi trước chữ ký' }
  const tre = i.po?.eta_late_days ?? 0
  if (tre > 0) return { ma: 'qua_hen', cau: `hẹn giao đã qua ${tre} ngày` }
  if (i.waiting_days >= CHO_LAU)
    return { ma: 'cho_lau', cau: `chờ ${i.waiting_days} ngày` }
  return null
}

const DIEM_GAP = { ky_bu: 0, qua_hen: 1, cho_lau: 2 } as const

/** Xếp trong khối "Cần ký trước": ký bù → quá hẹn → chờ lâu; cùng mức thì chờ lâu hơn trước. */
export function xepGap<T extends PhieuGap>(items: readonly T[]): T[] {
  return items
    .map((i) => ({ i, g: vungGap(i) }))
    .filter((x): x is { i: T; g: NonNullable<ReturnType<typeof vungGap>> } => !!x.g)
    .sort(
      (a, b) =>
        DIEM_GAP[a.g.ma] - DIEM_GAP[b.g.ma] || b.i.waiting_days - a.i.waiting_days,
    ) // prettier-ignore
    .map((x) => x.i)
}

/** Gom theo loại theo thứ tự khối; loại không có phiếu thì bỏ (Q25 — ẩn khối rỗng). */
export function gomTheoLoai<T extends { kind: LoaiPhieu }>(
  items: readonly T[],
): { loai: LoaiPhieu; khai: KhaiLoai; items: T[] }[] {
  return LOAI_THEO_THU_TU.map((loai) => ({
    loai,
    khai: LOAI_PHIEU[loai],
    items: items.filter((i) => i.kind === loai),
  })).filter((g) => g.items.length > 0)
}

/** Đếm theo phòng — chip lọc. Phòng có khai loại mà 0 phiếu vẫn trả về (chip mờ). */
export function demTheoPhong<T extends { kind: LoaiPhieu }>(
  items: readonly T[],
): { phong: PhongTrinh; nhan: string; n: number }[] {
  return PHONG_TRINH.filter((p) =>
    LOAI_THEO_THU_TU.some((l) => LOAI_PHIEU[l].phong === p),
  ).map((p) => ({
    phong: p,
    nhan: PHONG_NHAN[p],
    n: items.filter((i) => LOAI_PHIEU[i.kind].phong === p).length,
  }))
}

/** Ký nhanh được phiếu này không — luật của LOẠI + giá trị lớn + ký bù. */
export function kyNhanhDuoc(i: {
  kind: LoaiPhieu
  big: boolean
  late_sign?: unknown | null
}) {
  return LOAI_PHIEU[i.kind].kyNhanh && !i.big && !i.late_sign
}
