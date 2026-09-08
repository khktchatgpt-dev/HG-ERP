'use client'

import { useState } from 'react'
import {
  Followers,
  NoteComposer,
  NoteStream,
  type StreamRow,
} from '@/components/kit'
import { mergeStream, type DocNote } from '@/lib/doc-notes'

/**
 * TRANG XEM KHỐI TRAO ĐỔI — mẫu sống, dữ liệu dựng sẵn.
 *
 * Có trang riêng vì trang chi tiết đơn thật nặng 1718 dòng và 6 truy vấn: mở
 * nó chỉ để nhìn một khối là chậm, và khi khối đó hỏng thì không tách được lỗi
 * của mình với lỗi của trang. Ở đây khối chạy trần, không phụ thuộc DB.
 *
 * Cố ý bày TRẠNG THÁI XẤU: ghi chú gửi ra ngoài, ghi chú nhiều dòng, ghi chú
 * của người khác (không gỡ được), mốc máy ghi xen giữa. Trạng thái đẹp không
 * phơi ra lỗi nào.
 */

const MARKS = [
  { key: 'created', at: '2026-09-03T12:17:00Z', label: 'Soạn đơn', actor: 'Nga' },
  { key: 'submitted', at: '2026-09-03T15:56:00Z', label: 'Gửi Giám đốc duyệt' },
  { key: 'approved', at: null, label: 'Giám đốc duyệt' },
]

const NOTES: DocNote[] = [
  {
    id: 'n3',
    doc_type: 'po',
    doc_id: 'c658703c-1f39-4c28-9223-5dfd6062345b',
    author_id: 'me',
    author_name: 'Quản trị viên',
    audience: 'partner',
    body: 'Kính gửi Quý công ty, đề nghị xác nhận lại lịch giao hàng cho đơn PO-2026-0065. Trân trọng.',
    reply_to: null,
    created_at: '2026-09-08T02:10:00Z',
    deleted_at: null,
  },
  {
    id: 'n2',
    doc_type: 'po',
    doc_id: 'c658703c-1f39-4c28-9223-5dfd6062345b',
    author_id: 'u-nga',
    author_name: 'Đặng Thị Thanh Nga',
    audience: 'internal',
    body: 'NCC báo trễ 3 ngày do thiếu kính tấm.\nĐã gọi xác nhận với chị Hoa lúc 9h.\nHẹn lại 12/09.',
    reply_to: null,
    created_at: '2026-09-06T08:30:00Z',
    deleted_at: null,
  },
  {
    id: 'n1',
    doc_type: 'po',
    doc_id: 'c658703c-1f39-4c28-9223-5dfd6062345b',
    author_id: 'me',
    author_name: 'Quản trị viên',
    audience: 'internal',
    body: 'Giám đốc đi công tác tới 07/09, đơn này chờ ký khi về.',
    reply_to: null,
    created_at: '2026-09-04T01:00:00Z',
    deleted_at: null,
  },
]

export function NotesLab() {
  const [notes, setNotes] = useState<DocNote[]>(NOTES)
  const [muted, setMuted] = useState(false)
  const [now] = useState(() => new Date('2026-09-09T03:00:00Z'))

  const rows = mergeStream(MARKS, notes).map((it) =>
    it.kind === 'note'
      ? { ...it, note: { ...it.note, mine: it.note.author_id === 'me' } }
      : it,
  ) as StreamRow[]

  return (
    <div className="kit-v4 mx-auto flex max-w-[720px] flex-col gap-4 p-6">
      <div>
        <h1 className="text-[var(--fs-title)] font-semibold">Trao đổi trên chứng từ</h1>
        <p className="mt-1 text-[var(--fs-sm)] text-[var(--ink-2)]">
          Ghi chú của <b>người</b> trộn chung dòng với mốc <b>máy ghi</b>. Bấm
          &ldquo;Gửi nhà cung cấp&rdquo; để xem ô nhập đổi màu cảnh báo.
        </p>
      </div>

      <NoteComposer
        partnerLabel="Gửi Thép Asia"
        onSubmit={(body, audience) =>
          setNotes((cur) => [
            {
              id: `tmp-${Date.now()}`,
              doc_type: 'po',
              doc_id: 'c658703c-1f39-4c28-9223-5dfd6062345b',
              author_id: 'me',
              author_name: 'Quản trị viên',
              audience,
              body,
              reply_to: null,
              created_at: new Date().toISOString(),
              deleted_at: null,
            },
            ...cur,
          ])
        }
      />

      <Followers
        names={['Quản trị viên', 'Đặng Thị Thanh Nga']}
        muted={muted}
        onToggle={() => setMuted((m) => !m)}
      />

      <NoteStream
        rows={rows}
        now={now}
        onDelete={(id) => setNotes((cur) => cur.filter((n) => n.id !== id))}
      />
    </div>
  )
}
