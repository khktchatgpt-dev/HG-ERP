'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/Badge'
import { PageHeader } from '@/components/erp/PageHeader'
import { EmptyState } from '@/components/erp/EmptyState'
import { Spinner, TopProgressBar } from '@/components/erp/Spinner'
import { api, ApiError } from '@/lib/api'
import { paceForWindow } from '@/lib/production-summary'
import { useToast } from '@/components/ui/Toast'
import type { PlanView } from '@/modules/dept/production/plan.service'

/**
 * EDITOR KẾ HOẠCH per dòng SP (vai Kế hoạch — 0084): tick công đoạn theo thứ
 * tự danh mục → mỗi công đoạn 1 hàng: tổ phụ trách (mặc định theo tổ↔công
 * đoạn) + hạn bắt đầu/kết thúc. Lưu ghi đè kế hoạch dòng đó; công đoạn ĐÃ
 * CHẠY không bỏ được (server chặn).
 */

type StageDraft = {
  stage: string
  team_department_id: string
  planned_start: string
  planned_end: string
}

const STATUS_TONE = { todo: 'gray', doing: 'amber', done: 'green' } as const
const STATUS_LABEL = { todo: 'Chưa làm', doing: 'Đang làm', done: 'Đã xong' } as const

function LinePlanBlock({
  lsxId,
  line,
  stages,
  teams,
  canEdit,
  showOrder,
}: {
  lsxId: string
  line: PlanView['lines'][number]
  stages: { code: string; label: string }[]
  teams: PlanView['teams']
  canEdit: boolean
  /** Lệnh gộp nhiều đơn → mỗi dòng SP phải nói rõ nó của đơn nào (0113). */
  showOrder: boolean
}) {
  const router = useRouter()
  const toast = useToast()
  const jobByStage = new Map(line.jobs.map((j) => [j.stage, j]))
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [saveDefault, setSaveDefault] = useState(false)
  const [draft, setDraft] = useState<StageDraft[]>([])
  // Dòng SP đã có việc chạy → điều chỉnh phải kèm lý do (0169).
  const lineActive = line.jobs.some((j) => j.status !== 'todo')
  const [reason, setReason] = useState('')

  function startEdit(fromDefault: boolean) {
    const source = fromDefault
      ? (line.default_route ?? [])
      : line.jobs.map((j) => j.stage)
    // Thứ tự theo danh mục (thực tế xưởng đi PHÔI→HÀN→NGUỘI→SƠN theo catalog).
    const picked = new Set(source)
    setDraft(
      stages
        .filter((s) => picked.has(s.code))
        .map((s) => {
          const j = jobByStage.get(s.code)
          return {
            stage: s.code,
            team_department_id:
              j?.team_department_id ??
              teams.find((t) => t.stage_code === s.code)?.id ??
              '',
            planned_start: j?.planned_start ?? '',
            planned_end: j?.planned_end ?? '',
          }
        }),
    )
    setEditing(true)
  }

  function toggleStage(code: string) {
    setDraft((d) => {
      const has = d.some((s) => s.stage === code)
      if (has) return d.filter((s) => s.stage !== code)
      const j = jobByStage.get(code)
      const next: StageDraft = {
        stage: code,
        team_department_id:
          j?.team_department_id ?? teams.find((t) => t.stage_code === code)?.id ?? '',
        planned_start: j?.planned_start ?? '',
        planned_end: j?.planned_end ?? '',
      }
      // Chèn đúng vị trí theo thứ tự danh mục.
      const order = new Map(stages.map((s, i) => [s.code, i]))
      return [...d, next].sort(
        (a, b) => (order.get(a.stage) ?? 99) - (order.get(b.stage) ?? 99),
      )
    })
  }

  async function save() {
    setBusy(true)
    try {
      await api(`/api/dept/production/lsx/${lsxId}/plan`, {
        method: 'PUT',
        body: {
          order_line_id: line.order_line_id,
          stages: draft.map((s) => ({
            stage: s.stage,
            team_department_id: s.team_department_id || null,
            planned_start: s.planned_start || null,
            planned_end: s.planned_end || null,
          })),
          save_as_default: saveDefault,
          reason: reason.trim() || null,
        },
      })
      toast.success(`Đã lưu kế hoạch ${line.product_code}`)
      setEditing(false)
      setReason('')
      router.refresh()
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Không lưu được kế hoạch')
    } finally {
      setBusy(false)
    }
  }

  const labelOf = (c: string) => stages.find((s) => s.code === c)?.label ?? c

  return (
    <section className="bg-card rounded-xl border p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold">
          {line.product_name}{' '}
          <span className="text-muted-foreground font-mono text-xs">
            {line.product_code} · {line.qty.toLocaleString('vi-VN')} SP
            {showOrder && line.group_title ? ` · ${line.group_title}` : ''}
          </span>
        </h3>
        {canEdit && !editing && (
          <div className="ml-auto flex gap-2">
            {line.default_route && line.jobs.length === 0 && (
              <button
                onClick={() => startEdit(true)}
                className="border-input rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-[var(--accent)]"
              >
                Lấy lộ trình mặc định SP
              </button>
            )}
            <button
              onClick={() => startEdit(false)}
              className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg px-3 py-1.5 text-xs font-semibold"
            >
              {line.jobs.length ? 'Sửa kế hoạch' : 'Lên kế hoạch'}
            </button>
          </div>
        )}
      </div>

      {!editing ? (
        line.jobs.length === 0 ? (
          <p className="text-muted-foreground mt-3 text-sm">
            Chưa có lộ trình — xưởng chưa biết SP này đi qua công đoạn nào.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="text-muted-foreground border-b text-left text-xs">
                  <th className="py-1.5 pr-2">#</th>
                  <th className="py-1.5 pr-2">Công đoạn</th>
                  <th className="py-1.5 pr-2">Tổ phụ trách</th>
                  <th className="py-1.5 pr-2">Bắt đầu</th>
                  <th className="py-1.5 pr-2">Kết thúc</th>
                  <th className="py-1.5">Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {line.jobs.map((j, i) => (
                  <tr key={j.id} className="border-b">
                    <td className="text-muted-foreground py-1.5 pr-2 text-xs">{i + 1}</td>
                    <td className="py-1.5 pr-2 font-medium">{labelOf(j.stage)}</td>
                    <td className="py-1.5 pr-2">{j.team_name ?? '—'}</td>
                    <td className="py-1.5 pr-2 text-xs">{j.planned_start ?? '—'}</td>
                    <td className="py-1.5 pr-2 text-xs">{j.planned_end ?? '—'}</td>
                    <td className="py-1.5">
                      <Badge tone={STATUS_TONE[j.status]}>{STATUS_LABEL[j.status]}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : (
        <div className="mt-3 flex flex-col gap-3">
          {/* Tick công đoạn */}
          <div className="flex flex-wrap gap-1.5">
            {stages.map((s) => {
              const on = draft.some((d) => d.stage === s.code)
              const locked =
                jobByStage.get(s.code)?.status !== undefined &&
                jobByStage.get(s.code)!.status !== 'todo'
              return (
                <button
                  key={s.code}
                  onClick={() => !locked && toggleStage(s.code)}
                  disabled={locked && on}
                  title={locked ? 'Công đoạn đã chạy — không bỏ được' : undefined}
                  className={`rounded-lg border px-2.5 py-1 text-xs font-medium ${
                    on
                      ? 'border-[var(--primary)] bg-[var(--accent)] text-[var(--primary)]'
                      : 'text-muted-foreground hover:border-input border'
                  }`}
                >
                  {s.label}
                </button>
              )
            })}
          </div>

          {draft.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="text-muted-foreground border-b text-left text-xs">
                    <th className="py-1.5 pr-2">#</th>
                    <th className="py-1.5 pr-2">Công đoạn</th>
                    <th className="py-1.5 pr-2">Tổ phụ trách</th>
                    <th className="py-1.5 pr-2">Bắt đầu KH</th>
                    <th className="py-1.5 pr-2">Kết thúc KH</th>
                    <th
                      className="py-1.5"
                      title="SL dòng ÷ số ngày trong khung — nhịp tối thiểu để kịp hạn"
                    >
                      Nhịp suy
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {draft.map((d, i) => (
                    <tr key={d.stage} className="border-b">
                      <td className="text-muted-foreground py-1.5 pr-2 text-xs">
                        {i + 1}
                      </td>
                      <td className="py-1.5 pr-2 font-medium">{labelOf(d.stage)}</td>
                      <td className="py-1.5 pr-2">
                        <select
                          value={d.team_department_id}
                          onChange={(e) =>
                            setDraft((arr) =>
                              arr.map((x) =>
                                x.stage === d.stage
                                  ? { ...x, team_department_id: e.target.value }
                                  : x,
                              ),
                            )
                          }
                          className="border-input bg-background rounded border px-2 py-1 text-xs"
                        >
                          <option value="">— Tổ —</option>
                          {teams.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      {(['planned_start', 'planned_end'] as const).map((f) => (
                        <td key={f} className="py-1.5 pr-2">
                          <input
                            type="date"
                            value={d[f]}
                            onChange={(e) =>
                              setDraft((arr) =>
                                arr.map((x) =>
                                  x.stage === d.stage ? { ...x, [f]: e.target.value } : x,
                                ),
                              )
                            }
                            className="border-input bg-background rounded border px-2 py-1 text-xs"
                          />
                        </td>
                      ))}
                      <td className="py-1.5">
                        {(() => {
                          const pace = paceForWindow(
                            line.qty,
                            d.planned_start || null,
                            d.planned_end || null,
                          )
                          return pace != null ? (
                            <span className="font-mono text-xs whitespace-nowrap tabular-nums">
                              ≈ {pace.toLocaleString('vi-VN')} SP/ngày
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )
                        })()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {lineActive && (
            <label className="flex flex-col gap-1 text-xs">
              <span className="font-medium text-[var(--warn)]">
                Lý do điều chỉnh (bắt buộc — dòng SP đã có việc chạy, lịch sử ghi lại ai
                đổi gì vì sao)
              </span>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                placeholder="VD: Tổ 1 thiếu người, chuyển hạn sơn lùi 2 ngày"
                className="border-input bg-background rounded-lg border px-3 py-2 text-sm"
              />
            </label>
          )}
          <div className="flex items-center gap-3">
            <label className="text-muted-foreground flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={saveDefault}
                onChange={(e) => setSaveDefault(e.target.checked)}
                className="h-4 w-4"
              />
              Lưu làm lộ trình mặc định cho SP này
            </label>
            <div className="ml-auto flex gap-2">
              <button
                onClick={() => setEditing(false)}
                className="border-input rounded-lg border px-3 py-1.5 text-sm hover:bg-[var(--accent)]"
              >
                Huỷ
              </button>
              <button
                onClick={save}
                disabled={busy}
                className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-2 rounded-lg px-4 py-1.5 text-sm font-semibold disabled:opacity-50"
              >
                {busy && <Spinner size={14} />} Lưu kế hoạch
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

/**
 * KẾ HOẠCH CẢ LỆNH (thiết kế lại 24/08 theo thực tế điều độ): lập MỘT lộ
 * trình công đoạn + tổ + hạn, server rải xuống từng dòng theo lộ trình riêng
 * của SP (dòng không có công đoạn đó thì không sinh việc). MẶC ĐỊNH chỉ áp
 * cho dòng CHƯA có kế hoạch — dòng đã lập/tinh chỉnh giữ nguyên; muốn ghi đè
 * phải tick rõ. Tầng dòng SP bên dưới là chỗ tinh chỉnh ngoại lệ.
 */
function LsxPlanBlock({
  lsxId,
  lines,
  stages,
  teams,
  canEdit,
}: {
  lsxId: string
  lines: PlanView['lines']
  stages: { code: string; label: string }[]
  teams: PlanView['teams']
  canEdit: boolean
}) {
  const router = useRouter()
  const toast = useToast()
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [draft, setDraft] = useState<StageDraft[]>([])
  const [reason, setReason] = useState('')
  const [overwrite, setOverwrite] = useState(false)
  const anyActive = lines.some((l) => l.jobs.some((j) => j.status !== 'todo'))
  const plannedLines = lines.filter((l) => l.jobs.length > 0).length
  const labelOf = (c: string) => stages.find((s) => s.code === c)?.label ?? c

  /** Σ SL các dòng SẼ nhận công đoạn này (lọc theo lộ trình riêng của SP). */
  function qtyForStage(code: string): number {
    return lines
      .filter((l) => !l.default_route || l.default_route.includes(code))
      .reduce((s, l) => s + l.qty, 0)
  }

  function startEdit() {
    // Mồi từ dòng đã có kế hoạch nhiều công đoạn nhất — sửa cả lệnh thường là
    // chỉnh trên nền cũ, không phải gõ lại từ đầu.
    const seed = [...lines].sort((a, b) => b.jobs.length - a.jobs.length)[0]
    const jobByStage = new Map((seed?.jobs ?? []).map((j) => [j.stage, j]))
    setDraft(
      stages
        .filter((s) => jobByStage.has(s.code))
        .map((s) => {
          const j = jobByStage.get(s.code)!
          return {
            stage: s.code,
            team_department_id:
              j.team_department_id ??
              teams.find((t) => t.stage_code === s.code)?.id ??
              '',
            planned_start: j.planned_start ?? '',
            planned_end: j.planned_end ?? '',
          }
        }),
    )
    setEditing(true)
  }

  function toggleStage(code: string) {
    setDraft((d) => {
      if (d.some((s) => s.stage === code)) return d.filter((s) => s.stage !== code)
      const next: StageDraft = {
        stage: code,
        team_department_id: teams.find((t) => t.stage_code === code)?.id ?? '',
        planned_start: '',
        planned_end: '',
      }
      const order = new Map(stages.map((s, i) => [s.code, i]))
      return [...d, next].sort(
        (a, b) => (order.get(a.stage) ?? 99) - (order.get(b.stage) ?? 99),
      )
    })
  }

  async function save() {
    setBusy(true)
    try {
      const r = await api<{ lines_planned: number; lines_kept: number }>(
        `/api/dept/production/lsx/${lsxId}/plan`,
        {
          method: 'PUT',
          body: {
            scope: 'lsx',
            stages: draft.map((s) => ({
              stage: s.stage,
              team_department_id: s.team_department_id || null,
              planned_start: s.planned_start || null,
              planned_end: s.planned_end || null,
            })),
            overwrite,
            reason: reason.trim() || null,
          },
        },
      )
      toast.success(
        `Đã áp kế hoạch cho ${r.lines_planned} dòng SP` +
          (r.lines_kept ? ` — giữ nguyên ${r.lines_kept} dòng đã có kế hoạch` : ''),
      )
      setEditing(false)
      setReason('')
      setOverwrite(false)
      router.refresh()
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Không lưu được kế hoạch')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="bg-card rounded-xl border-2 border-[var(--primary)]/25 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold">Kế hoạch cả lệnh</h3>
        <span className="text-muted-foreground text-xs">
          {plannedLines}/{lines.length} dòng SP đã có lộ trình
        </span>
        {canEdit && !editing && (
          <button
            onClick={startEdit}
            className="bg-primary text-primary-foreground hover:bg-primary/90 ml-auto rounded-lg px-3 py-1.5 text-xs font-semibold"
          >
            {plannedLines ? 'Sửa kế hoạch cả lệnh' : 'Lên kế hoạch cả lệnh'}
          </button>
        )}
      </div>

      {!editing ? (
        <p className="text-muted-foreground mt-2 text-xs">
          Lập MỘT lộ trình công đoạn + tổ + hạn rồi áp cho các dòng SP CHƯA có kế hoạch —
          dòng có lộ trình riêng chỉ nhận công đoạn thuộc lộ trình đó, dòng đã lập/tinh
          chỉnh giữ nguyên. Cần khác biệt từng dòng thì tinh chỉnh ở khối bên dưới.
        </p>
      ) : (
        <div className="mt-3 flex flex-col gap-3">
          <div className="flex flex-wrap gap-1.5">
            {stages.map((s) => {
              const on = draft.some((d) => d.stage === s.code)
              return (
                <button
                  key={s.code}
                  onClick={() => toggleStage(s.code)}
                  className={`rounded-lg border px-2.5 py-1 text-xs font-medium ${
                    on
                      ? 'border-[var(--primary)] bg-[var(--accent)] text-[var(--primary)]'
                      : 'text-muted-foreground hover:border-input border'
                  }`}
                >
                  {s.label}
                </button>
              )
            })}
          </div>

          {draft.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="text-muted-foreground border-b text-left text-xs">
                    <th className="py-1.5 pr-2">#</th>
                    <th className="py-1.5 pr-2">Công đoạn</th>
                    <th className="py-1.5 pr-2">SL (các dòng áp)</th>
                    <th className="py-1.5 pr-2">Tổ phụ trách</th>
                    <th className="py-1.5 pr-2">Bắt đầu KH</th>
                    <th className="py-1.5 pr-2">Kết thúc KH</th>
                    <th className="py-1.5" title="Σ SL các dòng áp ÷ số ngày trong khung">
                      Nhịp suy
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {draft.map((d, i) => (
                    <tr key={d.stage} className="border-b">
                      <td className="text-muted-foreground py-1.5 pr-2 text-xs">
                        {i + 1}
                      </td>
                      <td className="py-1.5 pr-2 font-medium">{labelOf(d.stage)}</td>
                      <td className="py-1.5 pr-2 font-mono text-xs tabular-nums">
                        {qtyForStage(d.stage).toLocaleString('vi-VN')} SP
                      </td>
                      <td className="py-1.5 pr-2">
                        <select
                          value={d.team_department_id}
                          onChange={(e) =>
                            setDraft((arr) =>
                              arr.map((x) =>
                                x.stage === d.stage
                                  ? { ...x, team_department_id: e.target.value }
                                  : x,
                              ),
                            )
                          }
                          className="border-input bg-background rounded border px-2 py-1 text-xs"
                        >
                          <option value="">— Tổ —</option>
                          {teams.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      {(['planned_start', 'planned_end'] as const).map((f) => (
                        <td key={f} className="py-1.5 pr-2">
                          <input
                            type="date"
                            value={d[f]}
                            onChange={(e) =>
                              setDraft((arr) =>
                                arr.map((x) =>
                                  x.stage === d.stage ? { ...x, [f]: e.target.value } : x,
                                ),
                              )
                            }
                            className="border-input bg-background rounded border px-2 py-1 text-xs"
                          />
                        </td>
                      ))}
                      <td className="py-1.5">
                        {(() => {
                          const pace = paceForWindow(
                            qtyForStage(d.stage),
                            d.planned_start || null,
                            d.planned_end || null,
                          )
                          return pace != null ? (
                            <span className="font-mono text-xs whitespace-nowrap tabular-nums">
                              ≈ {pace.toLocaleString('vi-VN')} SP/ngày
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )
                        })()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {overwrite && anyActive && (
            <label className="flex flex-col gap-1 text-xs">
              <span className="font-medium text-[var(--warn)]">
                Lý do điều chỉnh (bắt buộc — lệnh đã có việc chạy, lịch sử ghi lại ai đổi
                gì vì sao)
              </span>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                placeholder="VD: dời cả lệnh lùi 3 ngày vì thiếu nhôm"
                className="border-input bg-background rounded-lg border px-3 py-2 text-sm"
              />
            </label>
          )}
          <div className="flex flex-wrap items-center gap-3">
            {plannedLines > 0 && (
              <label className="text-muted-foreground flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={overwrite}
                  onChange={(e) => setOverwrite(e.target.checked)}
                  className="size-4 rounded border-[var(--input)] accent-[var(--primary)]"
                />
                Ghi đè cả {plannedLines} dòng đã có kế hoạch
              </label>
            )}
            <div className="ml-auto flex gap-2">
              <button
                onClick={() => setEditing(false)}
                className="border-input rounded-lg border px-3 py-1.5 text-sm hover:bg-[var(--accent)]"
              >
                Huỷ
              </button>
              <button
                onClick={save}
                disabled={busy || draft.length === 0}
                className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-2 rounded-lg px-4 py-1.5 text-sm font-semibold disabled:opacity-50"
              >
                {busy && <Spinner size={14} />}
                {overwrite ? 'Áp & ghi đè kế hoạch' : 'Áp cho dòng chưa có KH'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

export function PlanEditor({ data, canEdit }: { data: PlanView; canEdit: boolean }) {
  const { lsx, lines, stages, teams } = data
  return (
    <div className="flex flex-col gap-4">
      <TopProgressBar active={false} />
      <PageHeader
        breadcrumbs={[
          { label: 'Kế hoạch sản xuất', href: '/kehoach-sx' },
          { label: lsx.code },
        ]}
        title={`Kế hoạch ${lsx.code}`}
        description={`${lsx.customer_name} · ${lsx.order_codes.length > 1 ? `${lsx.order_codes.length} đơn: ` : 'Đơn '}${lsx.order_codes.join(', ')} · Hạn xuất: ${
          lsx.ship_date ? new Date(lsx.ship_date).toLocaleDateString('vi-VN') : '—'
        } · Ưu tiên ${lsx.priority}`}
        actions={
          <Link
            href={`/kehoach-sx/lsx/${lsx.id}`}
            className="border-input rounded-lg border px-3 py-1.5 text-sm hover:bg-[var(--accent)]"
          >
            Hồ sơ lệnh →
          </Link>
        }
      />
      {lines.length === 0 ? (
        <EmptyState icon="◈" title="Đơn không có dòng SP" description="" />
      ) : (
        <>
          <LsxPlanBlock
            lsxId={lsx.id}
            lines={lines}
            stages={stages}
            teams={teams}
            canEdit={canEdit && lsx.status !== 'completed' && lsx.status !== 'cancelled'}
          />
          {lines.map((l) => (
            <LinePlanBlock
              key={l.order_line_id}
              lsxId={lsx.id}
              line={l}
              stages={stages}
              teams={teams}
              canEdit={
                canEdit && lsx.status !== 'completed' && lsx.status !== 'cancelled'
              }
              showOrder={lsx.order_codes.length > 1}
            />
          ))}
        </>
      )}
    </div>
  )
}
