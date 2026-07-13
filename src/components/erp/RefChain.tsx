import Link from 'next/link'

/**
 * Chuỗi liên kết chứng từ — hiện quan hệ cha→con dạng chip (vd Đơn hàng → LSX → PO).
 * Làm rõ "chứng từ này thuộc về đâu" ngay đầu màn chi tiết & trong bảng.
 * Node cuối (current) là chứng từ đang xem — tô accent.
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
  return (
    <div className={`flex flex-wrap items-center ${sm ? 'gap-1.5' : 'gap-2.5'}`}>
      {nodes.map((n, i) => (
        <div key={i} className="flex items-center gap-2.5">
          {i > 0 && (
            <span
              className={`text-zinc-300 dark:text-zinc-600 ${sm ? 'text-xs' : 'text-base'}`}
            >
              →
            </span>
          )}
          <Chip node={n} sm={sm} />
        </div>
      ))}
    </div>
  )
}

function Chip({ node, sm }: { node: ChainNode; sm: boolean }) {
  if (sm) {
    // Gọn cho bảng: mã mono + tô accent nếu current, link nếu có href.
    const cls = node.current
      ? 'font-mono text-xs font-semibold text-violet-600 dark:text-violet-400'
      : 'font-mono text-xs text-zinc-500 dark:text-zinc-400'
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
    ? 'border-violet-400 bg-violet-50 dark:border-violet-500/60 dark:bg-violet-950/40'
    : 'border-zinc-200 bg-zinc-50 hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900/60'
  const body = (
    <>
      <span className="text-[10px] font-semibold tracking-wide text-zinc-400 uppercase dark:text-zinc-500">
        {node.label}
      </span>
      <span
        className={`font-mono text-[13px] font-semibold ${
          node.current
            ? 'text-violet-600 dark:text-violet-400'
            : 'text-zinc-700 dark:text-zinc-200'
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
