/** 'ISO' → 'dd/mm HH:mm' giờ VN. */
export const lucVn = (iso: string | null) => {
  if (!iso) return '—'
  const d = new Date(Date.parse(iso) + 7 * 3600_000).toISOString()
  return `${d.slice(8, 10)}/${d.slice(5, 7)} ${d.slice(11, 16)}`
}

export const so = (n: number, le = 0) =>
  n.toLocaleString('vi-VN', { maximumFractionDigits: le })

export const MUC_KY = ['theo-to', 'theo-nguoi', 'dong-thoi-gian'] as const
export type MucKy = (typeof MUC_KY)[number]
