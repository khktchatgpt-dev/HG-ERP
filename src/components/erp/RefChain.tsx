import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

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
  /*
   * md (đầu màn chi tiết): NGANG ở màn rộng, DỌC ở màn hẹp (04/09/2026).
   *
   * Bản cũ chỉ có `flex-wrap`: đo trên 375px thì chuỗi gãy giữa chừng và mũi
   * tên rơi xuống ĐẦU dòng sau, đứng lẻ trước một chip — đọc như thể có một
   * chứng từ cha vô hình. Xếp dọc và xoay mũi tên xuống thì chuỗi cha→con vẫn
   * đọc được theo đúng chiều, không cần thu nhỏ gì.
   */
  return (
    <div className="flex flex-col items-start gap-1.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2.5">
      {nodes.map((n, i) => (
        <div key={i} className="flex w-full items-center gap-2 sm:w-auto sm:gap-2.5">
          {/* Icon lucide, KHÔNG phải ký tự "→" (04/09/2026). Ký tự mũi tên vẽ
              theo font đang có trên máy nên mỗi máy một nét, không ăn stroke
              1.8 như mọi icon khác, và không co theo cỡ chữ. Cùng luật đã dọn
              "⚠" ở thẻ nhóm và "→" ở cột ngày bên `/planning/lsx`. */}
          {i > 0 && (
            <ChevronRight
              className="text-muted-foreground/50 size-4 shrink-0 rotate-90 sm:rotate-0"
              strokeWidth={1.8}
              aria-hidden
            />
          )}
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

  /*
   * Màn hẹp: nhãn và mã nằm CÙNG một dòng (04/09/2026). Dạng hai dòng ăn ~54px
   * mỗi chip, chuỗi ba mắt là 160px chỉ để nói đơn này thuộc về đâu — trên
   * điện thoại đó là một phần năm màn hình. Cùng thông tin, một dòng đọc vẫn
   * đủ vì nhãn ngắn ("Lệnh SX", "Đơn hàng").
   */
  const base =
    'flex min-w-0 flex-1 items-baseline gap-2 rounded-lg border px-2.5 py-1.5 transition-colors sm:flex-none sm:flex-col sm:items-stretch sm:gap-0.5 sm:px-3 sm:py-2'
  const tone = node.current
    ? 'border-[var(--primary)]/40 bg-[var(--accent)]'
    : 'bg-muted/60 hover:border-[var(--primary)]/30'
  const body = (
    <>
      <span className="t-label text-muted-foreground shrink-0">{node.label}</span>
      <span
        className={`truncate font-mono text-[13px] font-semibold ${
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
