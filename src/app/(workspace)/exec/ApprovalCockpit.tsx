'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  Check,
  Clock,
  FileText,
  Inbox,
  Loader2,
  Lock,
  Printer,
  StickyNote,
  ShieldCheck,
  X,
} from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { api, ApiError, apiErrorText } from '@/lib/api'
import { Button } from '@/components/shadcn/button'
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
import { poLineAmount } from '@/lib/po-line'
import type { PendingLsx, PendingPo } from './ApprovalCardList'
import { type PoLine } from '@/app/(workspace)/planning/pos/PosManager'

/**
 * BUỒNG LÁI PHÊ DUYỆT (Slice 1) — master-detail: cột trái danh sách gộp
 * (LSX + đơn vật tư) theo tab loại; cột phải chi tiết phiếu đang chọn + dải
 * kết luận nhanh (verdict) + Góc quyết định + 3 nút (Duyệt / Từ chối / Yêu
 * cầu làm rõ). Nối API hiện có; phân tích sâu (biên LN, biến động giá, tồn
 * kho, công nợ) sẽ bổ sung ở slice sau. Bản compact CEO vẫn dùng
 * ApprovalCardList.
 */

type Sel = { kind: 'lsx' | 'po'; id: string }
type DecideTarget = { kind: 'lsx' | 'po'; id: string; code: string; label: string }

type Row =
  | { kind: 'lsx'; key: string; big: false; created_at: string; lsx: PendingLsx }
  | { kind: 'po'; key: string; big: boolean; created_at: string; po: PendingPo }

const fmtD = (d: string | null) => (d ? new Date(d).toLocaleDateString('vi-VN') : '—')
const fmtVnd = (n: number) => n.toLocaleString('vi-VN')

const TONE: Record<'gray' | 'amber' | 'red' | 'sky' | 'green', string> = {
  gray: 'border-zinc-200 bg-zinc-100 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
  amber:
    'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300',
  red: 'border-red-300 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300',
  sky: 'border-sky-300 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-300',
  green:
    'border-green-300 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950 dark:text-green-300',
}

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
  const [poDetail, setPoDetail] = useState<{ id: string; lines: PoLine[] } | null>(null)
  const [detailBusy, setDetailBusy] = useState(false)

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

  async function openRow(r: Row) {
    setSel({ kind: r.kind, id: keyId(r) })
    if (r.kind === 'po') {
      setDetailBusy(true)
      setPoDetail(null)
      try {
        const data = await api<{ lines: PoLine[] }>(`/api/dept/supply/pos/${r.po.id}`)
        setPoDetail({ id: r.po.id, lines: data.lines })
      } catch (e) {
        toast.error('Không tải được đơn đặt', apiErrorText(e))
      } finally {
        setDetailBusy(false)
      }
    }
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
                {c}
              </span>
            </Button>
          )
        })}
        {eligibleVisible.length > 0 && (
          <label className="text-muted-foreground ml-auto flex cursor-pointer items-center gap-2 text-xs">
            <Checkbox checked={allEligibleSelected} onCheckedChange={toggleAllEligible} />
            Chọn tất cả duyệt nhanh ({eligibleVisible.length})
          </label>
        )}
      </div>

      {/* Master-detail */}
      <div className="grid overflow-hidden rounded-xl border lg:grid-cols-[minmax(320px,380px)_1fr]">
        {/* Trái: danh sách */}
        <div className="bg-background max-h-[42vh] overflow-y-auto border-b lg:max-h-[68vh] lg:border-r lg:border-b-0">
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
                  onClick={() => void openRow(r)}
                  className={cn(
                    'flex cursor-pointer items-start gap-2.5 border-b px-3 py-2.5 last:border-b-0',
                    isSel
                      ? 'bg-muted shadow-[inset_3px_0_0_var(--primary)]'
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
                          : 'bg-green-500',
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <Badge
                        variant="outline"
                        className={cn(
                          'px-1.5 py-0',
                          r.kind === 'lsx' ? TONE.amber : TONE.sky,
                        )}
                      >
                        {r.kind === 'lsx' ? 'LSX' : 'PO'}
                      </Badge>
                      <span className="truncate font-mono text-xs">
                        {r.kind === 'lsx' ? r.lsx.code : r.po.code}
                      </span>
                    </div>
                    <div className="mt-0.5 truncate text-sm font-medium">
                      {r.kind === 'lsx' ? r.lsx.customer_name : r.po.supplier_name}
                    </div>
                    <div className="text-muted-foreground mt-0.5 flex items-center gap-1.5 text-[11px]">
                      {r.kind === 'po' && (
                        <span className="tabular-nums">{fmtVnd(r.po.total)} ₫</span>
                      )}
                      {days >= 2 && (
                        <span
                          className={cn(
                            'inline-flex items-center gap-0.5',
                            days >= 4 ? 'text-red-600' : 'text-amber-600',
                          )}
                        >
                          <Clock className="size-3" /> {days}n
                        </span>
                      )}
                      {r.big && <AlertTriangle className="size-3 text-red-500" />}
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
                      <TooltipContent>Giá trị lớn — duyệt riêng</TooltipContent>
                    </Tooltip>
                  )}
                </div>
              )
            })
          )}
        </div>

        {/* Phải: chi tiết */}
        <div className="bg-muted/20 min-h-[50vh]">
          {!selRow ? (
            <div className="text-muted-foreground flex h-full min-h-[50vh] flex-col items-center justify-center gap-2 px-6 text-center text-sm">
              <FileText className="size-7 opacity-40" />
              <div>Chọn một phiếu ở cột trái</div>
              <div className="text-xs">
                Kết luận nhanh, góc quyết định và nút duyệt sẽ hiện ở đây.
              </div>
            </div>
          ) : selRow.kind === 'lsx' ? (
            <LsxDetail
              l={selRow.lsx}
              nowIso={nowIso}
              busy={busy}
              onApprove={() => setApproveTarget(targetLsx(selRow.lsx))}
              onReject={() => setRejectTarget(targetLsx(selRow.lsx))}
            />
          ) : (
            <PoPanel
              p={selRow.po}
              big={selRow.big}
              nowIso={nowIso}
              busy={busy}
              detailBusy={detailBusy}
              detail={poDetail?.id === selRow.po.id ? poDetail : null}
              onApprove={() => setApproveTarget(targetPo(selRow.po))}
              onReject={() => setRejectTarget(targetPo(selRow.po))}
            />
          )}
        </div>
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

