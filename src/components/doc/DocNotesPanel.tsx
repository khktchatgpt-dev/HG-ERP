'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Chip,
  Followers,
  NoteComposer,
  NoteStream,
  type StreamRow,
} from '@/components/kit'
import { mergeStream, type DocNote, type DocType } from '@/lib/doc-notes'

/**
 * KHỐI TRAO ĐỔI trên một chứng từ — dùng cho MỌI loại (đơn mua, lệnh SX…).
 *
 * Một khối duy nhất chứ không mỗi khu một bản: chính route `/api/doc-notes`
 * đã chọn cách đó cho tầng API ("bốn bản sao của cùng một việc thì bản thứ tư
 * sẽ lệch"), tầng giao diện không có lý do gì làm ngược.
 *
 * Nạp ghi chú ở CLIENT chứ không dựng sẵn ở server: trang chi tiết đơn đã nạp
 * 6 truy vấn nặng (dòng hàng, đợt giao, phiếu nhập, lịch sử…), thêm một truy
 * vấn nữa vào đường dựng trang là làm chậm thứ ai cũng cần để phục vụ thứ chỉ
 * một số người mở tới. Đổi lại là một nhịp trống ngắn — chấp nhận được cho
 * phần phụ trợ, không chấp nhận được cho bảng số liệu chính.
 */
export function DocNotesPanel({
  docType,
  docId,
  marks,
  meId,
  meName,
  followerNames,
  emptyHint,
  partnerLabel,
  filters = false,
}: {
  docType: DocType
  docId: string
  /** Mốc máy ghi của đơn — trộn chung dòng với ghi chú của người. */
  marks: { key: string; at: string | null; label: string; actor?: string | null }[]
  meId: string
  meName: string
  followerNames: string[]
  /** Câu nói khi chưa ai ghi gì — phải nói VIỆC nên ghi, không nói "trống". */
  emptyHint: React.ReactNode
  /** Nhãn lựa chọn người đọc bên ngoài — xem `NoteComposer partnerLabel`. */
  partnerLabel?: string
  /**
   * Bày ba nút lọc Ghi chú / Mốc máy / Tất cả, mở sẵn ở "Ghi chú". Dùng khi khối
   * nằm ở chỗ HẸP (cột phải) và chứng từ đã có khối "Dòng thời gian" riêng: mốc
   * máy trộn chung làm lời người viết chìm giữa dòng máy (đo màn đơn mua
   * 26/09/2026 — 3 mốc hiện hai lần, ở Trao đổi và ở Dòng thời gian).
   */
  filters?: boolean
}) {
  const [loc, setLoc] = useState<'notes' | 'marks' | 'all'>(filters ? 'notes' : 'all')
  const [notes, setNotes] = useState<DocNote[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [muted, setMuted] = useState(false)
  const [loi, setLoi] = useState<string | null>(null)

  // Đọc đồng hồ MỘT LẦN khi khối gắn vào, không đọc trong render: render là
  // hàm phải thuần, và server/trình duyệt sẽ ra hai kết quả khác nhau.
  const [now] = useState(() => new Date())

  useEffect(() => {
    let huy = false
    fetch(`/api/doc-notes?doc_type=${docType}&doc_id=${docId}`)
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
  }, [docType, docId])

  async function ghi(body: string, audience: 'internal' | 'partner') {
    setBusy(true)
    setLoi(null)
    try {
      const r = await fetch('/api/doc-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ doc_type: docType, doc_id: docId, body, audience }),
      })
      if (!r.ok) throw new Error(String(r.status))
      const d: { note: DocNote } = await r.json()
      setNotes((cur) => [{ ...d.note, author_name: meName }, ...(cur ?? [])])
    } catch (e) {
      setLoi('Chưa ghi được. Nội dung vẫn còn trong ô — thử lại.')
      // NÉM TIẾP để `NoteComposer` biết lưu hỏng mà giữ chữ trong ô — nuốt ở đây
      // là ô tự xoá và câu báo lỗi ngay trên nói sai (B7½, 24/09/2026).
      throw e
    } finally {
      setBusy(false)
    }
  }

  const rows: StreamRow[] = useMemo(
    () =>
      mergeStream(loc === 'notes' ? [] : marks, loc === 'marks' ? [] : (notes ?? [])).map(
        (it) =>
          it.kind === 'note'
            ? {
                ...it,
                note: { ...it.note, mine: it.note.author_id === meId },
              }
            : it,
      ) as StreamRow[],
    [marks, notes, meId, loc],
  )

  return (
    <div className="kit flex flex-col gap-3">
      <NoteComposer onSubmit={ghi} busy={busy} partnerLabel={partnerLabel} />
      {loi && (
        <p className="text-k-sm rounded-[var(--radius)] border border-[var(--stop)] bg-[var(--stop-wash)] px-3 py-2 text-[var(--stop)]">
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
            body: JSON.stringify({ doc_type: docType, doc_id: docId, muted: !muted }),
          })
        }}
      />
      {filters && (
        <div
          className="flex flex-wrap gap-1.5"
          role="group"
          aria-label="Lọc dòng trao đổi"
        >
          <Chip
            icon="ghiChu"
            count={notes?.length ?? 0}
            on={loc === 'notes'}
            onClick={() => setLoc('notes')}
          >
            Ghi chú
          </Chip>
          <Chip
            icon="lichSu"
            count={marks.filter((m) => m.at).length}
            on={loc === 'marks'}
            onClick={() => setLoc('marks')}
          >
            Mốc máy
          </Chip>
          <Chip
            icon="boLoc"
            count={(notes?.length ?? 0) + marks.filter((m) => m.at).length}
            on={loc === 'all'}
            onClick={() => setLoc('all')}
          >
            Tất cả
          </Chip>
        </div>
      )}
      {notes === null ? (
        <p className="text-k-sm py-3 text-[var(--ink-3)]">Đang tải ghi chú…</p>
      ) : (
        <NoteStream rows={rows} now={now} empty={emptyHint} />
      )}
    </div>
  )
}
