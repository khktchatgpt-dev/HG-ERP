'use client'

import { Fragment, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Check,
  FileSpreadsheet,
  Package,
  Pencil,
  Printer,
  RotateCcw,
  SendHorizontal,
  X,
} from 'lucide-react'
import { Badge } from '@/components/shadcn/badge'
import { Button } from '@/components/shadcn/button'
import { Checkbox } from '@/components/shadcn/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/shadcn/dialog'
import { Input } from '@/components/shadcn/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/shadcn/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/shadcn/tabs'
import { Textarea } from '@/components/shadcn/textarea'
import { Spinner, TopProgressBar } from '@/components/erp/Spinner'
import { StageBar } from './LsxStageBar'
import { api, ApiError } from '@/lib/api'
import { canRemoveOrdersFromLsx } from '@/lib/record-ownership'
import { useToast } from '@/components/ui/Toast'
import type { Job } from '@/modules/dept/production/jobs.repo'
import type { ComponentOutputView } from '@/modules/dept/production/entries.service'
import { LsxOutsourcePanel } from './LsxOutsourcePanel'

/**
 * HỒ SƠ LỆNH (0084) — dùng chung 3 shell (production/exec/planning), quyền
 * theo cờ từ server. Trục chính = KẾ HOẠCH CÔNG ĐOẠN (jobs) per dòng SP;
 * số đọc từ sổ thống kê. Tab: Tổng quan · Chi tiết & số liệu · Gia công.
 *
 * Bố cục v2 (06/08/2026, theo trang mẫu /sales/lsx):
 *   · đầu trang là THẺ HỒ SƠ: mã lệnh + vòng đời + dải số liệu (đơn/dòng/SL/
 *     ngày) — liếc một phát nắm cả lệnh;
 *   · tab Tổng quan chia 2 cột: cột chính là BẢNG SẢN PHẨM NHÓM THEO PO (đúng
 *     cấu trúc tờ lệnh in) + kế hoạch công đoạn; cột phụ là đơn gộp/vật tư/ghi
 *     chú — metadata không chen giữa nội dung chính;
 *   · cột spec khách không dùng (rỗng cả bảng) tự ẩn.
 */

export type LsxHeaderData = {
  id: string
  code: string
  status: string
  /** Các đơn lệnh đang chạy (0113 — một lệnh gộp nhiều đơn cùng khách). */
  orders: { id: string; code: string }[]
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
  /**
   * Người LẬP lệnh (0119). Không lấy từ `issued_by` — cột đó bị ghi đè mỗi lần
   * gửi duyệt lại nên không truy được người lập. null = lệnh nhập bằng script
   * trước khi có tính năng.
   */
  created_by_name: string | null
}

export type LsxLineData = {
  /** id DÒNG LỆNH (production_order_lines) — 0114. */
  order_line_id: string
  /** Nhóm chứa dòng (số PO / bộ sưu tập) — lệnh gộp nhiều đơn. */
  group_title: string
  product_code: string
  name_vi: string
  unit: string
  qty: number
  ship_text: string
  image_url: string | null
  /** Spec theo MẪU CỘT của khách — khoá động, nhãn nằm ở specColumns. */
  spec: Record<string, string>
}

