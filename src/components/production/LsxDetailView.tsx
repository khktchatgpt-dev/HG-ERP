'use client'

import { useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Badge } from '@/components/Badge'
import { LSX_STATUS as ST } from '@/lib/lsx-status'
import { api, ApiError } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { PageHeader } from '@/components/erp/PageHeader'
import { Spinner, TopProgressBar } from '@/components/erp/Spinner'
import { Tabs } from '@/components/ui/Tabs'
import { DocumentFiles } from '@/components/DocumentFiles'
import { LsxComponentsPanel } from '@/components/production/LsxComponentsPanel'
import { LsxOutputPanel } from '@/components/production/LsxOutputPanel'
import { LsxOutsourcePanel } from '@/components/production/LsxOutsourcePanel'
import { LsxRoutePanel } from '@/components/production/LsxRoutePanel'
import {
  assessSupplyReadiness,
  PO_STATUS_LABEL,
  PO_STATUS_TONE,
  type PoStatus,
} from '@/lib/supply-readiness'

/** Dữ liệu cung ứng của LSX cho panel Tổng quan — nạp ở LsxDetailScreen. */
export type SupplyPanelData = {
  /** Đã khai định mức (BOM) cho lệnh? → phân biệt "chưa đặt" vs "chưa cần mua". */
  hasBom: boolean
  pos: {
    id: string
    code: string
    supplier_name: string
    status: PoStatus
    expected_at: string | null
    total: number
    currency: string
  }[]
}

