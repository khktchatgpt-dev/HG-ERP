'use client'

import { useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Btn, Tag } from './Primitives'

/**
 * ══════════════════════════════════════════════════════════════════════════
 * TRAO ĐỔI TRÊN CHỨNG TỪ (chatter)
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Chứng từ đã có DÒNG THỜI GIAN — thứ MÁY ghi. Đây là chỗ cho thứ NGƯỜI viết.
 *
 * VÌ SAO CẦN: đo được 66/68 đơn nằm im 5-7 ngày mà không dòng nào giải thích
 * vì sao. Câu trả lời tồn tại — nó nằm trên Zalo. Ba tháng sau không ai tra
 * ra. Odoo gọi lớp này là "chatter" và nó là khác biệt lớn nhất giữa một ERP
 * thật với một app quản lý dữ liệu.
 *
 * BA QUYẾT ĐỊNH THIẾT KẾ:
 *
 * 1. GHI CHÚ VÀ MỐC MÁY GHI NẰM CHUNG MỘT DÒNG, không phải hai tab. Thứ tự
 *    mới là thứ giải thích được chuyện gì đã xảy ra: "gửi duyệt 03/09 → ghi
 *    chú 'GĐ đi công tác' 04/09 → duyệt 08/09" chỉ có nghĩa khi ba dòng nằm
 *    cạnh nhau.
 *
 * 2. HAI LOẠI NGƯỜI ĐỌC TÁCH BẠCH, và ô nhập ĐỔI MÀU theo loại đang chọn.
 *    Gộp một ô thì sớm muộn có người gõ "thằng này giao hàng như mèo mửa" rồi
 *    bấm gửi cho chính nhà cung cấp đó. Màu là hàng rào cuối cùng trước khi
 *    tay bấm.
 *
 * 3. Ô NHẬP ĐẶT TRÊN ĐẦU, cùng phía với ghi chú mới nhất. Đặt dưới cùng thì
 *    trên một chứng từ có 40 dòng trao đổi, muốn viết một câu phải cuộn hết.
 */

export type NoteItem = {
  id: string
  body: string
  author_name: string | null
  audience: 'internal' | 'partner'
  created_at: string
  mine?: boolean
}

export type StreamRow =
  | { kind: 'mark'; at: string; key: string; label: string; actor?: string | null }
  | { kind: 'note'; at: string; note: NoteItem }

function khiNao(at: string, now: Date): string {
  const d = new Date(at)
  const phut = Math.floor((now.getTime() - d.getTime()) / 60000)
  // Mốc gần thì nói tương đối ("2 giờ trước") vì người đọc đang theo dõi việc
  // đang chạy; mốc xa thì nói ngày tháng vì lúc đó họ đang tra lại lịch sử.
  if (phut < 1) return 'vừa xong'
  if (phut < 60) return `${phut} phút trước`
  if (phut < 24 * 60) return `${Math.floor(phut / 60)} giờ trước`
  if (phut < 7 * 24 * 60) return `${Math.floor(phut / (60 * 24))} ngày trước`
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

/** Ô viết ghi chú. Chọn người đọc TRƯỚC khi gõ, không phải sau. */
export function NoteComposer({
  onSubmit,
  busy = false,
  partnerLabel = 'Gửi nhà cung cấp',
}: {
  onSubmit: (body: string, audience: 'internal' | 'partner') => void
  busy?: boolean
  /** Tên bên ngoài cụ thể — "Gửi NCC" mơ hồ hơn "Gửi Thép Asia". */
  partnerLabel?: string
}) {
  const [body, setBody] = useState('')
  const [audience, setAudience] = useState<'internal' | 'partner'>('internal')
  const ngoai = audience === 'partner'

  function gui() {
    const t = body.trim()
    if (!t || busy) return
    onSubmit(t, audience)
    setBody('')
  }

  return (
    <div
      className={cn(
        'rounded-[var(--radius)] border',
        // Ô nhập ĐỔI MÀU khi đang ở chế độ gửi ra ngoài — hàng rào cuối cùng
        // trước khi tay bấm. Chỉ đổi chữ nhãn thì mắt lướt qua không thấy.
        ngoai
          ? 'border-[var(--warn)] bg-[var(--warn-wash)]'
          : 'border-[var(--line)] bg-[var(--surface-card)]',
      )}
    >
      <div className="flex items-center gap-1 px-2 pt-2">
        {(['internal', 'partner'] as const).map((a) => (
          <button
            key={a}
            type="button"
            onClick={() => setAudience(a)}
            className={cn(
              'h-[22px] rounded-[var(--radius-sm)] px-2 text-[11.5px] font-medium',
              audience === a
                ? a === 'partner'
                  ? 'bg-[var(--warn)] text-white'
                  : 'bg-[var(--act)] text-[var(--act-ink)]'
                : 'text-[var(--ink-3)] hover:bg-[var(--surface-hover)]',
            )}
          >
            {a === 'internal' ? 'Ghi chú nội bộ' : partnerLabel}
          </button>
        ))}
      </div>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          // Ctrl/Cmd+Enter gửi. Enter trơn XUỐNG DÒNG: ghi chú nghiệp vụ hay
          // dài nhiều dòng ("NCC báo trễ / đã gọi chị Hoa / hẹn lại 12/09"),
          // gửi nhầm khi mới viết nửa câu là mất công gõ lại.
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) gui()
        }}
        rows={2}
        placeholder={
          ngoai
            ? 'Nội dung gửi ra ngoài — viết như đang nói với họ…'
            : 'Chuyện gì đang xảy ra với chứng từ này…'
        }
        className="w-full resize-none bg-transparent px-3 py-2 text-[12.5px] leading-relaxed outline-none placeholder:text-[var(--ink-3)]"
      />
      <div className="flex items-center justify-between gap-2 px-3 pb-2">
        <span className="text-[10.5px] text-[var(--ink-3)]">
          {ngoai
            ? '⚠ Nội dung này gửi ra ngoài công ty'
            : 'Chỉ người trong công ty đọc được · ⌘+Enter để gửi'}
        </span>
        <Btn primary onClick={gui} disabled={!body.trim() || busy}>
          {busy ? 'Đang lưu…' : 'Ghi'}
        </Btn>
      </div>
    </div>
  )
}

