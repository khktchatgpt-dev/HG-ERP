'use client'

import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * CHIP LỌC — công tắc bật/tắt một bộ lọc, kèm số lượng khớp.
 *
 * Lên kit 02/09/2026. Trước đó mỗi màn tự dựng một bản (`ToggleChip` trong
 * `planning/pos/PoFilters.tsx`), và hai bản dựng riêng thì sớm muộn lệch nhau —
 * đúng cơ chế làm giao diện "so le" mà cổng lint đang chặn.
 *
 * KHÁC bản gốc một điểm có chủ ý: bỏ `tone` amber/red. Bản cũ tô nền
 * `--warn`/`--stop` cho chip đang chọn, tức lấy màu VÒNG ĐỜI đi mã hoá TRẠNG
 * THÁI ĐIỀU KHIỂN. Luật của theme v3: `--warn/--stop/--done` chỉ nói về vòng
 * đời dữ liệu; đang-chọn là hành động, nên nó ăn `--primary`. Muốn nói "rổ này
 * gấp" thì dùng icon hoặc con số, đừng mượn màu.
 */
export function FilterChip({
  label,
  count,
  active,
  onClick,
  icon: Icon,
  title,
}: {
  label: string
  /** Số bản ghi khớp. 0 + chưa chọn = chip mờ, không bấm được. */
  count?: number
  active: boolean
  onClick: () => void
  icon?: LucideIcon
  /** Giải thích ý nghĩa bộ lọc — chip chữ ngắn nên thường cần. */
  title?: string
}) {
  const base =
    'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-medium transition-colors'

  // Rổ rỗng mà không đang chọn thì không có gì để bấm vào. Vẫn BÀY ra (không
  // ẩn) để người dùng thấy rổ đó tồn tại và đang bằng 0 — ẩn đi thì họ tưởng
  // thiếu bộ lọc.
  if (count === 0 && !active) {
    return (
      <span
        className={cn(base, 'border-border/60 bg-card text-muted-foreground/40')}
        title={title}
      >
        {Icon && <Icon size={14} strokeWidth={1.8} />}
        {label}
        <Count n={0} active={false} />
      </span>
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={title}
      className={cn(
        base,
        active
          ? 'border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)]'
          : 'border-border bg-card hover:border-foreground/30 text-foreground/75',
      )}
    >
      {Icon && <Icon size={14} strokeWidth={active ? 2.1 : 1.8} />}
      {label}
      {count != null && <Count n={count} active={active} />}
    </button>
  )
}

function Count({ n, active }: { n: number; active: boolean }) {
  return (
    <span
      className={cn(
        'rounded-full px-1.5 font-mono text-[11px] tabular-nums',
        active ? 'bg-white/25' : 'bg-muted',
      )}
    >
      {n}
    </span>
  )
}
