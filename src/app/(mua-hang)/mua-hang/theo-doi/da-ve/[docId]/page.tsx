import { notFound, redirect } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { canAction } from '@/modules/core/rbac/rbac.service'
import { loadChiTietPhieuNhap } from '@/modules/dept/supply/phieu-nhap-chi-tiet.repo'
import { PhieuNhapChiTietScreen } from './PhieuNhapChiTietScreen'

export const metadata = { title: 'Mua hàng · Phiếu nhập kho' }
export const dynamic = 'force-dynamic'

/**
 * CHI TIẾT PHIẾU NHẬP THEO ĐƠN (04/10/2026, bản vẽ J3/J4). Bấm số phiếu ở
 * Theo dõi đơn hàng › Đã về là tới đây (trước: mở thẳng bản in).
 *
 * Phiếu nhập ngoài đơn / hoàn kho không thuộc Mua hàng → sổ phiếu Kho.
 */
export default async function Page({ params }: { params: Promise<{ docId: string }> }) {
  const user = await authService.requirePageUser()
  const { docId } = await params
  const [ct, canWrite] = await Promise.all([
    loadChiTietPhieuNhap(docId),
    user.role === 'admin'
      ? Promise.resolve(true)
      : canAction(user, 'warehouse.stock.write'),
  ])
  if (ct === null) notFound()
  if (ct === 'khong-theo-don') redirect(`/warehouse/phieu/${docId}`)
  return <PhieuNhapChiTietScreen ct={ct} canWrite={canWrite} />
}
