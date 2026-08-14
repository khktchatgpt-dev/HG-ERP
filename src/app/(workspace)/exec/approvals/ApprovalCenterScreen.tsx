'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  Check,
  Clock,
  FileSearch,
  Inbox,
  ShoppingCart,
  Factory,
  X,
} from 'lucide-react'
import { PageHeader } from '@/components/erp/PageHeader'
import { DataTable, type Column } from '@/components/erp/DataTable'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/shadcn/button'
import { Checkbox } from '@/components/shadcn/checkbox'
import { TopProgressBar } from '@/components/erp/Spinner'
import { cn } from '@/lib/utils'
import { useApprovalDecision, type DecideTarget } from '../useApprovalDecision'
import type { SignBox, SignItem } from '@/modules/core/exec/exec.service'

/**
 * TRUNG TÂM PHÊ DUYỆT (/exec/approvals) — thiết kế lại 15/08/2026
 * (docs/exec-v3-approval-center.md): MỌI loại phiếu chờ Giám đốc gom một chỗ,
 * KHÔNG chia theo phòng ban — chip lọc mới phân loại. Ký / trả lại ngay tại
 * dòng; "Xem kỹ" mở màn thẩm định đầy đủ của từng phiếu.
 *
 * Hai bố cục cho hai tình huống thật:
 *   · máy tính  — bảng (Loại | Mã | Nội dung | Giá trị | Chờ | thao tác)
 *   · điện thoại — thẻ dọc, nút Ký to trong tầm ngón cái
 *
 * Luật giữ nguyên từ Hộp ký cũ: phiếu GIÁ TRỊ LỚN không được ký hàng loạt,
 * phải mở ra đọc; ký nhiều phiếu gọi tuần tự, phiếu lỗi nằm lại trong hộp.
 */

const KIND_LABEL = { lsx: 'Lệnh SX', po: 'Đơn mua' } as const
const KIND_TONE = { lsx: 'blue', po: 'amber' } as const
const KIND_ICON = { lsx: Factory, po: ShoppingCart } as const

export type ApprovalKind = 'all' | 'lsx' | 'po'

function money(value: number, currency: string): string {
  return `${new Intl.NumberFormat('vi-VN', {
    maximumFractionDigits: currency === 'VND' ? 0 : 2,
  }).format(value)} ${currency}`
}

function waitLabel(days: number): string {
  return days <= 0 ? 'hôm nay' : `${days} ngày`
}

/** Cộng tiền theo TỪNG tiền tệ — USD và VND không bao giờ cộng chung. */
function sumByCurrency(items: SignItem[]): [string, number][] {
  const m = new Map<string, number>()
  for (const i of items) m.set(i.currency, (m.get(i.currency) ?? 0) + i.value)
  return [...m.entries()]
}

