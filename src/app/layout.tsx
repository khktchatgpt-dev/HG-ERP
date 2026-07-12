import type { Metadata } from 'next'
import { Be_Vietnam_Pro, JetBrains_Mono } from 'next/font/google'
import { Providers } from '@/components/Providers'
import './globals.css'

// Be Vietnam Pro: thiết kế chuyên cho tiếng Việt (full diacritic, baseline đúng).
const beVietnam = Be_Vietnam_Pro({
  variable: '--font-sans',
  subsets: ['latin', 'vietnamese'],
  weight: ['300', '400', '500', '600', '700'],
  display: 'swap',
})

// Mono cho mã CV-xxxxxx, code, số tabular.
const jetBrainsMono = JetBrains_Mono({
  variable: '--font-mono',
  subsets: ['latin'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'HG Manager — Quản lý công việc',
  description: 'Hệ thống giao việc và quản lý công việc cho nhân viên',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    // suppressHydrationWarning: extension trình duyệt (Grammarly, trình dịch, bộ
    // gõ…) thường chèn attribute vào <html>/<body> TRƯỚC khi React hydrate → cảnh
    // báo "attributes didn't match". App không kiểm soát được; cờ này bỏ qua so
    // khớp attribute Ở ĐÚNG 1 phần tử này (không ảnh hưởng con) — cách Next/React
    // khuyến nghị. KHÔNG che giấu mismatch trong nội dung ứng dụng bên dưới.
    <html
      lang="vi"
      className={`${beVietnam.variable} ${jetBrainsMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full bg-zinc-50 dark:bg-zinc-950" suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
