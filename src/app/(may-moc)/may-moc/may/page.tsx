import { authService } from '@/modules/core/auth/auth.service'
import { assetsService } from '@/modules/core/assets/assets.service'
import { MayScreen, type Loc } from './MayScreen'

export const metadata = { title: 'Máy móc' }

const LOCS: readonly string[] = ['down', 'od', 'idle', 'stale'] satisfies Loc[]

export default async function Page({
  searchParams,
}: {
  /**
   * `?nhap=1` — nút "Nhập danh sách máy" ở trang Việc hôm nay mở thẳng hộp nhập Excel.
   * `?loc=down|od|idle|stale` — ô ở Việc hôm nay mở sẵn đúng chip lọc.
   */
  searchParams: Promise<{ nhap?: string; loc?: string }>
}) {
  const user = await authService.requirePageUser()
  const [{ nhap, loc }, d] = await Promise.all([searchParams, assetsService.list(user)])
  return (
    <MayScreen
      meta={d.meta}
      assets={d.assets}
      options={d.options}
      today={d.today}
      openImport={nhap === '1' && d.meta.can_edit}
      initialLoc={loc && LOCS.includes(loc) ? (loc as Loc) : ''}
    />
  )
}
