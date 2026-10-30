import { todayVn } from '@/lib/date-vn'
import { TASK_STATUS_LABEL, type TaskStatus } from '@/lib/task-flow'

/**
 * ĐỒ DÙNG CHUNG trang "Phân công việc" — VIẾT THẲNG Tailwind + token màu của khung
 * (`.theme-v3`), KHÔNG import `@/components/kit` (chủ dự án chốt 29/10/2026).
 * Một màu hành động (`--primary`), ba màu vòng đời (`--warn` `--stop` `--done`)
 * chỉ lên nhãn trạng thái, không bao giờ lên nút.
 */

/** Nút — cao 28px, chữ 12px. Khoá = nền xám ĐẶC (không opacity: chữ mờ trượt AA). */
export function btn(
  tone: 'primary' | 'normal' | 'ghost',
  locked = false,
  small = false,
): string {
  const base = `inline-flex items-center gap-1.5 rounded-md border px-2.5 text-[12px] whitespace-nowrap ${small ? 'h-6' : 'h-7'}` // prettier-ignore
  if (locked) return `${base} cursor-not-allowed border-[var(--border)] bg-[var(--muted)] text-[var(--muted-foreground)]` // prettier-ignore
  if (tone === 'primary') return `${base} border-[var(--primary)] bg-[var(--primary)] font-semibold text-[var(--primary-foreground)] hover:brightness-110` // prettier-ignore
  if (tone === 'ghost') return `${base} border-transparent bg-transparent font-medium text-[var(--accent-foreground)] hover:bg-[var(--accent)]` // prettier-ignore
  return `${base} border-[var(--input)] bg-[var(--card)] font-medium text-[var(--foreground)] hover:bg-[var(--accent)]` // prettier-ignore
}

export const fieldCls =
  'w-full rounded-md border border-[var(--input)] bg-[var(--card)] px-2 text-[13px] text-[var(--foreground)] placeholder:text-[var(--placeholder)] focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]'

export const labelCls =
  'text-[11px] font-semibold tracking-[0.05em] text-[var(--muted-foreground)] uppercase'

/** dd/mm của một mốc (timestamptz) theo NGÀY VN. */
export function dmVn(at: string): string {
  const d = todayVn(new Date(at))
  return `${d.slice(8, 10)}/${d.slice(5, 7)}`
}

/** Cộng ngày trên 'YYYY-MM-DD' theo lịch. */
export function addDays(iso: string, n: number): string {
  const d = new Date(
    Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10) + n),
  )
  return d.toISOString().slice(0, 10)
}

/** Thứ Hai TỚI (hôm nay là thứ Hai thì là tuần sau). */
export function nextMonday(iso: string): string {
  const dow = new Date(`${iso}T00:00:00Z`).getUTCDay()
  return addDays(iso, (8 - dow) % 7 || 7)
}

/** Bỏ dấu + chữ thường: gõ "phuong" ra "Phương", "ky thuat" ra "Kỹ Thuật". */
export function fold(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
}

type Tone = 'act' | 'warn' | 'stop' | 'done' | 'off'

const TONE_CLS: Record<Tone, string> = {
  act: 'border-[var(--primary)]/30 bg-[var(--accent)] text-[var(--accent-foreground)]',
  warn: 'border-[var(--warn)]/30 bg-[var(--warn)]/10 text-[var(--warn)]',
  stop: 'border-[var(--stop)]/30 bg-[var(--stop)]/10 text-[var(--stop)]',
  done: 'border-[var(--done)]/30 bg-[var(--done)]/10 text-[var(--done)]',
  off: 'border-[var(--border)] bg-[var(--muted)] text-[var(--muted-foreground)]',
}

/** Nhãn vòng đời — chỉ mã hoá trạng thái, không bấm được. */
export function Tag({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex h-5 items-center rounded border px-1.5 text-[12px] font-medium whitespace-nowrap ${TONE_CLS[tone]}`}
    >
      {children}
    </span>
  )
}

/** Tình trạng nhìn từ phía NGƯỜI GIAO. Quá hạn thắng mọi nhãn khác (việc cần đụng tay). */
export function StatusTag({
  status,
  overdueDays,
  late,
}: {
  status: TaskStatus
  overdueDays: number
  /** Số ngày trễ khi đã xong (0 = đúng hạn, null = không hạn). */
  late?: number | null
}) {
  if (overdueDays > 0) return <Tag tone="stop">Quá hạn {overdueDays} ngày</Tag>
  if (status === 'submitted') return <Tag tone="warn">Chờ tôi duyệt</Tag>
  if (status === 'rejected') return <Tag tone="stop">Trả lại · làm tiếp</Tag>
  if (status === 'in_progress') return <Tag tone="act">Đang làm</Tag>
  if (status === 'done') {
    return (
      <Tag tone="done">
        Xong{late == null ? '' : late > 0 ? ` · trễ ${late} ngày` : ' · đúng hạn'}
      </Tag>
    )
  }
  return <Tag tone="off">{TASK_STATUS_LABEL[status]}</Tag>
}

/** Xong trễ mấy ngày so với hạn (theo ngày VN). null = không hạn / chưa xong. */
export function lateDays(due: string | null, completed: string | null): number | null {
  if (!due || !completed) return null
  const ms = (x: string) => Date.UTC(+x.slice(0, 4), +x.slice(5, 7) - 1, +x.slice(8, 10))
  const d = ms(todayVn(new Date(completed))) - ms(todayVn(new Date(due)))
  return Math.max(0, Math.round(d / 86_400_000))
}
