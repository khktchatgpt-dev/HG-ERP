import type { StocktakeStatus } from '@/modules/dept/warehouse/stocktakes.repo'

/** Một dòng của sổ đợt kiểm kê — chỉ thứ màn cần, không gửi dòng đếm. */
export type DotRow = {
  id: string
  code: string
  status: StocktakeStatus
  /** Nhóm của đợt theo nhóm; đợt theo khu / danh sách thì rỗng. */
  nhom: string[]
  scope_kind: 'bin' | 'group' | 'list'
  scope_count: number
  nguoi_dem: string | null
  freeze_at: string | null
  /** Dòng đã sinh (sau khi bắt đầu đếm) / đã có số đếm. */
  tong: number
  da_dem: number
  doc_code: string | null
  reject_reason: string | null
  created_by: string
  created_at: string
}

export const RO_DOT = ['lam', 'cho', 'xong', 'huy', 'all'] as const
export type RoDot = (typeof RO_DOT)[number]

export const RO_DOT_NHAN: Record<RoDot, string> = {
  lam: 'Đang làm',
  cho: 'Chờ duyệt',
  xong: 'Đã duyệt',
  huy: 'Đã huỷ',
  all: 'Tất cả',
}

export function thuocRo(r: Pick<DotRow, 'status'>, ro: RoDot): boolean {
  if (ro === 'all') return true
  if (ro === 'lam') return r.status === 'open' || r.status === 'counting'
  if (ro === 'cho') return r.status === 'review'
  if (ro === 'xong') return r.status === 'approved'
  return r.status === 'cancelled'
}

/** Nhãn trạng thái: chữ + lớp nhãn nền nhạt (nền đặc = bấm được). */
export const TRANG_THAI: Record<StocktakeStatus, { nhan: string; lop: string }> = {
  open: { nhan: 'Mới mở', lop: 'kh-tag' },
  counting: { nhan: 'Đang đếm', lop: 'kh-tag run' },
  review: { nhan: 'Chờ duyệt', lop: 'kh-tag warn' },
  approved: { nhan: 'Đã duyệt', lop: 'kh-tag done' },
  cancelled: { nhan: 'Đã huỷ', lop: 'kh-tag' },
}

/** Huỷ được khi chưa duyệt và chưa huỷ (luật `stocktakesService.cancel`). */
export const huyDuoc = (s: StocktakeStatus) => s !== 'approved' && s !== 'cancelled'
