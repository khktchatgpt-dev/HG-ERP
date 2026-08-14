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
import { Button } from '@/components/shadcn/button'
import { Checkbox } from '@/components/shadcn/checkbox'
import { TopProgressBar } from '@/components/erp/Spinner'
import { cn } from '@/lib/utils'
import { useApprovalDecision, type DecideTarget } from './useApprovalDecision'
import type { SignBox, SignItem } from '@/modules/core/exec/exec.service'

const KIND_LABEL = { lsx: 'Lệnh SX', po: 'Đơn mua' } as const
const KIND_ICON = { lsx: Factory, po: ShoppingCart } as const

function money(value: number, currency: string): string {
  return `${new Intl.NumberFormat('vi-VN', {
    maximumFractionDigits: currency === 'VND' ? 0 : 2,
  }).format(value)} ${currency}`
}

/** "hôm nay" / "1 ngày" / "4 ngày" — con số trần trụi, không làm mềm. */
function waitLabel(days: number): string {
  return days <= 0 ? 'gửi hôm nay' : `chờ ${days} ngày`
}

/**
 * HỘP KÝ — trang chủ khu Giám đốc.
 *
 * Thay cho bảng tin nhiều thẻ trước đây (ExecDashboard). Chủ dự án chốt
 * 14/08/2026: việc DUY NHẤT của Giám đốc trên hệ thống là ký phiếu, nên trang
 * chủ phải là hộp phiếu chờ ký chứ không phải một dàn biểu đồ dẫn đi nơi khác.
 *
 * Mỗi thẻ ký được NGAY TẠI CHỖ. "Xem kỹ" mới mở trang thẩm định đầy đủ — vì
 * phần lớn phiếu là loại đã bàn miệng rồi, mở chi tiết chỉ tốn thêm hai cú bấm.
 *
 * Xem docs/exec-v2-ky-duyet-plan.md §5B.
 */
