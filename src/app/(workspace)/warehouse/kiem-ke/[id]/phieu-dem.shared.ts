import type { StocktakeStatus } from '@/modules/dept/warehouse/stocktakes.repo'

export type DotDem = {
  id: string
  code: string
  status: StocktakeStatus
  nhom: string[]
  scope_count: number
  freeze_at: string | null
  blind: boolean
  nguoi_dem: string | null
  note: string | null
  reject_reason: string | null
}

export type DongDem = {
  id: string
  material_id: string
  code: string
  name: string
  unit: string
  ke: string | null
  /** Số sổ tại mốc chốt — null khi đang đếm mù (server không gửi). */
  so_so: number | null
  /** Null = chưa đếm (khác 0). */
  dem: number | null
  note: string | null
  luc: string | null
}

/** Ô đang gõ dở của một dòng (chữ người gõ, chưa lưu). */
export type Nhap = { qty?: string; note?: string }

/** Chữ gõ → số đếm. Trống / không phải số → null (KHÔNG coi là 0). Hiểu "1.390" = 1390. */
export function docDem(v: string | undefined): number | null {
  if (v == null) return null
  const s = v.trim()
  if (s === '') return null
  const n = Number(s.replace(/\s/g, '').replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) && n >= 0 ? n : null
}

export const vietSo = (n: number | null) =>
  n == null ? '' : n.toLocaleString('vi-VN', { maximumFractionDigits: 3 })

/** Mốc giờ kiểu "19/10 11:26" theo giờ Việt Nam (locale vi-VN tự ra "11:26 19-10"). */
export function gioVn(iso: string | null): string {
  if (!iso) return ''
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
      timeZone: 'Asia/Ho_Chi_Minh',
    })
      .formatToParts(new Date(iso))
      .map((x) => [x.type, x.value]),
  )
  return `${p.day}/${p.month} ${p.hour}:${p.minute}`
}