export type SupplyPanelData = {
  hasBom: boolean
  /**
   * Định mức của lệnh đã CHỐT lúc nào (0142). null = chưa chốt → nhu cầu vật tư
   * còn đọc định mức sống của hồ sơ SP, Kỹ thuật sửa BOM là số của lệnh đổi theo.
   */
  bomSnapshot: { snapped_at: string; products: number } | null
  /** Được bấm "chốt lại định mức" (`production.lsx.bom_resnap`). */
  canResnapBom: boolean
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

const sectionCls = 'rounded-xl border bg-card p-4 shadow-xs'
const sectionLink = 'ml-auto text-xs font-medium text-primary hover:underline'
// Tiêu đề cột: chữ ĐẬM màu chữ chính — xám nhạt trên nền xám nhạt của hàng
// header là chỗ khó đọc nhất bảng.
const thCls = 'text-[11px] font-semibold tracking-wider text-foreground uppercase'

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
  canEditOrders = false,
  mergeCandidates = [],
  specColumns = [],
  linesHref,
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
  /** Sales — gộp thêm/gỡ đơn khi lệnh chưa hoàn thành (0113). */
  canEditOrders?: boolean
  /** Đơn cùng khách đã xác nhận, chưa thuộc lệnh nào — ứng viên gộp thêm. */
  mergeCandidates?: { id: string; code: string; line_count: number }[]
  /** Cột spec theo mẫu của khách (0114) — quyết định bảng SP hiện cột nào. */
  specColumns?: { key: string; label: string }[]
  /** Link màn soạn dòng lệnh (chỉ shell Sales). */
  linesHref?: string | null
}) {
  const router = useRouter()
  const toast = useToast()
  const [tab, setTab] = useState<Tab>('overview')
  const [busy, setBusy] = useState(false)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [resubmitOpen, setResubmitOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [addIds, setAddIds] = useState<string[]>([])
  const [resubmit, setResubmit] = useState({
    ship_date: lsx.ship_date ?? '',
    received_date: lsx.received_date ?? '',
    container_summary: lsx.container_summary ?? '',
    note: lsx.note ?? '',
  })
  // Sửa thông tin đầu lệnh (0117) — mở từ nút "Sửa thông tin".
  const [editOpen, setEditOpen] = useState(false)
  const [edit, setEdit] = useState({
    code: lsx.code,
    priority: String(lsx.priority ?? 0),
    ship_date: lsx.ship_date ?? '',
    received_date: lsx.received_date ?? '',
    container_summary: lsx.container_summary ?? '',
    note: lsx.note ?? '',
  })

  // Đổi danh sách đơn được tới khi lệnh kết thúc (server chặn lần cuối).
  const ordersEditable = lsx.status !== 'completed' && lsx.status !== 'cancelled'
  // Duyệt rồi thì chỉ SỬA/CẬP NHẬT, không gỡ bớt đơn (chốt 07/08/2026). Gộp THÊM
  // vẫn cho — đó là bổ sung, không phải xoá.
  const canRemoveOrders = canRemoveOrdersFromLsx(lsx.status)
  const labelOf = (c: string) => stages.find((s) => s.code === c)?.label ?? c
  const lineName = (id: string) =>
    lines.find((l) => l.order_line_id === id)?.name_vi ?? '?'

  const jobsByLine = new Map<string, Job[]>()
  for (const j of jobs) {
    const arr = jobsByLine.get(j.production_order_line_id) ?? []
    arr.push(j)
    jobsByLine.set(j.production_order_line_id, arr)
  }

  // Dải số liệu đầu trang + bảng SP nhóm theo PO (đúng cấu trúc tờ lệnh).
  const totalQty = lines.reduce((s, l) => s + l.qty, 0)
  const lineGroups = [...new Set(lines.map((l) => l.group_title))].map(
    (t) => [t, lines.filter((l) => l.group_title === t)] as const,
  )
  // Cột spec khách không dùng (rỗng cả bảng) thì ẩn — MERXX không có cột Kính rỗng.
  const specShown = specColumns.filter((c) =>
    lines.some((l) => (l.spec[c.key] ?? '').trim()),
  )

  async function call(path: string, body: unknown, okMsg: string) {
    setBusy(true)
    try {
      await api(path, { method: 'POST', body: body })
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

  /** Lưu thông tin đầu lệnh (0117) — gửi cả cụm, server bỏ field không đổi. */
  async function saveHeader() {
    setBusy(true)
    try {
      await api(`/api/dept/production/lsx/${lsx.id}`, {
        method: 'PATCH',
        body: {
          code: edit.code.trim(),
          priority: Number(edit.priority) || 0,
          ship_date: edit.ship_date || null,
          received_date: edit.received_date || null,
          container_summary: edit.container_summary.trim() || null,
          note: edit.note.trim() || null,
        },
      })
      toast.success('Đã lưu thông tin lệnh', edit.code.trim())
      setEditOpen(false)
      router.refresh()
    } catch (e) {
      toast.error('Lưu thất bại', e instanceof ApiError ? e.message : 'Có lỗi')
    } finally {
      setBusy(false)
    }
  }

  /** Gộp thêm / gỡ đơn của lệnh (0113) — cùng endpoint, khác method. */
  async function changeOrders(method: 'POST' | 'DELETE', ids: string[], okMsg: string) {
    setBusy(true)
    try {
      await api(`/api/dept/production/lsx/${lsx.id}/orders`, {
        method,
        body: { order_ids: ids },
      })
      toast.success(okMsg)
      setAddOpen(false)
      setAddIds([])
      router.refresh()
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Không đổi được danh sách đơn')
    } finally {
      setBusy(false)
    }
  }

  const stat = (label: string, value: React.ReactNode) => (
    <div>
      {/* 11px chứ không 10px: nhãn dải số liệu ở 10px + xám là gần như không đọc nổi. */}
      <div className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
        {label}
      </div>
      <div className="mt-0.5 text-sm font-semibold tabular-nums">{value}</div>
    </div>
  )

  return (
    <div className="theme-v2 text-foreground flex flex-col gap-4">
      <TopProgressBar active={busy} />

      {breadcrumbs.length > 0 && (
        <nav className="text-muted-foreground -mb-2 flex flex-wrap items-center gap-1 text-xs">
          {breadcrumbs.map((b, i) => (
            <Fragment key={i}>
              {i > 0 && <span>/</span>}
              {b.href ? (
                <Link href={b.href} className="hover:text-foreground hover:underline">
                  {b.label}
                </Link>
              ) : (
                <span>{b.label}</span>
              )}
            </Fragment>
          ))}
        </nav>
      )}

      {/* ── Thẻ hồ sơ: định danh + vòng đời + dải số liệu ─────────────────── */}
      <div className="bg-card rounded-xl border shadow-xs">
        <div className="flex flex-wrap items-start justify-between gap-3 p-4 pb-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <h1 className="text-xl font-semibold tracking-tight">
                Lệnh sản xuất <span className="font-mono">{lsx.code}</span>
              </h1>
              <StageBar status={lsx.status} className="w-[170px]" />
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <span className="text-muted-foreground text-sm">{lsx.customer_name}</span>
              {lsx.created_by_name && (
                <span className="text-muted-foreground text-sm">
                  · lập bởi <span className="text-foreground">{lsx.created_by_name}</span>
                </span>
              )}
              {lsx.priority > 0 && (
                <Badge
                  variant="outline"
                  className="border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-900 dark:bg-purple-950/40 dark:text-purple-400"
                >
                  Ưu tiên {lsx.priority}
                </Badge>
              )}
              {lsx.materials_received_at ? (
                <Badge
                  variant="outline"
                  className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-400"
                >
                  Đã nhận vật tư {fmtD(lsx.materials_received_at)}
                </Badge>
              ) : (
                (lsx.status === 'approved' || lsx.status === 'in_progress') && (
                  <Badge variant="secondary" className="text-muted-foreground">
                    Chưa nhận vật tư
                  </Badge>
                )
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {canApprove && lsx.status === 'pending_approval' && (
              <>
                <Button
                  onClick={() =>
                    call(
                      `/api/dept/production/lsx/${lsx.id}/approve`,
                      {},
                      `Đã duyệt ${lsx.code}`,
                    )
                  }
                  disabled={busy}
                >
                  <Check />
                  Duyệt lệnh
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setRejectOpen(true)}
                  disabled={busy}
                  className="text-destructive hover:text-destructive"
                >
                  <X />
                  Từ chối
                </Button>
              </>
            )}
            {canManage &&
              (lsx.status === 'approved' || lsx.status === 'in_progress') &&
              !lsx.materials_received_at && (
                <Button
                  variant="outline"
                  onClick={() =>
                    call(
                      `/api/dept/production/lsx/${lsx.id}/materials-received`,
                      {},
                      'Đã xác nhận nhận vật tư',
                    )
                  }
                  disabled={busy}
                >
                  <Package />
                  Nhận vật tư
                </Button>
              )}
            {/* Sửa đầu lệnh (0117) — Sales sửa số lệnh/ngày/cont/ghi chú mọi lúc
                trước khi lệnh kết thúc, không phải chờ bị từ chối mới sửa được. */}
            {canResubmit && ordersEditable && (
              <Button variant="outline" onClick={() => setEditOpen(true)} disabled={busy}>
                <Pencil />
                Sửa thông tin
              </Button>
            )}
            {/* Lệnh nháp (0117): Sales gửi thẳng từ hồ sơ, khỏi quay lại màn soạn. */}
            {canResubmit && lsx.status === 'draft' && (
              <Button
                onClick={() =>
                  call(
                    `/api/dept/production/lsx/${lsx.id}/submit`,
                    {},
                    `Đã gửi ${lsx.code} cho Giám đốc duyệt`,
                  )
                }
                disabled={busy}
              >
                <SendHorizontal />
                Gửi GĐ duyệt
              </Button>
            )}
            {canResubmit && lsx.status === 'rejected' && (
              <Button
                onClick={() => setResubmitOpen(true)}
                disabled={busy}
                className="bg-amber-600 text-white hover:bg-amber-500"
              >
                <RotateCcw />
                Gửi duyệt lại
              </Button>
            )}
            <Button variant="outline" asChild>
              <a href={`/print/lsx/${lsx.id}`} target="_blank">
                <Printer />
                In phiếu
              </a>
            </Button>
            {/* Tải .xlsx bày giống hệt phiếu in — Sales gửi khách/gia công sửa tiếp. */}
            <Button variant="outline" asChild>
              <a href={`/api/dept/production/lsx/${lsx.id}/export`} download>
                <FileSpreadsheet />
                Xuất Excel
              </a>
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 border-t px-4 py-3 sm:grid-cols-6">
          {stat('Đơn hàng', lsx.orders.length)}
          {stat('Dòng SP', lines.length)}
          {stat('Tổng SL', `${fmtN(totalQty)} SP`)}
          {stat('Ngày nhận', fmtD(lsx.received_date))}
          {stat('Hạn xuất', fmtD(lsx.ship_date))}
          {stat('Container', lsx.container_summary || '—')}
        </div>
      </div>

      {lsx.rejected_reason && lsx.status === 'rejected' && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          <b>GĐ từ chối:</b> {lsx.rejected_reason}
        </div>
      )}
      {lsx.status === 'completed' && (
        <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-300">
          Xưởng đã hoàn thành {fmtD(lsx.completed_at)} — chờ Sales xác nhận giao hàng để
          khép chuỗi{' '}
          {lsx.orders.length > 1
            ? `${lsx.orders.length} đơn`
            : `đơn ${lsx.orders[0]?.code ?? ''}`}
          .
        </div>
      )}

      {/* Tabs */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="max-w-full">
        <TabsList className="max-w-full overflow-x-auto">
          <TabsTrigger value="overview">Tổng quan</TabsTrigger>
          <TabsTrigger value="data">Chi tiết & số liệu</TabsTrigger>
          <TabsTrigger value="outsource">Gia công ngoài</TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === 'overview' && (
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          {/* ── Cột chính: sản phẩm + kế hoạch công đoạn + đồng bộ ─────────── */}
          <div className="flex min-w-0 flex-col gap-4">
            {/* Sản phẩm — nhóm theo PO/bộ sưu tập, đúng cấu trúc tờ lệnh in */}
            <section className={`${sectionCls} overflow-hidden p-0`}>
              <div className="flex items-center gap-2 px-4 pt-4 pb-3">
                <h2 className="text-sm font-semibold">Sản phẩm ({lines.length})</h2>
                {linesHref && (
                  <Link href={linesHref} className={sectionLink}>
                    Soạn dòng lệnh →
                  </Link>
                )}
              </div>
              <Table className="min-w-[560px]">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className={`${thCls} px-4`}>Sản phẩm</TableHead>
                    <TableHead className={`${thCls} w-28 text-right`}>SL</TableHead>
                    <TableHead className={`${thCls} w-28`}>Đợt xuất</TableHead>
                    {specShown.map((c) => (
                      <TableHead key={c.key} className={thCls}>
                        {c.label}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lineGroups.map(([title, ls]) => (
                    <Fragment key={title || '(none)'}>
                      {(title || lineGroups.length > 1) && (
                        <TableRow className="bg-muted/40 hover:bg-muted/40">
                          <TableCell
                            colSpan={3 + specShown.length}
                            className="px-4 py-1.5 whitespace-normal"
                          >
                            <span className="text-xs font-medium">
                              {title || 'Chưa đặt tên nhóm'}
                            </span>
                            <span className="text-muted-foreground ml-2 text-[11px]">
                              {ls.length} dòng · {fmtN(ls.reduce((s, l) => s + l.qty, 0))}{' '}
                              SP
                            </span>
                          </TableCell>
                        </TableRow>
                      )}
                      {ls.map((l) => (
                        <TableRow key={l.order_line_id}>
                          <TableCell className="px-4 py-2 whitespace-normal">
                            <span className="flex items-center gap-2.5">
                              {l.image_url && (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={l.image_url}
                                  alt=""
                                  className="h-9 w-9 shrink-0 rounded-md border object-cover"
                                />
                              )}
                              <span className="min-w-0">
                                <span className="block truncate text-sm font-medium">
                                  {l.name_vi}
                                </span>
                                {l.product_code !== l.name_vi && (
                                  <span className="text-muted-foreground block truncate font-mono text-xs">
                                    {l.product_code}
                                  </span>
                                )}
                              </span>
                            </span>
                          </TableCell>
                          <TableCell className="py-2 text-right text-sm tabular-nums">
                            <b>{fmtN(l.qty)}</b>{' '}
                            <span className="text-muted-foreground text-xs">
                              {l.unit}
                            </span>
                          </TableCell>
                          <TableCell className="text-muted-foreground py-2 text-xs">
                            {l.ship_text || '—'}
                          </TableCell>
                          {specShown.map((c) => (
                            <TableCell
                              key={c.key}
                              className="py-2 text-xs whitespace-pre-wrap"
                            >
                              {l.spec[c.key] || '—'}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </Fragment>
                  ))}
                </TableBody>
              </Table>
            </section>

            {/* Kế hoạch công đoạn per dòng SP */}
            <section className={sectionCls}>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold">Kế hoạch công đoạn</h2>
                {planHref && (
                  <Link href={planHref} className={sectionLink}>
                    Sửa kế hoạch →
                  </Link>
                )}
              </div>
              {jobs.length === 0 ? (
                <p className="text-muted-foreground mt-2 text-sm">
                  Chưa lên kế hoạch — Trưởng phòng Kế hoạch lên lộ trình + giao tổ trước
                  khi xưởng chạy.
                </p>
              ) : (
                <div className="mt-3 flex flex-col gap-3">
                  {[...jobsByLine.entries()].map(([lineId, js]) => (
                    <div key={lineId}>
                      <div className="text-muted-foreground mb-1 text-xs font-medium">
                        {lineName(lineId)}
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {[...js]
                          .sort((a, b) => a.seq - b.seq)
                          .map((j, i) => (
                            <span key={j.id} className="flex items-center gap-1.5">
                              {i > 0 && <span className="text-border">→</span>}
                              <span
                                className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs ${
                                  j.status === 'done'
                                    ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                                    : j.status === 'doing'
                                      ? 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                                      : 'text-muted-foreground'
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
              <section className={sectionCls}>
                <h2 className="mb-3 text-sm font-semibold">
                  Bộ đồng bộ (qua công đoạn cuối)
                </h2>
                <div className="flex flex-col gap-2">
                  {synced
                    .filter((s) => s.has_components)
                    .map((s) => {
                      const pct =
                        s.qty > 0 ? Math.round((s.synced_sets / s.qty) * 100) : 0
                      return (
                        <div key={s.order_line_id} className="text-sm">
                          <div className="mb-0.5 flex justify-between text-xs">
                            <span>
                              {s.product_name}{' '}
                              <span className="text-muted-foreground">
                                {s.product_code}
                              </span>
                            </span>
                            <b className="tabular-nums">
                              {fmtN(s.synced_sets)}/{fmtN(s.qty)} bộ ({pct}%)
                            </b>
                          </div>
                          <div className="bg-muted h-1.5 overflow-hidden rounded-full">
                            <div
                              className={`h-full ${pct >= 100 ? 'bg-emerald-500' : 'bg-sky-500'}`}
                              style={{ width: `${Math.min(100, pct)}%` }}
                            />
                          </div>
                        </div>
                      )
                    })}
                </div>
              </section>
            )}
          </div>

          {/* ── Cột phụ: đơn gộp + vật tư + ghi chú ────────────────────────── */}
          <div className="flex min-w-0 flex-col gap-4">
            <section className={sectionCls}>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold">
                  Đơn hàng trong lệnh ({lsx.orders.length})
                </h2>
                {canEditOrders && ordersEditable && mergeCandidates.length > 0 && (
                  <button onClick={() => setAddOpen((v) => !v)} className={sectionLink}>
                    {addOpen ? 'Đóng' : '+ Gộp thêm'}
                  </button>
                )}
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {lsx.orders.map((o) => (
                  <span
                    key={o.id}
                    className="bg-background inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs"
                  >
                    <Link
                      href={`/sales/orders/${o.id}`}
                      className="font-mono hover:underline"
                    >
                      {o.code}
                    </Link>
                    {canEditOrders && canRemoveOrders && lsx.orders.length > 1 && (
                      <button
                        disabled={busy}
                        onClick={() =>
                          void changeOrders('DELETE', [o.id], `Đã gỡ đơn ${o.code}`)
                        }
                        title="Gỡ đơn khỏi lệnh"
                        className="text-muted-foreground hover:text-destructive disabled:opacity-50"
                      >
                        ✕
                      </button>
                    )}
                  </span>
                ))}
              </div>
              {addOpen && (
                <div className="bg-muted/30 mt-3 flex flex-col gap-2 rounded-lg border p-3">
                  {mergeCandidates.map((c) => (
                    <label
                      key={c.id}
                      className="flex cursor-pointer items-center gap-2 text-sm"
                    >
                      <Checkbox
                        checked={addIds.includes(c.id)}
                        onCheckedChange={(v) =>
                          setAddIds((prev) =>
                            v ? [...prev, c.id] : prev.filter((x) => x !== c.id),
                          )
                        }
                      />
                      <span className="font-mono text-xs">{c.code}</span>
                      <span className="text-muted-foreground ml-auto text-xs">
                        {c.line_count} dòng
                      </span>
                    </label>
                  ))}
                  <Button
                    size="sm"
                    className="mt-1 self-start"
                    disabled={busy || !addIds.length}
                    onClick={() =>
                      void changeOrders(
                        'POST',
                        addIds,
                        `Đã gộp ${addIds.length} đơn vào ${lsx.code}`,
                      )
                    }
                  >
                    Gộp vào lệnh
                  </Button>
                </div>
              )}
            </section>

            {supply && (
              <section className={sectionCls}>
                <h2 className="mb-2 text-sm font-semibold">Vật tư & cung ứng</h2>
                {!supply.hasBom && (
                  <p className="mb-2 text-xs text-amber-600 dark:text-amber-400">
                    ⚠ Chưa có bảng chi tiết — nhu cầu vật tư chưa bóc được.
                  </p>
                )}
                {/* ĐỊNH MỨC ĐÃ CHỐT (0142): lệnh mua theo bản nào. Trước đây nhu
                    cầu đọc định mức SỐNG nên Kỹ thuật sửa BOM là số của lệnh cũ
                    đổi theo — nay đứng yên, và muốn ăn theo bản mới thì phải
                    bấm chốt lại (có người chịu trách nhiệm). */}
                <div className="bg-muted/40 mb-2 rounded-md px-2 py-1.5 text-xs">
                  {supply.bomSnapshot ? (
                    <p className="text-muted-foreground">
                      Định mức đã chốt {fmtD(supply.bomSnapshot.snapped_at)} ·{' '}
                      {supply.bomSnapshot.products} SP — Kỹ thuật sửa BOM sau mốc này
                      KHÔNG làm đổi nhu cầu của lệnh.
                    </p>
                  ) : (
                    <p className="text-amber-600 dark:text-amber-400">
                      Định mức chưa chốt — nhu cầu đang đọc bản hiện hành của hồ sơ SP, Kỹ
                      thuật sửa BOM là số của lệnh đổi theo. Chốt khi duyệt lệnh.
                    </p>
                  )}
                  {supply.canResnapBom && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        void call(
                          `/api/dept/production/lsx/${lsx.id}/bom-snapshot`,
                          {},
                          'Đã chốt lại định mức theo BOM hiện hành',
                        )
                      }
                      className="text-primary mt-1 inline-flex items-center gap-1 font-medium hover:underline disabled:opacity-50"
                    >
                      Chốt lại theo BOM mới
                    </button>
                  )}
                </div>
                {supply.pos.length === 0 ? (
                  <p className="text-muted-foreground text-sm">
                    Chưa có đơn đặt vật tư nào.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-2 text-sm">
                    {supply.pos.map((p) => (
                      <li key={p.id} className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="truncate font-mono text-xs">{p.code}</span>
                          <Badge
                            variant="secondary"
                            className="text-muted-foreground ml-auto shrink-0"
                          >
                            {p.status}
                          </Badge>
                        </div>
                        <div className="text-muted-foreground mt-0.5 truncate text-xs">
                          {p.supplier_name} · {p.total.toLocaleString('vi-VN')}{' '}
                          {p.currency} · về {fmtD(p.expected_at)}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}

            {lsx.note && (
              <section className={sectionCls}>
                <h2 className="mb-1 text-sm font-semibold">Ghi chú lệnh</h2>
                <p className="text-muted-foreground text-sm whitespace-pre-wrap">
                  {lsx.note}
                </p>
              </section>
            )}
          </div>
        </div>
      )}

      {tab === 'data' && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold">
              Chi tiết × công đoạn (số từ sổ thống kê)
            </h2>
            {shapingHref && (
              <Link href={shapingHref} className={sectionLink}>
                Sửa bảng chi tiết →
              </Link>
            )}
          </div>
          {components.length === 0 ? (
            <div className="rounded-xl border border-dashed py-14 text-center">
              <div className="text-sm font-medium">Chưa có bảng chi tiết</div>
              <div className="text-muted-foreground mt-1 text-xs">
                Thống kê định hình từ BOM Kỹ thuật trước khi ghi sổ.
              </div>
            </div>
          ) : (
            <div className="bg-card overflow-hidden rounded-xl border shadow-xs">
              <Table className="min-w-[720px]">
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className={`${thCls} px-4`}>Chi tiết</TableHead>
                    <TableHead className={`${thCls} w-24 text-right`}>Cần</TableHead>
                    <TableHead className={thCls}>Tiến độ công đoạn</TableHead>
                    <TableHead className={`${thCls} w-20 pr-4 text-right`}>%HT</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {components.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="px-4 py-2 whitespace-normal">
                        {c.cluster && (
                          <span className="text-muted-foreground text-xs">
                            {c.cluster} ·{' '}
                          </span>
                        )}
                        <span className="font-medium">{c.name}</span>
                        <span className="text-muted-foreground ml-1 text-xs">
                          ({lineName(c.order_line_id)})
                        </span>
                      </TableCell>
                      <TableCell className="py-2 text-right tabular-nums">
                        {fmtN(c.total_needed)}
                      </TableCell>
                      <TableCell className="py-2 whitespace-normal">
                        <div className="flex flex-wrap gap-1">
                          {c.summary.stages.map((s) => (
                            <span
                              key={s.stage}
                              className={`rounded border px-1.5 py-0.5 text-[11px] ${
                                s.pct >= 1
                                  ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                                  : s.done > 0
                                    ? 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                                    : 'text-muted-foreground'
                              }`}
                              title={`${labelOf(s.stage)}: ${fmtN(s.done)} / thiếu ${fmtN(Math.max(0, s.missing))}${s.defect ? ` / phế ${fmtN(s.defect)}` : ''}`}
                            >
                              {labelOf(s.stage)} {fmtN(s.done)}
                            </span>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="py-2 pr-4 text-right font-semibold tabular-nums">
                        {Math.round(c.summary.pct_total * 100)}%
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}

      {tab === 'outsource' && <LsxOutsourcePanel lsxId={lsx.id} canRecord={canManage} />}

      {/* Dialog SỬA THÔNG TIN ĐẦU LỆNH (0117) — khách hàng không sửa ở đây:
          mọi đơn trong lệnh phải cùng khách, đổi khách = tạo lệnh khác. */}
      <Dialog open={editOpen} onOpenChange={(o) => !o && !busy && setEditOpen(false)}>
        <DialogContent className="theme-v2">
          <DialogHeader>
            <DialogTitle>Sửa thông tin lệnh {lsx.code}</DialogTitle>
            <DialogDescription>
              Đầu phiếu lệnh — dòng sản phẩm sửa ở màn “Soạn dòng lệnh”.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <label className="text-foreground flex flex-col gap-1 text-xs font-medium">
                Số lệnh
                <Input
                  value={edit.code}
                  onChange={(e) => setEdit((f) => ({ ...f, code: e.target.value }))}
                  maxLength={50}
                  className="font-mono"
                />
              </label>
              <label className="text-foreground flex flex-col gap-1 text-xs font-medium">
                Ưu tiên (0 = thường)
                <Input
                  type="number"
                  min={0}
                  max={9}
                  value={edit.priority}
                  onChange={(e) => setEdit((f) => ({ ...f, priority: e.target.value }))}
                />
              </label>
              <label className="text-foreground flex flex-col gap-1 text-xs font-medium">
                Ngày nhận đơn (in trên phiếu)
                <Input
                  type="date"
                  value={edit.received_date}
                  onChange={(e) =>
                    setEdit((f) => ({ ...f, received_date: e.target.value }))
                  }
                />
              </label>
              <label className="text-foreground flex flex-col gap-1 text-xs font-medium">
                Hạn xuất
                <Input
                  type="date"
                  value={edit.ship_date}
                  onChange={(e) => setEdit((f) => ({ ...f, ship_date: e.target.value }))}
                />
              </label>
            </div>
            <label className="text-foreground flex flex-col gap-1 text-xs font-medium">
              Container
              <Input
                value={edit.container_summary}
                onChange={(e) =>
                  setEdit((f) => ({ ...f, container_summary: e.target.value }))
                }
                placeholder="vd 1 x 40'HC"
              />
            </label>
            <label className="text-foreground flex flex-col gap-1 text-xs font-medium">
              Ghi chú lệnh (in trên phiếu)
              <Textarea
                value={edit.note}
                onChange={(e) => setEdit((f) => ({ ...f, note: e.target.value }))}
                rows={3}
              />
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={busy}>
              Huỷ
            </Button>
            <Button
              onClick={() => void saveHeader()}
              disabled={busy || !edit.code.trim()}
            >
              {busy && <Spinner size={14} />} Lưu thông tin
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog gửi duyệt lại (Sales) — sửa kèm header vì lý do từ chối thường
          nằm ở chính các trường này */}
      <Dialog
        open={resubmitOpen}
        onOpenChange={(o) => !o && !busy && setResubmitOpen(false)}
      >
        <DialogContent className="theme-v2">
          <DialogHeader>
            <DialogTitle>Gửi duyệt lại {lsx.code}</DialogTitle>
            <DialogDescription>
              Sửa các trường Giám đốc đã chê rồi gửi lại — lệnh quay về hàng chờ duyệt.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <label className="text-foreground flex flex-col gap-1 text-xs font-medium">
                Ngày nhận (in LSX)
                <Input
                  type="date"
                  value={resubmit.received_date}
                  onChange={(e) =>
                    setResubmit((f) => ({ ...f, received_date: e.target.value }))
                  }
                />
              </label>
              <label className="text-foreground flex flex-col gap-1 text-xs font-medium">
                Ngày xuất
                <Input
                  type="date"
                  value={resubmit.ship_date}
                  onChange={(e) =>
                    setResubmit((f) => ({ ...f, ship_date: e.target.value }))
                  }
                />
              </label>
            </div>
            <label className="text-foreground flex flex-col gap-1 text-xs font-medium">
              Container
              <Input
                value={resubmit.container_summary}
                onChange={(e) =>
                  setResubmit((f) => ({ ...f, container_summary: e.target.value }))
                }
                placeholder="vd 1 x 40'HC"
              />
            </label>
            <label className="text-foreground flex flex-col gap-1 text-xs font-medium">
              Ghi chú
              <Textarea
                value={resubmit.note}
                onChange={(e) => setResubmit((f) => ({ ...f, note: e.target.value }))}
                rows={2}
              />
            </label>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setResubmitOpen(false)}
              disabled={busy}
            >
              Huỷ
            </Button>
            <Button
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
              className="bg-amber-600 text-white hover:bg-amber-500"
            >
              {busy && <Spinner size={14} />} Gửi duyệt lại
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog từ chối */}
      <Dialog open={rejectOpen} onOpenChange={(o) => !o && !busy && setRejectOpen(false)}>
        <DialogContent className="theme-v2">
          <DialogHeader>
            <DialogTitle>Từ chối {lsx.code}</DialogTitle>
            <DialogDescription>
              Ghi rõ lý do — Sales sẽ sửa theo đó rồi gửi duyệt lại.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={3}
            placeholder="Lý do từ chối (bắt buộc)"
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRejectOpen(false)}
              disabled={busy}
            >
              Huỷ
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                call(
                  `/api/dept/production/lsx/${lsx.id}/reject`,
                  { reason: rejectReason },
                  `Đã từ chối ${lsx.code}`,
                )
              }
              disabled={busy || !rejectReason.trim()}
            >
              {busy && <Spinner size={14} />} Từ chối lệnh
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
