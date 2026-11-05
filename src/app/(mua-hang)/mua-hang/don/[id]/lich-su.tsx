'use client'

import { FastTab, Timeline } from '@/components/kit'
import { PoDocuments } from './PoDocuments'
import { LichSuKy } from './lich-su-ky'
import type { DonCtx } from './useDonChungTu'

/** Khối `blkTimeline` của màn chứng từ đơn mua. */
export function DongThoiGian({ d }: { d: DonCtx }) {
  const { po, viewMode, marks, p } = d
  const vet = p.signEvents ?? []
  return (
    <>
      {po && (
        <FastTab
          id="dong-thoi-gian"
          fixed={viewMode}
          title="Dòng thời gian"
          summary={[
            [
              'Mốc',
              <span key="m" className="num">
                {marks.filter((m) => m.at).length}
              </span>,
            ],
          ]}
        >
          <Timeline marks={marks} />
        </FastTab>
      )}
      {/* Lịch sử ký (0293 · B4): ai gửi, trưởng phòng xem / trả lại, ai duyệt. */}
      {po && (
        <FastTab
          id="lich-su-ky"
          fixed={viewMode}
          title="Lịch sử ký"
          summary={[['Mốc', <span key="v" className="num">{vet.length}</span>]]} // prettier-ignore
        >
          <LichSuKy events={vet} />
        </FastTab>
      )}
    </>
  )
}

/** Khối `blkTaiLieu` của màn chứng từ đơn mua. */
export function TaiLieu({ d }: { d: DonCtx }) {
  const { po, viewMode, p } = d
  return (
    <>
      {po && (
        <FastTab id="tai-lieu" title="Tài liệu đính kèm" fixed={viewMode}>
          <PoDocuments poId={po.id} canEdit={p.perms.isSupply || p.perms.canApprove} />
        </FastTab>
      )}
    </>
  )
}
