import type { BaoCaoPayload } from '@/modules/dept/production/bao-cao.service'
import type { DinhMucReport } from '@/modules/dept/production/reports.service'

export type Payload = BaoCaoPayload
export type DinhMuc = DinhMucReport

export const TABS = ['to', 'loi', 'treo', 'ton', 'nang_suat', 'dinh_muc'] as const
export type TabKey = (typeof TABS)[number]
export const TAB_LABEL: Record<TabKey, string> = {
  to: 'Sản lượng theo tổ',
  loi: 'Lỗi (Pareto)',
  treo: 'Sửa lại còn treo',
  ton: 'Tồn công đoạn',
  nang_suat: 'Năng suất',
  dinh_muc: 'Định mức vs thực dùng',
}

export const fmt = (n: number) => n.toLocaleString('vi-VN')
export const dmy = (iso: string) => iso.slice(0, 10).split('-').reverse().join('/')
export const dm = (iso: string) => dmy(iso).slice(0, 5)
export const cx = (...xs: (string | false | null | undefined | 0)[]) =>
  xs.filter(Boolean).join(' ')
export const LEVEL: Record<string, string> = {
  part: 'chi tiết',
  cluster: 'cụm',
  unit: 'bộ',
}
const THU = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']
export const thu = (iso: string) => THU[new Date(`${iso}T00:00:00`).getDay()]