/**
 * DÒNG TRAO ĐỔI — ghi chú của người + mốc của máy, trộn theo thời gian.
 *
 * Mốc máy ghi để MỜ và một dòng; ghi chú của người thì đậm và có khung. Hai
 * loại phải phân biệt được bằng mắt trong nửa giây: một cái là sự kiện, một
 * cái là lời nói.
 */
export function NoteStream({
  rows,
  now,
  onDelete,
  empty,
}: {
  rows: StreamRow[]
  /** Thời điểm tham chiếu, TÍNH Ở NGOÀI — không đọc đồng hồ trong render. */
  now: Date
  onDelete?: (id: string) => void
  empty?: ReactNode
}) {
  if (rows.length === 0) {
    return (
      <p className="py-3 text-[12px] leading-relaxed text-[var(--ink-2)]">
        {empty ?? 'Chưa ai ghi gì về chứng từ này.'}
      </p>
    )
  }

  return (
    <ol className="flex flex-col gap-2 pt-1">
      {rows.map((r) =>
        r.kind === 'mark' ? (
          <li
            key={`m-${r.key}-${r.at}`}
            /*
              Mốc máy ghi phải MỜ HƠN ghi chú nhưng vẫn ĐỌC ĐƯỢC. Đo trên ảnh
              09/09: dùng --ink-3 cho cả dòng thì nó chìm gần như vô hình trên
              nền sáng, mà đây là thứ giải thích thứ tự sự việc. Nhãn lấy màu
              mực thường, chỉ phần thời gian mới nhạt.
            */
            className="flex items-baseline gap-2 pl-1 text-[11.5px]"
          >
            <span className="size-[5px] shrink-0 rounded-full bg-[var(--ink-3)]" />
            <span className="font-medium text-[var(--ink-2)]">{r.label}</span>
            {r.actor && <span className="text-[var(--ink-3)]">· {r.actor}</span>}
            <span className="num text-[var(--ink-3)]">{khiNao(r.at, now)}</span>
          </li>
        ) : (
          <li
            key={`n-${r.note.id}`}
            className={cn(
              'rounded-[var(--radius)] border px-3 py-2',
              r.note.audience === 'partner'
                ? 'border-[var(--warn)] bg-[var(--warn-wash)]'
                : 'border-[var(--hair)] bg-[var(--surface)]',
            )}
          >
            <div className="flex items-baseline gap-2">
              <span className="text-[12px] font-semibold">
                {r.note.author_name ?? 'Không rõ'}
              </span>
              {r.note.audience === 'partner' && <Tag tone="warn">đã gửi ra ngoài</Tag>}
              <span className="num text-[10.5px] text-[var(--ink-3)]">
                {khiNao(r.note.created_at, now)}
              </span>
              <span className="flex-1" />
              {r.note.mine && onDelete && (
                <button
                  type="button"
                  onClick={() => onDelete(r.note.id)}
                  className="text-[10.5px] text-[var(--ink-3)] hover:text-[var(--stop)]"
                >
                  gỡ
                </button>
              )}
            </div>
            {/* `whitespace-pre-wrap`: người ta xuống dòng có chủ đích ("đã gọi
                / hẹn lại 12/09"), ép về một dòng là mất ý. */}
            <p className="mt-[3px] text-[12.5px] leading-relaxed whitespace-pre-wrap">
              {r.note.body}
            </p>
          </li>
        ),
      )}
    </ol>
  )
}

/**
 * Người theo dõi — ai được báo khi có ghi chú mới.
 *
 * Bày ra vì đây là câu hỏi "ai đang biết chuyện này". Không có nó thì người
 * viết không rõ mình đang nói với ai, và sẽ đi nhắn Zalo cho chắc.
 */
export function Followers({
  names,
  muted,
  onToggle,
}: {
  names: string[]
  /** Người đang xem đã tắt theo dõi chưa. */
  muted: boolean
  onToggle: () => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-[11.5px]">
      <span className="text-[var(--ink-3)]">Theo dõi:</span>
      {names.length === 0 ? (
        <span className="text-[var(--ink-empty)]">chưa ai</span>
      ) : (
        names.map((n) => (
          <span
            key={n}
            className="rounded-[var(--radius-sm)] bg-[var(--surface)] px-1.5 py-[1px] text-[var(--ink-2)]"
          >
            {n}
          </span>
        ))
      )}
      <button
        type="button"
        onClick={onToggle}
        className="ml-1 text-[var(--act)] hover:underline"
      >
        {muted ? 'theo dõi lại' : 'bỏ theo dõi'}
      </button>
    </div>
  )
}
