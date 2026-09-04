'use client'

import { useState } from 'react'

/**
 * BẪY PORTAL — vá một lần cho mọi primitive.
 *
 * Radix render Dialog/Popover/Select/DropdownMenu/AlertDialog ra `<body>`, tức
 * NGOÀI wrapper `.theme-v3` mà `WorkspaceShell` đeo ở gốc trang. Token màu khai
 * báo trên wrapper đó không phủ tới, nên content rơi về giá trị của `:root` và
 * ra một hộp lạc tông giữa app.
 *
 * Trước đây mỗi chỗ gọi phải tự nhớ gõ `className="theme-v3 bg-card"`. Đo ngày
 * 02/09/2026: 3/11 `DialogContent` quên — đúng tỉ lệ hỏng của mọi luật dựa vào
 * trí nhớ. Hook này dò lấy lớp theme đang phủ rồi các primitive tự gắn lại, nên
 * chỗ gọi KHÔNG phải biết gì.
 *
 * Dò theo DOM (chứ không hằng số hoá `'theme-v3'`) để đường lùi khẩn vẫn nguyên:
 * đổi `theme-v3`→`theme-v2` ở `WorkspaceShell` là portal đi theo, không sót.
 */
const THEMES = ['theme-v3', 'theme-v2'] as const

/**
 * Bản KHÔNG-hook, cho vùng nổi sống dai hơn một lượt mở/đóng — cụ thể là khay
 * toast: nó mount một lần ở layout gốc rồi ở đó suốt phiên, nên chụp lớp theme
 * lúc mount là chụp phải khoảnh khắc shell chưa dựng xong (vào app từ `/login`
 * là dính). Gọi lại mỗi lần có toast mới thì luôn đúng, mà cũng chỉ tốn một
 * `querySelector`.
 */
export function resolvePortalTheme(): string | undefined {
  return resolveTheme()
}

function resolveTheme(): string | undefined {
  // SSR: chưa có DOM. Dialog mặc định đóng nên gần như không render ở server;
  // nếu có (defaultOpen) thì lượt hydrate ngay sau đó gắn đúng lớp.
  if (typeof document === 'undefined') return undefined
  for (const t of THEMES) if (document.querySelector(`.${t}`)) return t
  return undefined
}

/**
 * Lớp theme cần gắn lên content của portal. Đọc MỘT LẦN lúc mount — theme là
 * hằng số của cả phiên, không cần theo dõi thay đổi.
 */
export function usePortalTheme(): string | undefined {
  const [theme] = useState(resolveTheme)
  return theme
}
