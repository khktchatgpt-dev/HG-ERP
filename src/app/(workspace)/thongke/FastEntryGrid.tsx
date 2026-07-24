'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Badge } from '@/components/Badge'
import { api, ApiError } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import type { RunningLsx, Stage } from './LogbookScreen'

/**
 * Lưới NHẬP NHANH kiểu bảng tính cho thống kê: chọn LSX + công đoạn → hàng =
 * chi tiết đi qua công đoạn đó; di chuyển bằng mũi tên/Enter (Ctrl+Enter =
 * Ghi sổ); phế > 0 bắt buộc chọn nguyên nhân (ô viền đỏ tới khi chọn).
 * Buffer giữ theo (LSX × công đoạn × chi tiết) — đổi lệnh không mất số đã gõ;
 * Ghi sổ gom nhóm và POST endpoint per-LSX sẵn có (mọi guard server tự áp).
 */

type Cell = { qty: string; defect: string; reason: string; kg: string; machine: string }
export type PendingCells = Record<string, Cell> // key `${lsxId}|${stage}|${componentId}`

type GridComponent = {
  id: string
  name: string
  cluster: string | null
  total_needed: number
  allowed_stages: string[] | null
  summary: { stages: { stage: string; done: number; missing: number }[] }
}
type OutputData = { components: GridComponent[] }

const emptyCell = (): Cell => ({ qty: '', defect: '', reason: '', kg: '', machine: '' })
const hasValue = (c: Cell) => c.qty !== '' && Number(c.qty) > 0
const needsReason = (c: Cell) => c.defect !== '' && Number(c.defect) > 0 && !c.reason

const inp =
  'w-full rounded border border-zinc-300 px-1.5 py-1 text-xs focus:border-sky-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900'

/** Cột theo thứ tự bàn phím: SL → Phế → Lý do → Kg → Máy/màu. */
const COL_COUNT = 5

