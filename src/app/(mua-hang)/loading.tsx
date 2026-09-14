import { Loading, ScreenFrame } from '@/components/kit'

/**
 * KHUNG CHỜ CỦA KHU MUA HÀNG.
 *
 * Mọi workspace khác đều có `loading.tsx`; khu này thì không, nên chuyển
 * trang là ngồi nhìn màn cũ đứng im rồi nội dung mới đột ngột thay chỗ —
 * không có gì nói "đang đi". Nhưng nó chỉ CHẠY ĐƯỢC sau khi rail đổi sang
 * `next/link` (cùng đợt 14/09/2026): với `<a>` trần thì trình duyệt tải lại
 * cả tài liệu và Suspense của Next không bao giờ được gọi.
 *
 * Khung chờ bắt chước ĐÚNG hình dạng màn danh sách — đầu trang một hàng,
 * thanh lọc, rồi lưới — để nội dung thật về không làm bố cục nhảy.
 */
export default function MuaHangLoading() {
  return (
    <ScreenFrame>
      <div className="animate-pulse border-b border-[var(--line)] bg-[var(--surface-card)] px-[var(--gutter)] py-[10px]">
        <span className="block h-3 w-[190px] rounded bg-[var(--surface-raised)]" />
      </div>
      <div className="flex shrink-0 items-center gap-2 border-b border-[var(--line)] bg-[var(--surface-card)] px-[var(--gutter)] py-[9px]">
        {[300, 110, 110, 90].map((w) => (
          <span
            key={w}
            style={{ width: w }}
            className="h-[26px] animate-pulse rounded-[13px] bg-[var(--surface-raised)]"
          />
        ))}
      </div>
      <div className="min-w-0 flex-1 overflow-hidden bg-[var(--surface-card)]">
        <Loading rows={12} />
      </div>
    </ScreenFrame>
  )
}
