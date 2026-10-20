'use client'

/**
 * LỚP TOKEN CỦA KIT cho khu Sản xuất — cùng cách khu Mua hàng và khu Giám đốc
 * đã làm.
 *
 * `WorkspaceShell` gắn `.theme-v3` ở gốc (sidebar, thanh trên), còn màn mới
 * đọc token của `.kit`; thiếu lớp này thì `--act`, `--line`, `--surface-card`
 * rỗng và cả màn mất màu.
 *
 * HAI LỚP TOKEN LỒNG NHAU LÀ CÓ CHỦ Ý: `.theme-v3` phủ KHUNG, `.kit` phủ NỘI
 * DUNG. Luật "một file một hệ" của CLAUDE.md nói về file MÀN HÌNH — vỏ và nội
 * dung là hai file khác nhau.
 */
export function KitFrame({ children }: { children: React.ReactNode }) {
  return <div className="kit flex min-h-0 flex-1 flex-col">{children}</div>
}
