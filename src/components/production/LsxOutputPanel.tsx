'use client'

import { useCallback, useEffect, useState } from 'react'
import { Badge } from '@/components/Badge'
import { api, ApiError } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { Spinner } from '@/components/erp/Spinner'

/**
 * Sản lượng theo công đoạn/tổ của LSX (SX-P3 — FR-PR): bảng tổng hợp
 * thiếu/dư/%HT/đồng bộ + lưới nhập theo ngày (thay sheet PHÔI/HÀN/NGUỘI/SƠN).
 */

type Stage = { code: string; label: string }
type StageSummary = {
  stage: string
  done: number
  defect: number
  missing: number
  pct: number
}
type ComponentView = {
  id: string
  order_line_id: string
  cluster: string | null
  name: string
  total_needed: number
  summary: {
    stages: StageSummary[]
    done_final: number
    pct_total: number
    status: 'not_started' | 'in_progress' | 'done'
  }
}
type SyncedLine = {
  order_line_id: string
  product_code: string
  product_name: string
  qty: number
  synced_sets: number
  has_components: boolean
}
type Entry = {
  id: string
  component_id: string
  stage: string
  entry_date: string
  qty: number
  kg: number | null
  defect_qty: number
  machine_note: string | null
  note: string | null
  team_name: string | null
  created_by_name: string | null
}
type OutputData = {
  stages: Stage[]
  components: ComponentView[]
  synced_by_line: SyncedLine[]
  entries: Entry[]
}

/** Ô nhập theo chi tiết trong lưới ngày. */
type InputCell = { qty: string; defect: string; kg: string; machine: string }

const inp =
  'w-full rounded border border-zinc-300 px-1.5 py-1 text-xs focus:border-sky-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900'

const emptyCell = (): InputCell => ({ qty: '', defect: '', kg: '', machine: '' })

