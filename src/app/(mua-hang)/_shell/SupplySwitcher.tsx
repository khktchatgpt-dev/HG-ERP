'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { ChevronsUpDown } from 'lucide-react'
import { Btn } from '@/components/kit'
import { cn } from '@/lib/utils'
import { WORKSPACES, type WorkspaceId } from '@/workspaces/workspaces.config'

/**
 * Ô CHUYỂN KHU cho vỏ Mua hàng — ngồi ở chỗ `brand` của NavRail.
 *
 * VÌ SAO PHẢI DỰNG LẠI, KHÔNG DÙNG `WorkspaceSwitcher` CỦA VỎ CŨ. Ô kia dựng
 * bằng token theme v3 (`bg-accent`, `text-muted-foreground`, `ACCENT_CLASSES`),
 * thả vào đây là trộn hai bộ token trong một màn — đúng thứ CLAUDE.md cấm, và
 * hậu quả thấy được: nền popover lấy màu của hệ kia, chữ mất tương phản.
 * Cùng HÀNH VI, khác CÁCH TÔ.
 *
 * VÌ SAO CẦN Ở ĐÂY. Trước 15/09 người vào phòng Cung ứng rơi vào vỏ cũ, vốn có
 * sẵn ô chuyển khu. Từ lúc dời cửa vào sang khu này (e543b93), rail chỉ có chữ
 * "MH" đứng im — admin và người xem chéo vào đây là KẸT, không còn đường sang
 * phòng khác ngoài gõ URL. Đó là hồi quy do chính việc dời cửa gây ra.
 *
 * Danh sách `switchable` do server tính bằng `listAccessibleWorkspaces` — cùng
 * một nguồn với vỏ cũ, không khai tập quyền thứ hai.
 */
export function SupplySwitcher({
  current,
  switchable,
  expanded,
}: {
  current: WorkspaceId
  switchable: { id: WorkspaceId; readonly: boolean }[]
  expanded: boolean
}) {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const off = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false)
    }
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', off)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', off)
      document.removeEventListener('keydown', esc)
    }
  }, [open])

  const ws = WORKSPACES[current]
  // Khu đang đứng luôn có mặt trong danh sách, kể cả khi không nằm trong tập
  // chuyển được (admin đứng ở khu chưa ready) — để người dùng thấy mình ở đâu.
  const list = switchable.some((s) => s.id === current)
    ? switchable
    : [{ id: current, readonly: false }, ...switchable]

  const badge = (
    <span className="grid size-[22px] shrink-0 place-items-center rounded-[var(--radius-sm)] bg-[var(--act)] text-[10px] font-bold text-[var(--act-ink)]">
      MH
    </span>
  )

  // Một khu duy nhất thì không có gì để chuyển — bày nút mở ra danh sách một
  // dòng là hứa suông. Giữ nguyên nhãn tĩnh như trước.
  if (list.length <= 1) {
    return expanded ? (
      <span className="flex items-baseline gap-2">
        {badge}
        <span className="text-[13px] font-bold tracking-[-.01em]">Mua hàng</span>
      </span>
    ) : (
      badge
    )
  }

  return (
    <div ref={box} className="relative">
      {/*
        `Btn` của kit chứ không `<button>` thô — cổng lint `hg/no-raw-control`
        chặn thẻ thô, mà thành phần nó gợi ý (`shadcn/button`) lại là token
        theme v3, thả vào vỏ kit là trộn hệ. `Btn` cho ghi đè class và chuyển
        tiếp sự kiện nên gỡ hết viền/nền để về đúng dáng một nhãn bấm được.
      */}
      <Btn
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Chuyển khu — đang ở ${ws.label}`}
        title={expanded ? undefined : `Chuyển khu — đang ở ${ws.label}`}
        className={cn(
          'h-auto gap-2 rounded-[var(--radius-sm)] border-0 bg-transparent px-1 py-1',
          'hover:border-0 hover:bg-[var(--surface-sunken)]',
          expanded ? 'flex w-full text-left' : 'justify-center px-0',
        )}
      >
        {badge}
        {expanded && (
          <>
            <span className="min-w-0 flex-1 truncate text-[13px] font-bold tracking-[-.01em]">
              Mua hàng
            </span>
            <ChevronsUpDown
              className="size-3.5 shrink-0 text-[var(--ink-3)]"
              strokeWidth={1.8}
              aria-hidden
            />
          </>
        )}
      </Btn>

      {open && (
        <div
          role="menu"
          className="absolute top-[calc(100%+6px)] left-0 z-[var(--z-float)] max-h-80 w-[216px] overflow-auto rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface-card)] py-1 shadow-[0_8px_24px_rgba(17,24,38,.14)]"
        >
          {list.map(({ id, readonly }) => {
            const w = WORKSPACES[id]
            const active = id === current
            return (
              <Link
                key={id}
                href={`${w.home ?? w.route}/`}
                onClick={() => setOpen(false)}
                className={cn(
                  'flex items-center gap-2 px-3 py-[6px] text-[12.5px] hover:bg-[var(--surface-sunken)]',
                  active ? 'font-semibold text-[var(--ink)]' : 'text-[var(--ink-2)]',
                )}
              >
                <span className="flex-1 truncate">{w.label}</span>
                {readonly && (
                  <span className="rounded-[3px] bg-[var(--surface-sunken)] px-1 py-px text-[9px] tracking-wide text-[var(--ink-3)] uppercase">
                    chỉ xem
                  </span>
                )}
                {active && <span className="text-[var(--act)]">•</span>}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
