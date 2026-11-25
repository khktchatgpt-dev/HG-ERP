/**
 * SỔ PHIẾU KHO THEO KỲ — logic thuần cho hai trang Phiếu nhập / Phiếu xuất
 * (bản vẽ https://claude.ai/artifact/JG1wTjeFFCmHauZfmNhdGa, duyệt 23/11/2026).
 *
 * Trước đó một trang "Phiếu đã ghi" trộn 247 phiếu mọi loại, 50 phiếu một trang,
 * lý do chỉ ghi mã (N1, X1). Nay mỗi loại một trang, luôn có KỲ THÁNG (chép SAP
 * MB51: phải chọn kỳ trước khi chạy), gom theo ngày, lý do bằng chữ.
 *
 * Thuần, không chạm DB: server dựng `SoPhieuDong`, client lọc / gom / đếm.
 */

import { nhanLyDo } from './kho-ma-ly-do'

export type SoPhieuLoai = 'receipt' | 'issue'

export type SoPhieuDong = {
  id: string
  code: string
  kind: SoPhieuLoai
  doc_date: string
  status: 'pending' | 'posted' | 'rejected'
  /** NCC (phiếu nhập) / người nhận (phiếu xuất). */
  counterparty: string | null
  team_name: string | null
  /** Ghi chú hoặc lý do gõ tay — phiếu "ghi hộ" nói nó từ đâu ra ở đây. */
  dien_giai: string | null
  /** Có = phiếu NÀY LÀ phiếu đảo của tờ kia. */
  dao_cua: { id: string; code: string } | null
  /** Có = tờ NÀY đã bị phiếu kia đảo, hết hiệu lực. */
  dao_boi: { id: string; code: string } | null
  /** Mã lý do trên các dòng (đã suy cho dòng cũ trước 0197), duy nhất, theo thứ tự gặp. */
  ma: string[]
  so_dong: number
  don: { po_id: string; po_code: string } | null
  /** Lệnh SX: qua đơn mua (phiếu nhập) hoặc trên dòng (phiếu xuất cho lệnh). */
  lenh: string[]
  supplier_doc_no: string | null
  /** Thuộc rổ "Thiếu số phiếu NCC" — cùng tập với badge menu (`soPhieuRepo.thieuSoNcc`). */
  thieu_ncc: boolean
  created_by: string | null
  created_by_name: string | null
  /** Nhân viên Kho giữ phiếu — theo nhóm vật tư trên dòng (0305); không có = chưa phân công. */
  giu?: string[]
}

// ── Đường dẫn ──────────────────────────────────────────────────────

export const URL_PHIEU_NHAP = '/warehouse/phieu-nhap'
export const URL_PHIEU_XUAT = '/warehouse/phieu-xuat'

/** Rổ của trang Phiếu nhập. */
export const RO_NHAP = ['all', 'thieu', 'dao'] as const
export type RoNhap = (typeof RO_NHAP)[number]
/** Rổ của trang Phiếu xuất = nhóm lý do. */
export const RO_XUAT = ['all', 'lenh', 'dao', 'tra', 'khac'] as const
export type RoXuat = (typeof RO_XUAT)[number]

/** Link vào sổ: loại + rổ (vd. rổ "Thiếu số NCC" từ Bàn làm việc Kho). */
export function hrefSoPhieu(kind: SoPhieuLoai, ro?: RoNhap | RoXuat): string {
  const goc = kind === 'receipt' ? URL_PHIEU_NHAP : URL_PHIEU_XUAT
  return ro && ro !== 'all' ? `${goc}?ro=${ro}` : goc
}

/**
 * Rổ "Thiếu số NCC" trên MỌI tháng — đích của việc "ghi số phiếu NCC" ở Bàn làm
 * việc Kho: phiếu thiếu rải từ tháng 9, xem theo một tháng là giấu phần cũ.
 */
export const HREF_THIEU_NCC = `${URL_PHIEU_NHAP}?ky=tat-ca&ro=thieu`

// ── Kỳ ─────────────────────────────────────────────────────────────

/** `YYYY-MM` hoặc `tat-ca` (nút "Tìm trong mọi tháng"). */
export type Ky = string

export const KY_TAT_CA = 'tat-ca'

const LA_KY = /^\d{4}-(0[1-9]|1[0-2])$/

/** Kỳ từ tham số URL; sai / thiếu → tháng của `today`. */
export function kyTuThamSo(s: string | undefined, today: string): Ky {
  if (s === KY_TAT_CA) return KY_TAT_CA
  return s && LA_KY.test(s) ? s : today.slice(0, 7)
}

/** Khoảng ngày `[tu, den)` của kỳ; `null` = mọi tháng. */
export function khoangKy(ky: Ky): { tu: string; den: string } | null {
  if (ky === KY_TAT_CA) return null
  return { tu: `${ky}-01`, den: `${doiKy(ky, 1)}-01` }
}

