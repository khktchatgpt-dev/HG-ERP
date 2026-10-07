import type { ReactNode } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/shadcn/card'

/**
 * Ô thông tin / khối thông tin của trang chi tiết đơn — tách ra 07/10/2026 để
 * OrderDetailView không vượt trần dòng riêng (size-baseline). Không state.
 */

export function Tile({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 px-4 py-2.5">
      <div className="text-muted-foreground text-[11px] font-medium tracking-wider uppercase">
        {label}
      </div>
      <div className="mt-1">{children}</div>
    </div>
  )
}

/** Một ô thông tin — trả null khi rỗng để khối không bị rỗ dấu gạch. */
export function Info({
  label,
  value,
  wide = false,
}: {
  label: string
  value: string | null
  wide?: boolean
}) {
  if (!value) return null
  return (
    <div className={`flex min-w-0 flex-col ${wide ? 'col-span-2' : ''}`}>
      <span className="text-muted-foreground text-[11px] font-medium tracking-wider uppercase">
        {label}
      </span>
      <span className="text-sm break-words">{value}</span>
    </div>
  )
}

/**
 * Khối thông tin: chỉ vẽ ô có dữ liệu, tên các ô trống dồn xuống một dòng nhỏ.
 * Nhận mảng [nhãn, giá trị] để chỗ gọi khai một lần, không lặp hai lần cho hai
 * nhánh có/không.
 */
export function InfoBlock({
  title,
  fields,
  footer,
}: {
  title: string
  fields: [string, string | null, boolean?][]
  footer?: ReactNode
}) {
  const filled = fields.filter(([, v]) => !!v)
  const missing = fields.filter(([, v]) => !v).map(([l]) => l)
  if (!filled.length && !footer) return null
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3 lg:grid-cols-4">
          {filled.map(([label, value, wide]) => (
            <Info key={label} label={label} value={value} wide={wide} />
          ))}
        </div>
        {missing.length > 0 && (
          <div className="text-muted-foreground border-t pt-2.5 text-xs">
            Chưa khai: {missing.join(' · ')}
          </div>
        )}
        {footer}
      </CardContent>
    </Card>
  )
}
