'use client'

import type { ReactNode } from 'react'
import { Btn, ScreenFrame, ScreenHeader } from '@/components/kit'
import { doiThang, thangVn } from './ky-cong.shared'

/**
 * Khung chung của các trang nhóm CHẤM CÔNG và Hồ sơ nhân viên (tách trang 17/10/2026):
 * đầu trang (nhóm · tên trang · ‹ tháng › nếu trang theo kỳ) + nút ở góc phải. Không
 * cuộn ngang: `tableMin` 0, lưới tự co theo khung.
 */
export function KhungTrang({
  nhom = 'Chấm công',
  ten,
  thang,
  onThang,
  facts,
  actions,
  children,
}: {
  nhom?: string
  ten: string
  /** 'YYYY-MM' — có thì bày ‹ tháng ›. */
  thang?: string
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
                aria-label="Tháng trước"
                onClick={() => onThang(doiThang(thang, -1))}
              >
                {''}
              </Btn>
              <span className="num">{thangVn(thang)}</span>
              <Btn
                icon="sau"
                aria-label="Tháng sau"
                onClick={() => onThang(doiThang(thang, 1))}
              >
                {''}
              </Btn>
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
