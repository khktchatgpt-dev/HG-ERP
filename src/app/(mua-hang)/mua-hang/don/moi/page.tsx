import { redirect } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { canAction } from '@/modules/core/rbac/rbac.service'
import { suppliersService, isSupplyStaff } from '@/modules/dept/supply/suppliers.service'
import { posService } from '@/modules/dept/supply/pos.service'
import { productionRepo } from '@/modules/dept/production/production.repo'
import { settingsService } from '@/modules/core/settings/settings.service'
import { docTemplatesService } from '@/modules/core/doc-templates/doc-templates.service'
import { todayIso } from '@/app/(workspace)/planning/_data/watch'
import type { PoLineDto } from '@/app/(workspace)/planning/pos/new/po-line'
import { DonChungTuScreen } from '../[id]/DonChungTuScreen'
import { headerFromPo } from '../[id]/chung-tu'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Mua hàng · Đơn mua mới' }

/**
 * ĐƠN MỚI = cùng màn chứng từ, chế độ tạo. Không có form riêng.
 *
 * Mồi sẵn từ URL:
 *   · `?ncc=` / `?lsx=`  — từ hồ sơ NCC hoặc từ lệnh sản xuất
 *   · `?vt=A,B&sl=10,20` — từ dòng tồn kho / bảng kê vật tư: mã thành dòng,
 *     SL đề xuất cùng thứ tự (nhận cả `material`/`qty` của đường dẫn cũ)
 *   · `?tu=<id>`         — NHÂN BẢN: đầu đơn + dòng của đơn gốc, lưu thành đơn
 *     mới. Cố ý KHÔNG mang theo đợt giao (lịch lần trước sai cho lần này).
 *
 * Quyền: chỉ nhân sự mua hàng; người khác về danh sách thay vì thấy một form
 * không lưu được.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    ncc?: string
    lsx?: string
    vt?: string
    sl?: string
    material?: string
    qty?: string
    tu?: string
  }>
}) {
  const sp = await searchParams
  const user = await authService.requirePageUser()
  const canEdit = user.role === 'admin' || (await isSupplyStaff(user))
  if (!canEdit) redirect('/mua-hang/don')
  const [{ rows: suppliers }, lsxs, canApprove, company, tpl, src] = await Promise.all([
    suppliersService.list(user, { active_only: true, page: 1, page_size: 500 }),
    productionRepo.listActive(),
    canAction(user, 'supply.po.approve'),
    settingsService.getAll(),
    docTemplatesService.get('PO'),
    sp.tu ? posService.detail(user, sp.tu).catch(() => null) : Promise.resolve(null),
  ])

  // Nhân bản: dòng bỏ `id` để màn không coi chúng là dòng đã lưu của đơn gốc.
  const seedHeader = src
    ? headerFromPo(
        src.po,
        src.extra_lsx.map((x) => x.id),
      )
    : undefined
  const seedLines: PoLineDto[] = src
    ? src.lines.map((l) => ({ ...l, id: undefined }))
    : []

  const codesRaw = sp.vt ?? sp.material
  const seedCodes = codesRaw
    ? {
        codes: codesRaw
          .split(',')
          .map((c) => c.trim())
          .filter(Boolean),
        qtys: (sp.sl ?? sp.qty ?? '').split(',').map((v) => Number(v.trim())),
      }
    : undefined

  return (
    <DonChungTuScreen
      mode="create"
      today={todayIso()}
      po={null}
      lines={seedLines}
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
      seedHeader={seedHeader}
      seedCodes={seedCodes}
      company={company}
      tpl={tpl}
    />
  )
}
