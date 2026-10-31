import type { CSSProperties } from 'react'

/**
 * BẮC CẦU TOKEN cho khối phân công việc dựng ở trang dùng chung (P2–P5) khi đặt lên
 * Bàn làm việc. Các khối đó gọi màu bằng tên token theme-v3 (`--primary`,
 * `--border`…), còn Bàn làm việc nằm trong khung `.kit` có màu hành động riêng
 * (`--act`) — để nguyên là hai màu xanh trên một màn. Gắn `style={KIT_BRIDGE}` lên
 * khung bao để các tên đó trỏ sang màu kit cho riêng vùng ấy. `--stop` `--warn`
 * `--done` kit đã có sẵn cùng tên.
 */
export const KIT_BRIDGE = {
  '--primary': 'var(--act)',
  '--primary-foreground': 'var(--act-ink)',
  '--accent': 'var(--act-wash)',
  '--accent-foreground': 'var(--act-text)',
  '--foreground': 'var(--ink)',
  '--muted-foreground': 'var(--ink-3)',
  '--placeholder': 'var(--ink-3)',
  '--card': 'var(--surface-card)',
  '--muted': 'var(--surface-raised)',
  '--border': 'var(--hair)',
  '--input': 'var(--line)',
} as CSSProperties
