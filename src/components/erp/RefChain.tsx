import Link from 'next/link'

/**
 * Chuỗi liên kết chứng từ — hiện quan hệ cha→con dạng chip (vd Đơn hàng → LSX → PO).
 * Làm rõ "chứng từ này thuộc về đâu" ngay đầu màn chi tiết & trong bảng.
 * Node cuối (current) là chứng từ đang xem — tô màu hành động (--primary),
 * không còn violet riêng: một màu nhấn duy nhất toàn app.
 */
export type ChainNode = {
  /** Nhãn loại chứng từ, vd 'Đơn hàng', 'Lệnh SX'. */
  label: string
  /** Mã chứng từ, vd 'DH-2026-0003'. */
  value: string
  /** Link tới chứng từ (bỏ trống = không click được). */
  href?: string
  /** Đây là chứng từ đang xem (tô accent, không link). */
  current?: boolean
}

export function RefChain({
  nodes,
  size = 'md',
}: {
  nodes: ChainNode[]
  /** 'sm' cho trong bảng (1 dòng gọn), 'md' cho đầu màn chi tiết. */
  size?: 'sm' | 'md'
}) {
  const sm = size === 'sm'
  // sm (trong bảng): xếp DỌC, không mũi tên — tránh xuống hàng lộn xộn ở cột hẹp.
  if (sm) {
    return (
      <div className="flex flex-col gap-0.5 leading-tight">
        {nodes.map((n, i) => (
          <Chip key={i} node={n} sm />
        ))}
      </div>
    )
  }
  // md (đầu màn chi tiết): xếp ngang có mũi tên.
  return (
    <div className="flex flex-wrap items-center gap-2.5">
      {nodes.map((n, i) => (
        <div key={i} className="flex items-center gap-2.5">
          {i > 0 && <span className="text-border text-base">→</span>}
          <Chip node={n} sm={false} />
        </div>
      ))}
    </div>
  )
}

function Chip({ node, sm }: { node: ChainNode; sm: boolean }) {
  if (sm) {
    // Gọn cho bảng: mã mono + tô accent nếu current, link nếu có href.
    const cls = node.current
      ? 'font-mono text-xs font-semibold text-[var(--primary)]'
      : 'font-mono text-xs text-muted-foreground'
    return node.href && !node.current ? (
      <Link href={node.href} className={`${cls} hover:underline`}>
        {node.value}
      </Link>
    ) : (
      <span className={cls}>{node.value}</span>
    )
  }

  const base =
    'flex flex-col gap-0.5 rounded-lg border px-3 py-2 min-w-0 transition-colors'
  const tone = node.current
    ? 'border-[var(--primary)]/40 bg-[var(--accent)]'
    : 'bg-muted/60 hover:border-[var(--primary)]/30'
  const body = (
    <>
      <span className="t-label text-muted-foreground">{node.label}</span>
      <span
        className={`font-mono text-[13px] font-semibold ${
          node.current ? 'text-[var(--primary)]' : 'text-foreground'
        }`}
      >
        {node.value}
      </span>
    </>
  )
  return node.href && !node.current ? (
    <Link href={node.href} className={`${base} ${tone}`}>
      {body}
    </Link>
  ) : (
    <div className={`${base} ${tone}`}>{body}</div>
  )
}
