'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/ui/Toast'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { api, ApiError } from '@/lib/api'
import { Modal } from '@/components/Modal'
import { Badge } from '@/components/Badge'
import { EmptyState } from '@/components/erp/EmptyState'
import { TopProgressBar } from '@/components/erp/Spinner'
import { isBigApproval } from '@/lib/exec-ops'
import {
  PoDetail,
  type Po,
  type PoLine,
  type StatusLine,
} from '@/app/(workspace)/planning/pos/PosManager'

/**
 * Danh sách THẺ phê duyệt one-tap (mobile-first) — dùng ở cả /exec/approvals
 * (đầy đủ) lẫn Báo cáo CEO (compact, limit). Tự chứa handlers duyệt/từ chối
 * (API giữ nguyên) + modal PoDetail xem trước khi duyệt.
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

const fmtD = (d: string | null) => (d ? new Date(d).toLocaleDateString('vi-VN') : '—')

const BTN_APPROVE =
  'flex-1 rounded-md bg-green-600 px-3 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50'
const BTN_REJECT =
  'rounded-md border border-red-300 px-3 py-2.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:hover:bg-red-950'

export function ApprovalCardList({
  pos,
  lsxs,
  compact = false,
  limit,
}: {
  pos: PendingPo[]
  lsxs: PendingLsx[]
  /** compact = nhúng trong Báo cáo CEO: 1 grid gộp, không heading/EmptyState lớn. */
  compact?: boolean
  /** Giới hạn tổng số thẻ (compact) — phần dư hiện "+N chờ nữa". */
  limit?: number
}) {
  const router = useRouter()
  const toast = useToast()
  const confirm = useConfirm()
  const [busy, setBusy] = useState(false)
  const [viewing, setViewing] = useState<{
    po: Po
    lines: PoLine[]
    statusLines: StatusLine[]
  } | null>(null)

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
      toast.error('Không tải được đơn đặt', e instanceof ApiError ? e.message : 'Có lỗi')
    } finally {
      setBusy(false)
    }
  }

  async function decideLsx(l: PendingLsx, decision: 'approve' | 'reject') {
    let reason: string | undefined
    if (decision === 'reject') {
      reason = window.prompt(`Lý do từ chối LSX ${l.code}:`)?.trim() || undefined
      if (!reason) return
    } else {
      const ok = await confirm({
        title: `Duyệt LSX ${l.code}?`,
        description: `${l.customer_name} · đơn ${l.order_code}. Duyệt xong Cung ứng mới đặt được vật tư.`,
        confirmLabel: 'Duyệt',
      })
      if (!ok) return
    }
    setBusy(true)
    try {
      await api(
        `/api/dept/production/lsx/${l.id}/${decision === 'approve' ? 'approve' : 'reject'}`,
        { method: 'POST', body: decision === 'reject' ? { reason } : {} },
      )
      toast.success(decision === 'approve' ? 'Đã duyệt LSX' : 'Đã từ chối LSX', l.code)
      router.refresh()
    } catch (e) {
      toast.error('Thao tác thất bại', e instanceof ApiError ? e.message : 'Có lỗi')
    } finally {
      setBusy(false)
    }
  }

  async function decidePo(
    p: Pick<PendingPo, 'id' | 'code' | 'supplier_name' | 'lsx_code'>,
    decision: 'approve' | 'reject',
  ) {
    let reason: string | undefined
    if (decision === 'reject') {
      reason = window.prompt(`Lý do từ chối ${p.code}:`)?.trim() || undefined
      if (!reason) return
    } else {
      const ok = await confirm({
        title: `Duyệt đơn đặt ${p.code}?`,
        description: `NCC: ${p.supplier_name} · LSX ${p.lsx_code}. Duyệt xong Cung ứng mới gửi được cho NCC (BR-05).`,
        confirmLabel: 'Duyệt',
      })
      if (!ok) return
    }
    setBusy(true)
    try {
      await api(`/api/dept/supply/pos/${p.id}/decide`, {
        method: 'POST',
        body: { decision, reason },
      })
      toast.success(decision === 'approve' ? 'Đã duyệt' : 'Đã từ chối', p.code)
      setViewing(null)
      router.refresh()
    } catch (e) {
      toast.error('Thao tác thất bại', e instanceof ApiError ? e.message : 'Có lỗi')
    } finally {
      setBusy(false)
    }
  }

  // compact (CEO): 1 grid gộp LSX trước PO, cắt theo limit.
  const total = lsxs.length + pos.length
  let compactCards: React.ReactNode[] = []
  if (compact) {
    const capped: React.ReactNode[] = []
    for (const l of lsxs)
      capped.push(<LsxCard key={`l-${l.id}`} l={l} busy={busy} onDecide={decideLsx} />)
    for (const p of pos)
      capped.push(
        <PoCard
          key={`p-${p.id}`}
          p={p}
          busy={busy}
          onDecide={decidePo}
          onOpen={openPo}
        />,
      )
    compactCards = limit ? capped.slice(0, limit) : capped
  }

  return (
    <div className="flex flex-col gap-4">
      <TopProgressBar active={busy} />

      {compact ? (
        total === 0 ? (
          <p className="rounded-xl border border-zinc-200 bg-white px-4 py-3 text-xs text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900">
            ✓ Không có gì chờ duyệt.
          </p>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2">{compactCards}</div>
            {limit && total > limit && (
              <p className="text-xs text-zinc-400">… và {total - limit} phiếu chờ nữa.</p>
            )}
          </>
        )
      ) : (
        <>
          <section>
            <h2 className="mb-2 text-sm font-semibold text-zinc-500 uppercase">
              Lệnh sản xuất chờ duyệt ({lsxs.length})
            </h2>
            {lsxs.length === 0 ? (
              <EmptyState
                icon="✓"
                title="Không có LSX nào chờ duyệt"
                description="Sales phát LSX sẽ hiện ở đây kèm thông báo (FR-SAL-06)."
              />
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {lsxs.map((l) => (
                  <LsxCard key={l.id} l={l} busy={busy} onDecide={decideLsx} />
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="mb-2 text-sm font-semibold text-zinc-500 uppercase">
              Đơn đặt vật tư chờ duyệt ({pos.length})
            </h2>
            {pos.length === 0 ? (
              <EmptyState
                icon="✓"
                title="Không có đơn đặt vật tư nào chờ duyệt"
                description="Cung ứng gửi đơn đặt lên sẽ hiện ở đây kèm thông báo (BR-05)."
              />
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {pos.map((p) => (
                  <PoCard
                    key={p.id}
                    p={p}
                    busy={busy}
                    onDecide={decidePo}
                    onOpen={openPo}
                  />
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {/* Chi tiết PO trước khi duyệt — read-only + nút Duyệt/Từ chối */}
      <Modal
        open={!!viewing}
        onClose={() => setViewing(null)}
        title={viewing ? `${viewing.po.code} — ${viewing.po.supplier_name}` : ''}
        maxWidth="sm:max-w-4xl"
      >
        {viewing && (
          <PoDetail
            po={viewing.po}
            lines={viewing.lines}
            statusLines={viewing.statusLines}
            canEdit={false}
            canApprove
            onDecide={(d) =>
              void decidePo(
                {
                  id: viewing.po.id,
                  code: viewing.po.code,
                  supplier_name: viewing.po.supplier_name,
                  lsx_code: viewing.po.lsx_code,
                },
                d,
              )
            }
            onAdvance={() => {}}
            onCancel={() => {}}
          />
        )}
      </Modal>
    </div>
  )
}

// ── Thẻ phê duyệt (module-level — không tạo component trong render) ─────────

const CARD_CLS =
  'flex flex-col gap-2.5 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900'

function LsxCard({
  l,
  busy,
  onDecide,
}: {
  l: PendingLsx
  busy: boolean
  onDecide: (l: PendingLsx, d: 'approve' | 'reject') => Promise<void>
}) {
  return (
    <div className={CARD_CLS}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate font-semibold">{l.customer_name}</div>
          <Link
            href={`/exec/lsx/${l.id}`}
            className="font-mono text-xs text-sky-600 hover:underline dark:text-sky-400"
          >
            {l.code}
          </Link>
          <span className="ml-1.5 font-mono text-xs text-zinc-400">{l.order_code}</span>
        </div>
        <Badge tone="amber">LSX</Badge>
      </div>
      <div className="text-xs text-zinc-500">Phát ngày {fmtD(l.created_at)}</div>
      <div className="mt-auto flex gap-2">
        <button
          disabled={busy}
          onClick={() => void onDecide(l, 'approve')}
          className={BTN_APPROVE}
        >
          ✓ Duyệt
        </button>
        <button
          disabled={busy}
          onClick={() => void onDecide(l, 'reject')}
          className={BTN_REJECT}
        >
          Từ chối
        </button>
      </div>
    </div>
  )
}

function PoCard({
  p,
  busy,
  onDecide,
  onOpen,
}: {
  p: PendingPo
  busy: boolean
  onDecide: (p: PendingPo, d: 'approve' | 'reject') => Promise<void>
  onOpen: (p: PendingPo) => Promise<void>
}) {
  const big = isBigApproval(p.total)
  return (
    <div className={`${CARD_CLS} ${big ? 'border-red-300 dark:border-red-800' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate font-semibold">{p.supplier_name}</div>
          <button
            onClick={() => void onOpen(p)}
            className="font-mono text-xs text-sky-600 hover:underline dark:text-sky-400"
            title="Xem chi tiết dòng, tổng tiền, hồ sơ trước khi duyệt"
          >
            {p.code}
          </button>
          <span className="ml-1.5 font-mono text-xs text-zinc-400">
            {p.lsx_code}
            {p.order_code ? ` · ${p.order_code}` : ''}
          </span>
        </div>
        <Badge tone="blue">PO</Badge>
      </div>
      <div className="flex flex-wrap items-baseline gap-x-2">
        <span className="text-xl font-bold tabular-nums">
          {p.total.toLocaleString('vi-VN')}
        </span>
        <span className="text-xs text-zinc-500">
          {p.currency} · {p.lines_count} dòng
        </span>
      </div>
      {big && <Badge tone="red">⚠ Giá trị lớn — cần Giám đốc duyệt</Badge>}
      <div className="flex items-center gap-2 text-xs text-zinc-500">
        Hẹn giao {fmtD(p.expected_at)}
        <a
          href={`/print/supply/${p.id}`}
          target="_blank"
          rel="noopener"
          className="ml-auto text-sky-600 underline hover:text-sky-700 dark:text-sky-400"
        >
          Xem bản in
        </a>
      </div>
      <div className="mt-auto flex gap-2">
        <button
          disabled={busy}
          onClick={() => void onDecide(p, 'approve')}
          className={BTN_APPROVE}
        >
          ✓ Duyệt
        </button>
        <button
          disabled={busy}
          onClick={() => void onDecide(p, 'reject')}
          className={BTN_REJECT}
        >
          Từ chối
        </button>
      </div>
    </div>
  )
}
