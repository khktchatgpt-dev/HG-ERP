import { authService } from '@/modules/core/auth/auth.service'
import { posService } from '@/modules/dept/supply/pos.service'
import { suppliersService } from '@/modules/dept/supply/suppliers.service'
import { ACCENT_CLASSES, WORKSPACES } from '@/workspaces/workspaces.config'

const workspace = WORKSPACES.planning

export default async function PlanningHomePage() {
  const user = (await authService.currentUser())!
  const accent = ACCENT_CLASSES[workspace.accent]

  const [pending, open, suppliers] = await Promise.all([
    posService.list(user, { status: 'pending_approval', page: 1, page_size: 1 }),
    posService.list(user, { status: 'ordered', page: 1, page_size: 1 }),
    suppliersService.list(user, { active_only: true, page: 1, page_size: 1 }),
  ])

  return (
    <>
      <h1 className="mb-4 text-lg font-semibold">
        Kế hoạch - Cung ứng — chào {user.name ?? user.email}
      </h1>
      <div className="grid gap-4 sm:grid-cols-3">
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
            href="/sales/tracking"
            title="Theo dõi đơn hàng"
            desc="Tiến độ sản xuất, BOM, vật tư từng đơn"
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
