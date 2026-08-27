import Link from 'next/link'
import { authService } from '@/modules/core/auth/auth.service'
import { worklistService } from '@/modules/dept/production/worklist.service'
import { productionRepo } from '@/modules/dept/production/production.repo'
import { isProductionStaff } from '@/modules/dept/production/perms'
import { EmptyState } from '@/components/erp/EmptyState'
import { LsxWorkScreen } from './LsxWorkScreen'

export const dynamic = 'force-dynamic'

/**
 * Tầng 2 — MỘT LỆNH: thông tin lệnh + tiến độ từng sản phẩm theo công đoạn.
 * Từ đây chọn một (sản phẩm × công đoạn) để sang màn ghi sổ.
 */
export default async function LsxWorkPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await authService.requirePageUser()
  const { id } = await params
  const [data, lsx] = await Promise.all([
    worklistService.list(user, { lsxId: id }),
    productionRepo.findById(id),
  ])

  if (!lsx || data.rows.length === 0) {
    return (
      <div className="py-10">
        <EmptyState
          icon="▦"
          title="Lệnh không có việc ghi nhận"
          description="Lệnh đã kết thúc, hoặc chi tiết của lệnh chưa được phân nhóm nên chưa biết đi công đoạn nào."
        />
        <p className="mt-2 text-center">
          <Link href="/thongke" className="text-sm text-[var(--primary)] hover:underline">
            Về danh sách lệnh
          </Link>
        </p>
      </div>
    )
  }

  const canRecord = user.role === 'admin' || (await isProductionStaff(user))

  return (
    <LsxWorkScreen
      lsx={{
        id: lsx.id,
        code: lsx.code,
        customer_name: lsx.customer_name,
        order_codes: lsx.order_codes,
        ship_date: lsx.ship_date,
        status: lsx.status,
      }}
      stages={data.stages}
      rows={data.rows}
      canRecord={canRecord}
    />
  )
}
