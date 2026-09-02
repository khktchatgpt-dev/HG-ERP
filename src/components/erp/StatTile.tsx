'use client'

import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * THẺ SỐ BẤM ĐƯỢC — "số và lối đi là một" (mẫu /design-lab mục Màn hình mẫu).
 *
 * Lên kit 03/09/2026. Trước đó `PoFilters.tsx` tự dựng `StatBtn`, và mỗi màn
 * mới lại chép thêm một bản — đúng cơ chế làm giao diện so le mà `FilterChip`
 * đã phải dọn một lần. Ba chỗ dùng ngay: Kho & tồn, Vật tư theo lệnh, Đơn mua
 * của lệnh.
 *
 * KHÁC `StatsBar` ở chỗ nào: StatsBar là dải số ĐỌC, dày và im. Thẻ này là số
 * ĐỘNG TAY ĐƯỢC — bấm để lọc đúng nhóm nó đang đếm. Màn nào có bộ lọc tương ứng
 * với con số thì dùng thẻ này; màn chỉ báo cáo thì vẫn StatsBar.
 *
 * Màu: `tone` chỉ tô CON SỐ (vòng đời dữ liệu — warn/stop/done), còn viền
 * "đang chọn" luôn là `--primary`. Luật theme v3: trạng thái điều khiển không
 * mượn màu vòng đời — cùng lý do `FilterChip` đã bỏ tone amber/red.
 */

export type StatTone = 'default' | 'primary' | 'warn' | 'stop' | 'done'

const VALUE_COLOR: Record<StatTone, string | undefined> = {
  default: undefined,
  primary: 'var(--primary)',
  warn: 'var(--warn)',
  stop: 'var(--stop)',
  done: 'var(--done)',
}

export function StatTile({
  label,
  value,
  hint,
  tone = 'default',
  icon: Icon,
  active = false,
  onClick,
  title,
}: {
  label: string
  value: number | string
  /** Một dòng phụ dưới số — nói rõ số này nghĩa là gì khi nhãn quá ngắn. */
  hint?: string
  tone?: StatTone
  icon?: LucideIcon
  active?: boolean
  /** Có onClick = thẻ lọc; không có = thẻ đọc. */
  onClick?: () => void
  title?: string
}) {
  const body = (
    <>
      <p className="t-label text-muted-foreground flex items-center gap-1.5 truncate">
        {Icon && <Icon size={14} strokeWidth={active ? 2.1 : 1.8} />}
        {label}
      </p>
      <p
        className="mt-1.5 font-mono text-[22px] leading-none font-semibold tabular-nums"
        style={{ color: VALUE_COLOR[tone] }}
      >
        {value}
      </p>
      {hint && (
        <p className="text-muted-foreground mt-1.5 truncate text-[11px]">{hint}</p>
      )}
    </>
  )

  const base = 'bg-card rounded-xl border px-3.5 py-3 text-left transition-colors'
  if (!onClick) {
    return (
      <div className={base} title={title}>
        {body}
      </div>
    )
  }

  // Rổ rỗng vẫn BÀY ra nhưng mờ và không bấm được — ẩn đi thì hàng thẻ nhảy chỗ
  // mỗi lần dữ liệu đổi, và người dùng tưởng bộ lọc đó không tồn tại.
  const empty = value === 0 && !active
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={empty}
      aria-pressed={active}
      title={title}
      className={cn(
        base,
        active
          ? 'border-[var(--primary)] bg-[var(--accent)]/60'
          : empty
            ? 'cursor-default opacity-55'
            : 'hover:border-[var(--primary)]/40',
      )}
    >
      {body}
    </button>
  )
}

/** Lưới thẻ số — giữ cùng nhịp cột ở mọi màn. */
export function StatTiles({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{children}</div>
}
