export function Spinner({
  size = 'md',
  className = '',
}: {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const px = size === 'sm' ? 14 : size === 'lg' ? 28 : 20
  return (
    <span
      role="status"
      aria-label="Đang tải"
      className={`inline-block animate-spin rounded-full border-2 border-current border-r-transparent text-zinc-400 ${className}`}
      style={{ width: px, height: px }}
    />
  )
}

/** Full-area spinner for Suspense / loading screens. */
export function PageSpinner({ label }: { label?: string }) {
  return (
    <div className="flex min-h-[200px] flex-col items-center justify-center gap-3 text-sm text-zinc-500">
      <Spinner size="lg" />
      {label && <span>{label}</span>}
    </div>
  )
}
