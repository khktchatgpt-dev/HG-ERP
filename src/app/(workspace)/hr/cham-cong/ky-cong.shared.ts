import type { KyCong } from '@/modules/dept/hr/cham-cong/cham-cong.service'

export type { KyCong }

export function doiThang(t: string, buoc: number): string {
  const [y, m] = t.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1 + buoc, 1)).toISOString().slice(0, 7)
}

export const thangVn = (t: string) => `${t.slice(5, 7)}/${t.slice(0, 4)}`
export const dm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
export const dmy = (iso: string) => `${dm(iso)}/${iso.slice(0, 4)}`
export const THU = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'] as const
export const thu = (iso: string) => new Date(`${iso}T00:00:00Z`).getUTCDay()
