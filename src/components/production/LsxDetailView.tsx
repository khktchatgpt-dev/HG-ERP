'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/Badge'
import { api, ApiError } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { PageHeader } from '@/components/erp/PageHeader'
import { Spinner, TopProgressBar } from '@/components/erp/Spinner'
import { DocumentFiles } from '@/components/DocumentFiles'

type LsxStatus =
  'pending_approval' | 'approved' | 'in_progress' | 'completed' | 'rejected'

const ST: Record<
  LsxStatus,
  { label: string; tone: 'gray' | 'blue' | 'amber' | 'green' | 'red' }
> = {
  pending_approval: { label: 'Chờ GĐ duyệt', tone: 'amber' },
  approved: { label: 'Đã duyệt', tone: 'blue' },
  in_progress: { label: 'Đang sản xuất', tone: 'amber' },
  completed: { label: 'Hoàn thành', tone: 'green' },
  rejected: { label: 'Bị từ chối', tone: 'red' },
}

type Spec = {
  machine: string
  cushion: string
  paint: string
  glass: string
  wood: string
}
type Line = {
  order_line_id: string
  product_code: string
  name_vi: string
  unit: string
  qty: number
  image_url: string | null
  spec: Spec
}
type Progress = {
  id: string
  stage: string
  action: 'start' | 'done'
  note: string | null
  by: string | null
  at: string
}
type Stage = { code: string; label: string }

const fmtD = (d: string | null) => (d ? new Date(d).toLocaleDateString('vi-VN') : '—')

