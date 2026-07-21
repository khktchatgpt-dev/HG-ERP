'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Check,
  ChevronLeft,
  Clock,
  FileText,
  Inbox,
  Loader2,
  Lock,
  Printer,
  StickyNote,
  Truck,
  TriangleAlert,
  X,
} from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { api, ApiError, apiErrorText } from '@/lib/api'
import { Button } from '@/components/shadcn/button'
import { Checkbox } from '@/components/shadcn/checkbox'
import { Textarea } from '@/components/shadcn/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/shadcn/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/shadcn/alert-dialog'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/shadcn/tooltip'
import { TopProgressBar } from '@/components/erp/Spinner'
import { cn } from '@/lib/utils'
import {
  comparePending,
  isBulkApprovable,
  matchesFilter,
  summarizeBulk,
  waitingDays,
  type ApprovalFilter,
} from './approval-helpers'
import { isBigApproval } from '@/lib/exec-ops'
import type { PendingLsx, PendingPo } from './approval-types'
import {
  daysUntil,
  dueBadge,
  Fact,
  fmtD,
  fmtTr,
  fmtVnd,
  LsxProductTable,
  OrderInfo,
  PoLineTable,
  SectionLabel,
  Signal,
} from './approval-parts'

/**
 * BUỒNG LÁI PHÊ DUYỆT — master-detail để GĐ THẨM ĐỊNH rồi mới duyệt. Cột trái
 * gộp LSX + đơn vật tư theo tab; cột phải là bảng phân tích RIÊNG THEO LOẠI:
 *   • Đơn vật tư → cam kết chi tiền: tổng tiền, NCC, hàng về, bảng vật tư +
 *     cảnh báo thiếu giá, ghi chú.
 *   • Lệnh SX → sẵn sàng sản xuất: giá trị đơn, hạn giao khách, bảng sản phẩm +
 *     trạng thái BOM (tín hiệu chốt được kỹ thuật hay chưa).
 * Mobile drill-in một tầng (danh sách → chi tiết có nút quay lại). LsxDetail/
 * PoDetail được export để trang chi tiết đơn duyệt (/exec/approvals/{lsx,po}/[id])
 * dùng lại nguyên bản.
 */

type Sel = { kind: 'lsx' | 'po'; id: string }
type DecideTarget = { kind: 'lsx' | 'po'; id: string; code: string; label: string }

type Row =
  | { kind: 'lsx'; key: string; big: false; created_at: string; lsx: PendingLsx }
  | { kind: 'po'; key: string; big: boolean; created_at: string; po: PendingPo }

const FILTERS: { key: ApprovalFilter; label: string }[] = [
  { key: 'all', label: 'Tất cả' },
  { key: 'lsx', label: 'Lệnh SX' },
  { key: 'po', label: 'Đơn vật tư' },
]

function targetLsx(l: PendingLsx): DecideTarget {
  return {
    kind: 'lsx',
    id: l.id,
    code: l.code,
    label: `${l.customer_name} · đơn ${l.order_code}`,
  }
}
function targetPo(
  p: Pick<PendingPo, 'id' | 'code' | 'supplier_name' | 'lsx_code'>,
): DecideTarget {
  return {
    kind: 'po',
    id: p.id,
    code: p.code,
    label: `${p.supplier_name} · LSX ${p.lsx_code}`,
  }
}

