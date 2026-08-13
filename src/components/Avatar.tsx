function initials(name: string | null, email: string) {
  const src = (name ?? email).trim()
  const parts = src.split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

// Deterministic hue so the same person always gets the same color.
function hue(seed: string): number {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return h % 360
}

export function Avatar({
  name,
  email,
  size = 'md',
  src,
}: {
  name: string | null
  email: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  /** URL ảnh đã ký (xem `accountService.avatarUrl`). Không có → chữ cái đầu. */
  src?: string | null
}) {
  const px = size === 'sm' ? 28 : size === 'lg' ? 48 : size === 'xl' ? 72 : 36
  const text = initials(name, email)
  const h = hue(email)

  if (src) {
    // Dùng <img> chứ không next/image: URL ký từ Supabase Storage đổi mỗi giờ,
    // ảnh vốn đã nhỏ (≤72px) nên chẳng còn gì để tối ưu, mà next/image thì buộc
    // khai remotePatterns cho host Storage.
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        aria-hidden
        width={px}
        height={px}
        className="shrink-0 rounded-full object-cover"
        style={{ width: px, height: px }}
      />
    )
  }

  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white"
      style={{
        width: px,
        height: px,
        background: `hsl(${h} 60% 45%)`,
        fontSize: px * 0.4,
      }}
    >
      {text}
    </span>
  )
}
