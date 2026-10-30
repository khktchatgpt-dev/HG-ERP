'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { todayVn } from '@/lib/date-vn'
import type { DocNote } from '@/lib/doc-notes'
import type { RequestDocType } from '@/lib/doc-requests'
import type { RequestListItem } from '@/modules/core/doc-notes/doc-requests.service'
import { OpenRequests } from './OpenRequests'
import { RequestComposer } from './RequestComposer'
import type { Person } from './request-ui'

/**
 * Hai chế độ của ô viết trong khối trao đổi: "Ghi chú" (ô cũ, truyền vào qua
 * `children`) và "Yêu cầu việc" (0281, B2) — cộng khối "Yêu cầu đang mở" ghim
 * ngay dưới. Bản vẽ 1 duyệt 29/10/2026.
 *
 * Tách khỏi `DocNotesPanel` vì khung đó dựng bằng bộ kit, còn phần này chủ dự án
 * chốt KHÔNG dùng kit — mỗi file một hệ.
 *
 * Danh sách người (mọi phòng) chỉ tải khi cần: lần đầu bấm "Yêu cầu việc" hoặc
 * "Chuyển". Phần lớn người mở chứng từ chỉ đọc, không cần ~100 tên đó.
 */
export function DocRequestsArea({
  docType,
  docId,
  meId,
  requests,
  notes,
  onChanged,
  children,
}: {
  docType: RequestDocType
  docId: string
  meId: string
  requests: RequestListItem[]
  notes: DocNote[]
  /** Gọi sau mỗi lần ghi — khung cha tải lại ghi chú + yêu cầu. */
  onChanged: () => void
  /** Ô viết ghi chú thường. */
  children: React.ReactNode
}) {
  const [mode, setMode] = useState<'note' | 'request'>('note')
  const [today] = useState(() => todayVn())
  const [people, setPeople] = useState<Person[] | null>(null)
  const [wantPeople, setWantPeople] = useState(false)
  const [peopleErr, setPeopleErr] = useState(false)
  const [sent, setSent] = useState<string | null>(null)

  useEffect(() => {
    if (!wantPeople || people) return
    let huy = false
    api<{ people: Person[] }>('/api/doc-requests/people')
      .then((d) => !huy && setPeople(d.people))
      .catch(() => !huy && setPeopleErr(true))
    return () => {
      huy = true
    }
  }, [wantPeople, people])

  const tab = (m: 'note' | 'request', label: string) => (
    <button
      type="button"
      aria-pressed={mode === m}
      onClick={() => {
        setMode(m)
        setSent(null)
        if (m === 'request') setWantPeople(true)
      }}
      className={`h-6 px-2.5 text-[12px] ${mode === m ? 'bg-[var(--act-wash)] font-semibold text-[var(--act-text)]' : 'bg-[var(--surface-card)] text-[var(--ink-label)] hover:text-[var(--ink)]'}`}
    >
      {label}
    </button>
  )

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <div
          role="group"
          aria-label="Loại ghi"
          className="inline-flex self-start overflow-hidden rounded-[var(--radius-sm)] border border-[var(--line)] [&>button+button]:border-l [&>button+button]:border-[var(--line)]"
        >
          {tab('note', 'Ghi chú')}
          {tab('request', 'Yêu cầu việc')}
        </div>
        {mode === 'note' ? (
          children
        ) : (
          <RequestComposer
            docType={docType}
            docId={docId}
            people={people ?? []}
            peopleLoading={!people && !peopleErr}
            meId={meId}
            today={today}
            onCreated={(name) => {
              setSent(`Đã giao cho ${name}.`)
              onChanged()
            }}
          />
        )}
        {peopleErr && (
          <p role="alert" className="text-[12px] text-[var(--stop)]">
            Không tải được danh sách người nhận. Tải lại trang để thử lại.
          </p>
        )}
        {sent && (
          <p role="status" className="text-[12px] font-medium text-[var(--done)]">
            {sent}
          </p>
        )}
      </div>
      <OpenRequests
        requests={requests}
        notes={notes}
        people={people ?? []}
        peopleLoading={!people && !peopleErr}
        needPeople={() => setWantPeople(true)}
        meId={meId}
        today={today}
        onChanged={onChanged}
      />
    </div>
  )
}
