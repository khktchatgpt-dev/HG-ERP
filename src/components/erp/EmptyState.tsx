export function EmptyState({
  icon = '◌',
  title,
  description,
  action,
}: {
  icon?: string
  title: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-full bg-zinc-100 text-2xl text-zinc-400 dark:bg-zinc-900">
        {icon}
      </div>
      <h3 className="text-sm font-medium">{title}</h3>
      {description && (
        <p className="max-w-md text-xs text-zinc-500">{description}</p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
