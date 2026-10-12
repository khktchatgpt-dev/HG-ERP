import Link from 'next/link'

/**
 * Công tắc "Theo mã | Theo lệnh" của màn Tồn kho (Kho đợt 2 · B5, Q1: công tắc
 * trong màn, không thêm mục menu). Là ĐƯỜNG DẪN (`?xem=lenh`) — F5 và gửi link
 * giữ đúng chế độ. Ô đang chọn nền nhạt, không nền đặc (nền đặc = bấm được).
 */
export function XemSwitch({ xem }: { xem: 'ma' | 'lenh' }) {
  const o = (on: boolean) =>
    on
      ? 'bg-[var(--act-wash)] font-semibold text-[var(--act-text)]'
      : 'text-[var(--ink-2)] hover:bg-[var(--surface-hover)]'
  return (
    <span
      role="group"
      aria-label="Xem tồn kho"
      className="text-k-sm inline-flex h-[var(--ctl-h)] items-stretch overflow-hidden rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--surface-card)]"
    >
      <Link
        href="/warehouse/ton"
        aria-current={xem === 'ma' ? 'page' : undefined}
        className={`flex items-center px-2.5 ${o(xem === 'ma')}`}
      >
        Theo mã
      </Link>
      <Link
        href="/warehouse/ton?xem=lenh"
        aria-current={xem === 'lenh' ? 'page' : undefined}
        className={`flex items-center border-l border-[var(--line)] px-2.5 ${o(xem === 'lenh')}`}
      >
        Theo lệnh
      </Link>
    </span>
  )
}
