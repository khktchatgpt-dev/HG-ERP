export function EmptyState({
  icon = '◌',
  title,
  description,
  action,
}: {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-12 text-center dark:border-zinc-700 dark:bg-zinc-950">
      <div aria-hidden className="mx-auto mb-3 text-2xl text-zinc-300 dark:text-zinc-600">
        {icon}
      </div>
      <h3 className="text-sm font-medium">{title}</h3>
      {description && (
        <p className="mx-auto mt-1 max-w-sm text-xs text-zinc-500">{description}</p>
      )}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  )
}