export function ApprovalCenterScreen({
  box,
  initialKind,
}: {
  box: SignBox
  initialKind: ApprovalKind
}) {
  const router = useRouter()
  const [kind, setKind] = useState<ApprovalKind>(initialKind)
  const [picked, setPicked] = useState<SignItem[]>([])
  const { busy, askApprove, askReject, askApproveMany, dialogs } = useApprovalDecision(
    () => {
      setPicked([])
      router.refresh()
    },
  )

  const counts = useMemo(
    () => ({
      all: box.items.length,
      lsx: box.items.filter((i) => i.kind === 'lsx').length,
      po: box.items.filter((i) => i.kind === 'po').length,
    }),
    [box.items],
  )
  const items = kind === 'all' ? box.items : box.items.filter((i) => i.kind === kind)

  const target = (i: SignItem): DecideTarget => ({
    kind: i.kind,
    id: i.id,
    code: i.code,
    label: `${i.party} · ${i.facts[0] ?? ''}`,
  })

  const key = (i: SignItem) => `${i.kind}-${i.id}`
  /** Phiếu giá trị lớn KHÔNG được ký hàng loạt — phải mở ra đọc rồi ký riêng. */
  const bulkable = items.filter((i) => !i.big)
  const pickedKeys = new Set(picked.map(key))

  const columns: Column<SignItem>[] = [
    {
      key: 'kind',
      header: 'Loại',
      width: '110px',
      cell: (i) => {
        const Icon = KIND_ICON[i.kind]
        return (
          <Badge tone={KIND_TONE[i.kind]}>
            <Icon className="me-1 size-3" aria-hidden />
            {KIND_LABEL[i.kind]}
          </Badge>
        )
      },
      sortValue: (i) => i.kind,
    },
    {
      key: 'code',
      header: 'Mã',
      width: '130px',
      cell: (i) => (
        <Link href={i.href} className="font-semibold hover:underline">
          {i.code}
        </Link>
      ),
      sortValue: (i) => i.code,
    },
    {
      key: 'content',
      header: 'Nội dung',
      cell: (i) => (
        <div className="min-w-0">
          <div className="truncate">{i.party}</div>
          <div className="text-muted-foreground truncate text-xs">
            {[...i.facts, i.submitted_by ? `lập bởi ${i.submitted_by}` : null]
              .filter(Boolean)
              .join(' · ')}
          </div>
          {i.warnings.map((w) => (
            <div
              key={w}
              className="mt-0.5 flex items-start gap-1 text-xs text-amber-700 dark:text-amber-400"
            >
              <AlertTriangle className="mt-0.5 size-3 shrink-0" aria-hidden />
              {w}
            </div>
          ))}
        </div>
      ),
    },
    {
      key: 'value',
      header: 'Giá trị',
      width: '150px',
      align: 'right',
      cell: (i) => (
        <div>
          <span className="font-semibold tabular-nums">
            {i.value > 0 ? money(i.value, i.currency) : '—'}
          </span>
          {i.big && (
            <div className="mt-0.5">
              <Badge tone="purple">Giá trị lớn</Badge>
            </div>
          )}
        </div>
      ),
      sortValue: (i) => i.value,
    },
    {
      key: 'wait',
      header: 'Chờ',
      width: '90px',
      align: 'right',
      cell: (i) => (
        <span
          className={cn(
            'inline-flex items-center gap-1 text-xs tabular-nums',
            i.waiting_days >= 3
              ? 'font-medium text-amber-700 dark:text-amber-400'
              : 'text-muted-foreground',
          )}
        >
          <Clock className="size-3" aria-hidden />
          {waitLabel(i.waiting_days)}
        </span>
      ),
      sortValue: (i) => i.waiting_days,
    },
    {
      key: 'actions',
      header: '',
      width: '240px',
      align: 'right',
      cell: (i) => (
        <div className="flex justify-end gap-1.5">
          <Button variant="ghost" size="sm" asChild>
            <Link href={i.href}>
              <FileSearch className="size-4" aria-hidden />
              Xem kỹ
            </Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => askReject(target(i))}
          >
            <X className="size-4" aria-hidden />
            Trả lại
          </Button>
          <Button size="sm" disabled={busy} onClick={() => askApprove(target(i))}>
            <Check className="size-4" aria-hidden />
            Ký
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <TopProgressBar active={busy} />

      <PageHeader
        title="Chờ tôi phê duyệt"
        description={
          box.stats.total > 0
            ? `${box.stats.total} phiếu chờ bạn ký · lâu nhất ${box.stats.oldest_days} ngày · ${box.stats.value.map((v) => money(v.value, v.currency)).join(' · ')}`
            : 'Không có phiếu nào chờ chữ ký của bạn.'
        }
        actions={
          <Button variant="outline" asChild>
            <Link href="/exec/approvals/history">Đã xử lý →</Link>
          </Button>
        }
        meta={
          box.decided_today.approved + box.decided_today.rejected > 0 ? (
            <span className="text-muted-foreground text-sm">
              Hôm nay bạn đã duyệt {box.decided_today.approved} phiếu
              {box.decided_today.rejected > 0 &&
                `, trả lại ${box.decided_today.rejected} phiếu`}
              .
            </span>
          ) : undefined
        }
      />

      {box.stats.total > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {(['all', 'lsx', 'po'] as const).map((k) => (
            <Button
              key={k}
              size="sm"
              variant={kind === k ? 'default' : 'outline'}
              onClick={() => setKind(k)}
            >
              {k === 'all' ? 'Tất cả' : KIND_LABEL[k]}
              <span className="ms-1.5 tabular-nums opacity-70">{counts[k]}</span>
            </Button>
          ))}
          {bulkable.length > 1 && (
            <label className="text-muted-foreground ms-auto hidden cursor-pointer items-center gap-2 text-sm md:flex">
              <Checkbox
                checked={
                  bulkable.length > 0 && bulkable.every((i) => pickedKeys.has(key(i)))
                }
                onCheckedChange={(v) => setPicked(v ? bulkable : [])}
              />
              Chọn {bulkable.length} phiếu ký nhanh được
            </label>
          )}
        </div>
      )}

      {items.length === 0 ? (
        <EmptyCenter box={box} filtered={kind !== 'all' && box.stats.total > 0} />
      ) : (
        <>
          {/* Máy tính: bảng gộp mọi loại phiếu. Chỉ phiếu thường chọn được. */}
          <div className="hidden md:block">
            <DataTable
              rows={items}
              columns={columns}
              keyFn={key}
              pagination={false}
              selection={{
                selected: picked,
                onChange: (rows) => setPicked(rows.filter((r) => !r.big)),
                keyFn: key,
              }}
              rowClassName={(i) =>
                i.waiting_days >= 3 ? 'bg-amber-50/40 dark:bg-amber-950/10' : undefined
              }
            />
          </div>

          {/* Điện thoại: thẻ dọc, nút Ký dưới cùng trong tầm ngón cái. */}
          <ul className="space-y-3 md:hidden">
            {items.map((i) => {
              const Icon = KIND_ICON[i.kind]
              return (
                <li
                  key={key(i)}
                  className={cn(
                    'bg-card rounded-xl border p-4',
                    i.waiting_days >= 3 && 'border-amber-400 dark:border-amber-700',
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-muted-foreground inline-flex items-center gap-1 text-[11px] font-medium tracking-wide uppercase">
                          <Icon className="size-3.5" aria-hidden />
                          {KIND_LABEL[i.kind]}
                        </span>
                        <span className="font-semibold">{i.code}</span>
                        {i.big && <Badge tone="purple">Giá trị lớn</Badge>}
                      </div>
                      <div className="mt-0.5 text-sm">{i.party}</div>
                      <div className="text-muted-foreground mt-0.5 text-xs">
                        {[...i.facts, i.submitted_by ? `lập bởi ${i.submitted_by}` : null]
                          .filter(Boolean)
                          .join(' · ')}
                      </div>
                    </div>
                    <div className="text-end">
                      <div className="font-semibold tabular-nums">
                        {i.value > 0 ? money(i.value, i.currency) : '—'}
                      </div>
                      <div
                        className={cn(
                          'mt-0.5 inline-flex items-center gap-1 text-xs',
                          i.waiting_days >= 3
                            ? 'text-amber-700 dark:text-amber-400'
                            : 'text-muted-foreground',
                        )}
                      >
                        <Clock className="size-3.5" aria-hidden />
                        {i.waiting_days <= 0
                          ? 'gửi hôm nay'
                          : `chờ ${i.waiting_days} ngày`}
                      </div>
                    </div>
                  </div>

                  {i.warnings.length > 0 && (
                    <ul className="mt-2.5 space-y-1">
                      {i.warnings.map((w) => (
                        <li
                          key={w}
                          className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400"
                        >
                          <AlertTriangle
                            className="mt-0.5 size-3.5 shrink-0"
                            aria-hidden
                          />
                          {w}
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="mt-3 flex flex-col-reverse gap-2 border-t pt-3">
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={i.href}>
                        <FileSearch className="size-4" aria-hidden />
                        Xem kỹ
                      </Link>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      onClick={() => askReject(target(i))}
                    >
                      <X className="size-4" aria-hidden />
                      Trả lại
                    </Button>
                    <Button
                      size="sm"
                      disabled={busy}
                      onClick={() => askApprove(target(i))}
                    >
                      <Check className="size-4" aria-hidden />
                      Ký duyệt
                    </Button>
                  </div>
                </li>
              )
            })}
          </ul>
        </>
      )}

      {/* Dải ký nhanh — nổi ở chân màn khi đã chọn ít nhất một phiếu. */}
      {picked.length > 0 && (
        <div className="bg-card fixed inset-x-0 bottom-0 z-20 border-t shadow-lg">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3 px-4 py-3">
            <div className="text-sm">
              Đã chọn <b className="tabular-nums">{picked.length}</b> phiếu
              <span className="text-muted-foreground">
                {' · '}
                {sumByCurrency(picked)
                  .map(([cur, v]) => money(v, cur))
                  .join(' · ')}
              </span>
            </div>
            <div className="ms-auto flex gap-2">
              <Button variant="ghost" onClick={() => setPicked([])} disabled={busy}>
                Bỏ chọn
              </Button>
              <Button disabled={busy} onClick={() => askApproveMany(picked.map(target))}>
                <Check className="size-4" aria-hidden />
                Ký {picked.length} phiếu
              </Button>
            </div>
          </div>
        </div>
      )}

      {dialogs}
    </div>
  )
}

/**
 * Màn rỗng phải NÓI THẬT vì sao rỗng. "0 phiếu chờ" có hai nghĩa trái ngược:
 * đã ký hết (tốt) hoặc chưa ai từng lập phiếu trên hệ thống (dữ liệu chưa lên).
 */
function EmptyCenter({ box, filtered }: { box: SignBox; filtered: boolean }) {
  const neverUsed = box.emptiness.pos_total === 0 && box.emptiness.lsx_total === 0
  const noPo = box.emptiness.pos_total === 0

  return (
    <div className="bg-card rounded-xl border px-6 py-12 text-center">
      <Inbox className="text-muted-foreground mx-auto size-8" aria-hidden />
      <p className="mt-3 font-medium">
        {filtered ? 'Không có phiếu loại này' : 'Không có phiếu chờ duyệt'}
      </p>

      {!filtered && (
        <div className="text-muted-foreground mx-auto mt-2 max-w-lg space-y-2 text-sm">
          {neverUsed ? (
            <p>
              Hệ thống <b>chưa từng có phiếu nào</b> được lập — không phải bạn đã ký hết.
              Cần Kinh doanh phát lệnh sản xuất và Cung ứng lập đơn mua trên hệ thống thì
              phiếu mới chảy về đây.
            </p>
          ) : (
            <>
              <p>Mọi phiếu đã được xử lý.</p>
              {noPo && (
                <p>
                  Riêng <b>đơn mua thì chưa có đơn nào trên hệ thống</b> (
                  {box.emptiness.lsx_total} lệnh sản xuất đã có). Phòng Cung ứng còn đang
                  làm ngoài Excel.
                </p>
              )}
            </>
          )}
          <p className="text-xs">
            <Link href="/exec/approvals/history" className="underline">
              Xem lịch sử ký
            </Link>
          </p>
        </div>
      )}
    </div>
  )
}
