'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  Check,
  Clock,
  FileText,
  Loader2,
  Lock,
  Printer,
  X,
} from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { api, ApiError, apiErrorText } from '@/lib/api'
import { Button } from '@/components/shadcn/button'
import { Card } from '@/components/shadcn/card'
import { Badge } from '@/components/shadcn/badge'
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
import { EmptyState } from '@/components/erp/EmptyState'
import { TopProgressBar } from '@/components/erp/Spinner'
import { cn } from '@/lib/utils'
import {
  comparePending,
  isBulkApprovable,
  matchesFilter,
  summarizeBulk,
  waitingDays,
  waitingTone,
  type ApprovalFilter,
} from './approval-helpers'
import { isBigApproval } from '@/lib/exec-ops'
import {
  PoDetail,
  type Po,
  type PoLine,
  type StatusLine,
} from '@/app/(workspace)/planning/pos/PosManager'

/**
 * Danh sách THẺ phê duyệt (mobile-first) — dùng ở /exec/approvals (đầy đủ:
 * lọc, aging, chọn nhiều "duyệt nhanh") lẫn Báo cáo CEO (compact, limit).
 * Tự chứa handler duyệt/từ chối (API giữ nguyên) + dialog xem PO trước khi
 * duyệt. Từ chối dùng Dialog có ô lý do (thay window.prompt); PO giá trị lớn
 * bị chặn khỏi "duyệt nhanh", buộc mở chi tiết duyệt riêng.
 */

export type PendingPo = {
  id: string
  code: string
  supplier_name: string
  lsx_code: string
  order_code: string | null
  expected_at: string | null
  created_at: string
  currency: string
  total: number
  lines_count: number
}
export type PendingLsx = {
  id: string
  code: string
  order_code: string
  customer_name: string
  created_at: string
}

type Row =
  | { kind: 'lsx'; key: string; big: false; created_at: string; lsx: PendingLsx }
  | { kind: 'po'; key: string; big: boolean; created_at: string; po: PendingPo }

/** Đích của thao tác duyệt/từ chối — đủ để gọi API + hiển thị. */
type DecideTarget = { kind: 'lsx' | 'po'; id: string; code: string; label: string }

const fmtD = (d: string | null) => (d ? new Date(d).toLocaleDateString('vi-VN') : '—')
const fmtVnd = (n: number) => n.toLocaleString('vi-VN')

const TONE: Record<'gray' | 'amber' | 'red' | 'sky', string> = {
  gray: 'border-zinc-200 bg-zinc-100 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
  amber:
    'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300',
  red: 'border-red-300 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300',
  sky: 'border-sky-300 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-300',
}

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

const FILTERS: { key: ApprovalFilter; label: string }[] = [
  { key: 'all', label: 'Tất cả' },
  { key: 'lsx', label: 'Lệnh sản xuất' },
  { key: 'po', label: 'Đơn vật tư' },
  { key: 'big', label: 'Giá trị lớn' },
]

