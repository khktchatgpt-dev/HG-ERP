'use client'

import { Btn } from '@/components/kit'

/**
 * DẢI "ĐÃ GHI SỔ" — hiện sau khi phiếu kho ghi sổ xong, có nút IN.
 *
 * Vì sao là dải chứ không phải toast (chủ dự án 16/09: "phải có mẫu in"):
 * ghi sổ xong thủ kho thường phải in ngay đưa người giao / tổ ký, mà toast
 * tự tắt sau vài giây — nút In biến mất trước khi họ với tới chuột.
 *
 * Dùng chung cho cả đường nhập và đường xuất để hai màn không nói hai kiểu.
 * `NoticeBar` của kit chỉ có nền cảnh báo (vàng/đỏ) nên dải mừng dựng tại
 * chỗ, vẫn bằng token vòng đời `--done`.
 */
export function DaGhiSoBar({
  code,
  docId,
  detail,
  soPhieuHref,
  onClose,
}: {
  /** Mã phiếu vừa cấp — PNK-… / PXK-… */
  code: string
  docId: string
  /** Một câu ngắn: số dòng, tổ nhận, phần vào khoá… */
  detail: string
  /** Sổ phiếu đã lọc sẵn đúng loại phiếu vừa ghi. */
  soPhieuHref: string
  onClose: () => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-[11px] border-b border-[var(--done-line)] bg-[var(--done-wash)] px-[var(--gutter)] py-[9px] text-[12.5px]">
      <span className="shrink-0 text-[10.5px] font-bold tracking-[.06em] text-[var(--done)] uppercase">
        Đã ghi sổ
      </span>
      <span className="text-[var(--ink-2)]">
        <b className="num">{code}</b> · {detail}
      </span>
      <Btn href={`/print/warehouse/${docId}`} className="h-[24px] px-[9px] text-[12px]">
        In phiếu
      </Btn>
      <Btn href={soPhieuHref} className="h-[24px] px-[9px] text-[12px]">
        Xem ở sổ phiếu
      </Btn>
      <Btn
        onClick={onClose}
        className="ml-auto h-[24px] border-0 bg-transparent px-[9px] text-[12px]"
      >
        Đóng
      </Btn>
    </div>
  )
}
