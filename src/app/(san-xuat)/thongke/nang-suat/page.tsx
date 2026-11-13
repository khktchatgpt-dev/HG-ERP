import { authService } from '@/modules/core/auth/auth.service'
import { nangSuatService } from '@/modules/dept/production/nang-suat.service'
import { parseKy } from '@/lib/nang-suat'
import { NangSuatScreen } from './NangSuatScreen'

export const metadata = { title: 'Thống kê · Năng suất' }
export const dynamic = 'force-dynamic'

/**
 * NĂNG SUẤT (bản vẽ 11/11/2026 tab 3). Kỳ `?ky=7|14|30` ngày tới hôm nay, tab
 * `?theo=cong_doan|to`. Đọc: mọi NV vào được khu (cùng tư thế Báo cáo).
 */
export default async function NangSuatPage({
  searchParams,
}: {
  searchParams: Promise<{ ky?: string; theo?: string }>
}) {
  const [sp] = await Promise.all([searchParams, authService.requirePageUser()])
  const data = await nangSuatService.get({ ky: parseKy(sp.ky) })
  return <NangSuatScreen data={data} theo={sp.theo === 'to' ? 'to' : 'cong_doan'} />
}