export function SignBoxScreen({ box }: { box: SignBox }) {
  const router = useRouter()
  const [kind, setKind] = useState<'all' | 'lsx' | 'po'>('all')
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const { busy, askApprove, askReject, askApproveMany, dialogs } = useApprovalDecision(
    () => {
      setPicked(new Set())
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
  const pickedItems = items.filter((i) => picked.has(key(i)))
  const allPicked = bulkable.length > 0 && bulkable.every((i) => picked.has(key(i)))

  function toggle(i: SignItem) {
    setPicked((s) => {
      const next = new Set(s)
      if (next.has(key(i))) next.delete(key(i))
      else next.add(key(i))
      return next
    })
  }

  return (
    <div className="space-y-4">
      <TopProgressBar active={busy} />

      <PageHeader
        title="Hộp ký"
        description={
          box.stats.total > 0
            ? `${box.stats.total} phiếu chờ bạn ký · lâu nhất ${box.stats.oldest_days} ngày · ${box.stats.value.map((v) => money(v.value, v.currency)).join(' · ')}`
            : 'Không có phiếu nào chờ chữ ký của bạn.'
        }
        actions={
          <Button variant="outline" asChild>
            <Link href="/exec/approvals/history">Lịch sử ký →</Link>
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
            <label className="text-muted-foreground ms-auto flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox
                checked={allPicked}
                onCheckedChange={(v) =>
                  setPicked(v ? new Set(bulkable.map(key)) : new Set())
                }
              />
              Chọn {bulkable.length} phiếu ký nhanh được
            </label>
          )}
        </div>
      )}

      {items.length === 0 ? (
        <EmptyBox box={box} filtered={kind !== 'all' && box.stats.total > 0} />
      ) : (
        <ul className="space-y-3">
          {items.map((i) => {
            const Icon = KIND_ICON[i.kind]
            return (
              <li
                key={`${i.kind}-${i.id}`}
                className={cn(
                  'bg-card rounded-xl border p-4',
                  i.waiting_days >= 3 && 'border-amber-400 dark:border-amber-700',
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 gap-3">
                    {!i.big && (
                      <Checkbox
                        className="mt-1"
                        checked={picked.has(key(i))}
                        onCheckedChange={() => toggle(i)}
                        aria-label={`Chọn ${i.code} để ký nhanh`}
                      />
                    )}
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-muted-foreground inline-flex items-center gap-1 text-[11px] font-medium tracking-wide uppercase">
                          <Icon className="size-3.5" aria-hidden />
                          {KIND_LABEL[i.kind]}
                        </span>
                        <span className="font-semibold">{i.code}</span>
                        {i.big && (
                          <span className="rounded bg-purple-100 px-1.5 py-0.5 text-[11px] font-medium text-purple-700 dark:bg-purple-950 dark:text-purple-300">
                            Giá trị lớn
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 text-sm">{i.party}</div>
                      <div className="text-muted-foreground mt-0.5 text-xs">
                        {[...i.facts, i.submitted_by ? `lập bởi ${i.submitted_by}` : null]
                          .filter(Boolean)
                          .join(' · ')}
                      </div>
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
                      {waitLabel(i.waiting_days)}
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
                        <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                        {w}
                      </li>
                    ))}
                  </ul>
                )}

                {/* Nút xếp ngược trên điện thoại: "Ký" nằm dưới cùng, to nhất,
                    trong tầm ngón cái. Trên máy tính xếp phải như thường lệ. */}
                <div className="mt-3 flex flex-col-reverse gap-2 border-t pt-3 sm:flex-row sm:justify-end">
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
                    Ký duyệt
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {/* Dải ký nhanh — chỉ hiện khi đã chọn, nổi ở chân màn cho vừa tầm ngón cái. */}
      {pickedItems.length > 0 && (
        <div className="bg-card fixed inset-x-0 bottom-0 z-20 border-t shadow-lg">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3 px-4 py-3">
            <div className="text-sm">
              Đã chọn <b className="tabular-nums">{pickedItems.length}</b> phiếu
              <span className="text-muted-foreground">
                {' · '}
                {sumByCurrency(pickedItems)
                  .map(([cur, v]) => money(v, cur))
                  .join(' · ')}
              </span>
            </div>
            <div className="ms-auto flex gap-2">
              <Button
                variant="ghost"
                onClick={() => setPicked(new Set())}
                disabled={busy}
              >
                Bỏ chọn
              </Button>
              <Button
                disabled={busy}
                onClick={() => askApproveMany(pickedItems.map(target))}
              >
                <Check className="size-4" aria-hidden />
                Ký {pickedItems.length} phiếu
              </Button>
            </div>
          </div>
        </div>
      )}

      {dialogs}
    </div>
  )
}

/** Cộng tiền theo TỪNG tiền tệ — USD và VND không bao giờ cộng chung. */
function sumByCurrency(items: SignItem[]): [string, number][] {
  const m = new Map<string, number>()
  for (const i of items) m.set(i.currency, (m.get(i.currency) ?? 0) + i.value)
  return [...m.entries()]
}

/**
 * Màn rỗng phải NÓI THẬT vì sao rỗng. "0 phiếu chờ" có hai nghĩa trái ngược:
 * đã ký hết (tốt) hoặc chưa ai từng lập phiếu trên hệ thống (dữ liệu chưa lên).
 * Hiện cùng một dòng "Không có gì" cho cả hai là để Giám đốc yên tâm nhầm.
 */
function EmptyBox({ box, filtered }: { box: SignBox; filtered: boolean }) {
  const neverUsed = box.emptiness.pos_total === 0 && box.emptiness.lsx_total === 0
  const noPo = box.emptiness.pos_total === 0

  return (
    <div className="bg-card rounded-xl border px-6 py-12 text-center">
      <Inbox className="text-muted-foreground mx-auto size-8" aria-hidden />
      <p className="mt-3 font-medium">
        {filtered ? 'Không có phiếu loại này' : 'Hộp ký trống'}
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
