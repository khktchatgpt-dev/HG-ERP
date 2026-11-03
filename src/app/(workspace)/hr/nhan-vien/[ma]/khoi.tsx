import type { ReactNode } from 'react'

/**
 * Khối nhãn – giá trị kiểu kit cho tab Lương (còn kit, chưa có việc chạm tới). Tab Thông tin (B4)
 * không dùng file này — nó có lưới riêng trong hs.css.
 */
export function Khoi({ ten, children }: { ten: string; children: ReactNode }) {
  return (
    <section
      aria-label={ten}
      className="border-b border-[var(--line)] px-[var(--gutter)] py-2.5"
    >
      <div className="text-k-label mb-2 font-semibold tracking-[.05em] text-[var(--ink-3)] uppercase">
        {ten}
      </div>
      {children}
    </section>
  )
}

export function Dong({ nhan, children }: { nhan: string; children: ReactNode }) {
  return (
    <>
      <span className="text-[var(--ink-3)]">{nhan}</span>
      <div className="min-w-0">{children}</div>
    </>
  )
}

export const LUOI =
  'text-k-sm grid grid-cols-[140px_minmax(0,1fr)] items-center gap-x-3 gap-y-1.5'
