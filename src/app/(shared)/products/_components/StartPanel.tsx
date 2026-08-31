'use client'

import { Clock, FileQuestionMark, ImageOff, Search, Tag } from 'lucide-react'
import type { CustomerNameOption, ProductCounts } from './types'

/** Bao nhiêu nhãn khách được bày sẵn thành lối tắt. Đủ để trúng, chưa thành hàng rào chữ. */
const TOP_CUSTOMERS = 4

/**
 * Màn MỞ ĐẦU của thư viện — hiện khi chưa gõ và chưa lọc gì.
 *
 * Cố ý KHÔNG bày sẵn danh sách sản phẩm: 779 hồ sơ, mà mỗi lượt mở trang lại
 * tốn một truy vấn danh sách + hai truy vấn phụ + tối đa 24 vòng gọi Storage
 * cho ảnh (~1–1,5s mỗi tấm). Hầu hết lần vào đây là để TÌM một mã, không phải
 * để ngắm 24 SP mới nhất — nên trang mở ra là một ô tìm và mấy lối tắt, bấm cái
 * nào mới nạp cái đó.
 *
 * Các lối tắt đều là ĐƯỜNG DẪN có sẵn tham số lọc, không phải nút gọi API riêng
 * — bấm xong URL nói rõ đang xem tập nào và chia sẻ được.
 */
export function StartPanel({
  counts,
  customerNames,
  onPick,
}: {
  counts: ProductCounts
  customerNames: CustomerNameOption[]
  /** Đặt tham số URL — cùng đường với thanh lọc, xem `applyParams`. */
  onPick: (patch: Record<string, string | undefined>) => void
}) {
  // Xếp theo SỐ SP giảm dần, không theo bảng chữ cái: `customerNames` trả về
  // theo tên nên lấy 4 mục đầu là ra ACE/AE/ALPHAMARTS — mấy khách 2–3 mã.
  // Lối tắt phải là chỗ hay tới nhất thì mới đỡ được một lượt gõ.
  const topCustomers = [...customerNames]
    .sort((a, b) => b.count - a.count)
    .slice(0, TOP_CUSTOMERS)

  return (
    <div className="bg-card flex flex-col items-center gap-5 rounded-lg border px-6 py-12 text-center shadow-sm">
      <div className="grid size-12 place-items-center rounded-full bg-[var(--accent)]">
        <Search className="size-6 text-[var(--primary)]" strokeWidth={1.8} />
      </div>

      <div className="flex flex-col gap-1.5">
        <h2 className="t-title">
          Tìm sản phẩm trong{' '}
          <span className="font-mono tabular-nums">{counts.total}</span> hồ sơ
        </h2>
        <p className="text-muted-foreground max-w-md text-sm">
          Gõ mã HG, tên, mã khách đặt hay tên khách vào ô tìm phía trên. Thư viện không
          bày sẵn danh sách để trang mở nhanh và đỡ tải ảnh thừa.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        <Shortcut
          icon={Clock}
          label="Vừa sửa gần đây"
          onClick={() => onPick({ recent: '1' })}
        />
        {counts.bom_none > 0 && (
          <Shortcut
            icon={FileQuestionMark}
            label="Chưa vẽ định mức"
            count={counts.bom_none}
            onClick={() => onPick({ bom: 'none' })}
          />
        )}
        {counts.no_image > 0 && (
          <Shortcut
            icon={ImageOff}
            label="Thiếu ảnh"
            count={counts.no_image}
            onClick={() => onPick({ image: 'missing' })}
          />
        )}
        {topCustomers.map((c) => (
          <Shortcut
            key={c.name}
            icon={Tag}
            label={c.name}
            count={c.count}
            onClick={() => onPick({ customer: c.name })}
          />
        ))}
      </div>
    </div>
  )
}

function Shortcut({
  icon: Icon,
  label,
  count,
  onClick,
}: {
  icon: typeof Search
  label: string
  count?: number
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="bg-background text-muted-foreground focus-visible:ring-ring/50 inline-flex items-center gap-1.5 rounded-full border py-1.5 pr-3 pl-2.5 text-xs font-medium transition-colors hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700 focus-visible:ring-[3px] focus-visible:outline-none dark:hover:border-sky-800 dark:hover:bg-sky-950/40 dark:hover:text-sky-300"
    >
      <Icon className="size-3.5" aria-hidden />
      <span className="max-w-40 truncate">{label}</span>
      {count != null && (
        <span className="text-muted-foreground/60 tabular-nums">{count}</span>
      )}
    </button>
  )
}
