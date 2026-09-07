import { Breadcrumbs, type Crumb } from './Breadcrumbs'

export function PageHeader({
  breadcrumbs,
  title,
  description,
  actions,
  meta,
}: {
  breadcrumbs?: Crumb[]
  title: string
  description?: string
  /** Nút chính (bên phải). VD: "+ Thêm mới", "Export CSV". */
  actions?: React.ReactNode
  /** Info bar dưới title: badge, số liệu tóm tắt inline. */
  meta?: React.ReactNode
}) {
  return (
    <div className="border-b pb-4">
      {breadcrumbs && breadcrumbs.length > 0 && (
        <div className="mb-2">
          <Breadcrumbs items={breadcrumbs} />
        </div>
      )}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="t-display">{title}</h1>
          {description && (
            <p className="text-muted-foreground mt-0.5 text-sm">{description}</p>
          )}
          {meta && <div className="mt-2 flex flex-wrap items-center gap-2">{meta}</div>}
        </div>
        {actions && (
          /*
            flex-wrap + max-w-full (07/09/2026): shrink-0 đơn thuần khiến hàng
            nút đẩy cả trang tràn ngang ở 375px (đo được scrollWidth 781 trên
            màn bảng kê). Dưới sm cho nút xuống dòng; từ sm giữ nguyên nếp cũ
            là khối nút không co.
          */
          <div className="flex max-w-full flex-wrap items-center gap-2 sm:shrink-0">
            {actions}
          </div>
        )}
      </div>
    </div>
  )
}