type LsxStatus =
  'pending_approval' | 'approved' | 'in_progress' | 'completed' | 'rejected' | 'cancelled'

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
  // received = xác nhận đã nhận vật tư (G-3); cancelled = đơn huỷ kéo LSX dừng.
  action: 'start' | 'done' | 'received' | 'cancelled'
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
  canManage,
  canRecord,
  canEditSpec,
  breadcrumbs,
  materials,
  canEditComponents,
  defaultStage,
  routeStages,
  syncProgress,
  supply,
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
  /** Cập nhật giai đoạn + hoàn thành: GĐ/QL hoặc Xưởng (canTrackProgress). */
  canManage: boolean
  /** NHẬP sổ (sản lượng/gia công): CHỈ bộ phận sản xuất — hẹp hơn canManage. */
  canRecord?: boolean
  canEditSpec: boolean
  /** Override khi render từ workspace khác (vd /production) — mặc định Sales. */
  breadcrumbs?: { label: string; href?: string }[]
  /** Bảng chi tiết & định mức (plan-lsx-components): danh mục vật tư cho grid. */
  materials?: { id: string; code: string; name: string; unit: string }[]
  /** Sửa bảng chi tiết: Kế hoạch (KH-CƯ) + GĐ/QL — xưởng chỉ xem. */
  canEditComponents?: boolean
  /** Công đoạn mặc định cho form sản lượng (suy từ tổ của người xem). */
  defaultStage?: string | null
  /**
   * Hợp lộ trình các SP (0063) khi TẤT CẢ SP của lệnh đã chốt — select "Cập
   * nhật giai đoạn" chỉ hiện giai đoạn có SP đi qua. null = không lọc.
   */
  routeStages?: string[] | null
  /** Tiến độ "bộ đồng bộ" (Σ bộ hoàn chỉnh / Σ SL đặt) — thanh % ở Tổng quan. */
  syncProgress?: { sets: number; qty: number } | null
  /** Cung ứng/vật tư của lệnh (chỉ shell GĐ + Kế hoạch) — null = không hiện. */
  supply?: SupplyPanelData | null
}) {
  const router = useRouter()
  const toast = useToast()
  const confirm = useConfirm()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [busy, setBusy] = useState(false)
  const [specs, setSpecs] = useState<Line[]>(lines)
  const [stage, setStage] = useState(lsx.current_stage ?? '')
  // Gửi duyệt lại LSX bị từ chối — cho sửa nhanh header trước khi gửi (P1).
  const [resub, setResub] = useState({
    ship_date: lsx.ship_date ?? '',
    received_date: lsx.received_date ?? '',
    container_summary: lsx.container_summary ?? '',
    note: lsx.note ?? '',
  })

  const st = ST[lsx.status]
  const stageLabel = (code: string | null) =>
    code ? (stages.find((s) => s.code === code)?.label ?? code) : '—'
  const activeStage = lsx.status === 'approved' || lsx.status === 'in_progress'

  // Trang chia TAB theo URL (?tab=) — trước đây mọi khối dồn 1 cuộn dài, thống
  // kê phải lướt qua thông số 4 SP mới tới form nhập. Deep-link được: menu
  // "Nhập sản lượng" trỏ thẳng ?tab=output.
  const showWork = lsx.status !== 'pending_approval' && lsx.status !== 'rejected'
  const tabItems = [
    { id: 'overview', label: 'Tổng quan' },
    { id: 'specs', label: 'Thông số SX', count: lines.length },
    { id: 'plan', label: 'Chi tiết & lộ trình' },
    ...(showWork
      ? [
          { id: 'output', label: 'Sản lượng' },
          { id: 'outsource', label: 'Gia công ngoài' },
        ]
      : []),
  ].map((t) => ({ ...t, href: `${pathname}?tab=${t.id}` }))
  const requestedTab = searchParams.get('tab') ?? 'overview'
  const tab = tabItems.some((t) => t.id === requestedTab) ? requestedTab : 'overview'

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
  async function resubmit() {
    const ok = await confirm({
      title: `Gửi duyệt lại LSX ${lsx.code}?`,
      description: 'LSX quay về "Chờ GĐ duyệt"; Giám đốc sẽ nhận thông báo.',
      confirmLabel: 'Gửi duyệt lại',
    })
    if (!ok) return
    await call(
      `/api/dept/production/lsx/${lsx.id}/resubmit`,
      {
        ship_date: resub.ship_date || null,
        received_date: resub.received_date || null,
        container_summary: resub.container_summary.trim() || null,
        note: resub.note.trim() || null,
      },
      'Đã gửi duyệt lại',
    )
  }

  async function materialsReceived() {
    // prompt Cancel → null (bỏ); OK để trống → xác nhận không ghi chú.
    const note = window.prompt('Ghi chú nhận vật tư (tuỳ chọn — VD: đủ theo PXK-…):')
    if (note === null) return
    await call(
      `/api/dept/production/lsx/${lsx.id}/materials-received`,
      { note: note.trim() || null },
      'Đã xác nhận nhận vật tư',
    )
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
        breadcrumbs={
          breadcrumbs ?? [
            { label: 'Kinh doanh', href: '/sales' },
            { label: 'Đơn hàng', href: '/sales/orders' },
            { label: `LSX ${lsx.code}` },
          ]
        }
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

      {lsx.status === 'rejected' && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950">
          <p className="text-sm text-red-700 dark:text-red-300">
            GĐ từ chối{lsx.rejected_reason ? `: ${lsx.rejected_reason}` : ''}
          </p>
          {canEditSpec && (
            <div className="mt-3 flex flex-col gap-2">
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <label className="flex flex-col gap-1 text-sm">
                  Thời gian xuất
                  <input
                    type="date"
                    value={resub.ship_date}
                    onChange={(e) => setResub({ ...resub, ship_date: e.target.value })}
                    className={inp}
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  Ngày nhận
                  <input
                    type="date"
                    value={resub.received_date}
                    onChange={(e) =>
                      setResub({ ...resub, received_date: e.target.value })
                    }
                    className={inp}
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  Container
                  <input
                    value={resub.container_summary}
                    maxLength={100}
                    placeholder="3 x 40'HC"
                    onChange={(e) =>
                      setResub({ ...resub, container_summary: e.target.value })
                    }
                    className={inp}
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  Ghi chú
                  <input
                    value={resub.note}
                    maxLength={2000}
                    onChange={(e) => setResub({ ...resub, note: e.target.value })}
                    className={inp}
                  />
                </label>
              </div>
              <div className="flex justify-end">
                <button
                  disabled={busy}
                  onClick={() => void resubmit()}
                  className="rounded-md bg-sky-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
                >
                  Gửi duyệt lại
                </button>
              </div>
              <p className="text-xs text-red-600/80 dark:text-red-400/80">
                Sửa spec sản phẩm ở khối bên dưới nếu cần, rồi bấm Gửi duyệt lại — LSX
                quay về hàng chờ của Giám đốc.
              </p>
            </div>
          )}
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

      <Tabs items={tabItems} active={tab} />

      {/* ── Tab Tổng quan: thông tin lệnh + tiến độ + file ── */}
      {tab === 'overview' && (
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
          {/* Bộ đồng bộ = hàng hoàn chỉnh qua công đoạn cuối — liếc là biết
              lệnh ra được bao nhiêu hàng, chi tiết xem tab Sản lượng. */}
          {syncProgress && syncProgress.qty > 0 && (
            <div className="mt-3 border-t border-zinc-200 pt-3 dark:border-zinc-800">
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="text-zinc-500">
                  Tiến độ đồng bộ{' '}
                  <b className="text-zinc-700 dark:text-zinc-200">
                    {syncProgress.sets.toLocaleString('vi-VN')}/
                    {syncProgress.qty.toLocaleString('vi-VN')}
                  </b>{' '}
                  bộ hàng hoàn chỉnh
                </span>
                <span className="font-semibold">
                  {Math.round((syncProgress.sets / syncProgress.qty) * 100)}%
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                <div
                  className={`h-full rounded-full ${
                    syncProgress.sets >= syncProgress.qty ? 'bg-green-500' : 'bg-sky-500'
                  }`}
                  style={{
                    width: `${Math.min(100, Math.round((syncProgress.sets / syncProgress.qty) * 100))}%`,
                  }}
                />
              </div>
            </div>
          )}
        </Card>
      )}

      {/* ── Tab Thông số SX: dòng SP + spec ── */}
      {tab === 'specs' && (
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
                    <div className="font-mono text-xs text-zinc-400">
                      {l.product_code}
                    </div>
                    <div className="font-medium">{l.name_vi}</div>
                  </div>
                  <span className="ml-auto text-sm">
                    SL: <b>{l.qty.toLocaleString('vi-VN')}</b> {l.unit}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                  {(['machine', 'cushion', 'paint', 'glass', 'wood'] as const).map(
                    (k) => (
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
                        {canEditSpec && lsx.status !== 'completed' ? (
                          <input
                            value={l.spec[k]}
                            onChange={(e) => setSpec(i, k, e.target.value)}
                            className={inp}
                          />
                        ) : (
                          // Chế độ xem: chữ thường thay ô input giả — xưởng
                          // đọc nhanh, không tưởng nhầm là sửa được.
                          <span className="min-h-[30px] py-1 text-sm">
                            {l.spec[k] || <span className="text-zinc-400">—</span>}
                          </span>
                        )}
                      </label>
                    ),
                  )}
                </div>
              </div>
            ))}
          </div>
          {canEditSpec && (
            <p className="mt-2 text-xs text-zinc-500">
              Thông số mặc định lấy từ hồ sơ SP (Kỹ thuật). Sales tinh chỉnh cho lệnh này
              → bấm “Lưu thông số”. In LSX sẽ dùng thông số đã lưu.
            </p>
          )}
        </Card>
      )}

      {tab === 'overview' && supply && <SupplyCard supply={supply} />}

      {/* ── Tab Chi tiết & lộ trình: cụm/chi tiết/định mức + lộ trình giai đoạn ── */}
      {tab === 'plan' && (
        <>
          <LsxRoutePanel
            lsxId={lsx.id}
            stages={stages}
            canEdit={canEditComponents ?? false}
            locked={lsx.status === 'completed' || lsx.status === 'cancelled'}
          />
          <LsxComponentsPanel
            lsxId={lsx.id}
            orderLines={lines.map((l) => ({
              id: l.order_line_id,
              product_code: l.product_code,
              product_name: l.name_vi,
              qty: l.qty,
            }))}
            materials={materials ?? []}
            stages={stages}
            canEdit={canEditComponents ?? false}
            locked={lsx.status === 'completed' || lsx.status === 'cancelled'}
          />
        </>
      )}

      {/* ── Tab Sản lượng (SX-P3) — sau khi GĐ duyệt lệnh ── */}
      {tab === 'output' && showWork && (
        <LsxOutputPanel
          lsxId={lsx.id}
          canRecord={canRecord ?? canManage}
          active={activeStage}
          initialStage={defaultStage}
        />
      )}

      {/* ── Tab Gia công ngoài TTP/Vinh (SX-P4) ── */}
      {tab === 'outsource' && showWork && (
        <LsxOutsourcePanel
          lsxId={lsx.id}
          canRecord={canRecord ?? canManage}
          active={activeStage}
        />
      )}

      {/* Tiến độ sản xuất — LSX huỷ vẫn hiện timeline (có dòng log huỷ) */}
      {tab === 'overview' &&
        (activeStage || lsx.status === 'completed' || lsx.status === 'cancelled') && (
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
                    {/* Lọc theo lộ trình khi lệnh đã định hình đủ (0063). */}
                    {stages
                      .filter((s) => !routeStages || routeStages.includes(s.code))
                      .map((s) => (
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
                  onClick={() => void materialsReceived()}
                  className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
                  title="Xác nhận xưởng đã nhận vật tư xuất theo LSX (chỉ ghi log)"
                >
                  Đã nhận vật tư
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
              <ol className="relative ml-1 flex flex-col border-l border-zinc-200 dark:border-zinc-800">
                {progress.map((p) => (
                  <li key={p.id} className="relative pb-3 pl-4 text-xs last:pb-0">
                    {/* Chấm màu theo hành động: xanh lá = xong, xanh dương =
                        bắt đầu, tím = nhận vật tư, đỏ = huỷ. */}
                    <span
                      className={
                        'absolute top-0.5 -left-[5px] h-2.5 w-2.5 rounded-full ring-4 ring-white dark:ring-zinc-950 ' +
                        (p.action === 'done'
                          ? 'bg-green-500'
                          : p.action === 'received'
                            ? 'bg-violet-500'
                            : p.action === 'cancelled'
                              ? 'bg-red-500'
                              : 'bg-sky-500')
                      }
                    />
                    <div>
                      {p.action === 'received' ? (
                        <b>Đã nhận vật tư</b>
                      ) : p.action === 'cancelled' ? (
                        <b className="text-red-600 dark:text-red-400">
                          Đơn hàng huỷ — LSX dừng
                        </b>
                      ) : (
                        <>
                          <b>{stageLabel(p.stage)}</b>{' '}
                          {p.action === 'done' ? 'xong' : 'bắt đầu'}
                        </>
                      )}
                      {p.note && (
                        <span className="text-zinc-500 italic"> · {p.note}</span>
                      )}
                    </div>
                    <div className="text-[10px] text-zinc-400">
                      {new Date(p.at).toLocaleString('vi-VN')} · {p.by ?? 'Hệ thống'}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        )}

      {/* File đính kèm — cuối tab: ít thao tác hằng ngày hơn tiến độ */}
      {tab === 'overview' && (
        <Card title="File đính kèm LSX">
          <DocumentFiles
            kind="production_order"
            id={lsx.id}
            canEdit={canEditSpec || canApprove}
            title="Tài liệu LSX"
          />
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

// Tiền theo tệ, không quy đổi FX (GĐ đọc nguyên tệ như màn Quản lý đơn hàng).
const fmtMoney = (n: number, currency: string) => {
  const s = n.toLocaleString('vi-VN', { maximumFractionDigits: 0 })
  return currency === 'VND' ? `${s} ₫` : `${s} ${currency}`
}

const READY_DOT: Record<'green' | 'sky' | 'amber' | 'zinc', string> = {
  green: 'bg-emerald-500',
  sky: 'bg-sky-500',
  amber: 'bg-amber-500',
  zinc: 'bg-zinc-300 dark:bg-zinc-600',
}
const READY_TXT: Record<'green' | 'sky' | 'amber' | 'zinc', string> = {
  green: 'text-emerald-600 dark:text-emerald-400',
  sky: 'text-sky-600 dark:text-sky-400',
  amber: 'text-amber-600 dark:text-amber-400',
  zinc: 'text-zinc-500',
}

/**
 * Panel "Cung ứng / Vật tư" ở tab Tổng quan (shell GĐ + Kế hoạch): trả lời thẳng
 * "vật tư đã đủ để chạy sản xuất chưa" + list PO của lệnh. Chỉ-đọc; link sang
 * Đơn đặt vật tư để thao tác.
 */
function SupplyCard({ supply }: { supply: SupplyPanelData }) {
  const today = new Date().toISOString().slice(0, 10)
  const active = supply.pos.filter((p) => p.status !== 'cancelled')
  const r = assessSupplyReadiness(
    supply.pos.map((p) => ({ status: p.status, expected_at: p.expected_at })),
    supply.hasBom,
    today,
  )
  // Tổng cam kết theo tệ (gộp PO chưa huỷ) — đa tệ thì liệt kê từng loại.
  const byCur = new Map<string, number>()
  for (const p of active) byCur.set(p.currency, (byCur.get(p.currency) ?? 0) + p.total)
  const commit = [...byCur.entries()].filter(([, v]) => v > 0)

  return (
    <Card
      title="Cung ứng / Vật tư"
      right={
        <a
          href="/planning/pos"
          className="text-xs text-sky-600 hover:underline dark:text-sky-400"
        >
          Đơn đặt vật tư →
        </a>
      }
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
        <span
          className={`flex items-center gap-1.5 text-sm font-semibold ${READY_TXT[r.tone]}`}
        >
          <span className={`size-2 shrink-0 rounded-full ${READY_DOT[r.tone]}`} />
          {r.label}
        </span>
        {r.activeCount > 0 && (
          <span className="text-xs text-zinc-500">
            {r.receivedCount}/{r.activeCount} PO đã về đủ
          </span>
        )}
        {r.nextExpected && (
          <span className="text-xs text-zinc-500">
            Hẹn về gần nhất:{' '}
            <b className="text-zinc-700 dark:text-zinc-200">{fmtD(r.nextExpected)}</b>
          </span>
        )}
        {r.overdueCount > 0 && (
          <span className="text-xs font-medium text-red-600 dark:text-red-400">
            ⚠ {r.overdueCount} PO quá hẹn
          </span>
        )}
        {commit.length > 0 && (
          <span className="ml-auto text-xs text-zinc-500">
            Cam kết:{' '}
            <b className="text-zinc-700 tabular-nums dark:text-zinc-200">
              {commit.map(([cur, v]) => fmtMoney(v, cur)).join(' · ')}
            </b>
          </span>
        )}
      </div>

      {active.length === 0 ? (
        <p className="mt-3 border-t border-zinc-100 pt-3 text-xs text-zinc-400 dark:border-zinc-800">
          {supply.hasBom
            ? 'Lệnh đã có định mức nhưng chưa có đơn đặt vật tư nào — cần Cung ứng lên PO.'
            : 'Chưa có đơn đặt vật tư cho lệnh này.'}
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-zinc-100 border-t border-zinc-100 dark:divide-zinc-800 dark:border-zinc-800">
          {active.map((p) => {
            const overdue =
              p.status !== 'received' && p.expected_at != null && p.expected_at < today
            return (
              <li key={p.id} className="flex items-center gap-2 py-2 text-sm">
                <span className="shrink-0 font-mono text-xs text-zinc-500">{p.code}</span>
                <span className="min-w-0 flex-1 truncate">{p.supplier_name}</span>
                <Badge tone={PO_STATUS_TONE[p.status]}>{PO_STATUS_LABEL[p.status]}</Badge>
                <span
                  className={`w-20 shrink-0 text-right text-xs tabular-nums ${
                    overdue
                      ? 'font-medium text-red-600 dark:text-red-400'
                      : 'text-zinc-500'
                  }`}
                >
                  {p.expected_at ? fmtD(p.expected_at) : '—'}
                </span>
                <span className="w-28 shrink-0 text-right text-xs tabular-nums">
                  {p.total > 0 ? fmtMoney(p.total, p.currency) : '—'}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}