export function FastEntryGrid({
  lsxList,
  stages,
  initialStage,
  date,
  locked,
  onSaved,
  onPendingChange,
  onSavingChange,
  registerSave,
}: {
  lsxList: RunningLsx[]
  stages: Stage[]
  initialStage: string | null
  date: string
  /** Sổ tổ mình đã chốt ngày này — khoá lưới (server vẫn là chốt chặn cuối). */
  locked: boolean
  onSaved: () => void
  onPendingChange: (count: number) => void
  /** Báo trạng thái đang ghi lên footer để nút "Ghi sổ" hiện spinner + disable. */
  onSavingChange?: (saving: boolean) => void
  registerSave: (fn: () => void) => void
}) {
  const toast = useToast()
  const [lsxId, setLsxId] = useState(lsxList[0]?.id ?? '')
  const [stage, setStage] = useState(initialStage ?? stages[0]?.code ?? '')
  const [pending, setPending] = useState<PendingCells>({})
  const [summaries, setSummaries] = useState<Map<string, OutputData>>(new Map())
  const savingRef = useRef(false)
  const cellRefs = useRef<(HTMLElement | null)[][]>([])

  // Nạp (và cache) bảng chi tiết của LSX đang chọn.
  useEffect(() => {
    if (!lsxId || summaries.has(lsxId)) return
    let alive = true
    api<OutputData>(`/api/dept/production/lsx/${lsxId}/entries`)
      .then((d) => {
        if (!alive) return
        setSummaries((m) => new Map(m).set(lsxId, d))
      })
      .catch(() => toast.error('Không tải được bảng chi tiết của lệnh'))
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lsxId])

  const pendingKeys = Object.keys(pending).filter((k) => hasValue(pending[k]))
  useEffect(() => {
    onPendingChange(pendingKeys.length)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingKeys.length])

  const data = summaries.get(lsxId)
  const rows = (data?.components ?? []).filter(
    (c) => !c.allowed_stages || c.allowed_stages.includes(stage),
  )
  const key = (componentId: string) => `${lsxId}|${stage}|${componentId}`
  const setCell = (componentId: string, patch: Partial<Cell>) =>
    setPending((p) => ({
      ...p,
      [key(componentId)]: { ...(p[key(componentId)] ?? emptyCell()), ...patch },
    }))

  const missingReasons = pendingKeys.filter((k) => needsReason(pending[k]))
  // Số dòng đã gõ cho lệnh/công đoạn KHÁC (đổi select không mất — nhắc người nhập).
  const otherPending = pendingKeys.filter((k) => !k.startsWith(`${lsxId}|${stage}|`))

  const save = useCallback(async () => {
    if (savingRef.current) return
    const keys = Object.keys(pending).filter((k) => hasValue(pending[k]))
    if (keys.length === 0) return
    const bad = keys.filter((k) => needsReason(pending[k]))
    if (bad.length > 0) {
      toast.error('Thiếu lý do phế', `${bad.length} dòng có phế chưa ghi lý do`)
      return
    }
    // Gom theo (LSX, công đoạn) → POST endpoint per-LSX sẵn có.
    const groups = new Map<string, { lsxId: string; stage: string; keys: string[] }>()
    for (const k of keys) {
      const [gLsx, gStage] = k.split('|')
      const gk = `${gLsx}|${gStage}`
      const g = groups.get(gk) ?? { lsxId: gLsx, stage: gStage, keys: [] }
      g.keys.push(k)
      groups.set(gk, g)
    }
    savingRef.current = true
    onSavingChange?.(true)
    try {
      for (const g of groups.values()) {
        const entries = g.keys.map((k) => {
          const c = pending[k]
          return {
            component_id: k.split('|')[2],
            qty: Number(c.qty),
            defect_qty: c.defect === '' ? 0 : Number(c.defect),
            defect_reason: c.reason || null,
            kg: c.kg === '' ? null : Number(c.kg),
            machine_note: c.machine.trim() || null,
          }
        })
        const lsxCode = lsxList.find((l) => l.id === g.lsxId)?.code ?? g.lsxId
        try {
          const res = await api<{ warnings: string[] }>(
            `/api/dept/production/lsx/${g.lsxId}/entries`,
            { method: 'POST', body: { stage: g.stage, entry_date: date, entries } },
          )
          toast.success(`${lsxCode}: đã ghi ${entries.length} dòng`, date)
          for (const w of res.warnings) toast.error('⚠ Vượt tổng cần', w)
          // Nhóm ghi xong thì xoá khỏi buffer (nhóm lỗi giữ lại để sửa).
          setPending((p) => {
            const next = { ...p }
            for (const k of g.keys) delete next[k]
            return next
          })
          // Cache summary của lệnh này đã cũ → nạp lại lần chọn tới.
          setSummaries((m) => {
            const next = new Map(m)
            next.delete(g.lsxId)
            return next
          })
        } catch (e) {
          toast.error(
            `${lsxCode}: ghi sổ thất bại`,
            e instanceof ApiError ? e.message : 'Có lỗi',
          )
        }
      }
      onSaved()
    } finally {
      savingRef.current = false
      onSavingChange?.(false)
    }
  }, [pending, date, lsxList, onSaved, onSavingChange, toast])

  useEffect(() => {
    registerSave(() => void save())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [save])

  /** Điều hướng bàn phím kiểu bảng tính trên ma trận refs [hàng][cột]. */
  function onGridKeyDown(e: React.KeyboardEvent, row: number, col: number) {
    const focus = (r: number, c: number) => {
      const el = cellRefs.current[r]?.[c]
      if (el) {
        e.preventDefault()
        el.focus()
        if (el instanceof HTMLInputElement) el.select()
      }
    }
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      void save()
      return
    }
    if (e.key === 'Enter') {
      if (row + 1 < rows.length) focus(row + 1, col)
      else {
        e.preventDefault()
        void save() // Enter ở hàng cuối = ghi sổ (thói quen chốt dòng Excel)
      }
      return
    }
    if (e.key === 'ArrowDown') return focus(row + 1, col)
    if (e.key === 'ArrowUp') return focus(row - 1, col)
    const t = e.target as HTMLInputElement
    const atStart = t.selectionStart === 0 && t.selectionEnd === 0
    const atEnd =
      t.selectionStart === t.value?.length && t.selectionEnd === t.value?.length
    if (e.key === 'ArrowLeft' && (t.tagName !== 'INPUT' || atStart)) {
      return focus(row, Math.max(0, col - 1))
    }
    if (e.key === 'ArrowRight' && (t.tagName !== 'INPUT' || atEnd)) {
      return focus(row, Math.min(COL_COUNT - 1, col + 1))
    }
  }

  const setRef = (row: number, col: number) => (el: HTMLElement | null) => {
    ;(cellRefs.current[row] ??= [])[col] = el
  }

  if (lsxList.length === 0) {
    return (
      <section className="rounded-lg border border-zinc-200 bg-white p-4 text-xs text-zinc-400 dark:border-zinc-800 dark:bg-zinc-950">
        Không có lệnh nào đang chạy — khi có LSX được duyệt, nhập sổ được ngay tại đây.
      </section>
    )
  }

  return (
    <section className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex flex-wrap items-center gap-2 border-b border-zinc-200 px-4 py-2 dark:border-zinc-800">
        <h2 className="text-xs font-semibold tracking-wider text-zinc-500 uppercase">
          Nhập nhanh
        </h2>
        <select
          value={lsxId}
          onChange={(e) => setLsxId(e.currentTarget.value)}
          className={`${inp} !w-auto min-w-56`}
        >
          {lsxList.map((l) => (
            <option key={l.id} value={l.id}>
              {l.code} — {l.customer_name}
            </option>
          ))}
        </select>
        <select
          value={stage}
          onChange={(e) => setStage(e.currentTarget.value)}
          className={`${inp} !w-auto min-w-32`}
        >
          {stages.map((s) => (
            <option key={s.code} value={s.code}>
              {s.label}
            </option>
          ))}
        </select>
        {otherPending.length > 0 && (
          <Badge tone="amber">còn {otherPending.length} dòng lệnh khác chưa ghi</Badge>
        )}
        {missingReasons.length > 0 && (
          <Badge tone="red">{missingReasons.length} dòng phế thiếu lý do</Badge>
        )}
        <span className="ml-auto text-[10px] text-zinc-400">
          ↑↓←→ di chuyển · Enter xuống dòng · Ctrl+Enter ghi sổ
        </span>
      </div>

      {locked ? (
        <p className="px-4 py-4 text-xs text-zinc-400">
          🔒 Tổ của bạn đã chốt sổ ngày {date} — nhờ quản lý mở khoá nếu cần ghi thêm.
        </p>
      ) : !data ? (
        <p className="px-4 py-4 text-xs text-zinc-400">Đang tải bảng chi tiết…</p>
      ) : rows.length === 0 ? (
        <p className="px-4 py-4 text-xs text-zinc-400">
          {data.components.length === 0
            ? 'Lệnh chưa có bảng chi tiết — thống kê định hình trước (menu Định hình chi tiết).'
            : 'Không chi tiết nào đi qua công đoạn này (theo kế hoạch đã lên).'}
        </p>
      ) : (
        <div className="overflow-x-auto p-3">
          <table className="w-full min-w-[780px] text-xs">
            <thead>
              <tr className="text-left text-[10px] text-zinc-500 uppercase">
                <th className="py-1 pr-2">Chi tiết</th>
                <th className="w-16 py-1 pr-2 text-right">Còn</th>
                <th className="w-24 py-1 pr-2">SL đạt</th>
                <th className="w-16 py-1 pr-2">Phế</th>
                <th className="w-44 py-1 pr-2">Lý do phế</th>
                <th className="w-20 py-1 pr-2">Kg</th>
                <th className="py-1 pr-2">Máy / màu</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c, row) => {
                const cell = pending[key(c.id)] ?? emptyCell()
                const sum = c.summary.stages.find((x) => x.stage === stage)
                const remaining = sum ? Math.max(0, sum.missing) : c.total_needed
                const reasonMissing = needsReason(cell)
                return (
                  <tr
                    key={c.id}
                    className="border-t border-zinc-100 dark:border-zinc-900"
                  >
                    <td className="py-1 pr-2">
                      {c.cluster && (
                        <span className="text-[10px] text-zinc-400">{c.cluster} · </span>
                      )}
                      {c.name}
                    </td>
                    <td
                      className="py-1 pr-2 text-right tabular-nums"
                      title={`Cần tổng ${c.total_needed.toLocaleString('vi-VN')}`}
                    >
                      {remaining > 0 ? (
                        <span className="text-amber-600 dark:text-amber-400">
                          {remaining.toLocaleString('vi-VN')}
                        </span>
                      ) : (
                        <span className="text-emerald-600 dark:text-emerald-400">✓</span>
                      )}
                    </td>
                    <td className="py-1 pr-2">
                      <input
                        ref={setRef(row, 0)}
                        type="number"
                        min="0"
                        step="1"
                        value={cell.qty}
                        onChange={(e) => setCell(c.id, { qty: e.target.value })}
                        onKeyDown={(e) => onGridKeyDown(e, row, 0)}
                        className={inp}
                      />
                    </td>
                    <td className="py-1 pr-2">
                      <input
                        ref={setRef(row, 1)}
                        type="number"
                        min="0"
                        step="1"
                        value={cell.defect}
                        onChange={(e) => setCell(c.id, { defect: e.target.value })}
                        onKeyDown={(e) => onGridKeyDown(e, row, 1)}
                        className={inp}
                      />
                    </td>
                    <td className="py-1 pr-2">
                      <input
                        ref={setRef(row, 2)}
                        value={cell.reason}
                        onChange={(e) => setCell(c.id, { reason: e.target.value })}
                        onKeyDown={(e) => onGridKeyDown(e, row, 2)}
                        disabled={cell.defect === '' || Number(cell.defect) <= 0}
                        className={`${inp} disabled:opacity-40 ${
                          reasonMissing ? '!border-red-500 ring-1 ring-red-300' : ''
                        }`}
                        placeholder="lý do phế…"
                        title={reasonMissing ? 'Phế > 0 phải ghi lý do' : undefined}
                      />
                    </td>
                    <td className="py-1 pr-2">
                      <input
                        ref={setRef(row, 3)}
                        type="number"
                        min="0"
                        step="0.01"
                        value={cell.kg}
                        onChange={(e) => setCell(c.id, { kg: e.target.value })}
                        onKeyDown={(e) => onGridKeyDown(e, row, 3)}
                        className={inp}
                      />
                    </td>
                    <td className="py-1 pr-2">
                      <input
                        ref={setRef(row, 4)}
                        value={cell.machine}
                        onChange={(e) => setCell(c.id, { machine: e.target.value })}
                        onKeyDown={(e) => onGridKeyDown(e, row, 4)}
                        className={inp}
                        placeholder="máy cắt 2 / màu H-SM-96…"
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
