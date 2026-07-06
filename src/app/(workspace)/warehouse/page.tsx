import Link from 'next/link'
import { authService } from '@/modules/core/auth/auth.service'
import { materialsService } from '@/modules/dept/warehouse/warehouse.service'
import { PageHeader } from '@/components/erp/PageHeader'
import { StatsBar } from '@/components/erp/StatsBar'

export default async function WarehouseHome() {
  const user = (await authService.currentUser())!
  const { rows, total } = await materialsService.list(user, {
    page: 1,
    page_size: 1000,
    active_only: false,
  })

  const active = rows.filter((m) => m.is_active).length
  const groups = new Set(rows.filter((m) => m.group_name).map((m) => m.group_name)).size
  const noShelf = rows.filter((m) => !m.shelf_location).length

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        breadcrumbs={[{ label: 'Kho' }]}
        title="Trang chủ Kho"
        description="Danh mục vật tư, nhập/xuất/tồn (đang xây theo lộ trình)."
      />

      <StatsBar
        stats={[
          { label: 'Vật tư', value: total, tone: 'default' },
          { label: 'Đang dùng', value: active, tone: 'green' },
          { label: 'Nhóm', value: groups, tone: 'blue' },
          { label: 'Chưa gán kệ', value: noShelf, tone: noShelf ? 'amber' : 'gray' },
        ]}
      />

      <section>
        <h2 className="mb-2 text-xs font-semibold tracking-wider text-zinc-500 uppercase">
          Thao tác nhanh
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Link
            href="/warehouse/materials"
            className="rounded-lg border border-zinc-200 bg-white p-4 hover:border-amber-400 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-amber-600"
          >
            <div className="font-medium">Danh mục vật tư</div>
            <div className="mt-1 text-xs text-zinc-500">
              Mã, ĐVT, nhóm, tồn tối thiểu, vị trí kệ
            </div>
          </Link>
        </div>
      </section>
    </div>
  )
}
