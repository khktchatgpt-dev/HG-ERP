'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { matchesGiven } from '@/lib/task-flow'
import type {
  Assignee,
  GivenBoard,
  GivenItem,
} from '@/modules/workflow/tasks/tasks.service'
import { GiaoViec, type GiaoViecHandle } from '@/app/(shared)/phan-cong-viec/giao-viec'
import { BangViecToiGiao } from '@/app/(shared)/phan-cong-viec/viec-toi-giao'

/**
 * PHÂN CÔNG VIỆC trên Bàn làm việc của sếp / quản lý (P4, bản vẽ A 30/10/2026):
 * ô "Việc tôi giao" + nút "Giao việc" góc trên phải mở hộp NGAY BÊN PHẢI bảng.
 *
 * VIẾT KHÔNG KIT (D1) và DÙNG LẠI đúng bảng + hộp đã dựng ở trang Phân công việc
 * (P2): một luật, hai chỗ đặt. Khối P2 gọi màu bằng tên token theme-v3
 * (`--primary`, `--border`…), còn Bàn làm việc nằm trong khung `.kit` có màu hành
 * động riêng (`--act`) — để nguyên là hai màu xanh trên một màn. `KIT_BRIDGE` đặt
 * lại các tên đó theo màu kit cho riêng vùng này.
 */
const KIT_BRIDGE = {
  '--primary': 'var(--act)',
  '--primary-foreground': 'var(--act-ink)',
  '--accent': 'var(--act-wash)',
  '--accent-foreground': 'var(--act-text)',
  '--foreground': 'var(--ink)',
  '--muted-foreground': 'var(--ink-3)',
  '--placeholder': 'var(--ink-3)',
  '--card': 'var(--surface-card)',
  '--muted': 'var(--surface-raised)',
  '--border': 'var(--hair)',
  '--input': 'var(--line)',
} as React.CSSProperties

/** Việc tôi giao còn mở — CÙNG phép lọc "Chưa xong" của trang Phân công việc. */
export function openGiven(board: GivenBoard, today: string): GivenItem[] {
  return board.items.filter((t) => matchesGiven(t, 'open', today))
}

/** Nút "Giao việc" ở góc trên phải — cùng cỡ với nút của đầu trang. */
export function NutGiaoViec({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-[var(--ctl-h)] items-center gap-2 rounded-[var(--radius)] border border-[var(--act)] bg-[var(--act)] px-3 text-[12px] font-semibold whitespace-nowrap text-[var(--act-ink)] hover:bg-[var(--act-hover)]"
    >
      <Plus size={14} aria-hidden />
      Giao việc
    </button>
  )
}

/** Ô "Việc tôi giao": việc chưa xong, chờ tôi duyệt lên đầu. Đã xong / huỷ ở trang riêng. */
export function ViecToiGiaoBan({
  board,
  today,
  onGive,
}: {
  board: GivenBoard
  today: string
  /** Mở hộp Giao việc (nút ở trạng thái rỗng). */
  onGive: () => void
}) {
  const rows = openGiven(board, today)
  const s = board.summary
  if (rows.length === 0)
    return (
      <div
        style={KIT_BRIDGE}
        className="flex flex-col items-start gap-1 bg-[var(--surface-card)] px-4 py-8"
      >
        <p className="text-[13px] font-semibold text-[var(--ink)]">
          Không có việc nào bạn giao đang mở
        </p>
        <p className="text-[12px] text-[var(--ink-3)]">
          {board.items.length === 0
            ? 'Bạn chưa giao việc nào. Chọn người, ghi việc, đặt hạn — người nhận có chuông ngay.'
            : 'Việc đã xong / đã huỷ trong 30 ngày xem ở trang Phân công việc.'}
        </p>
        <div className="mt-1.5 flex items-center gap-3">
          <NutGiaoViec onClick={onGive} />
          {board.items.length > 0 && (
            <Link
              href="/phan-cong-viec"
              className="text-[12px] text-[var(--act-text)] hover:underline"
            >
              Mở trang Phân công việc ↗
            </Link>
          )}
        </div>
      </div>
    )
  return (
    <div style={KIT_BRIDGE} className="bg-[var(--surface-card)]">
      <BangViecToiGiao
        board={board}
        rows={rows}
        footer={
          <>
            {s.open} chưa xong · {s.to_approve} chờ tôi duyệt · {s.overdue} quá hạn · việc
            đã xong / huỷ xem ở{' '}
            <Link
              href="/phan-cong-viec"
              className="text-[var(--act-text)] hover:underline"
            >
              trang Phân công việc ↗
            </Link>
          </>
        }
      />
    </div>
  )
}

/**
 * Hộp Giao việc bên phải bảng. Chỉ mở khi bấm nút, đóng thì bảng chiếm hết bề
 * rộng. Giao xong thì GIỮ hộp mở (thường giao vài việc một lượt) và tải lại trang
 * để dòng mới hiện ngay ở ô "Việc tôi giao".
 */
export function HopGiaoViec({
  people,
  meId,
  today,
  onClose,
  onDone,
  ref,
}: {
  people: Assignee[]
  meId: string
  today: string
  onClose: () => void
  /** Sau khi giao xong — màn cha chuyển sang ô "Việc tôi giao". */
  onDone: () => void
  ref?: React.Ref<GiaoViecHandle>
}) {
  const router = useRouter()
  const [sent, setSent] = useState<string | null>(null)
  return (
    <aside
      aria-label="Hộp giao việc"
      style={KIT_BRIDGE}
      className="flex w-[340px] shrink-0 flex-col gap-2 overflow-auto border-l border-[var(--line)] bg-[var(--surface-card)] px-3.5 py-3"
    >
      <GiaoViec
        ref={ref}
        people={people}
        meId={meId}
        today={today}
        onClose={onClose}
        onDone={(name) => {
          setSent(`Đã giao cho ${name}.`)
          onDone()
          router.refresh()
        }}
      />
      {sent && (
        <p role="status" className="text-[12px] font-medium text-[var(--done)]">
          {sent}
        </p>
      )}
    </aside>
  )
}
