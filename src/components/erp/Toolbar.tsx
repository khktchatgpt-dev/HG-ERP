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
  onEnter,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  icon?: string
  className?: string
  /**
   * Có onEnter = tìm ở SERVER, chỉ chạy khi bấm Enter.
   * Danh sách lớn (13k vật tư) mà tìm theo từng phím là mỗi ký tự một vòng
   * server + một lượt đếm lại; gõ "thép hộp" là 8 vòng cho một lần tìm.
   */
  onEnter?: () => void
}) {
  return (
    <div className={`relative ${className}`}>
      {icon && (
        <span className="absolute top-1/2 left-2 -translate-y-1/2 text-xs text-zinc-400">
          {icon}
        </span>
      )}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && onEnter) {
            e.preventDefault()
            onEnter()
          }
        }}
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
