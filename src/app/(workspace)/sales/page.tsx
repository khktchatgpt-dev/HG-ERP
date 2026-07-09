import { authService } from '@/modules/core/auth/auth.service'
import { ACCENT_CLASSES, WORKSPACES } from '@/workspaces/workspaces.config'
import { salesService } from '@/modules/dept/sales/sales.service'
import { quotesService } from '@/modules/dept/sales/quotes.service'
import { ordersService } from '@/modules/dept/sales/orders.service'
import { productionRepo } from '@/modules/dept/production/production.repo'
import { assessLateRisk } from '@/lib/late-risk'

const workspace = WORKSPACES.sales

export default async function SalesHomePage() {
  const user = (await authService.currentUser())!
  const accent = ACCENT_CLASSES[workspace.accent]

  const [{ total: customerCount }, draftQuotes, openOrders, tracking] = await Promise.all(
    [
      salesService.list(user, { page: 1, page_size: 1, active_only: true }),
      quotesService.list(user, { status: 'draft', page: 1, page_size: 1 }),
      ordersService.list(user, { status: 'in_production', page: 1, page_size: 1 }),
      productionRepo.listTracking(),
    ],
  )
  const today = new Date().toISOString().slice(0, 10)
  const lateRisk = tracking.filter((r) => assessLateRisk(r, today)).length

  return (
    <>
      <h1 className="mb-4 text-lg font-semibold">
        Trang chủ Sales — chào {user.name ?? user.email}
      </h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Widget
          label="Khách hàng đang active"
          value={customerCount.toString()}
          hint="Cập nhật realtime"
          accentBg={accent.bg}
        />
        <Widget
          label="Báo giá nháp"
          value={draftQuotes.total.toString()}
          hint="Chưa chốt gửi khách"
          accentBg={accent.bg}
        />
        <Widget
          label="Đơn đang sản xuất"
          value={openOrders.total.toString()}
          hint="Xem chi tiết ở Theo dõi đơn"
          accentBg={accent.bg}
        />
        <Widget
          label="Đơn nguy cơ trễ"
          value={lateRisk.toString()}
          hint="Sát/quá hạn giao — lọc ⚠ ở Theo dõi đơn"
          accentBg={lateRisk > 0 ? 'bg-red-500' : accent.bg}
        />
      </div>

      <div className="mt-8">
        <h2 className="mb-2 text-sm font-semibold text-zinc-500 uppercase">
          Truy cập nhanh
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <QuickLink
            href="/sales/quotes"
            title="Báo giá"
            desc="Lập & chốt báo giá — hồ sơ riêng của Sales"
          />
          <QuickLink
            href="/sales/orders"
            title="Đơn hàng"
            desc="Tự tạo đơn từ báo giá đã chốt, phát LSX"
          />
          <QuickLink
            href="/sales/tracking"
            title="Theo dõi đơn hàng"
            desc="Trạng thái tổng hợp: BOM, vật tư, tiến độ"
          />
          <QuickLink
            href="/sales/customers"
            title="Khách hàng"
            desc="CRUD, phân KH cho sales, tìm kiếm"
          />
        </div>
      </div>
    </>
  )
}

function Widget({
  label,
  value,
  hint,
  accentBg,
}: {
  label: string
  value: string
  hint: string
  accentBg: string
}) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${accentBg}`} />
        <span className="text-xs font-medium text-zinc-500 uppercase">{label}</span>
      </div>
      <div className="mt-2 text-3xl font-semibold">{value}</div>
      <div className="mt-1 text-xs text-zinc-400">{hint}</div>
    </div>
  )
}

function QuickLink({ href, title, desc }: { href: string; title: string; desc: string }) {
  return (
    <a
      href={href}
      className="block rounded-lg border border-zinc-200 bg-white p-4 hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-600"
    >
      <div className="font-medium">{title}</div>
      <div className="mt-1 text-xs text-zinc-500">{desc}</div>
    </a>
  )
}
