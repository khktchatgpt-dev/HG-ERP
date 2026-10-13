'use client'

import { useRouter } from 'next/navigation'
import { isoToVn, todayVn } from '@/lib/date-vn'
import { DE_NGHI_NHAN, DE_NGHI_TONE } from '@/lib/de-nghi'
import { Code, Empty, Sheet, Tag } from '@/components/kit'
import type { PhieuCu } from './de-nghi.shared'

const fmt = (n: number) => n.toLocaleString('vi-VN')

/**
 * LẬP LẠI TỪ PHIẾU CŨ (Đ8, Q22) — chọn một phiếu đã gửi duyệt, màn mở bản nháp
 * mới chép sẵn dòng (`/warehouse/de-nghi/moi?tu=<id>`, xem `phieuLapLai`). Hàng
 * tiêu hao mua lặp hằng tháng: khỏi gõ lại từng dòng.
 */
export function LapLaiSheet({
  rows,
  coDong,
  onClose,
}: {
  rows: PhieuCu[]
  /** Màn đang có dòng gõ dở — nói trước là sẽ bị thay. */
  coDong: boolean
  onClose: () => void
}) {
  const router = useRouter()
  return (
    <Sheet
      open
      onClose={onClose}
      width={560}
      title="Lập lại từ phiếu cũ"
      subtitle={
        coDong
          ? 'Các dòng đang gõ trên màn sẽ được thay bằng dòng của phiếu chọn (chưa lưu thì mất).'
          : 'Chép dòng sang một nháp mới: số lượng theo số đã duyệt, giá theo lần mua gần nhất. Chưa lưu gì cho tới khi bấm Lưu nháp.'
      }
    >
      {rows.length === 0 ? (
        <Empty
          headline="Chưa có phiếu nào để lập lại"
          reason="Chỉ phiếu đã gửi lãnh đạo duyệt ít nhất một lần mới hiện ở đây."
          next={<span>Lập phiếu đầu tiên bằng tay, lần sau chọn lại ở đây.</span>}
        />
      ) : (
        <ul className="m-0 flex list-none flex-col p-0" aria-label="Phiếu đề nghị cũ">
          {rows.map((r) => (
            <li key={r.id} className="border-b border-[var(--hair)]">
              <button
                type="button"
                onClick={() => {
                  onClose()
                  router.push(`/warehouse/de-nghi/moi?tu=${r.id}`)
                }}
                className="text-k-body flex w-full flex-col gap-0.5 px-1 py-2 text-left hover:bg-[var(--act-wash)] focus-visible:bg-[var(--act-wash)]"
              >
                <span className="flex items-baseline justify-between gap-2">
                  <span className="flex items-baseline gap-2">
                    <Code>{r.code}</Code>
                    <span className="num text-k-sm text-[var(--ink-3)]">
                      {isoToVn(todayVn(new Date(r.ngay)))}
                    </span>
                  </span>
                  <Tag tone={DE_NGHI_TONE[r.status]}>{DE_NGHI_NHAN[r.status]}</Tag>
                </span>
                <span className="text-k-sm truncate text-[var(--ink-2)]">
                  {r.so_dong} dòng · {r.ten}
                  {r.so_dong > 3 ? '…' : ''}
                </span>
                <span className="text-k-sm text-[var(--ink-3)]">
                  Tổng dự kiến <b className="num text-[var(--ink)]">{fmt(r.tong)}</b>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  )
}
