export function so(n: number, le = 0): string {
  return n.toLocaleString('vi-VN', { maximumFractionDigits: le })
}

/** 'YYYY-MM-DDTHH…Z' → 'dd/mm HH:mm' giờ VN, cho dòng "lấy lúc". */
export function luc(iso: string | null): string {
  if (!iso) return 'chưa lấy'
  const d = new Date(new Date(iso).getTime() + 7 * 3600_000).toISOString()
  return `${d.slice(8, 10)}/${d.slice(5, 7)} ${d.slice(11, 16)}`
}