/** Tháng liền trước / sau. */
export function doiKy(ky: Ky, buoc: number): Ky {
  if (ky === KY_TAT_CA) return ky
  const [y, m] = ky.split('-').map(Number)
  const t = y * 12 + (m - 1) + buoc
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`
}

export function nhanKy(ky: Ky): string {
  if (ky === KY_TAT_CA) return 'Mọi tháng'
  return `Tháng ${ky.slice(5, 7)}/${ky.slice(0, 4)}`
}

/** Tên ngắn trong câu: "tháng 11", "mọi tháng". */
export function kyTrongCau(ky: Ky): string {
  if (ky === KY_TAT_CA) return 'mọi tháng'
  return `tháng ${Number(ky.slice(5, 7))}`
}

/** Số phiếu theo tháng từ danh sách ngày chứng từ — thanh trạng thái + câu rỗng. */
export function demTheoThang(ngays: string[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const d of ngays) {
    const k = d.slice(0, 7)
    out[k] = (out[k] ?? 0) + 1
  }
  return out
}

// ── Lý do bằng chữ ─────────────────────────────────────────────────

/** Nhãn NGẮN cho cột Lý do — bộ đầy đủ ở `kho-ma-ly-do.ts` (ô chọn, tooltip). */
const NHAN_NGAN: Record<string, string> = {
  N1: 'Mua theo đơn',
  N2: 'Mua ngoài đơn',
  N3: 'Hoàn kho từ SX',
  N4: 'Thừa sau kiểm kê',
  X1: 'Cấp cho lệnh',
  X2: 'Cấp bù hao',
  X3: 'Trả NCC',
  X4: 'Xuất huỷ',
  X5: 'Thiếu sau kiểm kê',
  X6: 'Dùng chung',
  X7: 'Xuất khác',
}

/** Nhóm lý do — rổ của trang Phiếu xuất. */
export type NhomXuat = 'lenh' | 'dao' | 'tra' | 'khac'

export type LyDoPhieu = {
  nhan: string
  /** Mã đầu (để tooltip nói mã đầy đủ); null = phiếu đảo hoặc dòng cũ không suy được. */
  ma: string | null
  dao: boolean
  /** Phiếu có nhiều lý do: số lý do còn lại. */
  them: number
}

export function lyDoPhieu(d: Pick<SoPhieuDong, 'kind' | 'dao_cua' | 'ma'>): LyDoPhieu {
  if (d.dao_cua)
    return {
      nhan: d.kind === 'issue' ? 'Đảo phiếu nhập' : 'Đảo phiếu xuất',
      ma: null,
      dao: true,
      them: 0,
    }
  const ma = d.ma[0] ?? null
  return {
    nhan: ma ? (NHAN_NGAN[ma] ?? nhanLyDo(ma) ?? ma) : 'Chưa rõ lý do',
    ma,
    dao: false,
    them: Math.max(0, d.ma.length - 1),
  }
}

export function nhomXuat(d: Pick<SoPhieuDong, 'dao_cua' | 'ma'>): NhomXuat {
  if (d.dao_cua) return 'dao'
  const ma = d.ma[0]
  if (ma === 'X1' || ma === 'X2') return 'lenh'
  if (ma === 'X3') return 'tra'
  return 'khac'
}

/** Phiếu "ghi hộ" — ghi bù cho ngày khác (18 phiếu xuất 02/10/2026). */
export const laGhiHo = (d: Pick<SoPhieuDong, 'dien_giai'>) =>
  /^\s*ghi hộ/i.test(d.dien_giai ?? '')

// ── Đếm + gom ──────────────────────────────────────────────────────

/**
 * Phiếu CÓ CỘNG vào số: đã bị đảo (gạch ngang) và bị từ chối thì không. Phiếu
 * ĐẢO vẫn cộng — nó là một lần ghi sổ thật; trang nói rõ "gồm n phiếu đảo".
 */
export const coTinh = (d: Pick<SoPhieuDong, 'dao_boi' | 'status'>) =>
  !d.dao_boi && d.status !== 'rejected'

export type NgayNhom = {
  ngay: string
  ds: SoPhieuDong[]
  soPhieu: number
  soDong: number
}

/** Gom theo ngày chứng từ, ngày mới trước; trong ngày giữ thứ tự đầu vào. */
export function gomTheoNgay(ds: SoPhieuDong[]): NgayNhom[] {
  const m = new Map<string, NgayNhom>()
  for (const d of ds) {
    const k = d.doc_date.slice(0, 10)
    const g = m.get(k) ?? { ngay: k, ds: [], soPhieu: 0, soDong: 0 }
    g.ds.push(d)
    if (coTinh(d)) {
      g.soPhieu++
      g.soDong += d.so_dong
    }
    m.set(k, g)
  }
  return [...m.values()].sort((a, b) => (a.ngay < b.ngay ? 1 : a.ngay > b.ngay ? -1 : 0))
}

export function tongSo(ds: SoPhieuDong[]): {
  soPhieu: number
  soDong: number
  dao: number
  daBiDao: number
  thieuNcc: number
} {
  let soPhieu = 0
  let soDong = 0
  let dao = 0
  let daBiDao = 0
  let thieuNcc = 0
  for (const d of ds) {
    if (coTinh(d)) {
      soPhieu++
      soDong += d.so_dong
    }
    if (d.dao_cua) dao++
    if (d.dao_boi) daBiDao++
    if (d.thieu_ncc) thieuNcc++
  }
  return { soPhieu, soDong, dao, daBiDao, thieuNcc }
}

const THU = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy']

/** "Thứ Bảy 21/11" — thêm năm khi khác năm của `today`. */
export function thuNgay(iso: string, today: string): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`)
  const dm = `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
  const nam = iso.slice(0, 4) === today.slice(0, 4) ? '' : `/${iso.slice(0, 4)}`
  return `${THU[d.getUTCDay()]} ${dm}${nam}`
}

// ── Tìm ────────────────────────────────────────────────────────────

const bo = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()

/** Khớp ô tìm: số phiếu, đơn, lệnh, NCC / người nhận, số phiếu NCC, diễn giải, người lập. */
export function khopTim(d: SoPhieuDong, q: string): boolean {
  const k = bo(q.trim())
  if (!k) return true
  const hay = [
    d.code,
    d.don?.po_code,
    ...d.lenh,
    d.counterparty,
    d.team_name,
    d.supplier_doc_no,
    d.dien_giai,
    d.created_by_name,
    d.dao_cua?.code,
    d.dao_boi?.code,
  ]
    .filter(Boolean)
    .join(' ')
  return bo(hay).includes(k)
}
