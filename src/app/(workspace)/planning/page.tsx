import Link from 'next/link'
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Factory,
  Gavel,
  Plus,
  Truck,
} from 'lucide-react'
import { authService } from '@/modules/core/auth/auth.service'
import { PageHeader } from '@/components/erp/PageHeader'
import { EmptyState } from '@/components/erp/EmptyState'
import { Button } from '@/components/shadcn/button'
import { buildAgenda } from '@/lib/supply-meeting'
import { loadMeeting } from './_data/meeting'
import { IssueRow, dmy } from './_components/IssueRow'
import { KpiTiles } from './_components/KpiTiles'

export const dynamic = 'force-dynamic'

const WEEKDAY = [
  'Chủ nhật',
  'Thứ Hai',
  'Thứ Ba',
  'Thứ Tư',
  'Thứ Năm',
  'Thứ Sáu',
  'Thứ Bảy',
]

/** Tuần ISO — "Kỳ họp: Tuần 36" như tiêu đề sổ Excel của Cung ứng. */
function isoWeek(iso: string): number {
  const d = new Date(`${iso}T00:00:00Z`)
  const day = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - day)
  const start = Date.UTC(d.getUTCFullYear(), 0, 1)
  return Math.ceil(((d.getTime() - start) / 86_400_000 + 1) / 7)
}

const TOP_ISSUES = 5

/**
 * TỔNG QUAN CUNG ỨNG — cửa ngõ của bảng họp, KHÔNG phải bảng họp (user chốt
 * 05/09/2026: nhiều lệnh nên mỗi trang một vai trò). Trang này chỉ trả lời
 * "hôm nay có vấn đề không" bằng 4 con số + 5 dòng khẩn nhất, rồi dẫn sang
 * đúng trang cho từng câu hỏi tiếp theo:
 *   Vấn đề cần xử lý → Vật tư theo lệnh → Hàng sắp về → Nhà cung cấp → Việc
 *   cần quyết định.
 */
export default async function PlanningHomePage() {
  const user = await authService.requirePageUser()
  const { today, rows, counts, issues } = await loadMeeting(user)
  const agenda = buildAgenda(rows)

  const top = issues.slice(0, TOP_ISSUES)
  const dateLabel = `${WEEKDAY[new Date(`${today}T00:00:00Z`).getUTCDay()]} ${dmy(today)}/${today.slice(0, 4)}`

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        breadcrumbs={[{ label: 'Cung ứng' }]}
        title="Tổng quan Cung ứng"
        description="Hôm nay cung ứng có đang ảnh hưởng kế hoạch sản xuất không. Mỗi mục bên dưới mở một trang riêng."
        meta={
          <span className="text-muted-foreground text-[12px]">
            {dateLabel} · Tuần <span className="t-data">{isoWeek(today)}</span> ·{' '}
            <span className="t-data">{rows.length}</span> lệnh đang chạy
          </span>
        }
        actions={
          <>
            <Button size="sm" asChild>
              <Link href="/planning/pos/new">
                <Plus />
                Soạn đơn mua
              </Link>
            </Button>
          </>
        }
      />

      {/* Tầng 1: hiện tại có vấn đề không? Mỗi ô dẫn sang trang đã lọc sẵn. */}
      <KpiTiles counts={counts} />

      {/* Tầng 2: năm việc khẩn nhất — đủ để mở đầu cuộc họp, phần còn lại ở trang riêng. */}
      <section className="bg-card overflow-hidden rounded-lg border">
        <header className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
          <h2 className="t-title">
            Khẩn nhất hôm nay
            <span className="t-data text-muted-foreground ml-2 font-normal">
              {Math.min(top.length, TOP_ISSUES)}/{issues.length}
            </span>
          </h2>
          <Button variant="link" size="sm" asChild className="h-auto p-0">
            <Link href="/planning/van-de">
              <AlertTriangle />
              Xem tất cả {issues.length} vấn đề
            </Link>
          </Button>
        </header>
        {top.length === 0 ? (
          <EmptyState
            icon={<CheckCircle2 className="size-5" />}
            title="Không có vấn đề nào cần nêu"
            description="Mọi lệnh đang chạy đều đã đủ vật tư hoặc nhà cung cấp đang giao đúng hẹn."
          />
        ) : (
          <ul className="divide-border divide-y">
            {top.map(({ row, risk }) => (
              <IssueRow key={row.id} row={row} risk={risk} />
            ))}
          </ul>
        )}
      </section>

      {/* Tầng 3: đi tiếp — mỗi thẻ là một trang, một câu hỏi. */}
      <section>
        <h2 className="t-label text-muted-foreground mb-2">Các trang họp</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <PageCard
            href="/planning/van-de"
            icon={AlertTriangle}
            title="Vấn đề cần xử lý"
            desc="Lệnh nào có nguy cơ, vì sao, ai đang cầm bóng"
            stat={`${issues.length} lệnh`}
          />
          <PageCard
            href="/planning/lsx"
            icon={Factory}
            title="Vật tư theo lệnh"
            desc="Từng lệnh: hạn vật tư, đơn mua, đã về tới đâu"
            stat={`${rows.length} lệnh`}
          />
          <PageCard
            href="/planning/hang-sap-ve"
            icon={Truck}
            title="Hàng sắp về"
            desc="Ngày mai, tuần này có gì về kho"
          />
          <PageCard
            href="/planning/suppliers"
            icon={Building2}
            title="Nhà cung cấp"
            desc="Ai đang giao trễ, hồ sơ và lịch sử mua"
          />
          <PageCard
            href="/planning/hop"
            icon={Gavel}
            title="Việc cần quyết định"
            desc="Cung ứng phải làm gì, Sản xuất và Giám đốc phải quyết gì"
            stat={`${agenda.length} việc`}
          />
        </div>
      </section>
    </div>
  )
}

function PageCard({
  href,
  icon: Icon,
  title,
  desc,
  stat,
}: {
  href: string
  icon: typeof Factory
  title: string
  desc: string
  stat?: string
}) {
  return (
    <Link
      href={href}
      className="bg-card hover:bg-accent focus-visible:ring-ring flex items-start gap-3 rounded-lg border p-4 transition-colors focus-visible:ring-2 focus-visible:outline-none"
    >
      <span className="bg-muted text-muted-foreground grid size-9 shrink-0 place-items-center rounded-md">
        <Icon className="size-5" strokeWidth={1.8} aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="flex items-baseline justify-between gap-2">
          <span className="t-title">{title}</span>
          {stat && <span className="t-data text-muted-foreground shrink-0">{stat}</span>}
        </span>
        <span className="text-muted-foreground mt-0.5 block text-[12.5px]">{desc}</span>
      </span>
    </Link>
  )
}