export function ApprovalCardList({
  pos,
  lsxs,
  compact = false,
  limit,
  nowIso,
}: {
  pos: PendingPo[]
  lsxs: PendingLsx[]
  /** compact = nhúng trong Báo cáo CEO: 1 grid gộp, không toolbar/lọc/bulk. */
  compact?: boolean
  /** Giới hạn tổng số thẻ (compact) — phần dư hiện "+N chờ nữa". */
  limit?: number
  /** Mốc thời gian tính aging (server truyền xuống để nhất quán). */
  nowIso?: string
}) {
  const router = useRouter()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [filter, setFilter] = useState<ApprovalFilter>('all')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkOpen, setBulkOpen] = useState(false)
  const [approveTarget, setApproveTarget] = useState<DecideTarget | null>(null)
  const [rejectTarget, setRejectTarget] = useState<DecideTarget | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [viewing, setViewing] = useState<{
    po: Po
    lines: PoLine[]
    statusLines: StatusLine[]
  } | null>(null)

  const now = nowIso ?? new Date().toISOString()

  // Gộp LSX + PO thành 1 danh sách, sắp: giá trị lớn trước, rồi chờ lâu nhất.
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

  const visible = compact ? rows : rows.filter((r) => matchesFilter(r, filter))
  const capped = limit ? visible.slice(0, limit) : visible

  // ── Selection (chỉ full mode) ──
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

  // ── API calls (endpoint giữ nguyên) ──
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

  async function openPo(p: PendingPo) {
    setBusy(true)
    try {
      const data = await api<{ po: Po; lines: PoLine[]; status_lines: StatusLine[] }>(
        `/api/dept/supply/pos/${p.id}`,
      )
      setViewing({
        po: { ...data.po, supplier_name: p.supplier_name, lsx_code: p.lsx_code },
        lines: data.lines,
        statusLines: data.status_lines,
      })
    } catch (e) {
      toast.error('Không tải được đơn đặt', apiErrorText(e))
    } finally {
      setBusy(false)
    }
  }

  async function confirmApprove() {
    if (!approveTarget) return
    setBusy(true)
    try {
      await callDecide(approveTarget, 'approve')
      toast.success('Đã duyệt', approveTarget.code)
      setApproveTarget(null)
      setViewing(null)
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
      setViewing(null)
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

  const total = rows.length

  // ── Compact (Báo cáo CEO) ──
  if (compact) {
    if (total === 0) {
      return (
        <p className="text-muted-foreground rounded-xl border px-4 py-3 text-xs">
          ✓ Không có gì chờ duyệt.
        </p>
      )
    }
    return (
      <div className="flex flex-col gap-3">
        <TopProgressBar active={busy} />
        <div className="grid gap-3 sm:grid-cols-2">
          {capped.map((r) =>
            r.kind === 'lsx' ? (
              <LsxCard
                key={r.key}
                l={r.lsx}
                now={now}
                busy={busy}
                onApprove={() => setApproveTarget(targetLsx(r.lsx))}
                onReject={() => setRejectTarget(targetLsx(r.lsx))}
              />
            ) : (
              <PoCard
                key={r.key}
                p={r.po}
                big={r.big}
                now={now}
                busy={busy}
                onOpen={() => openPo(r.po)}
                onApprove={() => setApproveTarget(targetPo(r.po))}
                onReject={() => setRejectTarget(targetPo(r.po))}
              />
            ),
          )}
        </div>
        {limit && total > limit && (
          <p className="text-muted-foreground text-xs">
            … và {total - limit} phiếu chờ nữa.
          </p>
        )}
        {dialogs()}
      </div>
    )
  }

  // ── Full (/exec/approvals) ──
  return (
    <div className="flex flex-col gap-4">
      <TopProgressBar active={busy} />

      {/* Bộ lọc phân đoạn */}
      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => {
          const count =
            f.key === 'all'
              ? rows.length
              : rows.filter((r) => matchesFilter(r, f.key)).length
          return (
            <Button
              key={f.key}
              size="sm"
              variant={filter === f.key ? 'default' : 'outline'}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
              <span
                className={cn(
                  'ml-1 tabular-nums',
                  filter === f.key ? 'opacity-80' : 'text-muted-foreground',
                )}
              >
                {count}
              </span>
            </Button>
          )
        })}
        {eligibleVisible.length > 0 && (
          <label className="text-muted-foreground ml-auto flex cursor-pointer items-center gap-2 text-xs">
            <Checkbox
              checked={allEligibleSelected}
              onCheckedChange={toggleAllEligible}
              aria-label="Chọn tất cả phiếu duyệt nhanh được"
            />
            Chọn tất cả duyệt nhanh ({eligibleVisible.length})
          </label>
        )}
      </div>

      {total === 0 ? (
        <EmptyState
          icon="✓"
          title="Không có phiếu nào chờ duyệt"
          description="LSX (FR-SAL-06) và đơn đặt vật tư (BR-05) gửi lên sẽ hiện ở đây kèm thông báo."
        />
      ) : visible.length === 0 ? (
        <EmptyState
          icon="🔍"
          title="Không có phiếu khớp bộ lọc"
          description="Đổi bộ lọc để xem các phiếu khác đang chờ."
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((r) =>
            r.kind === 'lsx' ? (
              <LsxCard
                key={r.key}
                l={r.lsx}
                now={now}
                busy={busy}
                selected={selected.has(r.key)}
                onToggle={() => toggleRow(r.key)}
                onApprove={() => setApproveTarget(targetLsx(r.lsx))}
                onReject={() => setRejectTarget(targetLsx(r.lsx))}
              />
            ) : (
              <PoCard
                key={r.key}
                p={r.po}
                big={r.big}
                now={now}
                busy={busy}
                selected={selected.has(r.key)}
                onToggle={r.big ? undefined : () => toggleRow(r.key)}
                onOpen={() => openPo(r.po)}
                onApprove={() => setApproveTarget(targetPo(r.po))}
                onReject={() => setRejectTarget(targetPo(r.po))}
              />
            ),
          )}
        </div>
      )}

      {/* Thanh duyệt nhanh (sticky) */}
      {selected.size > 0 && (
        <div className="bg-background/95 sticky bottom-3 z-10 flex flex-wrap items-center gap-3 rounded-xl border p-3 shadow-lg backdrop-blur">
          <span className="text-sm">
            Đã chọn <b className="tabular-nums">{selected.size}</b> phiếu
            {bulkSummary.total > 0 && (
              <span className="text-muted-foreground">
                {' '}
                · tổng <b className="tabular-nums">{fmtVnd(bulkSummary.total)}</b> VND
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

      {dialogs()}

      {/* Xác nhận duyệt nhanh hàng loạt */}
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
                      (tổng <b>{fmtVnd(bulkSummary.total)}</b> VND)
                    </>
                  )}
                  .
                </div>
                <div className="text-muted-foreground text-xs">
                  Đơn vật tư giá trị lớn (≥50tr) không nằm trong duyệt nhanh — mở chi tiết
                  duyệt riêng. Duyệt xong Cung ứng mới đặt/gửi được NCC.
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

  // ── Dialogs dùng chung cho cả 2 chế độ ──
  function dialogs() {
    return (
      <>
        {/* Xác nhận duyệt 1 phiếu */}
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

        {/* Từ chối — bắt buộc lý do */}
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

        {/* Chi tiết PO trước khi duyệt */}
        <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
            <DialogHeader>
              <DialogTitle>
                {viewing ? `${viewing.po.code} — ${viewing.po.supplier_name}` : ''}
              </DialogTitle>
            </DialogHeader>
            {viewing && (
              <PoDetail
                po={viewing.po}
                lines={viewing.lines}
                statusLines={viewing.statusLines}
                canEdit={false}
                canApprove
                onDecide={(d) =>
                  d === 'approve'
                    ? setApproveTarget(targetPo(viewing.po))
                    : setRejectTarget(targetPo(viewing.po))
                }
                onAdvance={() => {}}
                onCancel={() => {}}
              />
            )}
          </DialogContent>
        </Dialog>
      </>
    )
  }
}

// ── Badge aging ─────────────────────────────────────────────────────────────
function AgingBadge({ createdAt, now }: { createdAt: string; now: string }) {
  const days = waitingDays(createdAt, now)
  if (days < 2) return null
  return (
    <Badge variant="outline" className={cn('gap-1', TONE[waitingTone(days)])}>
      <Clock className="size-3" /> Chờ {days} ngày
    </Badge>
  )
}

// ── Thẻ LSX ─────────────────────────────────────────────────────────────────
function LsxCard({
  l,
  now,
  busy,
  selected,
  onToggle,
  onApprove,
  onReject,
}: {
  l: PendingLsx
  now: string
  busy: boolean
  selected?: boolean
  onToggle?: () => void
  onApprove: () => void
  onReject: () => void
}) {
  return (
    <Card className={cn('gap-2.5 p-4', selected && 'ring-primary/40 ring-2')}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2">
          {onToggle && (
            <Checkbox
              className="mt-0.5"
              checked={!!selected}
              onCheckedChange={onToggle}
              aria-label={`Chọn LSX ${l.code}`}
            />
          )}
          <div className="min-w-0">
            <div className="truncate font-semibold">{l.customer_name}</div>
            <Link
              href={`/exec/lsx/${l.id}`}
              className="font-mono text-xs text-sky-600 hover:underline dark:text-sky-400"
            >
              {l.code}
            </Link>
            <span className="text-muted-foreground ml-1.5 font-mono text-xs">
              {l.order_code}
            </span>
          </div>
        </div>
        <Badge variant="outline" className={TONE.amber}>
          LSX
        </Badge>
      </div>
      <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
        <span>Phát ngày {fmtD(l.created_at)}</span>
        <AgingBadge createdAt={l.created_at} now={now} />
      </div>
      <div className="mt-auto flex gap-2 pt-1">
        <Button className="flex-1" disabled={busy} onClick={onApprove}>
          <Check /> Duyệt
        </Button>
        <Button variant="destructive" disabled={busy} onClick={onReject}>
          <X /> Từ chối
        </Button>
      </div>
    </Card>
  )
}

// ── Thẻ PO ──────────────────────────────────────────────────────────────────
function PoCard({
  p,
  big,
  now,
  busy,
  selected,
  onToggle,
  onOpen,
  onApprove,
  onReject,
}: {
  p: PendingPo
  big: boolean
  now: string
  busy: boolean
  selected?: boolean
  onToggle?: () => void
  onOpen: () => void
  onApprove: () => void
  onReject: () => void
}) {
  return (
    <Card
      className={cn(
        'gap-2.5 p-4',
        selected && 'ring-primary/40 ring-2',
        big && 'border-red-300 dark:border-red-800',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2">
          {onToggle ? (
            <Checkbox
              className="mt-0.5"
              checked={!!selected}
              onCheckedChange={onToggle}
              aria-label={`Chọn đơn đặt ${p.code}`}
            />
          ) : big ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="mt-0.5 inline-flex text-red-500">
                  <Lock className="size-4" />
                </span>
              </TooltipTrigger>
              <TooltipContent>Giá trị lớn — mở chi tiết duyệt riêng</TooltipContent>
            </Tooltip>
          ) : null}
          <div className="min-w-0">
            <div className="truncate font-semibold">{p.supplier_name}</div>
            <button
              onClick={onOpen}
              className="font-mono text-xs text-sky-600 hover:underline dark:text-sky-400"
              title="Xem chi tiết dòng, tổng tiền, hồ sơ trước khi duyệt"
            >
              {p.code}
            </button>
            <span className="text-muted-foreground ml-1.5 font-mono text-xs">
              {p.lsx_code}
              {p.order_code ? ` · ${p.order_code}` : ''}
            </span>
          </div>
        </div>
        <Badge variant="outline" className={TONE.sky}>
          PO
        </Badge>
      </div>

      <div className="flex flex-wrap items-baseline gap-x-2">
        <span className="text-xl font-bold tabular-nums">{fmtVnd(p.total)}</span>
        <span className="text-muted-foreground text-xs">
          {p.currency} · {p.lines_count} dòng
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {big && (
          <Badge variant="outline" className={cn('gap-1', TONE.red)}>
            <AlertTriangle className="size-3" /> Giá trị lớn — cần Giám đốc duyệt
          </Badge>
        )}
        <AgingBadge createdAt={p.created_at} now={now} />
      </div>

      <div className="text-muted-foreground flex items-center gap-2 text-xs">
        Hẹn giao {fmtD(p.expected_at)}
        <a
          href={`/print/supply/${p.id}`}
          target="_blank"
          rel="noopener"
          className="ml-auto inline-flex items-center gap-1 text-sky-600 hover:underline dark:text-sky-400"
        >
          <Printer className="size-3" /> Bản in
        </a>
      </div>

      <div className="mt-auto flex gap-2 pt-1">
        <Button variant="outline" disabled={busy} onClick={onOpen}>
          <FileText /> Xem
        </Button>
        <Button className="flex-1" disabled={busy} onClick={onApprove}>
          <Check /> Duyệt
        </Button>
        <Button variant="destructive" disabled={busy} onClick={onReject}>
          <X /> Từ chối
        </Button>
      </div>
    </Card>
  )
}
