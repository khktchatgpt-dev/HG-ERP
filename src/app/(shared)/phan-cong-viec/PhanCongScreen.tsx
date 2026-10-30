'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { ASSIGN_BLOCKED } from '@/lib/task-flow'
import type { Assignee, GivenBoard } from '@/modules/workflow/tasks/tasks.service'
import { GiaoViec, type GiaoViecHandle } from './giao-viec'
import { btn } from './phan-cong.shared'
import { ViecToiGiao } from './viec-toi-giao'

/**
 * PHÂN CÔNG VIỆC — trang dùng chung (bản vẽ https://claude.ai/artifact/FQxKHGKQnhWt5dBjGA8n5k).
 *
 * P2 (30/10/2026): tab "Việc tôi giao" + hộp "Giao việc" bên phải, cho sếp và quản
 * lý. Tab "Việc của tôi" (người nhận báo hoàn thành) là P3; "Theo người" là P4.
 * Viết không kit theo chỉ đạo chủ dự án.
 */
export function PhanCongScreen({
  meId,
  today,
  board,
  people,
}: {
  meId: string
  today: string
  /** null = người xem không giao được việc (nhân viên). */
  board: GivenBoard | null
  people: Assignee[]
}) {
  const formRef = useRef<GiaoViecHandle>(null)
  const router = useRouter()
  const [sent, setSent] = useState<string | null>(null)

  return (
    <div className="flex min-h-0 flex-col">
      <header className="flex items-center gap-3 border-b border-[var(--border)] bg-[var(--card)] px-3.5 py-2">
        <h1 className="text-[18px] font-semibold text-[var(--foreground)]">
          Phân công việc
        </h1>
        <div className="flex-1" />
        {board ? (
          <button
            type="button"
            className={btn('primary')}
            onClick={() => formRef.current?.focus()}
          >
            <Plus size={14} aria-hidden />
            Giao việc
          </button>
        ) : (
          <span className="text-[12px] text-[var(--muted-foreground)]">
            {ASSIGN_BLOCKED}
          </span>
        )}
      </header>

      <nav
        aria-label="Mục"
        className="flex gap-0.5 border-b border-[var(--input)] bg-[var(--card)] px-3.5 text-[13px]"
      >
        <span
          aria-current="page"
          className="border-b-2 border-[var(--primary)] px-2.5 pt-2.5 pb-2 font-semibold text-[var(--accent-foreground)]"
        >
          Việc tôi giao
          {board && (
            <span className="ml-1 font-mono text-[11px] text-[var(--muted-foreground)]">
              {board.summary.open}
            </span>
          )}
        </span>
      </nav>

      {board ? (
        <div className="grid min-h-0 grid-cols-[minmax(0,1fr)_340px] items-start">
          <div className="min-w-0 border-r border-[var(--border)]">
            <ViecToiGiao board={board} today={today} />
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
      ) : (
        <div className="flex flex-col gap-1 bg-[var(--card)] px-4 py-8">
          <p className="text-[13px] font-semibold text-[var(--foreground)]">
            Trang này để sếp và quản lý giao việc
          </p>
          <p className="text-[12px] text-[var(--muted-foreground)]">
            Việc được giao cho bạn sẽ hiện ở mục &quot;Việc của tôi&quot; — mục đó đang
            làm ở bước tiếp theo.
          </p>
        </div>
      )}
    </div>
  )
}
