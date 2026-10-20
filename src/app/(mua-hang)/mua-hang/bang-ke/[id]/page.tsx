import { notFound } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { isSupplyStaff } from '@/modules/dept/supply/suppliers.service'
import { loadLsxBangKe } from '@/modules/dept/supply/lsx-bang-ke.service'
import { todayVn } from '@/lib/date-vn'
import { BangKeScreen } from './BangKeScreen'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await authService.requirePageUser()
  const bk = await loadLsxBangKe(user, id, todayVn(), true).catch(() => null)
  return { title: bk ? `Bảng kê · ${bk.lsx.code}` : 'Mua hàng · Bảng kê vật tư' }
}

/**
 * BẢNG KÊ VẬT TƯ CỦA LỆNH — "còn phải mua gì, bao nhiêu, để lên đơn" (08/10/2026).
 *
 * Cùng service với chế độ "Theo vật tư" của màn lệnh (`loadLsxBangKe`), nên hai
 * màn không thể nói khác nhau về cùng một lệnh. `?nhap=0` tắt định mức chưa
 * được Kỹ thuật kiểm; mặc định BẬT (Q2: 0/119 SP được kiểm, tắt là bảng trống).
 */
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ nhap?: string }>
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams])
  const includeDraft = sp.nhap !== '0'
  const user = await authService.requirePageUser()
  const [bk, supplyStaff] = await Promise.all([
    loadLsxBangKe(user, id, todayVn(), includeDraft),
    isSupplyStaff(user),
  ])
  if (!bk) notFound()
  return (
    <BangKeScreen
      bk={bk}
      canEdit={user.role === 'admin' || supplyStaff}
      includeDraft={includeDraft}
    />
  )
}
