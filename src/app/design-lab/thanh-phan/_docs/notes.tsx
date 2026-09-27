'use client'

import { useState } from 'react'
import { Followers, NoteComposer, NoteStream, type StreamRow } from '@/components/kit'
import { CompDoc } from '../../_lab/CompDoc'

/**
 * TRANG TÀI LIỆU — trao đổi trên chứng từ (B7, 24/09/2026).
 *
 * `now` CỐ ĐỊNH, đúng cách màn thật phải làm (đọc đồng hồ một lần ở ngoài,
 * không đọc trong render) — nên ghi chú vừa gõ trong ví dụ luôn là “vừa xong”.
 */
const NOW = new Date('2026-09-10T08:15:00+07:00')
const NOW_ISO = '2026-09-10T08:15:00+07:00'

const DONG: StreamRow[] = [
  {
    kind: 'note',
    at: '2026-09-09T16:40:00+07:00',
    note: {
      id: 'n1',
      body: 'Bên Thành Đạt báo hết vít 7 màu, hẹn tuần sau mới có.\nCó nên tách dòng đó ra đơn khác để phần còn lại đi trước không?',
      author_name: 'Nguyễn Văn A',
      audience: 'internal',
      created_at: '2026-09-09T16:40:00+07:00',
      mine: true,
    },
  },
  { kind: 'mark', at: '2026-09-05T16:10:00+07:00', key: 'han', label: 'Dời hạn giao 05/09 → 07/09', actor: 'Lê Văn D' }, // prettier-ignore
  {
    kind: 'note',
    at: '2026-09-03T09:15:00+07:00',
    note: {
      id: 'n2',
      body: 'Xác nhận đã nhận đơn, giao đợt đầu ngày 07/09.',
      author_name: 'Trần B · Cơ khí Thành Đạt',
      audience: 'partner',
      created_at: '2026-09-03T09:15:00+07:00',
    },
  },
  { kind: 'mark', at: '2026-08-28T10:02:00+07:00', key: 'tao', label: 'Soạn đơn', actor: 'Nguyễn Văn A' }, // prettier-ignore
]

function KhoiTraoDoi() {
  const [rows, setRows] = useState<StreamRow[]>(DONG)
  const [muted, setMuted] = useState(false)
  const [n, setN] = useState(0)
  return (
    <div className="grid max-w-[560px] gap-3">
      <NoteComposer
        partnerLabel="Gửi Cơ khí Thành Đạt"
        onSubmit={(body, audience) => {
          setN((x) => x + 1)
          setRows((cur) => [
            {
              kind: 'note',
              at: NOW_ISO,
              note: {
                id: `moi-${n}`,
                body,
                author_name: 'Nguyễn Văn A',
                audience,
                created_at: NOW_ISO,
                mine: true,
              },
            },
            ...cur,
          ])
        }}
      />
      <Followers
        names={['Nguyễn Văn A', 'Lê Văn D', 'Trần Thị C']}
        muted={muted}
        onToggle={() => setMuted((v) => !v)}
      />
      <NoteStream
        rows={rows}
        now={NOW}
        onDelete={(id) =>
          setRows((cur) => cur.filter((r) => r.kind !== 'note' || r.note.id !== id))
        }
      />
    </div>
  )
}

/** onSubmit trả Promise bị TỪ CHỐI — như server trả 500. Ô giữ nguyên chữ. */
function LuuHong() {
  const [loi, setLoi] = useState('')
  return (
    <div className="grid max-w-[560px] gap-2">
      <NoteComposer
        partnerLabel="Gửi Cơ khí Thành Đạt"
        onSubmit={() => {
          setLoi(
            'Chưa ghi được (giả lập lỗi máy chủ). Nội dung vẫn còn trong ô — thử lại.',
          )
          return Promise.reject(new Error('500'))
        }}
      />
      {loi && (
        <p role="alert" className="text-k-sm text-[var(--stop)]">
          {loi}
        </p>
      )}
    </div>
  )
}

