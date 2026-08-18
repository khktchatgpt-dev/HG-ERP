export function EmptyState({
  icon = '◌',
  title,
  description,
  action,
}: {
  /** Ký tự (◌, ▦…) hoặc một icon component — cả hai đều là ReactNode. */
  icon?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
      <div className="bg-muted text-muted-foreground grid h-14 w-14 place-items-center rounded-xl text-2xl [&_svg]:size-6">
        {icon}
      </div>
      <h3 className="t-title mt-2">{title}</h3>
      {description && (
        <p className="text-muted-foreground max-w-md text-xs">{description}</p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
