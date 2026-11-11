'use client'

import { useLocalPref } from '@/lib/use-local-pref'

/**
 * LỚP TOKEN CỦA KIT, đặt ngay trong vùng nội dung của vỏ chung.
 *
 * Từ 16/09/2026 khu Mua hàng bỏ vỏ riêng (rail 52px) để dùng chung một
 * sidebar với cả app — chủ dự án chốt: giữ giao diện sidebar cũ, đổi ruột
 * sang các màn mới. Nhưng sidebar cũ gắn lớp `.theme-v3` ở gốc, còn màn mới
 * đọc token của `.kit`; thiếu lớp này thì `--act`, `--line`, `--surface-card`
 * rỗng và cả khu mất màu.
 *
 * HAI LỚP TOKEN LỒNG NHAU LÀ CÓ CHỦ Ý, không phải lỡ tay: `.theme-v3` phủ
 * KHUNG (sidebar, thanh trên), `.kit` phủ NỘI DUNG. Luật "một file một hệ"
 * của CLAUDE.md nói về file màn hình — vỏ và nội dung là hai file khác nhau,
 * và `PoDetailScreen` đã chạy đúng lối này từ trước (nó tự gắn `theme-v3 kit`).
 *
 * MẬT ĐỘ là tuỳ chọn của NGƯỜI DÙNG, một thang cho cả module. MẶC ĐỊNH DÀY từ
 * 01/10/2026 (hàng 25px, ô nhập 24px): chủ dự án chấm "giao diện khá lớn, cần như
 * các hệ ERP để nhìn tổng quát" — đo ở laptop Full HD phóng 125% (vùng nhìn
 * 1536×730) lưới sửa đơn chỉ 12 dòng, cao 39px/dòng. Ai quen thưa bấm "Lưới thưa".
 * Trước đây lớp `kit-dense` do vỏ riêng gắn — vỏ đi thì nó phải về đây, không
 * thì nút đổi mật độ trong ba màn bấm vào không có gì xảy ra.
 */
export const DENSE_KEY = 'hg.mua-hang.dense'
export const DENSE_DEFAULT = '1'

export function KitFrame({ children }: { children: React.ReactNode }) {
  const [dense] = useLocalPref(DENSE_KEY, DENSE_DEFAULT)
  return (
    <div
      className={
        dense === '1' ? 'kit kit-dense flex h-full flex-col' : 'kit flex h-full flex-col'
      }
    >
      {children}
    </div>
  )
}
