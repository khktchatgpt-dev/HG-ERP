import type { ReactNode } from 'react'
import {
  Card as UiCard,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/shadcn/card'

/**
 * Thành phần trình bày nhỏ của OrderForm (thẻ, nhãn trường, nhãn dòng, tab) —
 * tách ra 07/10/2026 để OrderForm không vượt trần dòng riêng (size-baseline).
 * Không state, không gọi API.
 */

export function Card({
  title,
  right,
  children,
}: {
  title: string
  right?: ReactNode
  children: ReactNode
}) {
  return (
    <UiCard>
      <CardHeader>
        {/* Tiêu đề thẻ là CHỮ THẬT (14px, đậm, màu chữ chính) chứ không phải caps
            11px xám: cả trang trước đây mọi tiêu đề cùng một sắc xám nhạt nên
            không thẻ nào nổi lên được. */}
        <CardTitle className="t-title">{title}</CardTitle>
        {right && (
          <div className="col-start-2 row-span-2 row-start-1 self-center">{right}</div>
        )}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </UiCard>
  )
}

/**
 * Nhãn trường của form. `strong` = trường Sales phải để mắt (hạn giao, số
 * lượng…) — nhãn đậm lên để mắt bắt được trước, thay vì mọi nhãn một sắc như cũ.
 */
export function L({
  label,
  span2,
  strong,
  children,
}: {
  label: string
  span2?: boolean
  strong?: boolean
  children: ReactNode
}) {
  return (
    <label
      className={`grid gap-1.5 ${span2 ? 'sm:col-span-2 lg:col-span-4 xl:col-span-1' : ''}`}
    >
      {/* Bậc `t-label` của thang chữ v3 — 11px hoa, giãn chữ 0.04em. Trước là
          14px thường nên nhãn và giá trị cùng một cỡ, mắt không tách được đâu
          là câu hỏi đâu là câu trả lời. */}
      <span className={`t-label ${strong ? 'text-foreground' : 'text-muted-foreground'}`}>
        {label}
      </span>
      {children}
    </label>
  )
}

export function LineField({
  label,
  strong,
  children,
}: {
  label: string
  strong?: boolean
  children: ReactNode
}) {
  return (
    <label className="flex flex-col gap-1">
      {/* Ở khổ rộng nhãn nằm ở hàng tiêu đề cột, in lại trên từng dòng là thừa —
          nhưng vẫn giữ trong DOM cho trình đọc màn hình (`sr-only`). */}
      <span
        className={`t-label xl:sr-only ${strong ? 'text-foreground' : 'text-muted-foreground'}`}
      >
        {label}
      </span>
      {children}
    </label>
  )
}

export function Tab({
  on,
  onClick,
  children,
}: {
  on: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded px-3 py-1.5 text-sm font-medium transition-colors ${
        on
          ? 'bg-card text-foreground shadow-xs'
          : 'text-muted-foreground hover:text-foreground'
      }`}
    >
      {children}
    </button>
  )
}
