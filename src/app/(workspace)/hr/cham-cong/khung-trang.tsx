'use client'

import type { ReactNode } from 'react'
import { Btn, ScreenFrame, ScreenHeader } from '@/components/kit'
import { dm, doiThang, thangVn } from './ky-cong.shared'

/**
 * Khung chung của các trang nhóm CHẤM CÔNG và Hồ sơ nhân viên (tách trang 17/10/2026):
 * đầu trang (nhóm · tên trang · ‹ kỳ › + khoảng ngày nếu trang theo kỳ) + nút ở góc phải. Mọi
 * trang theo kỳ dùng CÙNG khoảng Nhân sự đặt (22/10/2026: trước đó vài trang cắt theo tháng lịch
 * nên cùng "10/2026" mà mỗi màn một khoảng ngày). Không
 * cuộn ngang: `tableMin` 0, lưới tự co theo khung.
 */
export function KhungTrang({
  nhom = 'Chấm công',
  ten,
  thang,
  khoang,
  onThang,
  facts,
  actions,
  children,
}: {
  nhom?: string
  ten: string
  /** 'YYYY-MM' — có thì bày ‹ tháng ›. */
  thang?: string
  /** Khoảng ngày của kỳ — bày cạnh tên kỳ để ai cũng thấy số trên màn tính từ đâu tới đâu. */
  khoang?: { tu: string; den: string }
  onThang?: (t: string) => void
  facts?: { label: string; value: ReactNode }[]
  actions?: ReactNode
  children: ReactNode
}) {
  return (
    <ScreenFrame tableMin={0}>
      <ScreenHeader
        compact
        eyebrow={nhom}
        title={
          thang && onThang ? (
            <span className="flex items-center gap-1.5">
              {ten}
              <Btn
                icon="truoc"
                aria-label="Kỳ trước"
                onClick={() => onThang(doiThang(thang, -1))}
              >
                {''}
              </Btn>
              <span className="num">Kỳ {thangVn(thang)}</span>
              <Btn
                icon="sau"
                aria-label="Kỳ sau"
                onClick={() => onThang(doiThang(thang, 1))}
              >
                {''}
              </Btn>
              {khoang && (
                <span className="text-k-sm num font-normal text-[var(--ink-2)]">
                  {dm(khoang.tu)} → {dm(khoang.den)}/{khoang.den.slice(0, 4)}
                </span>
              )}
            </span>
          ) : (
            ten
          )
        }
        facts={facts}
        actions={actions}
      />
      {children}
    </ScreenFrame>
  )
}
