import { notFound } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { isSupplyStaff } from '@/modules/dept/supply/suppliers.service'
import { loadLsxBangKe } from '@/modules/dept/supply/lsx-bang-ke.service'
import {
  keHoachMuaService,
  maCanChonCua,
} from '@/modules/dept/supply/ke-hoach-mua.service'
import { todayVn } from '@/lib/date-vn'
import { KeHoachMuaScreen } from './KeHoachMuaScreen'
import type { Buoc } from './useKeHoachMua'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await authService.requirePageUser()
  const bk = await loadLsxBangKe(user, id, todayVn(), true).catch(() => null)
  return { title: bk ? `Kế hoạch mua · ${bk.lsx.code}` : 'Mua hàng · Kế hoạch mua' }
}

/**
 * KẾ HOẠCH MUA CỦA LỆNH (22/10/2026, thay "Bảng kê vật tư" — giữ đường dẫn cũ để
 * link đang dùng không vỡ). Ba bước trên một màn: nhu cầu → chọn NCC → lên đơn.
 *
 * Cùng service với chế độ "Theo vật tư" của màn lệnh (`loadLsxBangKe`), nên hai
 * màn không thể nói khác nhau về cùng một lệnh. `?nhap=0` tắt định mức chưa
 * được Kỹ thuật kiểm (mặc định BẬT: 0 SP được kiểm, tắt là bảng trống).
 * `?buoc=1|2|3` mở thẳng một bước.
 */
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ nhap?: string; buoc?: string }>
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams])
  const includeDraft = sp.nhap !== '0'
  const user = await authService.requirePageUser()
  const [bk, supplyStaff] = await Promise.all([
    loadLsxBangKe(user, id, todayVn(), includeDraft),
    isSupplyStaff(user),
  ])
  if (!bk) notFound()
  // Gợi ý NCC cho đúng các mã còn phải đặt — cùng hàm tính với màn + file Excel.
  const nguon = await keHoachMuaService.nguonNcc(bk.lsx.id, maCanChonCua(bk))
  const buocDau: Buoc = sp.buoc === '3' ? 3 : sp.buoc === '2' ? 2 : 1
  return (
    <KeHoachMuaScreen
      bk={bk}
      canEdit={user.role === 'admin' || supplyStaff}
      includeDraft={includeDraft}
      buocDau={buocDau}
      nguon={nguon}
    />
  )
}
