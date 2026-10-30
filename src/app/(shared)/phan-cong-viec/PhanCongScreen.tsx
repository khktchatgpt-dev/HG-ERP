'use client'

import { useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { ASSIGN_BLOCKED, type GivenFilter, type MineFilter } from '@/lib/task-flow'
import type {
  Assignee,
  GivenBoard,
  MineBoard,
} from '@/modules/workflow/tasks/tasks.service'
import { GiaoViec, type GiaoViecHandle } from './giao-viec'
import { btn } from './phan-cong.shared'
import { ViecCuaToi } from './viec-cua-toi'
import { ViecToiGiao } from './viec-toi-giao'

/** Việc chuông vừa mở (`?viec=`): mục + chip đang chứa nó. */
export type PhanCongFocus =
  | { id: string; muc: 'cua-toi'; filter: MineFilter }
  | { id: string; muc: 'giao'; filter: GivenFilter }

type Muc = PhanCongFocus['muc']

/**
 * PHÂN CÔNG VIỆC — trang dùng chung (bản vẽ https://claude.ai/artifact/FQxKHGKQnhWt5dBjGA8n5k).
 *
 * Hai mục: "Việc của tôi" (mọi người — người ngoài Cung ứng nhận và báo hoàn thành ở
 * đây, chốt D2; P5) và "Việc tôi giao" + hộp "Giao việc" bên phải (sếp, quản lý; P2).
 * Người Cung ứng có cùng hai bảng trên Bàn làm việc. Viết không kit theo chỉ đạo chủ
 * dự án.
 */
export function PhanCongScreen({
  meId,
  today,
  board,
  mine,
  people,
  focus,
}: {
  meId: string
  today: string
  /** null = người xem không giao được việc (nhân viên). */
  board: GivenBoard | null
  mine: MineBoard
  people: Assignee[]
  /** Chuông mở trang thì có; null = mở thường. */
  focus: PhanCongFocus | null
}) {
  const formRef = useRef<GiaoViecHandle>(null)
  const router = useRouter()
  const [sent, setSent] = useState<string | null>(null)
  // Mở thường: người giao vào thẳng việc mình giao (trang dựng cho họ trước), người
  // nhận vào việc của mình. Chuông thì vào đúng mục có việc đó.
  const [muc, setMuc] = useState<Muc>(focus?.muc ?? (board ? 'giao' : 'cua-toi'))
  const tab: Muc = board ? muc : 'cua-toi'

  function giaoViec() {
    // Hộp chỉ có ở mục "Việc tôi giao": đổi mục rồi vẽ NGAY, mới đặt con trỏ được.
    if (tab !== 'giao') flushSync(() => setMuc('giao'))
    formRef.current?.focus()
  }

  const tabs: { id: Muc; label: string; n: number; red: boolean }[] = [
    { id: 'cua-toi', label: 'Việc của tôi', n: mine.summary.doing, red: mine.summary.overdue > 0 }, // prettier-ignore
    ...(board
      ? [{ id: 'giao' as const, label: 'Việc tôi giao', n: board.summary.open, red: board.summary.to_approve > 0 }] // prettier-ignore
      : []),
  ]

  return (
    <div className="flex min-h-0 flex-col">
      <header className="flex items-center gap-3 border-b border-[var(--border)] bg-[var(--card)] px-3.5 py-2">
        <h1 className="text-[18px] font-semibold text-[var(--foreground)]">
          Phân công việc
        </h1>
        <div className="flex-1" />
        {board ? (
          <button type="button" className={btn('primary')} onClick={giaoViec}>
            <Plus size={14} aria-hidden />
            Giao việc
          </button>
        ) : (
          <span className="text-[12px] text-[var(--muted-foreground)]">
            {ASSIGN_BLOCKED}
          </span>
        )}
      </header>

      <div
        role="tablist"
        aria-label="Mục"
        className="flex gap-0.5 border-b border-[var(--input)] bg-[var(--card)] px-3.5 text-[13px]"
      >
        {tabs.map((t) => {
          const on = t.id === tab
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setMuc(t.id)}
              className={`border-b-2 px-2.5 pt-2.5 pb-2 ${on ? 'border-[var(--primary)] font-semibold text-[var(--accent-foreground)]' : 'border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]'}`}
            >
              {t.label}
              <span
                className={`ml-1 font-mono text-[11px] ${t.red ? 'font-semibold text-[var(--stop)]' : 'text-[var(--muted-foreground)]'}`}
              >
                {t.n}
              </span>
            </button>
          )
        })}
      </div>

      {tab === 'cua-toi' && (
        <ViecCuaToi
          board={mine}
          today={today}
          initialFilter={focus?.muc === 'cua-toi' ? focus.filter : undefined}
          focusId={focus?.muc === 'cua-toi' ? focus.id : null}
        />
      )}

      {tab === 'giao' && board && (
        <div className="grid min-h-0 grid-cols-[minmax(0,1fr)_340px] items-start">
          <div className="min-w-0 border-r border-[var(--border)]">
            <ViecToiGiao
              board={board}
              today={today}
              initialFilter={focus?.muc === 'giao' ? focus.filter : undefined}
              focusId={focus?.muc === 'giao' ? focus.id : null}
            />
          </div>
          <aside className="flex flex-col gap-2 bg-[var(--card)] px-3.5 py-3">
            <GiaoViec
              ref={formRef}
              people={people}
              meId={meId}
              today={today}
              onDone={(name) => {
                setSent(`Đã giao cho ${name}.`)
                // Tải lại danh sách: việc vừa giao phải hiện ngay bên trái.
                router.refresh()
              }}
            />
            {sent && (
              <p role="status" className="text-[12px] font-medium text-[var(--done)]">
                {sent}
              </p>
            )}
          </aside>
        </div>
      )}
    </div>
  )
}