export default function DocNotes() {
  return (
    <CompDoc
      family="notes"
      summary={
        <>
          Trao đổi trên chứng từ (Odoo gọi là <i>chatter</i>): ô viết chọn người đọc{' '}
          <b>trước</b> khi gõ, dòng trộn ghi chú của người với mốc máy ghi theo thời gian,
          và danh sách ai đang được báo. Đây là chỗ cho câu “vì sao” — thứ hôm nay đang
          nằm trên Zalo.
        </>
      }
      useWhen="một chứng từ nằm im hay đổi hướng và cần một chỗ ghi lý do mà ba tháng sau còn tra ra — đơn mua, lệnh SX."
      avoidWhen={
        <>
          chỉ cần các mốc máy ghi (dùng <code>Timeline</code>), hoặc lý do là một TRƯỜNG
          bắt buộc của thao tác (lý do huỷ, lý do mở khoá) — đặt vào hộp xác nhận của thao
          tác đó, đừng để thành ghi chú tự do.
        </>
      }
      variants={[
        {
          name: 'Khối đầy đủ — viết, theo dõi, đọc',
          when: 'gõ một câu rồi Ctrl+Enter; bấm “Gửi Cơ khí Thành Đạt” để thấy ô đổi màu; “gỡ” chỉ có trên ghi chú của chính mình.',
          demo: <KhoiTraoDoi />,
        },
        {
          name: 'Lưu hỏng — chữ còn nguyên trong ô',
          when: 'onSubmit trả Promise: ô CHỜ kết quả — lưu được mới xoá, Promise bị từ chối thì giữ chữ để bấm lại. Gõ một câu rồi bấm Ghi: ví dụ này luôn hỏng.',
          demo: <LuuHong />,
        },
        {
          name: 'Chưa có gì — câu rỗng nói việc nên ghi',
          when: 'truyền empty thay cho câu mặc định; Followers rỗng thì nói “chưa ai”.',
          demo: (
            <div className="grid max-w-[560px] gap-2">
              <Followers names={[]} muted={false} onToggle={() => {}} />
              <NoteStream
                rows={[]}
                now={NOW}
                empty="Chưa ai ghi gì. Nếu đơn đang chờ NCC trả lời, ghi lại đã gọi ai, hẹn ngày nào — để người sau khỏi hỏi lại."
              />
            </div>
          ),
        },
      ]}
      states={[
        {
          state: 'Ô viết — nội bộ',
          looks:
            'Viền mảnh, nền thẻ; nút “Ghi chú nội bộ” nền màu hành động; dòng dưới: “Chỉ người trong công ty đọc được · ⌘+Enter để gửi”.',
          behaves: 'Mặc định mỗi lần dựng. Enter xuống dòng, Ctrl/⌘+Enter gửi.',
        },
        {
          state: 'Ô viết — ghi lại điều đã báo ra ngoài',
          looks:
            'Cả ô viền + nền màu cảnh báo; nút người đọc nền cảnh báo; chỗ gợi ý đổi; dòng dưới “⚠ Chỉ GHI LẠI — hệ thống không gửi gì ra ngoài” (hệ thống chưa có kênh gửi; câu cũ nói sai).',
          behaves:
            'Như trên. Kit chỉ truyền audience = partner — gửi thật hay không là việc của màn gọi.',
        },
        {
          state: 'Ô viết — trống / đang lưu',
          looks: 'Nút “Ghi” xám đặc; busy thì chữ thành “Đang lưu…”.',
          behaves:
            'Khoá cứng; Ctrl+Enter bị nuốt. onSubmit trả Promise thì ô CHỜ: lưu được mới xoá, bị từ chối (hoặc onSubmit ném lỗi) thì chữ còn nguyên. Không trả Promise thì xoá ngay như trước.',
        },
        {
          state: 'Dòng — mốc máy ghi',
          looks: 'Một dòng, chấm nhỏ; nhãn màu mực phụ, người làm và thời gian nhạt.',
          behaves: 'Tĩnh.',
        },
        {
          state: 'Dòng — ghi chú',
          looks:
            'Khung viền tóc, tên đậm, thời gian; ghi chú đã báo ra ngoài thì khung màu cảnh báo + nhãn “đã báo ra ngoài”. Xuống dòng trong nội dung được giữ.',
          behaves:
            'Có nút “gỡ” khi mine và có onDelete — bấm là gọi ngay, không hỏi lại.',
        },
        {
          state: 'Thời gian',
          looks:
            '“vừa xong” / “N phút trước” / “N giờ trước” / “N ngày trước”; từ 7 ngày trở lên in dd/mm/yyyy.',
          behaves: 'Tính so với now truyền vào.',
        },
        {
          state: 'Dòng rỗng',
          looks: 'Một đoạn chữ phụ: empty, hoặc “Chưa ai ghi gì về chứng từ này.”',
          behaves: 'Tĩnh.',
        },
      ]}
      a11y={{
        role: 'textarea + button bật/tắt aria-pressed (người đọc) + button (Ghi) · list (dòng trao đổi) · button (theo dõi)',
        keys: [
          {
            key: 'Tab',
            does: 'Hai nút người đọc → ô viết → nút Ghi; trong dòng: các nút “gỡ”; rồi nút theo dõi.',
          },
          {
            key: 'Ctrl+Enter / ⌘+Enter',
            does: 'Gửi ghi chú (khi ô có chữ và không busy).',
          },
          { key: 'Enter', does: 'Xuống dòng — cố ý, không gửi.' },
        ],
        reader: (
          <>
            Dòng trao đổi đọc thành danh sách; mỗi ghi chú: tên, “đã báo ra ngoài” nếu có,
            thời gian, nội dung. Hai nút chọn người đọc mang <code>aria-pressed</code> —
            nghe “Ghi chú nội bộ, nút bật/tắt, đã nhấn”, không chỉ thấy bằng màu (vá
            24/09/2026, B7½). <b>Bốn chỗ chưa tốt, ghi thật:</b> ô viết không có nhãn, chỉ
            có chữ gợi ý; mọi nút “gỡ” trùng tên, không nói gỡ ghi chú nào; ghi chú mới
            không được thông báo (không có vùng <code>aria-live</code>); và ký tự ⚠ bị đọc
            thành chữ.
          </>
        ),
      }}
      doDont={[
        {
          do: 'Trộn ghi chú của người và mốc máy ghi vào MỘT dòng theo thời gian.',
          dont: 'Tách thành hai tab — “gửi duyệt → GĐ đi công tác → duyệt” chỉ có nghĩa khi ba dòng nằm cạnh nhau.',
          source: 'kit/Notes.tsx — chú thích đầu file, quyết định 1',
        },
        {
          do: 'Chọn người đọc trước khi gõ; ô đổi màu khi đang ở chế độ ghi lại điều đã báo ra ngoài.',
          dont: 'Một ô chung cho nội bộ và đối tác — sớm muộn có lời nói nội bộ gửi thẳng cho NCC.',
          source: 'kit/Notes.tsx — quyết định 2',
        },
        {
          do: 'Kéo trao đổi về trên chứng từ, kèm người theo dõi.',
          dont: 'Để câu “sao đơn này chưa duyệt” sống trên Zalo — ba tháng sau không ai tra ra.',
          source:
            'docs/thiet-ke-huong-erp.md — lỗ hổng 2 “không có nơi trao đổi trên chứng từ”; docs/tieu-chi-workflow-erp.md §2.6',
        },
        {
          do: 'onSubmit trả Promise của lượt lưu, tự báo lỗi, rồi NÉM lại lỗi — ô mới biết mà giữ chữ (như DocNotesPanel).',
          dont: 'Bắt lỗi rồi nuốt luôn trong onSubmit: Promise thành công, ô xoá sạch câu vừa gõ, trong khi màn báo “Nội dung vẫn còn trong ô”.',
          source:
            'đọc mã 24/09/2026: DocNotesPanel báo “Nội dung vẫn còn trong ô” trong khi gui() xoá ô không chờ kết quả — vá ở B7½: ô chờ Promise, DocNotesPanel ném lại lỗi',
        },
      ]}
      tested={{ file: 'src/components/kit/shell-flow.a11y.test.tsx' }}
    />
  )
}