// ── Verdict + action bar (dùng chung) ───────────────────────────────────────
function Verdict({
  tone,
  children,
}: {
  tone: 'green' | 'amber' | 'red'
  children: React.ReactNode
}) {
  const Icon = tone === 'green' ? ShieldCheck : AlertTriangle
  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-lg border px-3 py-2.5 text-sm',
        TONE[tone],
      )}
    >
      <Icon className="size-4 shrink-0" />
      <span>{children}</span>
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
    <div className="bg-background/90 sticky bottom-0 flex flex-wrap gap-2 border-t px-4 py-3 backdrop-blur">
      <Button variant="destructive" disabled={busy} onClick={onReject}>
        <X /> Từ chối
      </Button>
      <Button className="flex-1" disabled={busy} onClick={onApprove}>
        <Check /> Phê duyệt{amountLabel ? ` · ${amountLabel}` : ''}
      </Button>
    </div>
  )
}

function DetailHead({
  tag,
  tagTone,
  code,
  title,
  meta,
  right,
}: {
  tag: string
  tagTone: string
  code: string
  title: string
  meta: React.ReactNode
  right?: React.ReactNode
}) {
  return (
    <div className="px-5 pt-5 pb-1">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className={tagTone}>
          {tag}
        </Badge>
        <span className="text-muted-foreground font-mono text-xs">{code}</span>
        {right && <span className="ml-auto">{right}</span>}
      </div>
      <h2 className="mt-1.5 text-lg font-semibold">{title}</h2>
      <div className="text-muted-foreground mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
        {meta}
      </div>
    </div>
  )
}

// ── Chi tiết LSX ─────────────────────────────────────────────────────────────
function LsxDetail({
  l,
  nowIso,
  busy,
  onApprove,
  onReject,
}: {
  l: PendingLsx
  nowIso: string
  busy: boolean
  onApprove: () => void
  onReject: () => void
}) {
  const days = waitingDays(l.created_at, nowIso)
  return (
    <div className="flex h-full min-h-[50vh] flex-col">
      <DetailHead
        tag="LSX"
        tagTone={TONE.amber}
        code={l.code}
        title={l.customer_name}
        meta={
          <>
            <span>Đơn: {l.order_code}</span>
            <span>
              Người lập:{' '}
              <b className="text-foreground font-medium">{l.issued_by_name ?? '—'}</b>
            </span>
            <span>Phát ngày: {fmtD(l.created_at)}</span>
            {days >= 2 && (
              <span
                className={cn(
                  'inline-flex items-center gap-0.5',
                  waitingTone(days) === 'red' ? 'text-red-600' : 'text-amber-600',
                )}
              >
                <Clock className="size-3" /> chờ {days} ngày
              </span>
            )}
          </>
        }
      />
      <div className="flex flex-1 flex-col gap-3 px-5 py-3">
        <Verdict tone={days >= 4 ? 'red' : days >= 2 ? 'amber' : 'green'}>
          {days >= 2 ? (
            <>
              <b>Chờ {days} ngày.</b> Duyệt để mở khoá Cung ứng đặt vật tư.
            </>
          ) : (
            <>
              <b>Sẵn sàng.</b> Duyệt để Cung ứng đặt được vật tư (FR-SAL-06).
            </>
          )}
        </Verdict>

        <Link
          href={`/exec/lsx/${l.id}`}
          className="text-sky-600 hover:underline dark:text-sky-400"
        >
          Mở hồ sơ đầy đủ LSX {l.code} →
        </Link>
      </div>
      <ActionBar busy={busy} onApprove={onApprove} onReject={onReject} />
    </div>
  )
}

