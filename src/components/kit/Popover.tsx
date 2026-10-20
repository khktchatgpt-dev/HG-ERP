'use client'

import type { ReactElement, ReactNode } from 'react'
import { Popover as P } from 'radix-ui'
import { cn } from '@/lib/utils'

/**
 * KHUNG NỔI GẮN VÀO MỘT NÚT — lọc nâng cao, chọn cột, xem nhanh một chứng từ.
 *
 * Thêm 24/09/2026 (B1, docs/he-thiet-ke-erp-ke-hoach.md §5.1). Trước đó kit
 * KHÔNG có khung nổi chung, nên mỗi chỗ cần một cái tự dựng lấy — và ba thứ
 * tự dựng đó (`PickFind`, `Lookup`, `DateInput`) đều nằm `absolute` trong DOM
 * nơi gọi, tức bị CẮT khi đặt trong bảng cuộn hay hộp thoại. Đây là nền cho
 * ô tìm-rồi-chọn (B4) và chọn cột / mật độ bảng (B5).
 *
 * KHÁC `Sheet` Ở CHỖ NÀO. `Sheet` là hộp MODAL — phải trả lời xong mới đi
 * tiếp, phần còn lại của trang bị khoá. `Popover` KHÔNG modal: nó là một
 * khung phụ, bấm ra ngoài là đóng, trang phía sau vẫn dùng được. Hỏi một câu
 * phải trả lời → `Sheet`. Bày thêm lựa chọn cho một nút → `Popover`.
 *
 * Radix lo: đưa tiêu điểm vào khung khi mở, Esc đóng, trả tiêu điểm về nút,
 * bấm ra ngoài là đóng, tự lật phía khi chạm mép màn, `aria-expanded` và
 * `aria-controls` trên nút.
 */
export function Popover({
  trigger,
  label,
  children,
  side = 'bottom',
  align = 'start',
  width = 280,
  open,
  onOpenChange,
}: {
  /** MỘT phần tử bấm được — thường là `Btn`. Radix gắn thẳng vào nó. */
  trigger: ReactElement
  /**
   * Tên của khung — BẮT BUỘC. Radix cho khung vai `dialog`, và một `dialog`
   * không tên thì trình đọc màn hình chỉ đọc ra "hộp thoại", không biết hộp gì.
   */
  label: string
  /**
   * Ruột khung. Mở ra thì tiêu điểm vào phần tử bấm/gõ được ĐẦU TIÊN trong đây;
   * không có thứ nào thì vào chính khung. Khung có đệm 12px sẵn.
   */
  children: ReactNode
  /** Phía hiện khung so với nút. Chạm mép màn thì Radix tự lật sang phía kia. */
  side?: 'top' | 'right' | 'bottom' | 'left'
  /** Canh khung theo nút: `start` thẳng mép đầu, `end` thẳng mép cuối (nút ở góc phải). */
  align?: 'start' | 'center' | 'end'
  /** Bề ngang khung (px). Không bao giờ vượt bề ngang màn trừ 16px lề. */
  width?: number
  /** Điều khiển từ ngoài — bỏ trống thì khung tự quản đóng/mở. */
  open?: boolean
  /**
   * Báo mỗi lần khung muốn đóng/mở (bấm nút, Esc, bấm ra ngoài, Tab ra ngoài).
   * Đi cặp với `open` khi điều khiển từ ngoài, vd. đóng khung sau khi áp bộ lọc.
   */
  onOpenChange?: (open: boolean) => void
}) {
  return (
    <P.Root open={open} onOpenChange={onOpenChange}>
      <P.Trigger asChild>{trigger}</P.Trigger>
      <P.Portal>
        {/* Token kit chỉ sống trong `.kit` — portal ra `<body>` thì phải đeo lại. */}
        <div className="kit contents">
          <P.Content
            aria-label={label}
            side={side}
            align={align}
            sideOffset={4}
            collisionPadding={8}
            className={cn(
              // `--z-pop` > `--z-modal`: mở từ trong hộp thoại vẫn nổi trên hộp.
              'z-[var(--z-pop)] rounded-[var(--radius)] border border-[var(--line)]',
              'bg-[var(--surface-card)] p-3 shadow-[var(--shadow-drop)]',
              'outline-none',
            )}
            // Không vượt bề ngang màn: khung 280px trên điện thoại 320px vẫn vừa.
            style={{ width, maxWidth: 'calc(100vw - 16px)' }}
          >
            {children}
          </P.Content>
        </div>
      </P.Portal>
    </P.Root>
  )
}
