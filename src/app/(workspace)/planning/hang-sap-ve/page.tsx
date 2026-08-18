import Link from 'next/link'
import { PackageCheck, Truck } from 'lucide-react'
import { authService } from '@/modules/core/auth/auth.service'
import { PageHeader } from '@/components/erp/PageHeader'
import { Button } from '@/components/shadcn/button'
import {
  INCOMING_BUCKET,
  groupIncoming,
  isIncoming,
  type IncomingBucket,
} from '@/lib/supply-watch'
import { EtaNote, PoWatchRow } from '../_components/PoWatchRow'
import { loadWatchPos, todayIso } from '../_data/watch'

export const dynamic = 'force-dynamic'

const TONE_COLOR: Record<(typeof INCOMING_BUCKET)[IncomingBucket]['tone'], string> = {
  stop: 'var(--stop)',
  warn: 'var(--warn)',
  primary: 'var(--primary)',
  muted: 'var(--muted-foreground)',
}

/**
 * HÀNG SẮP VỀ — lịch giao của những đơn NCC đang lo.
 *
 * Khác màn danh sách ở trục nhìn: ở đây trục là THỜI GIAN, không phải trạng
 * thái. Người mua mở màn này để trả lời "tuần này có gì về, có gì phải giục",
 * và để Kho biết trước mà xếp chỗ. Đơn chưa gửi NCC cố ý KHÔNG có mặt — chưa ai
 * chuẩn bị hàng thì xếp vào lịch giao là tự trấn an sai (xem `supply-watch.ts`).
 */
export default async function IncomingGoodsPage() {
  const user = await authService.requirePageUser()
  const today = todayIso()
  const { rows } = await loadWatchPos(user)

  const enRoute = rows.filter(isIncoming)
  const groups = groupIncoming(enRoute, today)
  const countOf = (b: IncomingBucket) =>
    groups.find((g) => g.bucket === b)?.rows.length ?? 0
  const totalValue = enRoute.reduce((s, p) => s + p.total, 0)

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        breadcrumbs={[{ label: 'Cung ứng', href: '/planning' }, { label: 'Hàng sắp về' }]}
        title="Hàng sắp về"
        description="Đơn đã gửi nhà cung cấp, xếp theo ngày hẹn giao. Đơn chưa gửi nằm ở mục Chờ tôi xử lý."
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/warehouse/docs">Phiếu nhập kho</Link>
          </Button>
        }
        meta={
          <span className="text-muted-foreground text-[12px]">
            {enRoute.length} đơn đang trên đường ·{' '}
            <span className="t-data">{totalValue.toLocaleString('vi-VN')}</span> tiền hàng
            chờ về
          </span>
        }
      />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {(['overdue', 'today', 'week', 'no_eta'] as const).map((b) => {
          const meta = INCOMING_BUCKET[b]
          const n = countOf(b)
          return (
            <div key={b} className="bg-card rounded-xl border px-3.5 py-2.5">
              <p className="t-label text-muted-foreground truncate">{meta.label}</p>
              <p
                className="mt-1 font-mono text-[20px] leading-none font-semibold tabular-nums"
                style={{
                  color: n > 0 ? TONE_COLOR[meta.tone] : 'var(--muted-foreground)',
                }}
              >
                {n}
              </p>
            </div>
          )
        })}
      </div>

      {groups.length === 0 ? (
        <div className="bg-card flex flex-col items-center rounded-xl border py-14 text-center">
          <span className="bg-muted grid size-12 place-items-center rounded-xl">
            <PackageCheck className="text-muted-foreground size-6" strokeWidth={1.8} />
          </span>
          <p className="t-title mt-4">Không có hàng nào đang trên đường</p>
          <p className="t-body text-muted-foreground mt-1 max-w-sm">
            Đơn chỉ vào đây sau khi đã gửi nhà cung cấp. Đơn đã duyệt mà chưa gửi nằm ở
            mục Chờ tôi xử lý.
          </p>
          <Button variant="outline" size="sm" className="mt-4" asChild>
            <Link href="/planning/viec-cua-toi">
              <Truck /> Xem việc đang chờ
            </Link>
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {groups.map(({ bucket, rows: list }) => {
            const meta = INCOMING_BUCKET[bucket]
            const color = TONE_COLOR[meta.tone]
            const value = list.reduce((s, p) => s + p.total, 0)
            return (
              <section key={bucket} className="bg-card overflow-hidden rounded-xl border">
                <header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b px-4 py-3">
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{ background: color }}
                    aria-hidden
                  />
                  <h2 className="t-title">{meta.label}</h2>
                  <span
                    className="rounded-full px-2 py-0.5 font-mono text-[12px] font-semibold tabular-nums"
                    style={{
                      color,
                      background: `color-mix(in srgb, ${color} 12%, transparent)`,
                    }}
                  >
                    {list.length}
                  </span>
                  <span className="t-data text-muted-foreground ml-auto text-[12px]">
                    {value.toLocaleString('vi-VN')}
                  </span>
                </header>
                <div>
                  {list.map((po) => (
                    <PoWatchRow
                      key={po.id}
                      po={po}
                      note={<EtaNote po={po} today={today} />}
                    />
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
