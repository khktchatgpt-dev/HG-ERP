import Link from 'next/link'

/**
 * CÔNG TẮC CÁCH XEM của trang Đơn mua (01/10/2026): Tất cả đơn · Đang về.
 *
 * Màn "Nhận hàng" cũ nằm riêng một mục menu mà chỉ là đúng tập đơn đã gửi NCC
 * xếp theo ngày hẹn — cùng dữ liệu với Kho › Hàng về và ba làn của Hộp thư.
 * Chủ dự án duyệt gộp nó vào Đơn mua thành một CÁCH XEM (bản vẽ "Cung ứng ·
 * Hàng về", artboard C2). Hai cách xem là hai route để mỗi cái giữ bộ lọc,
 * phạm vi và link chia sẻ riêng; công tắc chỉ là hai đường dẫn.
 *
 * "Đã về" sẽ là nút thứ ba ở bước sau (bản vẽ D1).
 */
export function XemDonSwitch({ at }: { at: 'tat-ca' | 'dang-ve' }) {
  const items = [
    { key: 'tat-ca', href: '/mua-hang/don', label: 'Tất cả đơn' },
    { key: 'dang-ve', href: '/mua-hang/don/dang-ve', label: 'Đang về' },
  ] as const
  return (
    <nav
      aria-label="Cách xem đơn mua"
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
