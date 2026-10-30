/**
 * ĐỒ DÙNG CHUNG cho khối yêu cầu việc (0281, B2) — VIẾT THẲNG Tailwind + token,
 * KHÔNG import `@/components/kit` (chủ dự án chốt 29/10/2026: "làm B1 nhưng không
 * dùng bộ kit"). Token màu (`--act`, `--stop`…) vẫn dùng: khối nằm trong vùng
 * `.kit` của khung trao đổi, và một màu hành động / ba màu vòng đời là luật màu
 * của cả app chứ không phải của bộ kit.
 */

export type Person = { id: string; name: string; department: string | null }

/** Lớp nút — chép đúng thông số nút của app (cao 28px, bo 6px, chữ 12px). */
export function btn(tone: 'primary' | 'normal' | 'ghost', locked = false): string {
  const base =
    'inline-flex h-7 items-center gap-1.5 rounded-[var(--radius)] border px-2.5 text-[12px] whitespace-nowrap'
  if (locked) {
    // Nền xám ĐẶC, không opacity: chữ mờ bằng opacity trượt AA (luật màu 16/09/2026).
    return `${base} cursor-not-allowed border-[var(--line-faint)] bg-[var(--surface-raised)] text-[var(--ink-3)]`
  }
  if (tone === 'primary') {
    return `${base} border-[var(--act)] bg-[var(--act)] font-semibold text-[var(--act-ink)] hover:bg-[var(--act-hover)]`
  }
  if (tone === 'ghost') {
    return `${base} border-transparent bg-transparent font-medium text-[var(--act-text)] hover:bg-[var(--act-wash)]`
  }
  return `${base} border-[var(--line)] bg-[var(--surface-card)] font-medium text-[var(--ink)] hover:border-[var(--ink-3)] hover:bg-[var(--surface)]`
}

export const fieldCls =
  'w-full rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--surface-card)] px-2 text-[13px] text-[var(--ink)] placeholder:text-[var(--ink-3)] focus:border-[var(--act)]'

export const labelCls =
  'text-[11px] font-semibold tracking-[0.05em] text-[var(--ink-label)] uppercase'

/** dd/mm từ 'YYYY-MM-DD'. */
export const dm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`

/** Cộng ngày trên chuỗi 'YYYY-MM-DD' (theo lịch, không theo múi giờ). */
export function addDays(iso: string, n: number): string {
  const d = new Date(
    Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10) + n),
  )
  return d.toISOString().slice(0, 10)
}

/** Thứ Hai TỚI (hôm nay là thứ Hai thì là tuần sau) — hạn hay hẹn nhất khi giao việc. */
export function nextMonday(iso: string): string {
  const dow = new Date(`${iso}T00:00:00Z`).getUTCDay() // 0 = CN
  return addDays(iso, (8 - dow) % 7 || 7)
}

/** Bỏ dấu + chữ thường để gõ "phuong" vẫn ra "Phương", "ky thuat" ra "Kỹ Thuật". */
export function fold(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
}

/** Nhãn vòng đời nhỏ — chỉ mã hoá trạng thái, không bao giờ bấm được. */
export function DueTag({
  dueOn,
  overdueDays,
}: {
  dueOn: string | null
  overdueDays: number
}) {
  if (overdueDays > 0) {
    return (
      <span className="inline-flex h-5 items-center rounded-[var(--radius-sm)] border border-[var(--stop-line)] bg-[var(--stop-wash)] px-1.5 text-[12px] font-medium whitespace-nowrap text-[var(--stop)]">
        Quá hạn {overdueDays} ngày
      </span>
    )
  }
  if (!dueOn) return null
  return (
    <span className="inline-flex h-5 items-center rounded-[var(--radius-sm)] border border-[var(--act-line)] bg-[var(--act-wash)] px-1.5 text-[12px] font-medium whitespace-nowrap text-[var(--act-text)]">
      Hạn <span className="ml-1 font-mono tabular-nums">{dm(dueOn)}</span>
    </span>
  )
}
