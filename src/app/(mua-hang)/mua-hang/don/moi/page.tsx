import { redirect } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { canAction } from '@/modules/core/rbac/rbac.service'
import { suppliersService, isSupplyStaff } from '@/modules/dept/supply/suppliers.service'
import { productionRepo } from '@/modules/dept/production/production.repo'
import { todayIso } from '@/app/(workspace)/planning/_data/watch'
import { DonChungTuScreen } from '../[id]/DonChungTuScreen'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Mua hàng · Đơn mua mới' }

/**
 * ĐƠN MỚI = cùng màn chứng từ, chế độ tạo. Không có form riêng.
 *
 * `?ncc=` và `?lsx=` mồi sẵn — từ hồ sơ NCC hoặc từ lệnh sản xuất. Quyền: chỉ
 * nhân sự mua hàng; người khác về danh sách thay vì thấy một form không lưu
 * được.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ ncc?: string; lsx?: string }>
}) {
  const sp = await searchParams
  const user = await authService.requirePageUser()
  const canEdit = user.role === 'admin' || (await isSupplyStaff(user))
  if (!canEdit) redirect('/mua-hang/don')
  const [{ rows: suppliers }, lsxs, canApprove] = await Promise.all([
    suppliersService.list(user, { active_only: true, page: 1, page_size: 500 }),
    productionRepo.listActive(),
    canAction(user, 'supply.po.approve'),
  ])
  return (
    <DonChungTuScreen
      mode="create"
      today={todayIso()}
      po={null}
      lines={[]}
      statusLines={[]}
      extraLsx={[]}
      warehouseDocs={[]}
      stock={{}}
      position={null}
      supplier={null}
      facts={null}
      shipments={[]}
      shipmentReceipts={{}}
      receiptBatches={[]}
      suppliers={suppliers.map((s) => ({ id: s.id, name: s.name, currency: s.currency ?? null, payment_terms: s.payment_terms ?? null, lead_time_days: s.lead_time_days ?? null }))} // prettier-ignore
      lsxs={lsxs.map((l) => ({ id: l.id, code: l.code, customer_name: l.customer_name, order_codes: l.order_codes }))} // prettier-ignore
      perms={{ canEdit: true, canApprove, isSupply: true }}
      me={{ id: user.id, name: user.name ?? user.email }}
      seed={{ supplierId: sp.ncc, lsxId: sp.lsx }}
    />
  )
}
