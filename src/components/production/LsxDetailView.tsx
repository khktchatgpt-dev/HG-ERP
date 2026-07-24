'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/Badge'
import { Modal } from '@/components/Modal'
import { PageHeader } from '@/components/erp/PageHeader'
import { EmptyState } from '@/components/erp/EmptyState'
import { Spinner, TopProgressBar } from '@/components/erp/Spinner'
import { api, ApiError } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { LSX_STATUS } from '@/lib/lsx-status'
import type { Job } from '@/modules/dept/production/jobs.repo'
import type { ComponentOutputView } from '@/modules/dept/production/entries.service'
import { LsxOutsourcePanel } from './LsxOutsourcePanel'

/**
 * HỒ SƠ LỆNH (0084) — dùng chung 3 shell (production/exec/planning), quyền
 * theo cờ từ server. Trục chính = KẾ HOẠCH CÔNG ĐOẠN (jobs) per dòng SP;
 * số đọc từ sổ thống kê. Tab: Tổng quan · Chi tiết & số liệu · Gia công.
 */

export type LsxHeaderData = {
  id: string
  code: string
  status: string
  order_id: string
  order_code: string
  customer_name: string
  priority: number
  ship_date: string | null
  received_date: string | null
  completed_at: string | null
  approved_at: string | null
  rejected_reason: string | null
  materials_received_at: string | null
  container_summary: string | null
  note: string | null
  created_at: string
}

export type LsxLineData = {
  order_line_id: string
  product_code: string
  name_vi: string
  unit: string
  qty: number
  image_url: string | null
  spec: { machine: string; cushion: string; paint: string; glass: string; wood: string }
}

export type SupplyPanelData = {
  hasBom: boolean
  pos: {
    id: string
    code: string
    supplier_name: string
    status: string
    expected_at: string | null
    total: number
    currency: string
  }[]
}

export type SyncedLine = {
  order_line_id: string
  product_code: string
  product_name: string
  qty: number
  synced_sets: number
  has_components: boolean
}

const fmtD = (d: string | null) => (d ? new Date(d).toLocaleDateString('vi-VN') : '—')
const fmtN = (n: number) => n.toLocaleString('vi-VN')

const JOB_LABEL = { todo: 'Chưa làm', doing: 'Đang làm', done: 'Xong' } as const

type Tab = 'overview' | 'data' | 'outsource'

