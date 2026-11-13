import type {
  DossierCell,
  DossierLine,
  DossierPayload,
  DossierRow,
  DossierStage,
} from '@/modules/dept/production/lsx-dossier.service'

export type Payload = DossierPayload
export type Line = DossierLine
export type Row = DossierRow
export type Cell = DossierCell
export type Stage = DossierStage

export const TABS = ['dong_bo', 'ke_hoach', 'phieu', 'trao_doi'] as const
export type TabKey = (typeof TABS)[number]
export const TAB_LABEL: Record<TabKey, string> = {
  dong_bo: 'Tiến độ',
  ke_hoach: 'Kế hoạch tổ & hạn',
  phieu: 'Phiếu',
  trao_doi: 'Trao đổi',
}

export const fmt = (n: number) => n.toLocaleString('vi-VN')
export const dmy = (iso: string) => iso.slice(0, 10).split('-').reverse().join('/')
export const pct = (a: number, b: number) =>
  b > 0 ? `${Math.round(Math.min(a / b, 1) * 100)}%` : '—'
/**
 * Ghép lớp — KHÔNG template string có khoảng trắng đầu (hook format lột mất,
 * bẫy B3 03/11).
 */
export const cx = (...xs: (string | false | null | undefined | 0)[]) =>
  xs.filter(Boolean).join(' ')

export const STATUS_LABEL: Record<string, string> = {
  draft: 'Nháp',
  pending_approval: 'Chờ GĐ duyệt',
  approved: 'Đã duyệt',
  in_progress: 'Đang sản xuất',
  completed: 'Hoàn thành',
  rejected: 'Bị trả về',
  cancelled: 'Đã huỷ',
}

/** Ô đang chọn trên bảng ba tầng. */
export type Pick = { line_id: string; row_id: string; stage: string }

/** Số ngày tới hạn xuất (âm = trễ). */
export function daysLeft(iso: string | null, today: string): number | null {
  if (!iso) return null
  const a = new Date(`${iso.slice(0, 10)}T00:00:00`).getTime()
  const b = new Date(`${today}T00:00:00`).getTime()
  return Math.round((a - b) / 86400000)
}
