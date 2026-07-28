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

/**
 * Màu chỉ dùng để PHÂN MIỀN, không để trang trí: mỗi sắc = một lĩnh vực, giữ
 * nguyên qua cả 5 tab, nên liếc màu là biết đang đọc phần của ai. Số liệu và
 * chữ vẫn trung tính — tô màu con số chỉ làm loãng chỗ cần đọc kỹ.
 *
 *   sky     đo lường / kích thước      violet  catalogue, thương mại
 *   amber   đóng gói, xếp cont         emerald xưởng, sản xuất
 *   slate   ghi chú, không thuộc miền nào
 */
export type Tone = 'sky' | 'amber' | 'violet' | 'emerald' | 'slate'

export const TONE: Record<Tone, string> = {
  sky: 'bg-sky-50 text-sky-600 dark:bg-sky-950/60 dark:text-sky-400',
  amber: 'bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400',
  violet: 'bg-violet-50 text-violet-600 dark:bg-violet-950/60 dark:text-violet-400',
  emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400',
  slate: 'bg-muted text-muted-foreground',
}

/** Ô biểu tượng có nền nhạt ở đầu mỗi thẻ — mốc nhận diện phần đang đọc. */
export function SectionIcon({
  icon: Icon,
  tone = 'slate',
}: {
  icon: React.ComponentType<{ className?: string }>
  tone?: Tone
}) {
  return (
    <span
      aria-hidden
      className={cn(
        'flex size-7 shrink-0 items-center justify-center rounded-md',
        TONE[tone],
      )}
    >
      <Icon className="size-4" />
    </span>
  )
}

export type BandCell = {
  label: string
  /** null = chưa có số. Cả băng cùng rỗng thì băng thu về một dòng mời nhập. */
  value: string | null
  /** Đơn vị in nhỏ cạnh số — tách khỏi `value` để số giữ được cỡ chữ lớn. */
  unit?: string
  /** Chú thích nguồn/cách tính, in mờ dưới nhãn. */
  sub?: string
}

/**
 * Băng số — chỗ DUY NHẤT trên trang hồ sơ dùng cỡ chữ lớn, dành cho bộ số cả
 * nhà máy chạy theo (kích thước, khối lượng, xếp cont). Mọi thứ khác giữ nhỏ.
 *
 * Rỗng sạch thì KHÔNG in một dãy "—" cỡ 20px: thư viện có 537 SP mà chỉ 12 SP
 * gõ quy cách tay, in dấu gạch to bằng số thật biến trang thành bãi trống và
 * làm người đọc mất niềm tin vào cả những băng CÓ số. Thay bằng một dòng mời
 * nhập, cao bằng 1/3.
 */
export function NumberBand({
  icon: Icon,
  tone,
  title,
  hint,
  cells,
  href,
  hrefLabel = 'Xem chi tiết',
  emptyText,
}: {
  icon: React.ComponentType<{ className?: string }>
  tone?: Tone
  title: string
  hint?: string
  cells: BandCell[]
  href?: string
  hrefLabel?: string
  /** Câu hiện khi cả băng chưa có số nào. */
  emptyText?: string
}) {
  const filled = cells.filter((c) => c.value).length
  return (
    <Card className="gap-0 overflow-hidden py-0">
      <div className="flex items-center gap-2.5 px-5 pt-4 pb-3">
        <SectionIcon icon={Icon} tone={tone} />
        <h2 className="text-sm font-semibold">{title}</h2>
        {hint && (
          <span className="text-muted-foreground hidden text-xs sm:inline">· {hint}</span>
        )}
        {href && (
          <Link
            href={href}
            className="text-primary focus-visible:ring-ring ml-auto inline-flex shrink-0 items-center gap-1 rounded text-xs font-medium hover:underline focus-visible:ring-2 focus-visible:outline-none"
          >
            {hrefLabel} <ArrowRight className="size-3.5" />
          </Link>
        )}
      </div>

      {filled === 0 ? (
        <p className="text-muted-foreground border-t px-5 py-3 text-xs">
          {emptyText ?? 'Chưa có số nào.'}
        </p>
      ) : (
        /* gap-px trên nền border = kẻ hairline giữa các ô, đúng cả khi xuống dòng */
        <div
          className="bg-border grid gap-px border-t"
          style={{
            gridTemplateColumns: `repeat(auto-fit, minmax(min(9.5rem, 100%), 1fr))`,
          }}
        >
          {cells.map((c) => (
            <div key={c.label} className="bg-card px-5 py-3.5">
              <div className="flex items-baseline gap-1">
                <span
                  className={cn(
                    // Mobile 2 cột: chuỗi "755 × 1425 × 750" ở text-lg tràn ô
                    // và bị cắt — hạ một nấc cho vừa, desktop giữ cỡ lớn.
                    'truncate text-base leading-tight font-semibold tracking-tight tabular-nums sm:text-lg',
                    !c.value && 'text-muted-foreground/40',
                  )}
                  title={c.value ?? undefined}
                >
                  {c.value || '—'}
                </span>
                {c.value && c.unit && (
                  <span className="text-muted-foreground shrink-0 text-xs">{c.unit}</span>
                )}
              </div>
              <div className={cn(EYEBROW, 'mt-1')}>{c.label}</div>
              {c.sub && (
                <div className="text-muted-foreground/70 mt-0.5 text-[10px]">{c.sub}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

/** Thẻ thông số dạng nhãn — giá trị. Chỉ ẩn cả thẻ khi rỗng sạch VÀ không sửa được. */
export function SpecSection({
  icon: Icon,
  tone,
  title,
  hint,
  fields,
  onEdit,
  editing,
  moreHref,
  moreLabel = 'Xem chi tiết',
}: {
  icon: React.ComponentType<{ className?: string }>
  tone?: Tone
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
      <div className="flex items-center gap-2.5 px-5 pt-4 pb-3">
        <SectionIcon icon={Icon} tone={tone} />
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
  tone,
  title,
  blocks,
  onEdit,
  editing,
}: {
  icon: React.ComponentType<{ className?: string }>
  tone?: Tone
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
      <div className="flex items-center gap-2.5 px-5 pt-4 pb-3">
        <SectionIcon icon={Icon} tone={tone} />
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