export function LsxDetailView({
  lsx,
  lines,
  jobs,
  stages,
  components,
  synced,
  supply,
  breadcrumbs,
  canApprove,
  canManage,
  canResubmit = false,
  planHref,
  shapingHref,
}: {
  lsx: LsxHeaderData
  lines: LsxLineData[]
  jobs: Job[]
  stages: { code: string; label: string }[]
  components: ComponentOutputView[]
  synced: SyncedLine[]
  supply: SupplyPanelData | null
  breadcrumbs: { label: string; href?: string }[]
  /** GĐ trong shell exec — duyệt/từ chối tại chỗ. */
  canApprove: boolean
  /** Quản đốc/GĐ — hoàn thành, nhận vật tư, xác nhận job tại đây. */
  canManage: boolean
  /** Sales — gửi duyệt lại khi LSX bị từ chối (sửa kèm header). */
  canResubmit?: boolean
  /** Link sang màn Kế hoạch / Định hình (chỉ shell production/planning). */
  planHref?: string | null
  shapingHref?: string | null
}) {
  const router = useRouter()
  const toast = useToast()
  const [tab, setTab] = useState<Tab>('overview')
  const [busy, setBusy] = useState(false)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [resubmitOpen, setResubmitOpen] = useState(false)
  const [resubmit, setResubmit] = useState({
    ship_date: lsx.ship_date ?? '',
    received_date: lsx.received_date ?? '',
    container_summary: lsx.container_summary ?? '',
    note: lsx.note ?? '',
  })

  const st = LSX_STATUS[lsx.status as keyof typeof LSX_STATUS]
  const labelOf = (c: string) => stages.find((s) => s.code === c)?.label ?? c
  const lineName = (id: string) =>
    lines.find((l) => l.order_line_id === id)?.name_vi ?? '?'

  const jobsByLine = new Map<string, Job[]>()
  for (const j of jobs) {
    const arr = jobsByLine.get(j.order_line_id) ?? []
    arr.push(j)
    jobsByLine.set(j.order_line_id, arr)
  }

  async function call(path: string, body: unknown, okMsg: string) {
    setBusy(true)
    try {
      await api(path, { method: 'POST', body: JSON.stringify(body) })
      toast.success(okMsg)
      setRejectOpen(false)
      setResubmitOpen(false)
      router.refresh()
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Thao tác thất bại')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <TopProgressBar active={busy} />
      <PageHeader
        breadcrumbs={breadcrumbs}
        title={`Lệnh sản xuất ${lsx.code}`}
        description={`${lsx.customer_name} · Đơn ${lsx.order_code}`}
        meta={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={st?.tone ?? 'gray'}>{st?.label ?? lsx.status}</Badge>
            {lsx.priority > 0 && <Badge tone="purple">Ưu tiên {lsx.priority}</Badge>}
            {lsx.materials_received_at ? (
              <Badge tone="green">Đã nhận vật tư {fmtD(lsx.materials_received_at)}</Badge>
            ) : (
              (lsx.status === 'approved' || lsx.status === 'in_progress') && (
                <Badge tone="gray">Chưa nhận vật tư</Badge>
              )
            )}
            <span className="text-xs text-zinc-500">
              Nhận: <b>{fmtD(lsx.received_date)}</b> · Xuất: <b>{fmtD(lsx.ship_date)}</b>
              {lsx.container_summary && <> · Cont: {lsx.container_summary}</>}
            </span>
          </div>
        }
        actions={
          <div className="flex flex-wrap gap-2">
            {canApprove && lsx.status === 'pending_approval' && (
              <>
                <button
                  onClick={() =>
                    call(
                      `/api/dept/production/lsx/${lsx.id}/approve`,
                      {},
                      `Đã duyệt ${lsx.code}`,
                    )
                  }
                  disabled={busy}
                  className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-green-500 disabled:opacity-50"
                >
                  ✓ Duyệt LSX
                </button>
                <button
                  onClick={() => setRejectOpen(true)}
                  disabled={busy}
                  className="rounded-lg border border-red-300 px-3 py-1.5 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:hover:bg-red-950"
                >
                  Từ chối
                </button>
              </>
            )}
            {canManage &&
              (lsx.status === 'approved' || lsx.status === 'in_progress') &&
              !lsx.materials_received_at && (
                <button
                  onClick={() =>
                    call(
                      `/api/dept/production/lsx/${lsx.id}/materials-received`,
                      {},
                      'Đã xác nhận nhận vật tư',
                    )
                  }
                  disabled={busy}
                  className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
                >
                  📦 Nhận vật tư
                </button>
              )}
            {canResubmit && lsx.status === 'rejected' && (
              <button
                onClick={() => setResubmitOpen(true)}
                disabled={busy}
                className="rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-amber-500 disabled:opacity-50"
              >
                ↻ Gửi duyệt lại
              </button>
            )}
            <a
              href={`/print/lsx/${lsx.id}`}
              target="_blank"
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              🖨 In LSX
            </a>
          </div>
        }
      />

      {lsx.rejected_reason && lsx.status === 'rejected' && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          <b>GĐ từ chối:</b> {lsx.rejected_reason}
        </div>
      )}
      {lsx.status === 'completed' && (
        <div className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-300">
          Xưởng đã hoàn thành {fmtD(lsx.completed_at)} — chờ Sales xác nhận giao hàng để
          khép chuỗi đơn {lsx.order_code}.
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-zinc-200 dark:border-zinc-800">
        {(
          [
            ['overview', 'Tổng quan'],
            ['data', 'Chi tiết & số liệu'],
            ['outsource', 'Gia công ngoài'],
          ] as [Tab, string][]
        ).map(([t, label]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-t-lg px-4 py-2 text-sm font-medium ${
              tab === t
                ? 'border border-b-0 border-zinc-200 bg-white text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100'
                : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="flex flex-col gap-4">
          {/* Kế hoạch công đoạn per dòng SP */}
          <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold">Kế hoạch công đoạn</h2>
              {planHref && (
                <Link
                  href={planHref}
                  className="ml-auto text-xs text-sky-600 hover:underline dark:text-sky-400"
                >
                  Sửa kế hoạch →
                </Link>
              )}
            </div>
            {jobs.length === 0 ? (
              <p className="mt-2 text-sm text-zinc-500">
                Chưa lên kế hoạch — Trưởng phòng Kế hoạch lên lộ trình + giao tổ trước khi
                xưởng chạy.
              </p>
            ) : (
              <div className="mt-3 flex flex-col gap-3">
                {[...jobsByLine.entries()].map(([lineId, js]) => (
                  <div key={lineId}>
                    <div className="mb-1 text-xs font-medium text-zinc-500">
                      {lineName(lineId)}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {[...js]
                        .sort((a, b) => a.seq - b.seq)
                        .map((j, i) => (
                          <span key={j.id} className="flex items-center gap-1.5">
                            {i > 0 && <span className="text-zinc-300">→</span>}
                            <span
                              className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs ${
                                j.status === 'done'
                                  ? 'border-green-300 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-300'
                                  : j.status === 'doing'
                                    ? 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                    : 'border-zinc-200 text-zinc-500 dark:border-zinc-700'
                              }`}
                              title={`${JOB_LABEL[j.status]}${j.team_name ? ` · ${j.team_name}` : ''}${j.planned_end ? ` · hạn ${fmtD(j.planned_end)}` : ''}${j.note ? ` · ${j.note}` : ''}`}
                            >
                              {labelOf(j.stage)}
                              {j.team_name && (
                                <span className="text-[10px] opacity-70">
                                  {j.team_name}
                                </span>
                              )}
                              {j.status === 'done' ? ' ✓' : ''}
                            </span>
                          </span>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Đồng bộ bộ SP */}
          {synced.some((s) => s.has_components) && (
            <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
              <h2 className="mb-3 text-sm font-semibold">
                Bộ đồng bộ (qua công đoạn cuối)
              </h2>
              <div className="flex flex-col gap-2">
                {synced
                  .filter((s) => s.has_components)
                  .map((s) => {
                    const pct = s.qty > 0 ? Math.round((s.synced_sets / s.qty) * 100) : 0
                    return (
                      <div key={s.order_line_id} className="text-sm">
                        <div className="mb-0.5 flex justify-between text-xs">
                          <span>
                            {s.product_name}{' '}
                            <span className="text-zinc-400">{s.product_code}</span>
                          </span>
                          <b>
                            {fmtN(s.synced_sets)}/{fmtN(s.qty)} bộ ({pct}%)
                          </b>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                          <div
                            className={`h-full ${pct >= 100 ? 'bg-green-500' : 'bg-sky-500'}`}
                            style={{ width: `${Math.min(100, pct)}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
              </div>
            </section>
          )}

          {/* Dòng SP + spec in */}
          <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
            <h2 className="mb-3 text-sm font-semibold">Sản phẩm ({lines.length})</h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 text-left text-xs text-zinc-500 dark:border-zinc-800">
                    <th className="py-1.5 pr-2">SP</th>
                    <th className="py-1.5 pr-2">Mã</th>
                    <th className="w-20 py-1.5 pr-2 text-right">SL</th>
                    <th className="py-1.5 pr-2">Máy/dây</th>
                    <th className="py-1.5 pr-2">Nệm</th>
                    <th className="py-1.5 pr-2">Sơn</th>
                    <th className="py-1.5">Kính/Gỗ</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l) => (
                    <tr
                      key={l.order_line_id}
                      className="border-b border-zinc-100 dark:border-zinc-900"
                    >
                      <td className="py-1.5 pr-2">
                        <span className="flex items-center gap-2">
                          {l.image_url && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={l.image_url}
                              alt=""
                              className="h-8 w-8 rounded object-cover"
                            />
                          )}
                          <span className="font-medium">{l.name_vi}</span>
                        </span>
                      </td>
                      <td className="py-1.5 pr-2 font-mono text-xs">{l.product_code}</td>
                      <td className="py-1.5 pr-2 text-right">
                        {fmtN(l.qty)} {l.unit}
                      </td>
                      <td className="py-1.5 pr-2 text-xs">{l.spec.machine || '—'}</td>
                      <td className="py-1.5 pr-2 text-xs">{l.spec.cushion || '—'}</td>
                      <td className="py-1.5 pr-2 text-xs">{l.spec.paint || '—'}</td>
                      <td className="py-1.5 text-xs">
                        {[l.spec.glass, l.spec.wood].filter(Boolean).join(' · ') || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Cung ứng (exec/planning) */}
          {supply && (
            <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
              <h2 className="mb-3 text-sm font-semibold">Vật tư & cung ứng</h2>
              {!supply.hasBom && (
                <p className="mb-2 text-xs text-amber-600 dark:text-amber-400">
                  ⚠ Chưa có bảng chi tiết — nhu cầu vật tư chưa bóc được.
                </p>
              )}
              {supply.pos.length === 0 ? (
                <p className="text-sm text-zinc-500">Chưa có đơn đặt vật tư nào.</p>
              ) : (
                <ul className="flex flex-col gap-1.5 text-sm">
                  {supply.pos.map((p) => (
                    <li key={p.id} className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs">{p.code}</span>
                      <span>{p.supplier_name}</span>
                      <Badge tone="gray">{p.status}</Badge>
                      <span className="ml-auto text-xs text-zinc-500">
                        {p.total.toLocaleString('vi-VN')} {p.currency} · về{' '}
                        {fmtD(p.expected_at)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {lsx.note && (
            <p className="text-sm text-zinc-500">
              <b>Ghi chú:</b> {lsx.note}
            </p>
          )}
        </div>
      )}

      {tab === 'data' && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold">
              Chi tiết × công đoạn (số từ sổ thống kê)
            </h2>
            {shapingHref && (
              <Link
                href={shapingHref}
                className="ml-auto text-xs text-sky-600 hover:underline dark:text-sky-400"
              >
                Sửa bảng chi tiết →
              </Link>
            )}
          </div>
          {components.length === 0 ? (
            <EmptyState
              icon="▥"
              title="Chưa có bảng chi tiết"
              description="Thống kê định hình từ BOM Kỹ thuật trước khi ghi sổ."
            />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 text-left text-xs text-zinc-500 dark:border-zinc-800">
                    <th className="px-3 py-2">Chi tiết</th>
                    <th className="w-20 py-2 pr-2 text-right">Cần</th>
                    <th className="py-2 pr-3">Tiến độ công đoạn</th>
                    <th className="w-20 py-2 pr-3 text-right">%HT</th>
                  </tr>
                </thead>
                <tbody>
                  {components.map((c) => (
                    <tr
                      key={c.id}
                      className="border-b border-zinc-100 dark:border-zinc-900"
                    >
                      <td className="px-3 py-2">
                        {c.cluster && (
                          <span className="text-xs text-zinc-400">{c.cluster} · </span>
                        )}
                        <span className="font-medium">{c.name}</span>
                        <span className="ml-1 text-xs text-zinc-400">
                          ({lineName(c.order_line_id)})
                        </span>
                      </td>
                      <td className="py-2 pr-2 text-right tabular-nums">
                        {fmtN(c.total_needed)}
                      </td>
                      <td className="py-2 pr-3">
                        <div className="flex flex-wrap gap-1">
                          {c.summary.stages.map((s) => (
                            <span
                              key={s.stage}
                              className={`rounded border px-1.5 py-0.5 text-[11px] ${
                                s.pct >= 1
                                  ? 'border-green-300 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-300'
                                  : s.done > 0
                                    ? 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                    : 'border-zinc-200 text-zinc-400 dark:border-zinc-700'
                              }`}
                              title={`${labelOf(s.stage)}: ${fmtN(s.done)} / thiếu ${fmtN(Math.max(0, s.missing))}${s.defect ? ` / phế ${fmtN(s.defect)}` : ''}`}
                            >
                              {labelOf(s.stage)} {fmtN(s.done)}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-2 pr-3 text-right font-semibold">
                        {Math.round(c.summary.pct_total * 100)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'outsource' && <LsxOutsourcePanel lsxId={lsx.id} canRecord={canManage} />}

      {/* Modal gửi duyệt lại (Sales) — sửa kèm header vì lý do từ chối thường
          nằm ở chính các trường này */}
      <Modal
        open={resubmitOpen}
        onClose={() => setResubmitOpen(false)}
        title={`Gửi duyệt lại ${lsx.code}`}
      >
        <div className="flex flex-col gap-3 text-sm">
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-zinc-500">Ngày nhận (in LSX)</span>
              <input
                type="date"
                value={resubmit.received_date}
                onChange={(e) =>
                  setResubmit((f) => ({ ...f, received_date: e.target.value }))
                }
                className="rounded-lg border border-zinc-300 px-2 py-1.5 dark:border-zinc-700 dark:bg-zinc-900"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-zinc-500">Ngày xuất</span>
              <input
                type="date"
                value={resubmit.ship_date}
                onChange={(e) =>
                  setResubmit((f) => ({ ...f, ship_date: e.target.value }))
                }
                className="rounded-lg border border-zinc-300 px-2 py-1.5 dark:border-zinc-700 dark:bg-zinc-900"
              />
            </label>
          </div>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-zinc-500">Container</span>
            <input
              value={resubmit.container_summary}
              onChange={(e) =>
                setResubmit((f) => ({ ...f, container_summary: e.target.value }))
              }
              placeholder="vd 1 x 40'HC"
              className="rounded-lg border border-zinc-300 px-2 py-1.5 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-zinc-500">Ghi chú</span>
            <textarea
              value={resubmit.note}
              onChange={(e) => setResubmit((f) => ({ ...f, note: e.target.value }))}
              rows={2}
              className="rounded-lg border border-zinc-300 px-2 py-1.5 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setResubmitOpen(false)}
              className="rounded-lg border border-zinc-300 px-3 py-1.5 dark:border-zinc-700"
            >
              Huỷ
            </button>
            <button
              onClick={() =>
                call(
                  `/api/dept/production/lsx/${lsx.id}/resubmit`,
                  {
                    ship_date: resubmit.ship_date || null,
                    received_date: resubmit.received_date || null,
                    container_summary: resubmit.container_summary || null,
                    note: resubmit.note || null,
                  },
                  'Đã gửi duyệt lại — chờ Giám đốc',
                )
              }
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-3 py-1.5 font-semibold text-white disabled:opacity-50"
            >
              {busy && <Spinner size={14} />} Gửi duyệt lại
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal từ chối */}
      <Modal
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
        title={`Từ chối ${lsx.code}`}
      >
        <div className="flex flex-col gap-3">
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={3}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            placeholder="Lý do từ chối (bắt buộc) — Sales sẽ sửa rồi gửi duyệt lại"
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setRejectOpen(false)}
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700"
            >
              Huỷ
            </button>
            <button
              onClick={() =>
                call(
                  `/api/dept/production/lsx/${lsx.id}/reject`,
                  { reason: rejectReason },
                  `Đã từ chối ${lsx.code}`,
                )
              }
              disabled={busy || !rejectReason.trim()}
              className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {busy && <Spinner size={14} />} Từ chối LSX
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
