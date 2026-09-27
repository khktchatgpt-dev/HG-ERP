'use client'

import { PoNotesPanel } from '@/app/(workspace)/planning/pos/[id]/PoNotesPanel'
import type { DonCtx } from './useDonChungTu'

/** Khối `notesPanel` của màn chứng từ đơn mua. */
export function TraoDoiKhung({ d }: { d: DonCtx }) {
  const { po, me, marks } = d
  return po ? (
    <PoNotesPanel
      poId={po.id}
      meId={me.id}
      meName={me.name}
      marks={marks.map((m) => ({ key: m.key, at: m.at, label: m.label, actor: m.actor }))} // prettier-ignore
      followerNames={[po.assignee_name].filter((x): x is string => !!x)}
      partnerLabel="Đã báo NCC · ghi lại"
      filters
    />
  ) : null
}
