/**
 * MÃ CHỨNG TỪ — chữ ký thị giác của theme v3 "HG Ledger".
 *
 * Mọi mã phiếu (PO-…, LSX-…, DH-…) hiển thị qua chip này: mono đẳng khoảng trên
 * nền tint màu hành động — nhận ra "đây là một chứng từ, bấm/đọc được" từ xa,
 * và tách hẳn mã khỏi câu chữ xung quanh. Dùng trong bảng, đầu màn chi tiết,
 * dialog, thẻ mobile.
 */
export function DocChip({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <span
      className={`t-data rounded-md bg-[var(--accent)] px-1.5 py-0.5 text-[12px] font-medium text-[var(--accent-foreground)] ${className}`}
    >
      {children}
    </span>
  )
}
