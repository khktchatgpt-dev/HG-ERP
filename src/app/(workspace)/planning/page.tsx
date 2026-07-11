import { authService } from '@/modules/core/auth/auth.service'
import { posService } from '@/modules/dept/supply/pos.service'
import { suppliersService } from '@/modules/dept/supply/suppliers.service'
import { productionService } from '@/modules/dept/production/production.service'
import { productionRepo } from '@/modules/dept/production/production.repo'
import { assessLateRisk, assessPoLate } from '@/lib/late-risk'
import { ACCENT_CLASSES, WORKSPACES } from '@/workspaces/workspaces.config'

const workspace = WORKSPACES.planning

export default async function PlanningHomePage() {
  const user = (await authService.currentUser())!
  const accent = ACCENT_CLASSES[workspace.accent]

  const [pending, open, suppliers, producing, tracking, allPos] = await Promise.all([
    posService.list(user, { status: 'pending_approval', page: 1, page_size: 1 }),
    posService.list(user, { status: 'ordered', page: 1, page_size: 1 }),
    suppliersService.list(user, { active_only: true, page: 1, page_size: 1 }),
    productionService.list(user, { status: 'in_progress', page: 1, page_size: 1 }),
    productionRepo.listTracking(),
    posService.list(user, { page: 1, page_size: 500 }),
  ])
  const today = new Date().toISOString().slice(0, 10)
  const lateRisk = tracking.filter((r) => assessLateRisk(r, today)).length
  const poLate = allPos.rows.filter((p) => assessPoLate(p, today) === 'overdue').length

  return (
    <>
      <h1 className="mb-4 text-lg font-semibold">
        Kế hoạch - Cung ứng — chào {user.name ?? user.email}
      </h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Widget
          label="Đơn nguy cơ trễ"
          value={lateRisk.toString()}
          hint="Sát/quá hạn — lọc ⚠ ở Theo dõi đơn"
          accentBg={lateRisk > 0 ? 'bg-red-500' : accent.bg}
        />
        <Widget
          label="PO quá hẹn giao"
          value={poLate.toString()}
          hint="NCC trễ hẹn — lọc ⚠ ở Đơn đặt vật tư"
          accentBg={poLate > 0 ? 'bg-red-500' : accent.bg}
        />
        <Widget
          label="PO chờ GĐ duyệt"
          value={pending.total.toString()}
          hint="BR-05: duyệt xong mới gửi NCC"
          accentBg={accent.bg}
        />
        <Widget
          label="PO đã gửi NCC"
          value={open.total.toString()}
          hint="Đang chờ hàng về kho"
          accentBg={accent.bg}
        />
        <Widget
          label="LSX đang sản xuất"
          value={producing.total.toString()}
          hint="Cập nhật giai đoạn ở Tiến độ SX"
          accentBg={accent.bg}
        />
        <Widget
          label="Nhà cung cấp"
          value={suppliers.total.toString()}
          hint="Đang giao dịch"
          accentBg={accent.bg}
        />
      </div>

      <div className="mt-8">
        <h2 className="mb-2 text-sm font-semibold text-zinc-500 uppercase">
          Truy cập nhanh
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <QuickLink
            href="/planning/pos"
            title="Đơn đặt vật tư"
            desc="Tạo PO từ LSX, gửi duyệt, theo dõi hàng về"
          />
          <QuickLink
            href="/planning/suppliers"
            title="Nhà cung cấp"
            desc="Hồ sơ NCC, lịch sử mua"
          />
          <QuickLink
            href="/planning/production"
            title="Tiến độ sản xuất"
            desc="Cập nhật giai đoạn từng LSX, báo hoàn thành"
          />
          <QuickLink
            href="/sales/tracking"
            title="Theo dõi đơn hàng"
            desc="Trạng thái tổng hợp: BOM, vật tư, sản xuất từng đơn"
          />
          <QuickLink
            href="/warehouse/docs"
            title="Phiếu kho"
            desc="Phiếu nhập theo PO, phiếu xuất theo LSX"
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
