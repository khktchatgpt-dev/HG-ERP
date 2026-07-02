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
}: {
  name: string | null
  email: string
  size?: 'sm' | 'md' | 'lg'
}) {
  const px = size === 'sm' ? 28 : size === 'lg' ? 48 : 36
  const text = initials(name, email)
  const h = hue(email)
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
