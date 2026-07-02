/**
 * Filter/action toolbar dense — dùng ngay trên bảng dữ liệu.
 * Style ERP: mỏng, sticky, background trắng, border rõ.
 */
export function Toolbar({
  left,
  right,
  sticky = false,
}: {
  left?: React.ReactNode
  right?: React.ReactNode
  sticky?: boolean
}) {
  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-2 rounded-t-lg border border-b-0 border-zinc-200 bg-zinc-50 px-2 py-1.5 dark:border-zinc-800 dark:bg-zinc-900 ${
        sticky ? 'sticky top-16 z-[5]' : ''
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">{left}</div>
      {right && <div className="flex flex-wrap items-center gap-2">{right}</div>}
    </div>
  )
}

/** Compact filter input dùng trong toolbar */
export function ToolbarInput({
  value,
  onChange,
  placeholder,
  icon,
  className = '',
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  icon?: string
  className?: string
}) {
  return (
    <div className={`relative ${className}`}>
      {icon && (
        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-zinc-400">
          {icon}
        </span>
      )}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 ${
          icon ? 'pl-7' : ''
        }`}
      />
    </div>
  )
}

/** Compact select dùng trong toolbar */
export function ToolbarSelect<T extends string>({
  value,
  onChange,
  options,
  className = '',
}: {
  value: T
  onChange: (v: T) => void
  options: readonly { value: T; label: string }[]
  className?: string
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className={`rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 ${className}`}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}
