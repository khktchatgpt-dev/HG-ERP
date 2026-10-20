'use client'

import { useRouter } from 'next/navigation'
import { isoToVn, todayVn } from '@/lib/date-vn'
import { DE_NGHI_NHAN } from '@/lib/de-nghi'
import { HopThoai } from '../_erp/o-nhap'
import type { PhieuCu } from './de-nghi.shared'

const fmt = (n: number) => n.toLocaleString('vi-VN')

/**
 * LẬP LẠI TỪ PHIẾU CŨ (Đ8, Q22) — chọn một phiếu đã gửi duyệt, màn mở bản nháp
 * mới chép sẵn dòng (`/warehouse/de-nghi/moi?tu=<id>`, xem `phieuLapLai`). Hàng
 * tiêu hao mua lặp hằng tháng: khỏi gõ lại từng dòng. Không kit (B5).
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
    <HopThoai
      title="Lập lại từ phiếu cũ"
      subtitle={
        coDong
          ? 'Các dòng đang gõ trên màn sẽ được thay bằng dòng của phiếu chọn (chưa lưu thì mất).'
          : 'Chép dòng sang một nháp mới: số lượng theo số đã duyệt, giá theo lần mua gần nhất. Chưa lưu gì cho tới khi bấm Lưu nháp.'
      }
      onClose={onClose}
      width={580}
    >
      {rows.length === 0 ? (
        <p>
          <b>Chưa có phiếu nào để lập lại.</b> Chỉ phiếu đã gửi lãnh đạo duyệt ít nhất một
          lần mới hiện ở đây — lập phiếu đầu tiên bằng tay, lần sau chọn lại ở đây.
        </p>
      ) : (
        <div className="kh-ds" role="list" aria-label="Phiếu đề nghị cũ">
          {rows.map((r) => (
            <button
              key={r.id}
              type="button"
              role="listitem"
              className="kh-pl-row"
              style={{ padding: '7px 10px', borderBottom: '1px solid var(--kh-hair)' }}
              onClick={() => {
                onClose()
                router.push(`/warehouse/de-nghi/moi?tu=${r.id}`)
              }}
            >
              <span style={{ minWidth: 0 }}>
                <span className="kh-sq c-dnm" aria-hidden />
                <b className="kh-ma">{r.code}</b>{' '}
                <span className="kh-mut kh-num">
                  {isoToVn(todayVn(new Date(r.ngay)))}
                </span>
                <span className="s" style={{ display: 'block' }}>
                  {r.so_dong} dòng · {r.ten}
                  {r.so_dong > 3 ? '…' : ''}
                </span>
              </span>
              <span className="r">
                <span className="kh-tag" style={{ display: 'inline-block' }}>
                  {DE_NGHI_NHAN[r.status]}
                </span>
                <b className="kh-num" style={{ display: 'block' }}>
                  {fmt(r.tong)}
                </b>
              </span>
            </button>
          ))}
        </div>
      )}
    </HopThoai>
  )
}
