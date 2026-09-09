'use client'

import { useEffect, useMemo, useState } from 'react'
import { Followers, NoteComposer, NoteStream, type StreamRow } from '@/components/kit'
import { mergeStream, type DocNote } from '@/lib/doc-notes'

/**
 * KHỐI TRAO ĐỔI trên trang chi tiết đơn đặt vật tư.
 *
 * Nạp ghi chú ở CLIENT chứ không dựng sẵn ở server: trang chi tiết đơn đã nạp
 * 6 truy vấn nặng (dòng hàng, đợt giao, phiếu nhập, lịch sử…), thêm một truy
 * vấn nữa vào đường dựng trang là làm chậm thứ ai cũng cần để phục vụ thứ chỉ
 * một số người mở tới. Đổi lại là một nhịp trống ngắn — chấp nhận được cho
 * phần phụ trợ, không chấp nhận được cho bảng số liệu chính.
 */
export function PoNotesPanel({
  poId,
  marks,
  meId,
  meName,
  followerNames,
}: {
  poId: string
  /** Mốc máy ghi của đơn — trộn chung dòng với ghi chú của người. */
  marks: { key: string; at: string | null; label: string; actor?: string | null }[]
  meId: string
  meName: string
  followerNames: string[]
}) {
  const [notes, setNotes] = useState<DocNote[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [muted, setMuted] = useState(false)
  const [loi, setLoi] = useState<string | null>(null)

  // Đọc đồng hồ MỘT LẦN khi khối gắn vào, không đọc trong render: render là
  // hàm phải thuần, và server/trình duyệt sẽ ra hai kết quả khác nhau.
  const [now] = useState(() => new Date())

  useEffect(() => {
    let huy = false
    fetch(`/api/doc-notes?doc_type=po&doc_id=${poId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: { notes: DocNote[] }) => {
        if (!huy) setNotes(d.notes)
      })
      .catch(() => {
        if (!huy) {
          setNotes([])
          // Nói thẳng là KHÔNG ĐỌC ĐƯỢC, đừng để trống. Ô trống đọc thành
          // "chưa ai ghi gì" — người dùng sẽ tưởng đồng nghiệp im lặng.
          setLoi('Không tải được ghi chú. Tải lại trang để thử lại.')
        }
      })
    return () => {
      huy = true
    }
  }, [poId])

  async function ghi(body: string, audience: 'internal' | 'partner') {
    setBusy(true)
    setLoi(null)
    try {
      const r = await fetch('/api/doc-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ doc_type: 'po', doc_id: poId, body, audience }),
      })
      if (!r.ok) throw new Error(String(r.status))
      const d: { note: DocNote } = await r.json()
      setNotes((cur) => [{ ...d.note, author_name: meName }, ...(cur ?? [])])
    } catch {
      setLoi('Chưa ghi được. Nội dung vẫn còn trong ô — thử lại.')
    } finally {
      setBusy(false)
    }
  }

  const rows: StreamRow[] = useMemo(
    () =>
      mergeStream(marks, notes ?? []).map((it) =>
        it.kind === 'note'
          ? {
              ...it,
              note: { ...it.note, mine: it.note.author_id === meId },
            }
          : it,
      ) as StreamRow[],
    [marks, notes, meId],
  )

  return (
    <div className="kit flex flex-col gap-3">
      <NoteComposer onSubmit={ghi} busy={busy} />
      {loi && (
        <p className="rounded-[var(--radius)] border border-[var(--stop)] bg-[var(--stop-wash)] px-3 py-2 text-[11.5px] text-[var(--stop)]">
          {loi}
        </p>
      )}
      <Followers
        names={followerNames}
        muted={muted}
        onToggle={() => {
          setMuted((m) => !m)
          void fetch('/api/doc-notes/follow', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ doc_type: 'po', doc_id: poId, muted: !muted }),
          })
        }}
      />
      {notes === null ? (
        <p className="py-3 text-[12px] text-[var(--ink-3)]">Đang tải ghi chú…</p>
      ) : (
        <NoteStream
          rows={rows}
          now={now}
          empty={
            <>
              Chưa ai ghi gì về đơn này. Ghi lại những gì đang xảy ra ngoài hệ thống —
              NCC hẹn lại ngày nào, ai đã gọi cho ai — để ba tháng nữa còn tra được.
            </>
          }
        />
      )}
    </div>
  )
}
