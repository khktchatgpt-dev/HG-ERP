import { choNhan } from '@/lib/pgt-tabs'
import type {
  GiaoNhanPayload,
  PgtDocView,
  TransferSourceRow,
} from '@/modules/dept/production/transfer-docs.service'

export type Payload = GiaoNhanPayload
export type Doc = PgtDocView
export type SourceRow = TransferSourceRow

export const TABS = ['cho_nhan', 'da_giao', 'da_nhan', 'tat_ca', 'dao_huy'] as const
export type TabKey = (typeof TABS)[number]
export const TAB_LABEL: Record<TabKey, string> = {
  cho_nhan: 'Chờ tôi nhận',
  da_giao: 'Tôi đã giao',
  da_nhan: 'Đã nhận',
  tat_ca: 'Tất cả phiếu',
  dao_huy: 'Đã đảo / huỷ',
}

export const fmt = (n: number) => n.toLocaleString('vi-VN')
export const dmy = (iso: string) => iso.slice(0, 10).split('-').reverse().join('/')
export const num = (s: string | undefined) => {
  if (!s) return 0
  const n = Number(s.replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

/** Bản nháp nhận cho một dòng phiếu: số nhận gõ tay + lý do chênh. */
export type NhanDraft = { received: string; reason: string }

/**
 * Phiếu thuộc tab nào — tính theo TỔ ĐANG ĐỨNG (`teamId`), cùng một hàm cho số
 * trên tab và cho dòng bày ra (con số là một lời hứa).
 */
export function docInTab(d: Doc, tab: TabKey, teamId: string | null): boolean {
  switch (tab) {
    case 'cho_nhan':
      return choNhan(d, teamId)
    case 'da_giao':
      return d.status === 'da_giao' && !d.reverses_doc_id && d.from_team_id === teamId
    case 'da_nhan':
      return (
        d.status === 'da_nhan' &&
        !d.reverses_doc_id &&
        (d.from_team_id === teamId || d.to_team_id === teamId)
      )
    case 'dao_huy':
      return d.status === 'da_huy' || d.reverses_doc_id != null
    case 'tat_ca':
      return true
  }
}

export const STATUS_LABEL: Record<Doc['status'], string> = {
  da_giao: 'chờ nhận',
  da_nhan: 'đã nhận',
  da_huy: 'đã huỷ',
}

/**
 * Ghép lớp. KHÔNG dùng template string có khoảng trắng đầu (` r`): hook format
 * (sắp lớp Tailwind) lột khoảng trắng trong chuỗi mẫu → "edr" (bẫy B3, 03/11).
 */
export const cx = (...xs: (string | false | null | undefined | 0)[]) =>
  xs.filter(Boolean).join(' ')
