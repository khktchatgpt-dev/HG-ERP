import { Badge as ShadcnBadge } from '@/components/shadcn/badge'
import { cn } from '@/lib/utils'

/**
 * NHÃN TRẠNG THÁI — nay là lớp mỏng trên `shadcn/badge`.
 *
 * Trước đây đây là một component tự viết với bảng sáu màu pastel gõ cứng
 * (`bg-amber-100 text-amber-800`…), sống song song với `components/shadcn/badge`
 * mà 33 tệp khác đang dùng. Hai nhãn cùng nghĩa, hai hình thù, tuỳ tệp nào gọi
 * cái nào — đó là một trong ba hệ giao diện đang chồng lên nhau trong dự án.
 *
 * Giữ NGUYÊN API `tone` để 45 tệp đang gọi không phải sửa dòng nào; chỉ đổi
 * ruột: màu lấy từ token (`--warn`/`--stop`/`--done`/`--primary`) thay vì bảng
 * Tailwind cố định, nên nhãn tự khớp chủ đề và tự đúng ở cả nền sáng lẫn tối.
 *
 * Dạng NỀN NHẠT chứ không đặc: nhãn nằm xen trong bảng dày, tô đặc một loạt ô
 * emerald thì bảng thành đèn nháy và chữ quanh nó hết đọc được. Màu đặc để dành
 * cho nút — thứ người ta bấm.
 */

export type BadgeTone = 'gray' | 'blue' | 'green' | 'amber' | 'red' | 'purple'

/**
 * `blue` và `purple` cùng trỏ về `--primary` khi gom sáu màu nhấn về một. Hai
 * tên tone vẫn giữ để 45 chỗ gọi không phải sửa, nhưng chúng vẽ ra như nhau —
 * ai thêm mới thì dùng `blue`, `purple` là di sản.
 */
const TONE: Record<BadgeTone, string> = {
  gray: 'bg-muted text-muted-foreground border-transparent',
  blue: 'border-transparent bg-[color-mix(in_srgb,var(--primary)_12%,transparent)] text-[var(--primary)]',
  purple:
    'border-transparent bg-[color-mix(in_srgb,var(--primary)_12%,transparent)] text-[var(--primary)]',
  green:
    'border-transparent bg-[color-mix(in_srgb,var(--done)_14%,transparent)] text-[var(--done)]',
  amber:
    'border-transparent bg-[color-mix(in_srgb,var(--warn)_14%,transparent)] text-[var(--warn)]',
  red: 'border-transparent bg-[color-mix(in_srgb,var(--stop)_14%,transparent)] text-[var(--stop)]',
}

export function Badge({
  children,
  tone = 'gray',
  className,
}: {
  children: React.ReactNode
  tone?: BadgeTone
  className?: string
}) {
  return (
    <ShadcnBadge className={cn('rounded-full', TONE[tone], className)}>
      {children}
    </ShadcnBadge>
  )
}
