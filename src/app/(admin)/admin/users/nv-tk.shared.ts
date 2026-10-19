export const TH =
  'sticky top-0 z-[1] border-b border-[var(--line)] bg-[var(--surface-raised)] px-2.5 py-1.5 text-left font-semibold text-[var(--ink-2)] whitespace-nowrap'
export const TD = 'border-b border-[var(--line-faint)] px-2.5 py-1.5 whitespace-nowrap'

export const ROLE_LABEL: Record<string, string> = {
  admin: 'Quản trị',
  manager: 'Quản lý',
  employee: 'Nhân viên',
}
export const ROLES = ['employee', 'manager', 'admin'] as const

/** ISO → '14/10' (giờ VN); năm khác thì kèm năm. */
export function ngayVn(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(Date.parse(iso) + 7 * 3600_000).toISOString()
  const nam = d.slice(0, 4) !== new Date().toISOString().slice(0, 4)
  return `${d.slice(8, 10)}/${d.slice(5, 7)}${nam ? `/${d.slice(2, 4)}` : ''}`
}

export const lucVn = (iso: string) => {
  const d = new Date(Date.parse(iso) + 7 * 3600_000).toISOString()
  return `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)} ${d.slice(11, 16)}`
}

/** Mật khẩu tạm 10 ký tự, bỏ ký tự dễ đọc nhầm (0/O, 1/l/I). Người nhận bắt đổi ở lần đầu. */
export function matKhauTam(): string {
  const chu = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const b = new Uint32Array(10)
  crypto.getRandomValues(b)
  return Array.from(b, (x) => chu[x % chu.length]).join('')
}
