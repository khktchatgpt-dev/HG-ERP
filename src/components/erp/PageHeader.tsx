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
    <div className="border-b border-zinc-200 pb-4 dark:border-zinc-800">
      {breadcrumbs && breadcrumbs.length > 0 && (
        <div className="mb-2">
          <Breadcrumbs items={breadcrumbs} />
        </div>
      )}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold sm:text-xl">{title}</h1>
          {description && (
            <p className="mt-0.5 text-sm text-zinc-500">{description}</p>
          )}
          {meta && <div className="mt-2 flex flex-wrap items-center gap-2">{meta}</div>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
    </div>
  )
}
