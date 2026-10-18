export const TH =
  'sticky top-0 z-[1] border-b border-[var(--line)] bg-[var(--surface-raised)] px-2.5 py-1.5 text-left font-semibold text-[var(--ink-2)] whitespace-nowrap'
export const TD = 'border-b border-[var(--line-faint)] px-2.5 py-1.5 whitespace-nowrap'

/** 'YYYY-MM' → '10/2026'. */
export const kyVn = (t: string) => `${t.slice(5, 7)}/${t.slice(0, 4)}`

export const so = (n: number, le = 0) =>
  n.toLocaleString('vi-VN', { maximumFractionDigits: le })

/** Số kiểu VN trong ô nhập → số; rỗng → null; sai → undefined. */
export function docTien(s: string): number | null | undefined {
  const t = s.trim().replace(/[\sđ₫]/gi, '')
  if (!t) return null
  const n = Number(t.replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) && n >= 0 ? n : undefined
}

export const tienVn = (n: number | null | undefined) => (n == null ? '' : so(n))

export function congKy(t: string, n: number): string {
  const [y, m] = t.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7)
}

export const lucVn = (iso: string) => {
  const d = new Date(Date.parse(iso) + 7 * 3600_000).toISOString()
  return `${d.slice(8, 10)}/${d.slice(5, 7)} ${d.slice(11, 16)}`
}
