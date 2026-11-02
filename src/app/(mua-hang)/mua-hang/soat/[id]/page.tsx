import { notFound } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { isSupplyStaff } from '@/modules/dept/supply/suppliers.service'
import { loadLsxBangKe } from '@/modules/dept/supply/lsx-bang-ke.service'
import { lenhDoiCua } from '@/modules/dept/supply/lenh-doi.service'
import { productionRepo } from '@/modules/dept/production/production.repo'
import { todayVn } from '@/lib/date-vn'
import { SoatLenhScreen } from './SoatLenhScreen'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const lsx = await productionRepo.findById(id).catch(() => null)
  return { title: lsx ? `Soát thay đổi · ${lsx.code}` : 'Mua hàng · Soát thay đổi' }
}

/**
 * SOÁT THAY ĐỔI MỘT LỆNH (T1, 02/11/2026). Số "nay" là ĐÚNG bảng kê Kế hoạch mua
 * tính (bật định mức chưa kiểm như mặc định bên đó) — mốc soát ghi bằng chính
 * số đó. Chỉ gửi xuống trình duyệt đầu lệnh + tập thay đổi, không cả bảng kê.
 */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await authService.requirePageUser()
  const [bk, supplyStaff] = await Promise.all([
    loadLsxBangKe(user, id, todayVn(), true),
    isSupplyStaff(user),
  ])
  if (!bk) notFound()
  const doi = await lenhDoiCua(bk)
  return (
    <SoatLenhScreen
      lsx={{
        id: bk.lsx.id,
        code: bk.lsx.code,
        customer_name: bk.lsx.customer_name,
        ship_date: bk.lsx.ship_date,
        so_sp: bk.products.length,
        sl_sp: bk.products.reduce((s, p) => s + p.qty, 0),
      }}
      doi={doi}
      canEdit={user.role === 'admin' || supplyStaff}
    />
  )
}
