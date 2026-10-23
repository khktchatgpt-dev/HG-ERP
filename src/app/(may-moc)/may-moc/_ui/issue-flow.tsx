'use client'

import { useState } from 'react'
import { vnd, type IssuePriority } from '@/lib/may-moc'
import type { IssueView } from '@/modules/core/assets/issues.view'
import { useMutate } from './shared'
import { AcceptSheet, DoneSheet, ReasonSheet, type IssueRef } from './issue-dialogs'
import type { IssueAct } from './issue-card'

export const issueLabel = (i: IssueView) =>
  i.asset ? `${i.asset.code} ${i.asset.name}` : '(máy đã xoá)'

export const issueRef = (i: IssueView): IssueRef => ({
  id: i.id,
  no: i.no,
  label: issueLabel(i),
  description: i.description,
  priority: i.priority as IssuePriority,
  vendor: i.vendor,
  estimate: i.estimate,
})

/**
 * Luồng nút trên phiếu báo hỏng — dùng chung cho thẻ ở Việc hôm nay, Tổng quan
 * và Báo hỏng. "Duyệt" chạy thẳng (như demo: một cú bấm), các việc khác mở hộp.
 */
export function useIssueFlow({
  techs,
  approveOver,
  me,
}: {
  techs: { id: string; name: string }[]
  approveOver: number
  me?: string | null
}) {
  const m = useMutate()
  const [st, setSt] = useState<{ k: Exclude<IssueAct, 'approve'>; i: IssueView } | null>(
    null,
  )
  const act = (i: IssueView, k: IssueAct) => {
    if (k === 'approve') {
      void m.run(
        () => m.api(`/api/may-moc/issues/${i.id}/approve`, { method: 'POST' }),
        `Đã duyệt ${i.no} — Cơ điện tiến hành sửa`,
      )
      return
    }
    setSt({ k, i })
  }
  const close = () => setSt(null)
  const sheets = st ? (
    st.k === 'accept' ? (
      <AcceptSheet
        issue={issueRef(st.i)}
        techs={techs}
        approveOver={approveOver}
        me={me}
        onClose={close}
      />
    ) : st.k === 'done' ? (
      <DoneSheet issue={issueRef(st.i)} onClose={close} />
    ) : (
      <ReasonSheet
        title={`Không duyệt ${st.i.no}`}
        subtitle={`${issueLabel(st.i)} · dự toán ${vnd(st.i.estimate ?? 0)} đ`}
        consequence="Phiếu trả về Tổ Cơ điện ở trạng thái Mới báo, dự toán bị xoá. Cơ điện đọc lý do để làm phương án khác."
        confirmLabel="Gửi lại Cơ điện"
        url={`/api/may-moc/issues/${st.i.id}/reject`}
        okText={`${st.i.no} đã trả lại Cơ điện`}
        placeholder="VD: chỉ thay cảm biến trước, theo dõi thêm 1 tháng"
        onClose={close}
      />
    )
  ) : null
  return { act, sheets, busy: m.busy }
}
