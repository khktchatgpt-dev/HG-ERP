'use client'

import { Btn, Empty, ScreenFrame, ScreenHeader } from '@/components/kit'

/** Người không có quyền duyệt đơn mua mở thẳng /mua-hang/cho-ky. */
export function KhongCoQuyenKy() {
  return (
    <ScreenFrame>
      <ScreenHeader compact eyebrow="Mua hàng" title="Chờ tôi ký" />
      <div className="min-w-0 flex-1 bg-[var(--surface-card)]">
        <Empty
          headline="Bạn không có quyền ký đơn mua"
          reason="Hộp ký chỉ dành cho người có quyền duyệt đơn mua (Ban Giám đốc và người được giao). Đơn bạn gửi duyệt nằm ở sổ Đơn mua, trạng thái Chờ duyệt."
          next={
            <Btn icon="don" href="/mua-hang/don?trang_thai=pending">
              Xem đơn đang chờ duyệt
            </Btn>
          }
        />
      </div>
    </ScreenFrame>
  )
}
