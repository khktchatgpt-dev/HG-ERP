import { Btn, Empty, ScreenFrame } from '@/components/kit'
import { authService } from '@/modules/core/auth/auth.service'
import { assetsMeta, assetsService } from '@/modules/core/assets/assets.service'
import { ChiPhiScreen } from './ChiPhiScreen'

export const metadata = { title: 'Chi phí bảo trì' }

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ ym?: string }>
}) {
  const user = await authService.requirePageUser()
  const [{ ym }, meta] = await Promise.all([searchParams, assetsMeta(user)])
  if (!meta.can_cost) {
    return (
      <ScreenFrame>
        <Empty
          level={2}
          headline="Bạn chưa có quyền xem chi phí bảo trì"
          reason="Chi phí sửa chữa và bảo dưỡng chỉ Kế toán, Ban Giám đốc và Tổ Cơ điện xem được."
          next={<Btn href="/may-moc">Về Việc hôm nay</Btn>}
        />
      </ScreenFrame>
    )
  }
  const d = await assetsService.cost(
    user,
    ym && /^\d{4}-\d{2}$/.test(ym) ? ym : undefined,
  )
  return (
    <ChiPhiScreen
      month={d.month}
      current={d.current}
      rows={d.rows}
      series={d.series}
      byDept={d.by_dept}
    />
  )
}
