'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { Card } from '@/components/shadcn/card'
import { Separator } from '@/components/shadcn/separator'
import { cn } from '@/lib/utils'

/**
 * Hai kiểu thẻ hiển thị dùng chung cho các tab hồ sơ sản phẩm.
 *
 * Cả hai hiện ĐỦ mọi trường, ô chưa điền để "—" thay vì ẩn đi: ẩn thì người
 * dùng không biết hồ sơ còn chỗ nào để điền (và tưởng hệ thống mất dữ liệu).
 */

/**
 * Nhãn nhỏ trên mỗi giá trị. Một token duy nhất cho cả trang chi tiết để các
 * thẻ đọc như một tờ phiếu thông số, không phải mỗi thẻ một cỡ chữ.
 */
export const EYEBROW =
  'text-muted-foreground text-[10px] font-medium tracking-[0.12em] uppercase'

/** Thẻ thông số dạng nhãn — giá trị. Chỉ ẩn cả thẻ khi rỗng sạch VÀ không sửa được. */
export function SpecSection({
  icon: Icon,
  title,
  hint,
  fields,
  onEdit,
  editing,
  moreHref,
  moreLabel = 'Xem chi tiết',
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  hint?: string
  /** [nhãn, giá trị, dùng font mono?] */
  fields: [string, string | null | undefined, boolean?][]
  /** Có hàm này thì hiện nút sửa riêng cho phần này. */
  onEdit?: () => void
  /** Form sửa của chính phần này — có thì thay chỗ bảng giá trị, sửa TẠI CHỖ. */
  editing?: React.ReactNode
  /** Thẻ tóm tắt: link sang tab chứa bản đầy đủ (thay cho nút Sửa). */
  moreHref?: string
  moreLabel?: string
}) {
  const filled = fields.filter(([, v]) => v).length
  if (filled === 0 && !onEdit && !moreHref) return null
  return (
    <Card className={cn('gap-0 py-0', editing && 'ring-primary/30 ring-1')}>
      <div className="flex items-center gap-2 px-5 pt-4 pb-3">
        <Icon className="text-muted-foreground size-4" />
        <h2 className="text-sm font-semibold">{title}</h2>
        {hint && <span className="text-muted-foreground text-xs">· {hint}</span>}
        {filled < fields.length && (
          <span className="text-muted-foreground text-xs">
            · thiếu {fields.length - filled}
          </span>
        )}
        {/* Đang sửa thì nút Sửa biến mất — form đã có Huỷ / Lưu của riêng nó. */}
        {onEdit && !editing ? (
          <button
            type="button"
            onClick={onEdit}
            className="text-primary focus-visible:ring-ring ml-auto rounded text-xs font-medium hover:underline focus-visible:ring-2 focus-visible:outline-none"
          >
            Sửa
          </button>
        ) : (
          !editing &&
          moreHref && (
            <Link
              href={moreHref}
              className="text-primary focus-visible:ring-ring ml-auto inline-flex items-center gap-1 rounded text-xs font-medium hover:underline focus-visible:ring-2 focus-visible:outline-none"
            >
              {moreLabel} <ArrowRight className="size-3.5" />
            </Link>
          )
        )}
      </div>
      <Separator />
      {editing ? (
        <div className="px-5 py-4">{editing}</div>
      ) : (
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 px-5 py-4 sm:grid-cols-3">
          {fields.map(([label, value, mono]) => (
            <div key={label} className="flex min-w-0 flex-col gap-0.5">
              <dt className={EYEBROW}>{label}</dt>
              <dd
                className={cn(
                  'text-sm break-words',
                  mono && value && 'font-mono',
                  !value && 'text-muted-foreground/50',
                )}
              >
                {value || '—'}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </Card>
  )
}

/** Gom các khối văn bản dài (mô tả / shipping mark / ghi chú) vào một thẻ. */
export function TextCard({
  icon: Icon,
  title,
  blocks,
  onEdit,
  editing,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  blocks: [string, string | null | undefined][]
  onEdit?: () => void
  /** Form sửa của chính phần này — có thì thay chỗ nội dung, sửa TẠI CHỖ. */
  editing?: React.ReactNode
}) {
  const filled = blocks.filter(([, v]) => v).length
  if (filled === 0 && !onEdit) return null
  return (
    <Card className={cn('gap-0 py-0', editing && 'ring-primary/30 ring-1')}>
      <div className="flex items-center gap-2 px-5 pt-4 pb-3">
        <Icon className="text-muted-foreground size-4" />
        <h2 className="text-sm font-semibold">{title}</h2>
        {filled < blocks.length && (
          <span className="text-muted-foreground text-xs">
            · thiếu {blocks.length - filled}
          </span>
        )}
        {onEdit && !editing && (
          <button
            type="button"
            onClick={onEdit}
            className="text-primary focus-visible:ring-ring ml-auto rounded text-xs font-medium hover:underline focus-visible:ring-2 focus-visible:outline-none"
          >
            Sửa
          </button>
        )}
      </div>
      <Separator />
      {editing ? (
        <div className="px-5 py-4">{editing}</div>
      ) : (
        <div className="flex flex-col gap-3 px-5 py-4">
          {blocks.map(([label, text]) => (
            <div key={label} className="flex flex-col gap-0.5">
              <span className={EYEBROW}>{label}</span>
              <p
                className={cn(
                  'text-sm leading-relaxed whitespace-pre-wrap',
                  !text && 'text-muted-foreground/50',
                )}
              >
                {text || '—'}
              </p>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
