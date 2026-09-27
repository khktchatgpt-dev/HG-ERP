import { redirect } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { canAction } from '@/modules/core/rbac/rbac.service'
import { suppliersService, isSupplyStaff } from '@/modules/dept/supply/suppliers.service'
import { posService } from '@/modules/dept/supply/pos.service'
import { posRepo } from '@/modules/dept/supply/pos.repo'
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
    /** Đơn BỔ SUNG cho phần giao thiếu của đơn này (0213): mồi dòng = SL còn thiếu. */
    'bo-sung'?: string
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
    sp.tu || sp['bo-sung']
      ? posService.detail(user, (sp.tu ?? sp['bo-sung'])!).catch(() => null)
      : Promise.resolve(null),
  ])
  /*
    ĐƠN BỔ SUNG (0213): cùng NCC, cùng lệnh, cùng mẫu với đơn gốc — dòng chỉ còn
    phần ĐÃ CHỐT THIẾU (đặt − đã nhận của dòng đã chốt, sổ `supply_po_line_status`). Người mua đổi
    NCC được ngay trên màn (tình huống "NCC cũ không giao nổi → chuyển NCC khác").
  */
  const boSung = sp['bo-sung'] && src ? src : null
  // Chỉ dòng ĐÃ CHỐT THIẾU — phần NCC không giao nữa (dòng chưa chốt thì NCC vẫn đang giao).
  const missingById = new Map((boSung?.status_lines ?? []).filter((s) => !!s.closed_short_at).map((s) => [s.id, Number(s.qty_missing ?? 0)])) // prettier-ignore

  // Nhân bản: dòng bỏ `id` để màn không coi chúng là dòng đã lưu của đơn gốc.
  const seedHeader = src
    ? headerFromPo(
        src.po,
        src.extra_lsx.map((x) => x.id),
      )
    : undefined
  const seedLines: PoLineDto[] = boSung
    ? boSung.lines.flatMap((l) => {
        const miss = l.id ? (missingById.get(l.id) ?? 0) : 0
        return miss > 1e-6 ? [{ ...l, id: undefined, qty_ordered: miss }] : []
      })
    : src
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
      lastTemplates={await posRepo.lastTemplateBySupplier()}
      suppliers={suppliers.map((s) => ({ id: s.id, name: s.name, currency: s.currency ?? null, payment_terms: s.payment_terms ?? null, lead_time_days: s.lead_time_days ?? null, can_order: s.can_order !== false, lock_reason: s.lock_reason ?? null, moq: s.moq ?? null }))} // prettier-ignore
      lsxs={lsxs.map((l) => ({ id: l.id, code: l.code, customer_name: l.customer_name, order_codes: l.order_codes }))} // prettier-ignore
      perms={{ canEdit: true, canApprove, isSupply: true }}
      me={{ id: user.id, name: user.name ?? user.email }}
      seed={{ supplierId: sp.ncc, lsxId: sp.lsx }}
      seedHeader={seedHeader}
      seedCodes={seedCodes}
      sourcePo={boSung ? { id: boSung.po.id, code: boSung.po.code } : null}
      company={company}
      tpl={tpl}
    />
  )
}
