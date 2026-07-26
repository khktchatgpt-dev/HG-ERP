'use client'

import { useCallback, useEffect, useState } from 'react'
import { Badge } from '@/components/Badge'
import { PageHeader } from '@/components/erp/PageHeader'
import { EmptyState } from '@/components/erp/EmptyState'
import { Spinner, TopProgressBar } from '@/components/erp/Spinner'
import { api, ApiError } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { useConfirm } from '@/components/ui/ConfirmDialog'

/**
 * BÀN GIAO CHO TỔ — chọn lệnh → (1) form ghi giao/trả, (2) bảng đối chiếu WIP
 * per (chi tiết × công đoạn × tổ): Giao / Trả / Đã dùng / Còn tại tổ,
 * (3) sổ bàn giao chi tiết (xoá được dòng nhập nhầm).
 */

type Stage = { code: string; label: string }
type Team = { id: string; name: string }
type Lsx = { id: string; code: string; customer_name: string }

type TransferEntry = {
  id: string
  component_id: string
  stage: string
  team_department_id: string
  direction: 'issue' | 'return'
  entry_date: string
  qty: number
  reason: string | null
  note: string | null
  team_name: string | null
  component_name: string | null
  component_cluster: string | null
  created_by_name: string | null
}

type Triple = {
  component_id: string
  component_name: string | null
  component_cluster: string | null
  stage: string
  team_department_id: string
  team_name: string | null
  wip: { issued: number; returned: number; used: number; available: number }
}

type GridComponent = {
  id: string
  kind?: 'part' | 'assembly'
  name: string
  cluster: string | null
  summary: { stages: { stage: string }[] }
}

const sel =
  'rounded-md border border-zinc-300 px-2 py-1.5 text-sm focus:border-sky-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900'

const fmt = (n: number) => n.toLocaleString('vi-VN')

