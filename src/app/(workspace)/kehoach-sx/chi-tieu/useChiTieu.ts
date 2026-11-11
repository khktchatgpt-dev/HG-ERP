'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api, ApiError } from '@/lib/api'
import { isSingleCell, parsePasteGrid } from '@/lib/entry-paste'
import { shiftIso } from '@/lib/local-date'
import {
  applyPaste,
  blockers,
  cellMap,
  changedDays,
  countTyped,
  fillWeek,
  initialDraft,
  keyOf,
  payloadForDay,
  THU,
  type Draft,
  type Week,
} from './chi-tieu.shared'
import type { ChiTieuRow } from '@/modules/dept/production/targets.service'

/**
 * State + xử lý của màn Chỉ tiêu ngày (theo tuần). Nháp là chuỗi gõ trong ô;
 * lưu = một PUT ghi đè trọn ngày cho MỖI ngày có ô đổi (API cũ giữ nguyên).
 */
export function useChiTieu(week: Week, canEdit: boolean) {
  const router = useRouter()
  const { rows, days, today } = week
  /** Kết quả lượt lưu gần nhất — bày TẠI CHỖ trên thanh chốt (khu SX không dùng toast). */
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)

  const initial = useMemo(() => initialDraft(week.targets), [week.targets])
  const [draft, setDraft] = useState<Draft>(initial)
  // Điều chỉnh nháp theo prop khi `router.refresh()` trả dữ liệu mới (lưu xong).
  const [seen, setSeen] = useState(initial)
  if (seen !== initial) {
    setSeen(initial)
    setDraft(initial)
  }
  const [busy, setBusy] = useState(false)

  const derived = useMemo(() => cellMap(week.derived), [week.derived])
  const done = useMemo(() => cellMap(week.done), [week.done])
  const saved = useMemo(() => cellMap(week.targets), [week.targets])
  const blk = useMemo(() => blockers(rows, days, draft), [rows, days, draft])
  const dirtyDays = useMemo(
    () => changedDays(rows, days, today, draft, initial),
    [rows, days, today, draft, initial],
  )
  const dirtyCells = useMemo(() => {
    let n = 0
    for (const r of rows)
      for (const d of days) {
        if (d < today) continue
        const k = keyOf(r.team_id, r.stage, d)
        if ((draft[k] ?? '').trim() !== (initial[k] ?? '').trim()) n++
      }
    return n
  }, [rows, days, today, draft, initial])
  const typed = countTyped(rows, days, today, draft)

  const setCell = (k: string, v: string) => {
    setMsg(null)
    setDraft((d) => ({ ...d, [k]: v }))
  }
  const fill = (r: ChiTieuRow) => setDraft((d) => fillWeek(r, days, today, d))
  const bo = () => {
    setMsg(null)
    setDraft(initial)
  }

  const focusKey = (k: string) => {
    const el = document.querySelector<HTMLInputElement>(`[data-key="${k}"]`)
    el?.focus()
    el?.select?.()
  }
  const focusCell = (row: number, col: number) => {
    const el = document.querySelector<HTMLInputElement>(
      `[data-cell="${row}:${col}"]:not([disabled])`,
    )
    if (!el) return false
    el.focus()
    el.select?.()
    return true
  }
  const step = (row: number, col: number, dr: number, dc: number) => {
    for (let i = 1; i <= (dr !== 0 ? rows.length : days.length); i++) {
      if (focusCell(row + dr * i, col + dc * i)) return
    }
  }
  const onCellKey =
    (row: number, col: number) => (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.ctrlKey || e.metaKey) return
      const el = e.currentTarget
      if (e.key === 'Enter' || e.key === 'ArrowDown') {
        e.preventDefault()
        step(row, col, e.key === 'Enter' && e.shiftKey ? -1 : 1, 0)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        step(row, col, -1, 0)
      } else if (e.key === 'ArrowLeft' && el.selectionStart === 0) {
        e.preventDefault()
        step(row, col, 0, -1)
      } else if (e.key === 'ArrowRight' && el.selectionEnd === el.value.length) {
        e.preventDefault()
        step(row, col, 0, 1)
      }
    }
  const onCellPaste =
    (row: number, col: number) => (e: React.ClipboardEvent<HTMLInputElement>) => {
      const grid = parsePasteGrid(e.clipboardData.getData('text/plain'))
      if (grid.length === 0 || isSingleCell(grid)) return
      e.preventDefault()
      setDraft((d) => applyPaste(grid, row, col, rows, days, today, d))
    }

  async function save() {
    if (!canEdit || busy || blk.length > 0 || dirtyDays.length === 0) return
    setBusy(true)
    try {
      for (const d of dirtyDays) {
        await api('/api/dept/production/targets', {
          method: 'PUT',
          body: { date: d, rows: payloadForDay(d, rows, draft, week.targets) },
        })
      }
      setMsg({
        ok: true,
        text: `Đã lưu chỉ tiêu ${dirtyDays.length} ngày (${dirtyDays
          .map((d) => THU[days.indexOf(d)])
          .join(' · ')}) — Vào việc và Báo cáo dùng ngay số này`,
      })
      router.refresh()
    } catch (e) {
      setMsg({
        ok: false,
        text: `Lưu thất bại: ${e instanceof ApiError ? e.message : 'có lỗi máy chủ'} — chưa ghi gì thêm`,
      })
    } finally {
      setBusy(false)
    }
  }

  const goWeek = (delta: number) =>
    router.push(`/kehoach-sx/chi-tieu?tuan=${shiftIso(week.week_start, 7 * delta)}`)
  const goToday = () => router.push('/kehoach-sx/chi-tieu')

  return {
    week,
    canEdit,
    draft,
    derived,
    done,
    saved,
    blk,
    dirtyDays,
    dirtyCells,
    typed,
    busy,
    msg,
    setCell,
    fill,
    bo,
    focusKey,
    onCellKey,
    onCellPaste,
    save,
    goWeek,
    goToday,
  } as const
}

export type ChiTieuCtx = ReturnType<typeof useChiTieu>