export function LsxOutputPanel({
  lsxId,
  canRecord,
  active,
}: {
  lsxId: string
  /** Xưởng / KH-CƯ / GĐ-QL (khớp canTrackProgress ở service). */
  canRecord: boolean
  /** LSX đã duyệt / đang SX — mới nhập được. */
  active: boolean
}) {
  const toast = useToast()
  const confirm = useConfirm()
  const [busy, setBusy] = useState(false)
  const [data, setData] = useState<OutputData | null>(null)
  const [stage, setStage] = useState('')
  const [entryDate, setEntryDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [cells, setCells] = useState<Record<string, InputCell>>({})
  const [showEntries, setShowEntries] = useState(false)

  const load = useCallback(async () => {
    try {
      const d = await api<OutputData>(`/api/dept/production/lsx/${lsxId}/output`)
      setData(d)
      if (d.stages.length > 0) setStage((s) => s || d.stages[0].code)
    } catch (e) {
      toast.error(
        'Không tải được sản lượng',
        e instanceof ApiError ? e.message : 'Có lỗi',
      )
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lsxId])

  useEffect(() => {
    // load() là async — setState chạy trong callback đã resolve, không đồng bộ.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  function setCell(componentId: string, patch: Partial<InputCell>) {
    setCells((c) => ({
      ...c,
      [componentId]: { ...(c[componentId] ?? emptyCell()), ...patch },
    }))
  }

  async function save() {
    if (!data) return
    const entries = Object.entries(cells)
      .filter(([, c]) => c.qty !== '' && Number(c.qty) > 0)
      .map(([component_id, c]) => ({
        component_id,
        qty: Number(c.qty),
        defect_qty: c.defect === '' ? 0 : Number(c.defect),
        kg: c.kg === '' ? null : Number(c.kg),
        machine_note: c.machine.trim() || null,
      }))
    if (entries.length === 0) {
      toast.error('Chưa nhập sản lượng', 'Điền SL cho ít nhất 1 chi tiết')
      return
    }
    setBusy(true)
    try {
      const res = await api<{ warnings: string[] }>(
        `/api/dept/production/lsx/${lsxId}/output`,
        { method: 'POST', body: { stage, entry_date: entryDate, entries } },
      )
      toast.success(`Đã ghi ${entries.length} dòng sản lượng`, entryDate)
      for (const w of res.warnings) toast.error('⚠ Vượt tổng cần', w)
      setCells({})
      await load()
    } catch (e) {
      toast.error('Ghi sản lượng thất bại', e instanceof ApiError ? e.message : 'Có lỗi')
    } finally {
      setBusy(false)
    }
  }

  async function removeEntry(en: Entry) {
    const ok = await confirm({
      title: 'Xoá bản ghi sản lượng?',
      description: `${en.entry_date} · ${stageLabel(en.stage)} · SL ${en.qty}. Sổ append-only — xoá rồi nhập lại nếu ghi nhầm.`,
      tone: 'danger',
      confirmLabel: 'Xoá',
    })
    if (!ok) return
    setBusy(true)
    try {
      await api(`/api/dept/production/output/${en.id}`, { method: 'DELETE' })
      toast.success('Đã xoá bản ghi')
      await load()
    } catch (e) {
      toast.error('Xoá thất bại', e instanceof ApiError ? e.message : 'Có lỗi')
    } finally {
      setBusy(false)
    }
  }

  const stageLabel = (code: string) =>
    data?.stages.find((s) => s.code === code)?.label ?? code
  // 1 lệnh nhiều SP — hiện chi tiết thuộc SP nào (map qua dòng đơn).
  const productByLine = new Map(
    (data?.synced_by_line ?? []).map((l) => [l.order_line_id, l.product_code]),
  )
  const componentName = (id: string) =>
    data?.components.find((c) => c.id === id)?.name ?? '?'

  if (!data) {
    return (
      <section className="rounded-lg border border-zinc-200 bg-white p-4 text-xs text-zinc-400 dark:border-zinc-800 dark:bg-zinc-950">
        Đang tải sản lượng…
      </section>
    )
  }

  const hasComponents = data.components.length > 0

  return (
    <section className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 px-4 py-2.5 dark:border-zinc-800">
        <h2 className="text-xs font-semibold tracking-wider text-zinc-500 uppercase">
          Sản lượng theo công đoạn ({data.entries.length} lần ghi)
        </h2>
        {data.synced_by_line.some((l) => l.has_components) && (
          <div className="flex flex-wrap gap-2 text-xs">
            {data.synced_by_line
              .filter((l) => l.has_components)
              .map((l) => (
                <Badge
                  key={l.order_line_id}
                  tone={l.synced_sets >= l.qty ? 'green' : 'blue'}
                >
                  {l.product_code}: đồng bộ {l.synced_sets}/{l.qty} bộ
                </Badge>
              ))}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-4 p-4">
        {!hasComponents ? (
          <p className="text-xs text-zinc-400">
            Chưa có bảng chi tiết — Kế hoạch nhập bảng chi tiết trước, xưởng mới báo được
            sản lượng theo chi tiết.
          </p>
        ) : (
          <>
            {/* Tổng hợp thiếu/dư/%HT per chi tiết × công đoạn (FR-PR-04/05) */}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-xs">
                <thead>
                  <tr className="border-b border-zinc-200 text-left text-[10px] text-zinc-500 uppercase dark:border-zinc-800">
                    <th className="py-1.5 pr-2">Chi tiết</th>
                    <th className="w-16 py-1.5 pr-2 text-right">Tổng cần</th>
                    {data.stages.map((s) => (
                      <th key={s.code} className="w-24 py-1.5 pr-2 text-right">
                        {s.label}
                      </th>
                    ))}
                    <th className="w-20 py-1.5 pr-2 text-right">%HT</th>
                    <th className="w-24 py-1.5" />
                  </tr>
                </thead>
                <tbody>
                  {data.components.map((c) => (
                    <tr
                      key={c.id}
                      className="border-b border-zinc-100 dark:border-zinc-900"
                    >
                      <td className="py-1.5 pr-2">
                        <div className="flex min-w-0 flex-col">
                          <span className="text-[10px] text-zinc-400">
                            {productByLine.get(c.order_line_id) ?? ''}
                            {c.cluster ? ` · ${c.cluster}` : ''}
                          </span>
                          <span className="font-medium">{c.name}</span>
                        </div>
                      </td>
                      <td className="py-1.5 pr-2 text-right font-medium">
                        {c.total_needed.toLocaleString('vi-VN')}
                      </td>
                      {data.stages.map((col) => {
                        const s = c.summary.stages.find((x) => x.stage === col.code)
                        if (!s)
                          return (
                            <td
                              key={col.code}
                              className="py-1.5 pr-2 text-right text-zinc-300 dark:text-zinc-600"
                              title="Chi tiết không qua công đoạn này"
                            >
                              —
                            </td>
                          )
                        return (
                          <td key={s.stage} className="py-1.5 pr-2 text-right">
                          <span
                            className={
                              s.done === 0
                                ? 'text-zinc-300 dark:text-zinc-600'
                                : s.missing <= 0
                                  ? 'font-medium text-green-600 dark:text-green-400'
                                  : 'text-amber-600 dark:text-amber-400'
                            }
                            title={`Thiếu/(Dư): ${s.missing} · Phế: ${s.defect}`}
                          >
                            {s.done.toLocaleString('vi-VN')}
                          </span>
                          {s.defect > 0 && (
                            <span className="ml-0.5 text-[10px] text-red-500">
                              (-{s.defect})
                            </span>
                          )}
                        </td>
                        )
                      })}
                      <td className="py-1.5 pr-2 text-right font-medium">
                        {Math.round(c.summary.pct_total * 100)}%
                      </td>
                      <td className="py-1.5 text-right">
                        <Badge
                          tone={
                            c.summary.status === 'done'
                              ? 'green'
                              : c.summary.status === 'in_progress'
                                ? 'amber'
                                : 'gray'
                          }
                        >
                          {c.summary.status === 'done'
                            ? 'Hoàn thành'
                            : c.summary.status === 'in_progress'
                              ? 'Đang làm'
                              : 'Chưa làm'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Lưới nhập theo ngày (FR-PR-02/03/09) */}
            {canRecord && active && (
              <div className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
                <div className="mb-2 flex flex-wrap items-end gap-3">
                  <label className="flex flex-col gap-1 text-xs">
                    Công đoạn
                    <select
                      value={stage}
                      onChange={(e) => setStage(e.target.value)}
                      className={`${inp} min-w-32`}
                    >
                      {data.stages.map((s) => (
                        <option key={s.code} value={s.code}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-xs">
                    Ngày
                    <input
                      type="date"
                      value={entryDate}
                      onChange={(e) => setEntryDate(e.target.value)}
                      className={inp}
                    />
                  </label>
                  <span className="pb-1 text-[10px] text-zinc-400">
                    Tổ ghi theo phòng của người nhập · điền SL chi tiết nào thì ghi chi
                    tiết đó
                  </span>
                  <button
                    disabled={busy || !stage}
                    onClick={() => void save()}
                    className="ml-auto inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {busy && <Spinner size={12} />}✓ Ghi sản lượng ngày
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[680px] text-xs">
                    <thead>
                      <tr className="text-left text-[10px] text-zinc-500 uppercase">
                        <th className="py-1 pr-2">Chi tiết</th>
                        <th className="w-20 py-1 pr-2">SL làm</th>
                        <th className="w-16 py-1 pr-2">Phế</th>
                        <th className="w-20 py-1 pr-2">Kg</th>
                        <th className="py-1 pr-2">Máy / màu</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.components.map((c) => {
                        const cell = cells[c.id] ?? emptyCell()
                        return (
                          <tr
                            key={c.id}
                            className="border-t border-zinc-100 dark:border-zinc-900"
                          >
                            <td className="py-1 pr-2">{c.name}</td>
                            <td className="py-1 pr-2">
                              <input
                                type="number"
                                min="0"
                                step="1"
                                value={cell.qty}
                                onChange={(e) => setCell(c.id, { qty: e.target.value })}
                                className={inp}
                              />
                            </td>
                            <td className="py-1 pr-2">
                              <input
                                type="number"
                                min="0"
                                step="1"
                                value={cell.defect}
                                onChange={(e) =>
                                  setCell(c.id, { defect: e.target.value })
                                }
                                className={inp}
                              />
                            </td>
                            <td className="py-1 pr-2">
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={cell.kg}
                                onChange={(e) => setCell(c.id, { kg: e.target.value })}
                                className={inp}
                              />
                            </td>
                            <td className="py-1 pr-2">
                              <input
                                value={cell.machine}
                                onChange={(e) =>
                                  setCell(c.id, { machine: e.target.value })
                                }
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
              </div>
            )}

            {/* Sổ nhập gần nhất */}
            <div>
              <button
                onClick={() => setShowEntries((v) => !v)}
                className="text-xs text-sky-600 hover:underline dark:text-sky-400"
              >
                {showEntries ? '▾' : '▸'} Sổ ghi sản lượng ({data.entries.length})
              </button>
              {showEntries && (
                <ul className="mt-2 flex flex-col gap-1 text-xs">
                  {data.entries.slice(0, 50).map((en) => (
                    <li
                      key={en.id}
                      className="flex flex-wrap items-center gap-2 border-l-2 border-zinc-300 pl-2 dark:border-zinc-700"
                    >
                      <span className="text-zinc-500">
                        {new Date(en.entry_date).toLocaleDateString('vi-VN')}
                      </span>
                      <Badge>{stageLabel(en.stage)}</Badge>
                      <span className="font-medium">
                        {componentName(en.component_id)}
                      </span>
                      <span>
                        SL <b>{en.qty}</b>
                        {en.defect_qty > 0 && (
                          <span className="text-red-500"> · phế {en.defect_qty}</span>
                        )}
                        {en.kg != null && <span> · {en.kg} kg</span>}
                      </span>
                      {en.machine_note && (
                        <span className="text-zinc-400">{en.machine_note}</span>
                      )}
                      <span className="text-zinc-400">
                        {en.team_name ?? '—'} · {en.created_by_name ?? '—'}
                      </span>
                      {canRecord && active && (
                        <button
                          onClick={() => void removeEntry(en)}
                          className="text-red-500 hover:text-red-700"
                          title="Xoá bản ghi (nhập nhầm) — chỉ người nhập / QL"
                        >
                          ✕
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  )
}
