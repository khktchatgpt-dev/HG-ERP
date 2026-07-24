'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/Badge'
import { PageHeader } from '@/components/erp/PageHeader'
import { EmptyState } from '@/components/erp/EmptyState'
import { Spinner, TopProgressBar } from '@/components/erp/Spinner'
import { api, ApiError } from '@/lib/api'
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
}: {
  lsxId: string
  line: PlanView['lines'][number]
  stages: { code: string; label: string }[]
  teams: PlanView['teams']
  canEdit: boolean
}) {
  const router = useRouter()
  const toast = useToast()
  const jobByStage = new Map(line.jobs.map((j) => [j.stage, j]))
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [saveDefault, setSaveDefault] = useState(false)
  const [draft, setDraft] = useState<StageDraft[]>([])

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
        body: JSON.stringify({
          order_line_id: line.order_line_id,
          stages: draft.map((s) => ({
            stage: s.stage,
            team_department_id: s.team_department_id || null,
            planned_start: s.planned_start || null,
            planned_end: s.planned_end || null,
          })),
          save_as_default: saveDefault,
        }),
      })
      toast.success(`Đã lưu kế hoạch ${line.product_code}`)
      setEditing(false)
      router.refresh()
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Không lưu được kế hoạch')
    } finally {
      setBusy(false)
    }
  }

  const labelOf = (c: string) => stages.find((s) => s.code === c)?.label ?? c

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold">
          {line.product_name}{' '}
          <span className="font-mono text-xs text-zinc-500">
            {line.product_code} · {line.qty.toLocaleString('vi-VN')} SP
          </span>
        </h3>
        {canEdit && !editing && (
          <div className="ml-auto flex gap-2">
            {line.default_route && line.jobs.length === 0 && (
              <button
                onClick={() => startEdit(true)}
                className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
              >
                Lấy lộ trình mặc định SP
              </button>
            )}
            <button
              onClick={() => startEdit(false)}
              className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900"
            >
              {line.jobs.length ? 'Sửa kế hoạch' : 'Lên kế hoạch'}
            </button>
          </div>
        )}
      </div>

      {!editing ? (
        line.jobs.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">
            Chưa có lộ trình — xưởng chưa biết SP này đi qua công đoạn nào.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-xs text-zinc-500 dark:border-zinc-800">
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
                  <tr
                    key={j.id}
                    className="border-b border-zinc-100 dark:border-zinc-900"
                  >
                    <td className="py-1.5 pr-2 text-xs text-zinc-400">{i + 1}</td>
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
                      ? 'border-red-500 bg-red-50 text-red-700 dark:border-red-700 dark:bg-red-950 dark:text-red-300'
                      : 'border-zinc-200 text-zinc-500 hover:border-zinc-400 dark:border-zinc-700'
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
                  <tr className="border-b border-zinc-200 text-left text-xs text-zinc-500 dark:border-zinc-800">
                    <th className="py-1.5 pr-2">#</th>
                    <th className="py-1.5 pr-2">Công đoạn</th>
                    <th className="py-1.5 pr-2">Tổ phụ trách</th>
                    <th className="py-1.5 pr-2">Bắt đầu KH</th>
                    <th className="py-1.5 pr-2">Kết thúc KH</th>
                  </tr>
                </thead>
                <tbody>
                  {draft.map((d, i) => (
                    <tr
                      key={d.stage}
                      className="border-b border-zinc-100 dark:border-zinc-900"
                    >
                      <td className="py-1.5 pr-2 text-xs text-zinc-400">{i + 1}</td>
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
                          className="rounded border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900"
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
                            className="rounded border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-300">
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
                className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700"
              >
                Huỷ
              </button>
              <button
                onClick={save}
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50"
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
        description={`${lsx.customer_name} · Đơn ${lsx.order_code} · Hạn xuất: ${
          lsx.ship_date ? new Date(lsx.ship_date).toLocaleDateString('vi-VN') : '—'
        } · Ưu tiên ${lsx.priority}`}
        actions={
          <Link
            href={`/kehoach-sx/lsx/${lsx.id}`}
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            Hồ sơ lệnh →
          </Link>
        }
      />
      {lines.length === 0 ? (
        <EmptyState icon="◈" title="Đơn không có dòng SP" description="" />
      ) : (
        lines.map((l) => (
          <LinePlanBlock
            key={l.order_line_id}
            lsxId={lsx.id}
            line={l}
            stages={stages}
            teams={teams}
            canEdit={canEdit && lsx.status !== 'completed' && lsx.status !== 'cancelled'}
          />
        ))
      )}
    </div>
  )
}