export function ApprovalCockpit({
  pos,
  lsxs,
  nowIso,
}: {
  pos: PendingPo[]
  lsxs: PendingLsx[]
  nowIso: string
}) {
  const router = useRouter()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [filter, setFilter] = useState<ApprovalFilter>('all')
  const [sel, setSel] = useState<Sel | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkOpen, setBulkOpen] = useState(false)
  const [approveTarget, setApproveTarget] = useState<DecideTarget | null>(null)
  const [rejectTarget, setRejectTarget] = useState<DecideTarget | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  const rows = useMemo<Row[]>(() => {
    const all: Row[] = [
      ...lsxs.map((l): Row => ({
        kind: 'lsx',
        key: `lsx:${l.id}`,
        big: false,
        created_at: l.created_at,
        lsx: l,
      })),
      ...pos.map((p): Row => ({
        kind: 'po',
        key: `po:${p.id}`,
        big: isBigApproval(p.total),
        created_at: p.created_at,
        po: p,
      })),
    ]
    all.sort(comparePending)
    return all
  }, [lsxs, pos])

  const visible = rows.filter((r) => matchesFilter(r, filter))
  const selRow = sel
    ? rows.find((r) => r.kind === sel.kind && keyId(r) === sel.id)
    : undefined

  const eligibleVisible = visible.filter((r) =>
    isBulkApprovable(
      r.kind === 'po' ? { kind: 'po', total: r.po.total } : { kind: 'lsx' },
    ),
  )
  const allEligibleSelected =
    eligibleVisible.length > 0 && eligibleVisible.every((r) => selected.has(r.key))
  const selectedRows = rows.filter((r) => selected.has(r.key))
  const bulkSummary = summarizeBulk(
    selectedRows.map((r) =>
      r.kind === 'po'
        ? { kind: 'po' as const, total: r.po.total }
        : { kind: 'lsx' as const },
    ),
  )

  function keyId(r: Row) {
    return r.kind === 'po' ? r.po.id : r.lsx.id
  }

  function toggleRow(key: string) {
    setSelected((s) => {
      const next = new Set(s)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }
  function toggleAllEligible() {
    setSelected((s) => {
      const next = new Set(s)
      if (allEligibleSelected) eligibleVisible.forEach((r) => next.delete(r.key))
      else eligibleVisible.forEach((r) => next.add(r.key))
      return next
    })
  }

  async function callDecide(
    t: DecideTarget,
    decision: 'approve' | 'reject',
    reason?: string,
  ) {
    if (t.kind === 'lsx') {
      await api(`/api/dept/production/lsx/${t.id}/${decision}`, {
        method: 'POST',
        body: decision === 'reject' ? { reason } : {},
      })
    } else {
      await api(`/api/dept/supply/pos/${t.id}/decide`, {
        method: 'POST',
        body: { decision, reason },
      })
    }
  }

  async function confirmApprove() {
    if (!approveTarget) return
    setBusy(true)
    try {
      await callDecide(approveTarget, 'approve')
      toast.success('Đã duyệt', approveTarget.code)
      setApproveTarget(null)
      setSel(null)
      router.refresh()
    } catch (e) {
      toast.error('Thao tác thất bại', apiErrorText(e))
    } finally {
      setBusy(false)
    }
  }

  async function submitReject() {
    if (!rejectTarget) return
    const reason = rejectReason.trim()
    if (!reason) return
    setBusy(true)
    try {
      await callDecide(rejectTarget, 'reject', reason)
      toast.success('Đã từ chối', rejectTarget.code)
      setRejectTarget(null)
      setRejectReason('')
      setSel(null)
      router.refresh()
    } catch (e) {
      toast.error('Thao tác thất bại', apiErrorText(e))
    } finally {
      setBusy(false)
    }
  }

  async function runBulk() {
    const targets: DecideTarget[] = selectedRows.map((r) =>
      r.kind === 'po' ? targetPo(r.po) : targetLsx(r.lsx),
    )
    setBusy(true)
    let ok = 0
    const fails: string[] = []
    for (const t of targets) {
      try {
        await callDecide(t, 'approve')
        ok += 1
      } catch (e) {
        fails.push(`${t.code} (${e instanceof ApiError ? e.message : 'lỗi'})`)
      }
    }
    setBusy(false)
    setBulkOpen(false)
    setSelected(new Set())
    if (fails.length === 0) toast.success(`Đã duyệt nhanh ${ok} phiếu`)
    else toast.warning(`Đã duyệt ${ok} phiếu, ${fails.length} lỗi`, fails.join(' · '))
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-3">
      <TopProgressBar active={busy} />

      {/* Bộ lọc */}
      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => {
          const c =
            f.key === 'all'
              ? rows.length
              : rows.filter((r) => matchesFilter(r, f.key)).length
          const active = filter === f.key
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition',
                active
                  ? 'bg-foreground text-background'
                  : 'text-muted-foreground hover:bg-muted',
              )}
            >
              {f.label}
              <span
                className={cn(
                  'tabular-nums',
                  active ? 'opacity-70' : 'text-muted-foreground/70',
                )}
              >
                {c}
              </span>
            </button>
          )
        })}
        {eligibleVisible.length > 0 && (
          <label className="text-muted-foreground ml-auto flex cursor-pointer items-center gap-2 text-xs">
            <Checkbox checked={allEligibleSelected} onCheckedChange={toggleAllEligible} />
            Chọn hết để duyệt nhanh ({eligibleVisible.length})
          </label>
        )}
      </div>

      {/* Master-detail */}
      <div className="grid gap-4 lg:grid-cols-[minmax(300px,340px)_minmax(0,1fr)]">
        {/* Trái: danh sách */}
        <aside className={cn('lg:block', sel && 'hidden')}>
          <div className="bg-card divide-border/60 divide-y overflow-hidden rounded-xl border">
            {visible.length === 0 ? (
              <div className="text-muted-foreground flex h-40 flex-col items-center justify-center gap-2 text-sm">
                <Inbox className="size-6 opacity-50" />
                Không có phiếu chờ duyệt.
              </div>
            ) : (
              visible.map((r) => {
                const isSel = sel?.kind === r.kind && sel.id === keyId(r)
                const days = waitingDays(r.created_at, nowIso)
                const bulkable = isBulkApprovable(
                  r.kind === 'po' ? { kind: 'po', total: r.po.total } : { kind: 'lsx' },
                )
                return (
                  <div
                    key={r.key}
                    onClick={() => setSel({ kind: r.kind, id: keyId(r) })}
                    className={cn(
                      'flex cursor-pointer items-start gap-3 px-3.5 py-3 transition',
                      isSel
                        ? 'bg-muted shadow-[inset_2px_0_0_var(--primary)]'
                        : 'hover:bg-muted/50',
                    )}
                  >
                    <span
                      className={cn(
                        'mt-1.5 size-2 shrink-0 rounded-full',
                        days >= 4
                          ? 'bg-red-500'
                          : days >= 2
                            ? 'bg-amber-500'
                            : 'bg-emerald-500',
                      )}
                      title={days >= 1 ? `Chờ ${days} ngày` : 'Mới'}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-muted-foreground flex items-center gap-2 text-[11px]">
                        <span className="font-medium tracking-wide uppercase">
                          {r.kind === 'lsx' ? 'Lệnh SX' : 'Vật tư'}
                        </span>
                        <span className="truncate font-mono">
                          {r.kind === 'lsx' ? r.lsx.code : r.po.code}
                        </span>
                      </div>
                      <div className="text-foreground mt-0.5 truncate text-sm font-semibold">
                        {r.kind === 'lsx' ? r.lsx.customer_name : r.po.supplier_name}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs">
                        {r.kind === 'po' ? (
                          <span
                            className={cn(
                              'font-semibold tabular-nums',
                              r.big
                                ? 'text-red-600 dark:text-red-400'
                                : 'text-foreground',
                            )}
                          >
                            {fmtVnd(r.po.total)} ₫
                          </span>
                        ) : (
                          <span className="text-muted-foreground tabular-nums">
                            {r.lsx.order_value ? fmtTr(r.lsx.order_value) : '—'}
                          </span>
                        )}
                        {r.kind === 'lsx' && (r.lsx.bom_pending ?? 0) > 0 && (
                          <span className="inline-flex items-center gap-0.5 text-amber-600 dark:text-amber-400">
                            <TriangleAlert className="size-3" /> {r.lsx.bom_pending} chờ
                            BOM
                          </span>
                        )}
                        {days >= 2 && (
                          <span
                            className={cn(
                              'inline-flex items-center gap-0.5',
                              days >= 4
                                ? 'text-red-600 dark:text-red-400'
                                : 'text-amber-600 dark:text-amber-400',
                            )}
                          >
                            <Clock className="size-3" /> {days}n
                          </span>
                        )}
                        {r.big && (
                          <span className="rounded bg-red-50 px-1 text-[10px] font-semibold text-red-600 dark:bg-red-950/60 dark:text-red-400">
                            GIÁ TRỊ LỚN
                          </span>
                        )}
                      </div>
                    </div>
                    {bulkable ? (
                      <div onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          className="mt-0.5"
                          checked={selected.has(r.key)}
                          onCheckedChange={() => toggleRow(r.key)}
                          aria-label={`Chọn ${r.kind === 'lsx' ? r.lsx.code : r.po.code}`}
                        />
                      </div>
                    ) : (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="mt-0.5 text-red-500">
                            <Lock className="size-3.5" />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          Giá trị lớn — duyệt riêng, không duyệt nhanh
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </aside>

        {/* Phải: chi tiết */}
        <section className={cn('lg:block', !sel && 'hidden')}>
          {!selRow ? (
            <div className="text-muted-foreground flex min-h-[360px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-6 text-center text-sm">
              <FileText className="size-7 opacity-40" />
              <div>Chọn một phiếu ở danh sách</div>
              <div className="text-xs">Bảng phân tích và nút duyệt sẽ hiện ở đây.</div>
            </div>
          ) : selRow.kind === 'lsx' ? (
            <LsxDetail
              l={selRow.lsx}
              nowIso={nowIso}
              busy={busy}
              onBack={() => setSel(null)}
              fullHref={`/exec/approvals/lsx/${selRow.lsx.id}`}
              onApprove={() => setApproveTarget(targetLsx(selRow.lsx))}
              onReject={() => setRejectTarget(targetLsx(selRow.lsx))}
            />
          ) : (
            <PoDetail
              p={selRow.po}
              big={selRow.big}
              nowIso={nowIso}
              busy={busy}
              onBack={() => setSel(null)}
              fullHref={`/exec/approvals/po/${selRow.po.id}`}
              onApprove={() => setApproveTarget(targetPo(selRow.po))}
              onReject={() => setRejectTarget(targetPo(selRow.po))}
            />
          )}
        </section>
      </div>

      {/* Thanh duyệt nhanh */}
      {selected.size > 0 && (
        <div className="bg-background/95 sticky bottom-3 z-10 flex flex-wrap items-center gap-3 rounded-xl border p-3 shadow-lg backdrop-blur">
          <span className="text-sm">
            Đã chọn <b className="tabular-nums">{selected.size}</b> phiếu
            {bulkSummary.total > 0 && (
              <span className="text-muted-foreground">
                {' '}
                · tổng <b className="tabular-nums">{fmtVnd(bulkSummary.total)}</b> ₫
              </span>
            )}
          </span>
          <div className="ml-auto flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
              Bỏ chọn
            </Button>
            <Button size="sm" disabled={busy} onClick={() => setBulkOpen(true)}>
              <Check /> Duyệt nhanh {selected.size} phiếu
            </Button>
          </div>
        </div>
      )}

      {/* Dialogs */}
      <AlertDialog
        open={!!approveTarget}
        onOpenChange={(o) => !o && setApproveTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Duyệt {approveTarget?.kind === 'lsx' ? 'LSX' : 'đơn đặt'}{' '}
              {approveTarget?.code}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {approveTarget?.label}. Duyệt xong Cung ứng mới{' '}
              {approveTarget?.kind === 'lsx'
                ? 'đặt được vật tư'
                : 'gửi được cho NCC (BR-05)'}
              .
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Huỷ</AlertDialogCancel>
            <AlertDialogAction disabled={busy} onClick={() => void confirmApprove()}>
              {busy && <Loader2 className="animate-spin" />} Duyệt
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={!!rejectTarget}
        onOpenChange={(o) => {
          if (!o) {
            setRejectTarget(null)
            setRejectReason('')
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Từ chối {rejectTarget?.kind === 'lsx' ? 'LSX' : 'đơn đặt'}{' '}
              {rejectTarget?.code}
            </DialogTitle>
            <DialogDescription>
              {rejectTarget?.label}. Ghi lý do để bộ phận liên quan biết cần sửa gì.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            autoFocus
            rows={3}
            placeholder="Lý do từ chối…"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
          />
          <DialogFooter>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => {
                setRejectTarget(null)
                setRejectReason('')
              }}
            >
              Huỷ
            </Button>
            <Button
              variant="destructive"
              disabled={busy || !rejectReason.trim()}
              onClick={() => void submitReject()}
            >
              {busy && <Loader2 className="animate-spin" />} Từ chối
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={bulkOpen} onOpenChange={(o) => !o && setBulkOpen(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Duyệt nhanh {selected.size} phiếu?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-1">
                <div>
                  {bulkSummary.lsx} lệnh sản xuất + {bulkSummary.po} đơn vật tư
                  {bulkSummary.total > 0 && (
                    <>
                      {' '}
                      (tổng <b>{fmtVnd(bulkSummary.total)}</b> ₫)
                    </>
                  )}
                  .
                </div>
                <div className="text-muted-foreground text-xs">
                  Đơn vật tư giá trị lớn (≥50tr) không nằm trong duyệt nhanh — mở chi tiết
                  duyệt riêng.
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Huỷ</AlertDialogCancel>
            <AlertDialogAction disabled={busy} onClick={() => void runBulk()}>
              {busy && <Loader2 className="animate-spin" />} Duyệt {selected.size} phiếu
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ── Mảnh riêng của panel (DetailHead + ActionBar) ────────────────────────────

function DetailHead({
  kind,
  code,
  title,
  metric,
  metricLabel,
  metricTone,
  onBack,
}: {
  kind: 'lsx' | 'po'
  code: string
  title: string
  metric: string
  metricLabel: string
  metricTone?: 'red'
  onBack: () => void
}) {
  return (
    <div className="border-border/60 border-b px-5 py-4">
      <button
        onClick={onBack}
        className="text-muted-foreground hover:text-foreground mb-2 -ml-1 inline-flex items-center gap-1 text-xs lg:hidden"
      >
        <ChevronLeft className="size-4" /> Danh sách
      </button>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-muted-foreground flex items-center gap-2 text-xs">
            <span className="font-medium tracking-wide uppercase">
              {kind === 'lsx' ? 'Lệnh sản xuất' : 'Đơn đặt vật tư'}
            </span>
            <span className="font-mono">{code}</span>
          </div>
          <h2 className="mt-1 truncate text-lg font-bold">{title}</h2>
        </div>
        <div className="shrink-0 text-right">
          <div
            className={cn(
              'text-xl font-bold tabular-nums',
              metricTone === 'red' && 'text-red-600 dark:text-red-400',
            )}
          >
            {metric}
          </div>
          <div className="text-muted-foreground text-[11px]">{metricLabel}</div>
        </div>
      </div>
    </div>
  )
}

function ActionBar({
  amountLabel,
  busy,
  onApprove,
  onReject,
}: {
  amountLabel?: string
  busy: boolean
  onApprove: () => void
  onReject: () => void
}) {
  return (
    <div className="bg-background/90 border-border/60 sticky bottom-0 flex flex-wrap gap-2 border-t px-5 py-3 backdrop-blur">
      <Button variant="destructive" disabled={busy} onClick={onReject}>
        <X /> Từ chối
      </Button>
      <Button className="flex-1" disabled={busy} onClick={onApprove}>
        <Check /> Phê duyệt{amountLabel ? ` · ${amountLabel}` : ''}
      </Button>
    </div>
  )
}

// ── Chi tiết Lệnh sản xuất — thẩm định "sẵn sàng sản xuất" ────────────────────
export function LsxDetail({
  l,
  nowIso,
  busy,
  onBack,
  onApprove,
  onReject,
  fullHref,
}: {
  l: PendingLsx
  nowIso: string
  busy: boolean
  onBack: () => void
  onApprove: () => void
  onReject: () => void
  /** Link mở trang chi tiết đầy đủ — ẩn khi đã ở chính trang đó. */
  fullHref?: string
}) {
  const days = waitingDays(l.created_at, nowIso)
  const due = dueBadge(daysUntil(l.ship_date, nowIso))
  const bomPending = l.bom_pending ?? 0
  const lines = l.lines ?? []

  return (
    <div className="bg-card flex flex-col overflow-hidden rounded-xl border">
      <DetailHead
        kind="lsx"
        code={l.code}
        title={l.customer_name}
        metric={l.order_value ? fmtTr(l.order_value) : '—'}
        metricLabel="Giá trị đơn"
        onBack={onBack}
      />
      <div className="flex flex-col gap-3 p-5">
        {bomPending > 0 ? (
          <Signal tone="alert">
            <b>{bomPending} sản phẩm chưa chốt BOM.</b> Duyệt lệnh nhưng Kỹ thuật cần hoàn
            tất BOM thì xưởng mới đủ định mức chạy.
          </Signal>
        ) : due.tone === 'red' ? (
          <Signal tone="alert">
            <b>Hạn giao {due.text}.</b> Duyệt sớm để Cung ứng kịp đặt vật tư.
          </Signal>
        ) : days >= 2 ? (
          <Signal tone="warn">
            <b>Đã chờ {days} ngày.</b> Duyệt để mở khoá Cung ứng đặt vật tư.
          </Signal>
        ) : (
          <Signal tone="ok">
            BOM đủ, sẵn sàng — duyệt để Cung ứng đặt vật tư (FR-SAL-06).
          </Signal>
        )}

        <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 sm:grid-cols-3 lg:grid-cols-4">
          <Fact label="Đơn hàng">{l.order_code}</Fact>
          <Fact label="Hạn giao khách" tone={due.tone}>
            <span className="inline-flex items-center gap-1">
              <Truck className="size-3.5" />
              {fmtD(l.ship_date)}
            </span>
          </Fact>
          <Fact label="Còn lại" tone={due.tone}>
            {due.text}
          </Fact>
          <Fact label="Ngày nhận">{fmtD(l.received_date)}</Fact>
          <Fact label="Người phát lệnh">{l.issued_by_name ?? '—'}</Fact>
          <Fact label="Phát ngày">{fmtD(l.created_at)}</Fact>
          <Fact
            label="Chờ duyệt"
            tone={days >= 4 ? 'red' : days >= 2 ? 'amber' : 'muted'}
          >
            {days >= 1 ? `${days} ngày` : 'mới'}
          </Fact>
        </dl>

        {l.order && <OrderInfo o={l.order} />}

        <LsxProductTable lines={lines} />

        {l.container_summary && l.container_summary.trim() && (
          <div>
            <SectionLabel>Đóng container</SectionLabel>
            <p className="mt-1 text-sm whitespace-pre-wrap">{l.container_summary}</p>
          </div>
        )}

        {l.note && l.note.trim() && (
          <div>
            <SectionLabel>
              <span className="inline-flex items-center gap-1">
                <StickyNote className="size-3.5" /> Ghi chú
              </span>
            </SectionLabel>
            <p className="mt-1 text-sm whitespace-pre-wrap">{l.note}</p>
          </div>
        )}

        {fullHref && (
          <Link
            href={fullHref}
            className="text-sm text-sky-600 hover:underline dark:text-sky-400"
          >
            Mở chi tiết đầy đủ LSX {l.code} →
          </Link>
        )}
      </div>
      <ActionBar busy={busy} onApprove={onApprove} onReject={onReject} />
    </div>
  )
}

// ── Chi tiết Đơn vật tư — thẩm định "cam kết chi tiền" ────────────────────────
export function PoDetail({
  p,
  big,
  nowIso,
  busy,
  onBack,
  onApprove,
  onReject,
  fullHref,
}: {
  p: PendingPo
  big: boolean
  nowIso: string
  busy: boolean
  onBack: () => void
  onApprove: () => void
  onReject: () => void
  /** Link mở trang chi tiết đầy đủ — ẩn khi đã ở chính trang đó. */
  fullHref?: string
}) {
  const days = waitingDays(p.created_at, nowIso)
  const due = dueBadge(daysUntil(p.expected_at, nowIso))
  const lines = p.lines ?? []
  const missingPrice = lines.filter((ln) => ln.unit_price == null).length

  return (
    <div className="bg-card flex flex-col overflow-hidden rounded-xl border">
      <DetailHead
        kind="po"
        code={p.code}
        title={p.supplier_name}
        metric={`${fmtVnd(p.total)} ₫`}
        metricLabel="Tổng cam kết"
        metricTone={big ? 'red' : undefined}
        onBack={onBack}
      />
      <div className="flex flex-col gap-4 p-5">
        {big ? (
          <Signal tone="alert">
            <b>Giá trị lớn (≥50tr).</b> Cần Giám đốc xem kỹ từng dòng trước khi duyệt chi.
          </Signal>
        ) : missingPrice > 0 ? (
          <Signal tone="warn">
            <b>{missingPrice} dòng chưa có đơn giá.</b> Tổng cam kết có thể chưa phản ánh
            đủ.
          </Signal>
        ) : due.tone === 'red' ? (
          <Signal tone="alert">
            <b>Hàng hẹn về {due.text}.</b> Duyệt để Cung ứng kịp gửi NCC (BR-05).
          </Signal>
        ) : days >= 2 ? (
          <Signal tone="warn">
            <b>Đã chờ {days} ngày.</b> Duyệt xong Cung ứng mới gửi được NCC (BR-05).
          </Signal>
        ) : (
          <Signal tone="ok">Sẵn sàng — duyệt để Cung ứng gửi đơn cho NCC (BR-05).</Signal>
        )}

        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
          <Fact label="Cho LSX">
            {p.lsx_code}
            {p.order_code ? ` · ${p.order_code}` : ''}
          </Fact>
          <Fact label="Hàng hẹn về" tone={due.tone}>
            <span className="inline-flex items-center gap-1">
              <Truck className="size-3.5" />
              {fmtD(p.expected_at)}
            </span>
          </Fact>
          <Fact label="Còn lại" tone={due.tone}>
            {due.text}
          </Fact>
          <Fact label="Người lập đơn">{p.created_by_name ?? '—'}</Fact>
          <Fact label="Lập ngày">{fmtD(p.created_at)}</Fact>
          <Fact
            label="Chờ duyệt"
            tone={days >= 4 ? 'red' : days >= 2 ? 'amber' : 'muted'}
          >
            {days >= 1 ? `${days} ngày` : 'mới'}
          </Fact>
        </dl>

        <PoLineTable lines={lines} total={p.total} />

        {p.note && p.note.trim() && (
          <div>
            <SectionLabel>
              <span className="inline-flex items-center gap-1">
                <StickyNote className="size-3.5" /> Ghi chú đơn đặt
              </span>
            </SectionLabel>
            <p className="mt-1 text-sm whitespace-pre-wrap">{p.note}</p>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          {fullHref && (
            <Link
              href={fullHref}
              className="text-sm text-sky-600 hover:underline dark:text-sky-400"
            >
              Mở chi tiết đầy đủ {p.code} →
            </Link>
          )}
          <a
            href={`/print/supply/${p.id}`}
            target="_blank"
            rel="noopener"
            className="inline-flex items-center gap-1 text-sm text-sky-600 hover:underline dark:text-sky-400"
          >
            <Printer className="size-3.5" /> Xem bản in đơn đặt →
          </a>
        </div>
      </div>
      <ActionBar
        amountLabel={`${fmtVnd(p.total)} ₫`}
        busy={busy}
        onApprove={onApprove}
        onReject={onReject}
      />
    </div>
  )
}