export function TransferBoard({
  lsxList,
  stages,
  teams,
  canRecord,
}: {
  lsxList: Lsx[]
  stages: Stage[]
  teams: Team[]
  canRecord: boolean
}) {
  const toast = useToast()
  const confirm = useConfirm()
  const [busy, setBusy] = useState(false)
  const [lsxId, setLsxId] = useState(lsxList[0]?.id ?? '')
  const [data, setData] = useState<{
    entries: TransferEntry[]
    triples: Triple[]
  } | null>(null)
  const [components, setComponents] = useState<GridComponent[]>([])

  // Form ghi giao/trả.
  const [fComp, setFComp] = useState('')
  const [fStage, setFStage] = useState(stages[0]?.code ?? '')
  const [fTeam, setFTeam] = useState(teams[0]?.id ?? '')
  const [fDir, setFDir] = useState<'issue' | 'return'>('issue')
  const [fDate, setFDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [fQty, setFQty] = useState('')
  const [fReason, setFReason] = useState('')
  const [fNote, setFNote] = useState('')

  const load = useCallback(async () => {
    if (!lsxId) return
    try {
      const [d, c] = await Promise.all([
        api<{ entries: TransferEntry[]; triples: Triple[] }>(
          `/api/dept/production/lsx/${lsxId}/transfers`,
        ),
        api<{ components: GridComponent[] }>(`/api/dept/production/lsx/${lsxId}/entries`),
      ])
      setData(d)
      setComponents(c.components)
      if (c.components.length && !c.components.some((x) => x.id === fComp)) {
        setFComp(c.components[0].id)
      }
    } catch (e) {
      toast.error(
        'Không tải được sổ bàn giao',
        e instanceof ApiError ? e.message : 'Có lỗi',
      )
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lsxId])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setData(null)
    void load()
  }, [load])

  const stageLabel = (code: string) => stages.find((s) => s.code === code)?.label ?? code
  // Chi tiết hợp lệ cho công đoạn đang chọn (đi qua công đoạn đó theo kế hoạch).
  const compOptions = components.filter((c) =>
    c.summary.stages.some((s) => s.stage === fStage),
  )

  async function record() {
    if (!fComp || !fTeam || !fQty || Number(fQty) <= 0) {
      toast.error('Thiếu dữ liệu', 'Chọn chi tiết, tổ và nhập SL > 0')
      return
    }
    if (fDir === 'return' && !fReason.trim()) {
      toast.error('Trả lại phải ghi lý do', 'VD: phôi móp, giao thừa…')
      return
    }
    setBusy(true)
    try {
      const res = await api<{ warnings: string[] }>(
        `/api/dept/production/lsx/${lsxId}/transfers`,
        {
          method: 'POST',
          body: {
            component_id: fComp,
            stage: fStage,
            team_department_id: fTeam,
            direction: fDir,
            entry_date: fDate,
            qty: Number(fQty),
            reason: fDir === 'return' ? fReason.trim() : null,
            note: fNote.trim() || null,
          },
        },
      )
      toast.success(fDir === 'issue' ? 'Đã ghi giao cho tổ' : 'Đã ghi trả lại', fDate)
      for (const w of res.warnings) toast.error('⚠ Cảnh báo', w)
      setFQty('')
      setFReason('')
      setFNote('')
      await load()
    } catch (e) {
      toast.error('Ghi thất bại', e instanceof ApiError ? e.message : 'Có lỗi')
    } finally {
      setBusy(false)
    }
  }

  async function removeEntry(t: TransferEntry) {
    const ok = await confirm({
      title: 'Xoá bản ghi bàn giao?',
      description: `${t.component_name ?? ''} · ${stageLabel(t.stage)} · ${t.team_name ?? ''} · ${t.direction === 'issue' ? 'giao' : 'trả lại'} ${fmt(t.qty)}. Sổ append-only — xoá rồi ghi lại nếu nhầm.`,
      tone: 'danger',
      confirmLabel: 'Xoá',
    })
    if (!ok) return
    setBusy(true)
    try {
      await api(`/api/dept/production/transfers/${t.id}`, { method: 'DELETE' })
      toast.success('Đã xoá bản ghi')
      await load()
    } catch (e) {
      toast.error('Xoá thất bại', e instanceof ApiError ? e.message : 'Có lỗi')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <TopProgressBar active={busy} />
      <PageHeader
        breadcrumbs={[
          { label: 'Thống kê xưởng', href: '/thongke' },
          { label: 'Giao tổ' },
        ]}
        title="Bàn giao phôi / WIP cho tổ"
        description="Ghi SL giao vào tổ theo đợt (như cột SL giao của sổ giấy) và tổ trả lại lỗi/thừa — tồn tại tổ = giao − trả − đã làm, hệ thống tự đối chiếu và cảnh báo khi tổ ghi sản lượng vượt số được giao."
        actions={
          lsxList.length > 0 ? (
            <select
              value={lsxId}
              onChange={(e) => setLsxId(e.target.value)}
              className={sel}
            >
              {lsxList.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.code} — {l.customer_name}
                </option>
              ))}
            </select>
          ) : undefined
        }
      />

      {lsxList.length === 0 ? (
        <EmptyState
          icon="⇥"
          title="Không có lệnh đang chạy"
          description="Có LSX được duyệt là ghi bàn giao được ngay tại đây."
        />
      ) : (
        <>
          {/* Form ghi giao / trả */}
          {canRecord && (
            <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
              <h2 className="mb-3 text-xs font-semibold tracking-wider text-zinc-500 uppercase">
                Ghi bàn giao
              </h2>
              <div className="flex flex-wrap items-end gap-2">
                <label className="flex flex-col gap-1 text-xs text-zinc-500">
                  Hướng
                  <select
                    value={fDir}
                    onChange={(e) => setFDir(e.target.value as 'issue' | 'return')}
                    className={sel}
                  >
                    <option value="issue">Giao vào tổ</option>
                    <option value="return">Tổ trả lại</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-xs text-zinc-500">
                  Công đoạn
                  <select
                    value={fStage}
                    onChange={(e) => setFStage(e.target.value)}
                    className={sel}
                  >
                    {stages.map((s) => (
                      <option key={s.code} value={s.code}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-xs text-zinc-500">
                  Chi tiết / cụm
                  <select
                    value={fComp}
                    onChange={(e) => setFComp(e.target.value)}
                    className={`${sel} min-w-52`}
                  >
                    {compOptions.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.cluster ? `${c.cluster} · ` : ''}
                        {c.name}
                        {c.kind === 'assembly' ? ' (cụm)' : ''}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-xs text-zinc-500">
                  Tổ
                  <select
                    value={fTeam}
                    onChange={(e) => setFTeam(e.target.value)}
                    className={sel}
                  >
                    {teams.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-xs text-zinc-500">
                  Ngày
                  <input
                    type="date"
                    value={fDate}
                    onChange={(e) => e.target.value && setFDate(e.target.value)}
                    className={sel}
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs text-zinc-500">
                  SL
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={fQty}
                    onChange={(e) => setFQty(e.target.value)}
                    className={`${sel} w-24`}
                  />
                </label>
                {fDir === 'return' && (
                  <label className="flex flex-col gap-1 text-xs text-zinc-500">
                    Lý do trả
                    <input
                      value={fReason}
                      onChange={(e) => setFReason(e.target.value)}
                      className={`${sel} min-w-44`}
                      placeholder="phôi móp / giao thừa…"
                    />
                  </label>
                )}
                <label className="flex flex-col gap-1 text-xs text-zinc-500">
                  Ghi chú
                  <input
                    value={fNote}
                    onChange={(e) => setFNote(e.target.value)}
                    className={`${sel} min-w-44`}
                    placeholder="đợt 2 / hàng trần…"
                  />
                </label>
                <button
                  disabled={busy}
                  onClick={() => void record()}
                  className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {busy && <Spinner size={12} />}✓ Ghi
                </button>
              </div>
            </section>
          )}

          {/* Đối chiếu WIP per (chi tiết × công đoạn × tổ) */}
          <section className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
            <div className="border-b border-zinc-200 px-4 py-2 dark:border-zinc-800">
              <h2 className="text-xs font-semibold tracking-wider text-zinc-500 uppercase">
                Đối chiếu tồn tại tổ (giao − trả − đã làm)
              </h2>
            </div>
            {!data ? (
              <p className="px-4 py-6 text-center text-xs text-zinc-400">Đang tải…</p>
            ) : data.triples.length === 0 ? (
              <div className="py-6">
                <EmptyState
                  icon="⇥"
                  title="Lệnh này chưa có bàn giao nào"
                  description={canRecord ? 'Ghi giao ở form bên trên.' : ''}
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-xs">
                  <thead>
                    <tr className="border-b border-zinc-200 text-left text-[10px] text-zinc-500 uppercase dark:border-zinc-800">
                      <th className="px-3 py-1.5">Chi tiết</th>
                      <th className="py-1.5 pr-2">Công đoạn</th>
                      <th className="py-1.5 pr-2">Tổ</th>
                      <th className="w-20 py-1.5 pr-2 text-right">Giao</th>
                      <th className="w-20 py-1.5 pr-2 text-right">Trả lại</th>
                      <th className="w-20 py-1.5 pr-2 text-right">Đã làm</th>
                      <th className="w-24 py-1.5 pr-2 text-right">Còn tại tổ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.triples.map((t) => (
                      <tr
                        key={`${t.component_id}|${t.stage}|${t.team_department_id}`}
                        className="border-b border-zinc-100 dark:border-zinc-900"
                      >
                        <td className="px-3 py-1.5 font-medium">
                          {t.component_cluster && (
                            <span className="text-[10px] font-normal text-zinc-400">
                              {t.component_cluster} ·{' '}
                            </span>
                          )}
                          {t.component_name ?? '?'}
                        </td>
                        <td className="py-1.5 pr-2">
                          <Badge>{stageLabel(t.stage)}</Badge>
                        </td>
                        <td className="py-1.5 pr-2">{t.team_name ?? '—'}</td>
                        <td className="py-1.5 pr-2 text-right tabular-nums">
                          {fmt(t.wip.issued)}
                        </td>
                        <td className="py-1.5 pr-2 text-right tabular-nums">
                          {t.wip.returned > 0 ? fmt(t.wip.returned) : '—'}
                        </td>
                        <td className="py-1.5 pr-2 text-right tabular-nums">
                          {fmt(t.wip.used)}
                        </td>
                        <td
                          className={`py-1.5 pr-2 text-right font-semibold tabular-nums ${
                            t.wip.available < 0
                              ? 'text-red-600 dark:text-red-400'
                              : 'text-emerald-600 dark:text-emerald-400'
                          }`}
                        >
                          {fmt(t.wip.available)}
                          {t.wip.available < 0 && ' ⚠'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Sổ bàn giao chi tiết */}
          <section className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
            <div className="border-b border-zinc-200 px-4 py-2 dark:border-zinc-800">
              <h2 className="text-xs font-semibold tracking-wider text-zinc-500 uppercase">
                Sổ bàn giao ({data?.entries.length ?? 0} dòng)
              </h2>
            </div>
            {!data ? (
              <p className="px-4 py-6 text-center text-xs text-zinc-400">Đang tải…</p>
            ) : data.entries.length === 0 ? (
              <p className="px-4 py-4 text-xs text-zinc-400">Chưa có dòng nào.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[860px] text-xs">
                  <thead>
                    <tr className="border-b border-zinc-200 text-left text-[10px] text-zinc-500 uppercase dark:border-zinc-800">
                      <th className="px-3 py-1.5">Ngày</th>
                      <th className="py-1.5 pr-2">Hướng</th>
                      <th className="py-1.5 pr-2">Chi tiết</th>
                      <th className="py-1.5 pr-2">Công đoạn</th>
                      <th className="py-1.5 pr-2">Tổ</th>
                      <th className="w-20 py-1.5 pr-2 text-right">SL</th>
                      <th className="py-1.5 pr-2">Lý do / ghi chú</th>
                      <th className="py-1.5 pr-2">Người ghi</th>
                      <th className="w-8 py-1.5" />
                    </tr>
                  </thead>
                  <tbody>
                    {data.entries.map((t) => (
                      <tr
                        key={t.id}
                        className="border-b border-zinc-100 dark:border-zinc-900"
                      >
                        <td className="px-3 py-1.5 font-mono">{t.entry_date}</td>
                        <td className="py-1.5 pr-2">
                          {t.direction === 'issue' ? (
                            <Badge tone="blue">Giao</Badge>
                          ) : (
                            <Badge tone="red">Trả lại</Badge>
                          )}
                        </td>
                        <td className="py-1.5 pr-2 font-medium">
                          {t.component_name ?? '?'}
                        </td>
                        <td className="py-1.5 pr-2">{stageLabel(t.stage)}</td>
                        <td className="py-1.5 pr-2">{t.team_name ?? '—'}</td>
                        <td className="py-1.5 pr-2 text-right font-semibold tabular-nums">
                          {fmt(t.qty)}
                        </td>
                        <td className="py-1.5 pr-2 text-zinc-500">
                          {[t.reason, t.note].filter(Boolean).join(' · ') || '—'}
                        </td>
                        <td className="py-1.5 pr-2 text-zinc-500">
                          {t.created_by_name ?? '—'}
                        </td>
                        <td className="py-1.5 pr-2 text-right">
                          {canRecord && (
                            <button
                              onClick={() => void removeEntry(t)}
                              disabled={busy}
                              className="text-red-500 hover:text-red-700 disabled:opacity-30"
                              title="Xoá bản ghi (nhập nhầm) — chỉ người nhập / QL"
                              aria-label="Xoá bản ghi"
                            >
                              ✕
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
