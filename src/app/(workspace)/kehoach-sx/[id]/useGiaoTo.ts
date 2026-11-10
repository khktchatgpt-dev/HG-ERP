'use client'

import { useCallback, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api, apiErrorText } from '@/lib/api'
import type { PlanView } from '@/modules/dept/production/plan.service'
import {
  blockers,
  columnsOf,
  defaultTeam,
  diffDraft,
  effectiveCell,
  initialDraft,
  lockedJob,
  type CellDraft,
  type CellKey,
  type Draft,
} from './giao-to.shared'

export type GiaoToProps = { data: PlanView; canEdit: boolean }

/**
 * State + xử lý màn Giao tổ & hạn (khuôn F). Nháp là MỘT object (hàng Cả lệnh +
 * ô sửa riêng); mọi số bày (ô hiệu lực, xem trước, chặn, khối trên) suy từ nháp
 * bằng hàm thuần ở giao-to.shared — hook không tính gì hai lần.
 */
export function useGiaoTo(p: GiaoToProps) {
  const { data } = p
  const router = useRouter()
  const [draft, setDraft] = useState<Draft>(() => initialDraft(data))
  const [overwrite, setOverwrite] = useState(false)
  const [reason, setReason] = useState('')
  const [sel, setSel] = useState<CellKey | null>(null)
  const [extraCols, setExtraCols] = useState<string[]>([])
  const [tab, setTab] = useState<'ke_hoach' | 'nhat_ky'>('ke_hoach')
  /** Gập khối Khối lượng theo công đoạn để lưới 8 dòng vừa một màn 1280×800. */
  const [klGap, setKlGap] = useState(true)
  const [busy, setBusy] = useState(false)
  const [loi, setLoi] = useState<string | null>(null)
  const [thongBao, setThongBao] = useState<string | null>(null)

  const cols = useMemo(() => columnsOf(data, draft, extraCols), [data, draft, extraCols])
  const diff = useMemo(() => diffDraft(data, draft, overwrite), [data, draft, overwrite])
  const chan = useMemo(
    () => blockers(data, draft, overwrite, reason, diff),
    [data, draft, overwrite, reason, diff],
  )
  const dirty = !!diff.lsx || diff.lines.length > 0
  const locked = data.lsx.status === 'completed' || data.lsx.status === 'cancelled'
  const canEdit = p.canEdit && !locked

  const eff = useCallback(
    (lineId: string, stage: string) =>
      effectiveCell(data, draft, lineId, stage, overwrite),
    [data, draft, overwrite],
  )
  const cellOf = (key: CellKey): CellDraft => {
    if (key.line == null)
      return draft.all[key.stage] ?? { on: false, team: '', start: '', end: '' }
    return eff(key.line, key.stage).cell
  }
  const lineOf = (id: string) => data.lines.find((l) => l.order_line_id === id)!

  /** Ghi một ô (sửa riêng dòng hoặc hàng Cả lệnh). */
  const patch = (key: CellKey, c: Partial<CellDraft>) =>
    setDraft((d) => {
      if (key.line == null) {
        const cur = d.all[key.stage] ?? {
          on: false,
          team: defaultTeam(data.teams, key.stage),
          start: '',
          end: '',
        }
        return { ...d, all: { ...d.all, [key.stage]: { ...cur, ...c } } }
      }
      const cur = effectiveCell(data, d, key.line, key.stage, overwrite).cell
      const base =
        cur.on || cur.team || cur.start || cur.end
          ? cur
          : { on: false, team: defaultTeam(data.teams, key.stage), start: '', end: '' }
      return {
        ...d,
        lines: {
          ...d.lines,
          [key.line]: { ...(d.lines[key.line] ?? {}), [key.stage]: { ...base, ...c } },
        },
      }
    })

  /** Space / bấm tick: thêm hoặc bỏ công đoạn cho ô; việc đã chạy không bỏ được. */
  const toggle = (key: CellKey) => {
    if (!canEdit) return
    if (key.line && lockedJob(lineOf(key.line), key.stage)) return
    const cur = cellOf(key)
    patch(key, { on: !cur.on })
    setSel(key)
  }
  /** Áp ô đang chọn cho cả cột (mọi dòng đi qua) hoặc cả dòng (mọi cột đang bật). */
  const apCot = (key: CellKey) => {
    const c = cellOf(key)
    setDraft((d) => {
      const lines = { ...d.lines }
      for (const l of data.lines) {
        if (!(key.stage in l.needs) && !l.jobs.some((j) => j.stage === key.stage))
          continue
        if (lockedJob(l, key.stage)) continue
        lines[l.order_line_id] = {
          ...(lines[l.order_line_id] ?? {}),
          [key.stage]: { ...c, on: true },
        }
      }
      return { ...d, lines }
    })
  }
  const apDong = (key: CellKey) => {
    if (key.line == null) return
    const c = cellOf(key)
    setDraft((d) => {
      const row = { ...(d.lines[key.line!] ?? {}) }
      for (const s of cols) {
        const e = effectiveCell(data, d, key.line!, s.code, overwrite)
        if (!e.cell.on) continue
        row[s.code] = { ...e.cell, start: c.start, end: c.end }
      }
      return { ...d, lines: { ...d.lines, [key.line!]: row } }
    })
  }
  /** Bàn phím trên lưới: ←↑→↓ đi ô · Space tick · Enter sửa · Esc bỏ chọn. */
  const onKey = (e: React.KeyboardEvent, focusEditor: () => void) => {
    if (!sel) return
    const rows: (string | null)[] = [null, ...data.lines.map((l) => l.order_line_id)]
    const ri = rows.indexOf(sel.line)
    const ci = cols.findIndex((c) => c.code === sel.stage)
    const go = (r: number, c: number) => {
      const rr = Math.max(0, Math.min(rows.length - 1, r))
      const cc = Math.max(0, Math.min(cols.length - 1, c))
      setSel({ line: rows[rr], stage: cols[cc].code })
      e.preventDefault()
    }
    if (e.key === 'ArrowDown') go(ri + 1, ci)
    else if (e.key === 'ArrowUp') go(ri - 1, ci)
    else if (e.key === 'ArrowRight') go(ri, ci + 1)
    else if (e.key === 'ArrowLeft') go(ri, ci - 1)
    else if (e.key === ' ') {
      e.preventDefault()
      toggle(sel)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      focusEditor()
    } else if (e.key === 'Escape') setSel(null)
  }

  const huy = () => {
    setDraft(initialDraft(data))
    setOverwrite(false)
    setReason('')
    setSel(null)
    setLoi(null)
  }

  const luu = async () => {
    if (busy || !canEdit) return
    if (chan.some((b) => b.kind === 'stop') || !dirty) return
    setBusy(true)
    setLoi(null)
    try {
      const url = `/api/dept/production/lsx/${data.lsx.id}/plan`
      // Cả lệnh trước, dòng sau — dòng tinh chỉnh thắng.
      if (diff.lsx)
        await api(url, {
          method: 'PUT',
          body: {
            scope: 'lsx',
            stages: diff.lsx.stages,
            overwrite,
            reason: reason.trim() || null,
          },
        })
      for (const l of diff.lines)
        await api(url, { method: 'PUT', body: { ...l, reason: reason.trim() || null } })
      setThongBao(
        `Đã lưu kế hoạch: ${diff.receiving} dòng nhận từ Cả lệnh · ${diff.lines.length} dòng tinh chỉnh`,
      )
      setDraft(initialDraft(data))
      setOverwrite(false)
      setReason('')
      router.refresh()
    } catch (e) {
      setLoi(apiErrorText(e))
    } finally {
      setBusy(false)
    }
  }

  // Nháp phải nhận lại DB sau router.refresh() (mẫu "điều chỉnh state theo prop").
  const [seen, setSeen] = useState(data)
  if (seen !== data) {
    setSeen(data)
    setDraft(initialDraft(data))
  }

  const stageLabel = (c: string) => data.stages.find((s) => s.code === c)?.label ?? c
  const teamName = (id: string | null) =>
    id ? (data.teams.find((t) => t.id === id)?.name ?? '?') : null

  return {
    p,
    data,
    canEdit,
    locked,
    draft,
    cols,
    diff,
    chan,
    dirty,
    overwrite,
    setOverwrite,
    reason,
    setReason,
    sel,
    setSel,
    extraCols,
    setExtraCols,
    tab,
    setTab,
    klGap,
    setKlGap,
    busy,
    loi,
    setLoi,
    thongBao,
    setThongBao,
    eff,
    cellOf,
    lineOf,
    patch,
    toggle,
    apCot,
    apDong,
    onKey,
    huy,
    luu,
    stageLabel,
    teamName,
  } as const
}

export type GiaoToCtx = ReturnType<typeof useGiaoTo>
