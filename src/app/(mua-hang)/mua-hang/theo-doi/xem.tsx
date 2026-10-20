import Link from 'next/link'

/**
 * CÔNG TẮC CÁCH XEM của Theo dõi đơn hàng (01/10/2026, bản vẽ G3): Đang về ·
 * Đã về. Hai câu hỏi khác nhau — "cái gì sắp tới" và "cái gì vừa tới, ổn
 * không" — nên hai route (mỗi cái giữ bộ lọc, phạm vi, link chia sẻ riêng);
 * công tắc chỉ là hai đường dẫn. Chuyến hàng KHÔNG là cách xem thứ ba: nó nằm
 * trong Đang về (chủ dự án chốt).
 */
export function XemTheoDoi({ at }: { at: 'dang-ve' | 'da-ve' }) {
  const items = [
    { key: 'dang-ve', href: '/mua-hang/theo-doi', label: 'Đang về' },
    { key: 'da-ve', href: '/mua-hang/theo-doi/da-ve', label: 'Đã về' },
  ] as const
  return (
    <nav
      aria-label="Cách xem theo dõi đơn hàng"
      className="inline-flex h-[var(--chip-h)] shrink-0 overflow-hidden rounded-[13px] border border-[var(--line)] bg-[var(--surface-card)]"
    >
      {items.map((it) => {
        const on = it.key === at
        return (
          <Link
            key={it.key}
            href={it.href}
            aria-current={on ? 'page' : undefined}
            className={
              on
                ? 'text-k-sm flex items-center bg-[var(--act)] px-3 font-semibold text-[var(--act-ink)]'
                : 'text-k-sm flex items-center px-3 text-[var(--ink-2)] hover:bg-[var(--surface-hover)]'
            }
          >
            {it.label}
          </Link>
        )
      })}
    </nav>
  )
}