export function LsxDetailView({
  lsx,
  lines,
  progress,
  stages,
  canApprove,
  canEditSpec,
}: {
  lsx: {
    id: string
    code: string
    status: LsxStatus
    order_id: string
    order_code: string
    customer_name: string
    current_stage: string | null
    ship_date: string | null
    received_date: string | null
    completed_at: string | null
    approved_at: string | null
    rejected_reason: string | null
    container_summary: string | null
    note: string | null
    created_at: string
  }
  lines: Line[]
  progress: Progress[]
  stages: Stage[]
  canApprove: boolean
  canEditSpec: boolean
}) {
  const router = useRouter()
  const toast = useToast()
  const confirm = useConfirm()
  const [busy, setBusy] = useState(false)
  const [specs, setSpecs] = useState<Line[]>(lines)
  const [stage, setStage] = useState(lsx.current_stage ?? '')

  const st = ST[lsx.status]
  const stageLabel = (code: string | null) =>
    code ? (stages.find((s) => s.code === code)?.label ?? code) : '—'
  const canManage = canApprove // GĐ/QL cập nhật giai đoạn + hoàn thành
  const activeStage = lsx.status === 'approved' || lsx.status === 'in_progress'

  async function call(url: string, body?: unknown, ok = 'Đã cập nhật') {
    setBusy(true)
    try {
      await api(url, { method: 'POST', body: body ?? {} })
      toast.success(ok, lsx.code)
      router.refresh()
    } catch (e) {
      toast.error('Thất bại', e instanceof ApiError ? e.message : 'Có lỗi')
    } finally {
      setBusy(false)
    }
  }

  async function approve() {
    const ok = await confirm({
      title: `Duyệt LSX ${lsx.code}?`,
      description: 'Đơn sẽ sang "Đã phát LSX"; Cung ứng được báo để đặt vật tư.',
      confirmLabel: 'Duyệt',
    })
    if (ok) await call(`/api/dept/production/lsx/${lsx.id}/approve`, {}, 'Đã duyệt LSX')
  }
  async function reject() {
    const reason = window.prompt(`Lý do từ chối LSX ${lsx.code}:`)?.trim()
    if (!reason) return
    await call(`/api/dept/production/lsx/${lsx.id}/reject`, { reason }, 'Đã từ chối LSX')
  }
  async function updateStage() {
    if (!stage) return
    await call(
      `/api/dept/production/lsx/${lsx.id}/stage`,
      { stage, action: 'done' },
      'Đã cập nhật giai đoạn',
    )
  }
  async function complete() {
    const ok = await confirm({
      title: `Báo hoàn thành ${lsx.code}?`,
      description: 'Đơn sẽ chuyển sang Hoàn thành để giao hàng.',
      confirmLabel: 'Hoàn thành',
    })
    if (ok)
      await call(`/api/dept/production/lsx/${lsx.id}/complete`, {}, 'LSX hoàn thành')
  }

  async function saveSpecs() {
    setBusy(true)
    try {
      await api(`/api/dept/production/lsx/${lsx.id}/specs`, {
        method: 'PUT',
        body: {
          lines: specs.map((l) => ({
            order_line_id: l.order_line_id,
            specs: {
              machine: l.spec.machine || undefined,
              cushion: l.spec.cushion || undefined,
              paint: l.spec.paint || undefined,
              glass: l.spec.glass || undefined,
              wood: l.spec.wood || undefined,
            },
          })),
        },
      })
      toast.success('Đã lưu thông số sản xuất', lsx.code)
      router.refresh()
    } catch (e) {
      toast.error('Lưu spec thất bại', e instanceof ApiError ? e.message : 'Có lỗi')
    } finally {
      setBusy(false)
    }
  }

  function setSpec(i: number, k: keyof Spec, v: string) {
    setSpecs((ls) =>
      ls.map((l, x) => (x === i ? { ...l, spec: { ...l.spec, [k]: v } } : l)),
    )
  }

  const inp =
    'w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm focus:border-sky-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900'

  return (
    <div className="flex flex-col gap-5">
      <TopProgressBar active={busy} />
      <PageHeader
        breadcrumbs={[
          { label: 'Kinh doanh', href: '/sales' },
          { label: 'Đơn hàng', href: '/sales/orders' },
          { label: `LSX ${lsx.code}` },
        ]}
        title={`Lệnh sản xuất ${lsx.code}`}
        description={`${lsx.customer_name} · đơn ${lsx.order_code}`}
        meta={
          <>
            <Badge tone={st.tone}>{st.label}</Badge>
            {activeStage && lsx.current_stage && (
              <Badge tone="amber">Giai đoạn: {stageLabel(lsx.current_stage)}</Badge>
            )}
          </>
        }
        actions={
          <a
            href={`/print/lsx/${lsx.id}`}
            target="_blank"
            rel="noopener"
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            🖨 In LSX
          </a>
        }
      />

      {lsx.status === 'rejected' && lsx.rejected_reason && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          GĐ từ chối: {lsx.rejected_reason}
        </div>
      )}

      {/* Duyệt (GĐ) */}
      {lsx.status === 'pending_approval' && canApprove && (
        <Card title="Giám đốc duyệt LSX">
          <div className="flex flex-wrap gap-2">
            <button
              disabled={busy}
              onClick={() => void approve()}
              className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              ✓ Duyệt LSX
            </button>
            <button
              disabled={busy}
              onClick={() => void reject()}
              className="rounded-md border border-red-300 px-4 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:hover:bg-red-950"
            >
              Từ chối
            </button>
          </div>
        </Card>
      )}

      {/* Thông tin */}
      <Card title="Thông tin LSX">
        <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3 lg:grid-cols-4">
          <Info label="Đơn hàng" value={lsx.order_code} />
          <Info label="Khách hàng" value={lsx.customer_name} />
          <Info label="Container" value={lsx.container_summary} />
          <Info label="Ngày nhận" value={fmtD(lsx.received_date)} />
          <Info label="Thời gian xuất" value={fmtD(lsx.ship_date)} />
          <Info label="Ngày duyệt" value={fmtD(lsx.approved_at)} />
          <Info label="Ngày hoàn thành" value={fmtD(lsx.completed_at)} />
          <Info label="Ngày tạo" value={fmtD(lsx.created_at)} />
        </div>
        {lsx.note && (
          <div className="mt-3 border-t border-zinc-200 pt-3 text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
            <span className="font-medium">Ghi chú: </span>
            {lsx.note}
          </div>
        )}
      </Card>

      {/* Dòng SP + thông số sản xuất */}
      <Card
        title={`Sản phẩm & thông số sản xuất (${specs.length})`}
        right={
          canEditSpec && lsx.status !== 'completed' ? (
            <button
              disabled={busy}
              onClick={() => void saveSpecs()}
              className="inline-flex items-center gap-1.5 rounded-md bg-sky-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-700 disabled:opacity-50"
            >
              {busy && <Spinner size={12} />}
              Lưu thông số
            </button>
          ) : undefined
        }
      >
        <div className="flex flex-col gap-3">
          {specs.map((l, i) => (
            <div
              key={l.order_line_id}
              className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"
            >
              <div className="mb-2 flex items-center gap-3">
                {l.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={l.image_url}
                    alt={l.name_vi}
                    className="h-10 w-12 rounded object-contain"
                  />
                ) : null}
                <div className="min-w-0">
                  <div className="font-mono text-xs text-zinc-400">{l.product_code}</div>
                  <div className="font-medium">{l.name_vi}</div>
                </div>
                <span className="ml-auto text-sm">
                  SL: <b>{l.qty.toLocaleString('vi-VN')}</b> {l.unit}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                {(['machine', 'cushion', 'paint', 'glass', 'wood'] as const).map((k) => (
                  <label key={k} className="flex flex-col gap-1">
                    <span className="text-[10px] font-medium tracking-wide text-zinc-400 uppercase">
                      {
                        {
                          machine: 'Máy',
                          cushion: 'Nệm',
                          paint: 'Sơn',
                          glass: 'Kính',
                          wood: 'Gỗ',
                        }[k]
                      }
                    </span>
                    <input
                      value={l.spec[k]}
                      readOnly={!canEditSpec || lsx.status === 'completed'}
                      onChange={(e) => setSpec(i, k, e.target.value)}
                      className={inp}
                    />
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
        {canEditSpec && (
          <p className="mt-2 text-xs text-zinc-500">
            Thông số mặc định lấy từ hồ sơ SP (Kỹ thuật). Sales tinh chỉnh cho lệnh này →
            bấm “Lưu thông số”. In LSX sẽ dùng thông số đã lưu.
          </p>
        )}
      </Card>

      {/* File LSX */}
      <Card title="File đính kèm LSX">
        <DocumentFiles
          kind="production_order"
          id={lsx.id}
          canEdit={canEditSpec || canApprove}
          title="Tài liệu LSX"
        />
      </Card>

      {/* Tiến độ sản xuất */}
      {(activeStage || lsx.status === 'completed') && (
        <Card title="Tiến độ sản xuất">
          {activeStage && canManage && (
            <div className="mb-3 flex flex-wrap items-end gap-2">
              <label className="flex flex-col gap-1 text-sm">
                Giai đoạn
                <select
                  value={stage}
                  onChange={(e) => setStage(e.target.value)}
                  className={`${inp} min-w-48`}
                >
                  <option value="">— chọn giai đoạn —</option>
                  {stages.map((s) => (
                    <option key={s.code} value={s.code}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>
              <button
                disabled={busy || !stage}
                onClick={() => void updateStage()}
                className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
              >
                Cập nhật giai đoạn
              </button>
              <button
                disabled={busy}
                onClick={() => void complete()}
                className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                ✓ Hoàn thành
              </button>
            </div>
          )}
          {progress.length === 0 ? (
            <p className="text-xs text-zinc-400">Chưa có tiến độ.</p>
          ) : (
            <ul className="flex flex-col gap-1.5 text-xs">
              {progress.map((p) => (
                <li
                  key={p.id}
                  className="border-l-2 border-zinc-300 pl-2 dark:border-zinc-700"
                >
                  <span className="text-zinc-500">
                    {new Date(p.at).toLocaleString('vi-VN')} — {p.by ?? 'Hệ thống'}:
                  </span>{' '}
                  <b>{stageLabel(p.stage)}</b> ({p.action === 'done' ? 'xong' : 'bắt đầu'}
                  ){p.note && <span className="italic"> · {p.note}</span>}
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  )
}

function Card({
  title,
  right,
  children,
}: {
  title: string
  right?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-2.5 dark:border-zinc-800">
        <h2 className="text-xs font-semibold tracking-wider text-zinc-500 uppercase">
          {title}
        </h2>
        {right}
      </div>
      <div className="p-4">{children}</div>
    </section>
  )
}

function Info({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] font-medium text-zinc-400 uppercase">{label}</span>
      <span>{value ? value : <span className="text-zinc-400">—</span>}</span>
    </div>
  )
}