// ── Chi tiết PO ──────────────────────────────────────────────────────────────
function PoPanel({
  p,
  big,
  nowIso,
  busy,
  detailBusy,
  detail,
  onApprove,
  onReject,
}: {
  p: PendingPo
  big: boolean
  nowIso: string
  busy: boolean
  detailBusy: boolean
  detail: { lines: PoLine[] } | null
  onApprove: () => void
  onReject: () => void
}) {
  const days = waitingDays(p.created_at, nowIso)
  const verdictTone = big ? 'red' : days >= 4 ? 'red' : days >= 2 ? 'amber' : 'green'
  return (
    <div className="flex h-full min-h-[50vh] flex-col">
      <DetailHead
        tag="Đơn vật tư"
        tagTone={TONE.sky}
        code={p.code}
        title={p.supplier_name}
        right={
          <span className="text-lg font-bold tabular-nums">{fmtVnd(p.total)} ₫</span>
        }
        meta={
          <>
            <span>
              LSX {p.lsx_code}
              {p.order_code ? ` · ${p.order_code}` : ''}
            </span>
            <span>
              Người lập:{' '}
              <b className="text-foreground font-medium">{p.created_by_name ?? '—'}</b>
            </span>
            <span>Hẹn giao: {fmtD(p.expected_at)}</span>
            <a
              href={`/print/supply/${p.id}`}
              target="_blank"
              rel="noopener"
              className="inline-flex items-center gap-1 text-sky-600 hover:underline dark:text-sky-400"
            >
              <Printer className="size-3" /> Bản in
            </a>
          </>
        }
      />
      <div className="flex flex-1 flex-col gap-3 px-5 py-3">
        <Verdict tone={verdictTone}>
          {big ? (
            <>
              <b>Giá trị lớn (≥50tr).</b> Cần Giám đốc xem kỹ trước khi duyệt.
            </>
          ) : days >= 2 ? (
            <>
              <b>Chờ {days} ngày.</b> Duyệt xong Cung ứng mới gửi được NCC (BR-05).
            </>
          ) : (
            <>
              <b>Sẵn sàng.</b> Duyệt để Cung ứng gửi đơn cho NCC (BR-05).
            </>
          )}
        </Verdict>

        {/* Bảng dòng gọn — chỉ vật tư · SL · đơn giá · thành tiền */}
        {detailBusy ? (
          <div className="text-muted-foreground flex items-center gap-2 rounded-lg border px-4 py-6 text-sm">
            <Loader2 className="size-4 animate-spin" /> Đang tải dòng đơn…
          </div>
        ) : detail ? (
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted-foreground border-b text-left text-[11px] uppercase">
                  <th className="px-3 py-2 font-medium">Vật tư</th>
                  <th className="px-3 py-2 text-right font-medium">SL đặt</th>
                  <th className="px-3 py-2 text-right font-medium">Đơn giá</th>
                  <th className="px-3 py-2 text-right font-medium">Thành tiền</th>
                </tr>
              </thead>
              <tbody>
                {detail.lines.map((ln) => (
                  <tr key={ln.id} className="border-b last:border-b-0">
                    <td className="px-3 py-2">
                      <div className="font-medium">{ln.material_name}</div>
                      <div className="text-muted-foreground text-xs">
                        {ln.material_code}
                        {ln.spec ? ` · ${ln.spec}` : ''}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {Number(ln.qty_ordered).toLocaleString('vi-VN')} {ln.material_unit}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {ln.unit_price != null ? fmtVnd(ln.unit_price) : '—'}
                    </td>
                    <td className="px-3 py-2 text-right font-medium tabular-nums">
                      {fmtVnd(poLineAmount(ln))}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t">
                  <td colSpan={3} className="px-3 py-2 text-right font-semibold">
                    Tổng cộng
                  </td>
                  <td className="px-3 py-2 text-right font-bold tabular-nums">
                    {fmtVnd(p.total)} ₫
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : null}

        {p.note && p.note.trim() && (
          <div className="rounded-lg border">
            <div className="text-muted-foreground flex items-center gap-1.5 border-b px-4 py-2 text-[11px] font-bold tracking-wider uppercase">
              <StickyNote className="size-3.5" /> Ghi chú đơn đặt
            </div>
            <p className="px-4 py-3 text-sm whitespace-pre-wrap">{p.note}</p>
          </div>
        )}
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
