import { notFound } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { canAction } from '@/modules/core/rbac/rbac.service'
import { posService } from '@/modules/dept/supply/pos.service'
import { posRepo } from '@/modules/dept/supply/pos.repo'
import { suppliersService, isSupplyStaff } from '@/modules/dept/supply/suppliers.service'
import { suppliersRepo } from '@/modules/dept/supply/supply.repo'
import { supplierFacts } from '@/modules/dept/supply/supplier-facts.repo'
import { poPosition } from '@/modules/dept/supply/balance.repo'
import { loadReceiptBatches } from '@/modules/dept/supply/po-receipts.service'
import { settingsService } from '@/modules/core/settings/settings.service'
import { docTemplatesService } from '@/modules/core/doc-templates/doc-templates.service'
import { stockInfoMany } from '@/modules/dept/warehouse/stock.repo'
import { productionRepo } from '@/modules/dept/production/production.repo'
import { HttpError } from '@/server/http'
import { todayIso } from '@/app/(workspace)/planning/_data/watch'
import { DonChungTuScreen } from './DonChungTuScreen'

export const dynamic = 'force-dynamic'

/** Tiêu đề tab mang MÃ ĐƠN — người mua mở năm sáu đơn cạnh nhau, tab ghi tên app thì không tìm ra tab nào. */
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const po = await posRepo.findById(id)
  return { title: po ? `Mua hàng · ${po.code}` : 'Mua hàng · Đơn mua' }
}

/**
 * MÀN CHỨNG TỪ ĐƠN MUA HỢP NHẤT — xem, sửa, tạo trên MỘT màn.
 *
 * Chép form view của Odoo và details page của Dynamics: cùng một bố cục, bấm
 * "Sửa" thì ô chữ thành ô nhập ngay tại chỗ, không có trang `/edit` riêng.
 * Bản cũ có ba màn (`/pos/[id]`, `/pos/[id]/edit`, `/pos/new`) cho một tờ đơn —
 * người dùng học ba bố cục để làm một việc.
 *
 * NỬA ĐẦU (bước 2a): xem đầy đủ đầu đơn + dòng hàng + hồ sơ NCC; sửa/tạo đầu
 * đơn và dòng hàng theo lưới dẫn bằng `PO_FIELDS` của mẫu đơn; lưu qua đúng
 * route `POST/PATCH /api/dept/supply/pos` mà form cũ dùng. Nửa sau: đợt giao,
 * ma trận nhận hàng, trao đổi, tài liệu, các ô nhập đặc thù (khuôn, lọt lòng).
 *
 * `?sua=1` mở thẳng chế độ sửa (đơn còn nháp và mình phụ trách).
 */
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ sua?: string }>
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams])
  const user = await authService.requirePageUser()
  const [supplyStaff, canManageAny, canApprove] = await Promise.all([
    isSupplyStaff(user),
    canAction(user, 'supply.po.manage_any'),
    canAction(user, 'supply.po.approve'),
  ])

  let detail
  try {
    detail = await posService.detail(user, id)
  } catch (e) {
    if (e instanceof HttpError && e.status === 404) notFound()
    throw e
  }
  const { po, lines, status_lines, extra_lsx, warehouse_docs } = detail

  const [position, supplier, facts, stockRows, shipments, { rows: suppliers }, lsxs, shipmentReceipts, receiptBatches, company, tpl] = // prettier-ignore
    await Promise.all([
      poPosition(po.id),
      po.supplier_id ? suppliersRepo.findById(po.supplier_id) : Promise.resolve(null),
      po.supplier_id ? supplierFacts(po.supplier_id, po.id) : Promise.resolve(null),
      stockInfoMany(
        lines.map((l) => l.material_id).filter((x): x is string => x != null),
      ),
      posService.listShipments(user, po.id),
      suppliersService.list(user, { active_only: true, page: 1, page_size: 500 }),
      productionRepo.listActive(),
      // Đã về CÓ CHỨNG TỪ theo đợt (PNK nối shipment_id) — phần không nối đợt
      // thì client suy diễn, xem allocateReceiptsToShipments.
      posService.shipmentReceipts(user, po.id),
      // Đợt về theo PHIẾU cho ma trận dòng × đợt — cùng hàm với Excel lệnh.
      loadReceiptBatches([po.id]).then((r) => r[po.id] ?? []),
      // Đầu phiếu + mẫu in cho "Xem trước phiếu" lúc sửa — settings có cache.
      settingsService.getAll(),
      docTemplatesService.get('PO'),
    ])
  const stock: Record<string, number> = {}
  for (const r of stockRows) stock[r.material_id] = r.on_hand

  const isSupply = user.role === 'admin' || supplyStaff
  const manageAny = user.role === 'admin' || canManageAny
  const canEdit = isSupply && (manageAny || (po.assigned_to != null && po.assigned_to === user.id)) // prettier-ignore

  return (
    <DonChungTuScreen
      mode={sp.sua === '1' && canEdit && po.status === 'draft' ? 'edit' : 'view'}
      today={todayIso()}
      po={po}
      lines={lines}
      statusLines={status_lines}
      extraLsx={extra_lsx}
      warehouseDocs={warehouse_docs}
      stock={stock}
      position={position}
      supplier={supplier ? { name: supplier.name, code: supplier.code ?? null, tax_no: supplier.tax_no ?? null, phone: supplier.phone ?? null } : null} // prettier-ignore
      facts={facts}
      shipments={shipments.map((s) => ({ id: s.id, seq: s.seq, expected_date: s.expected_date, status: s.status, note: s.note, lines: s.lines }))} // prettier-ignore
      shipmentReceipts={shipmentReceipts}
      receiptBatches={receiptBatches}
      company={company}
      tpl={tpl}
      suppliers={suppliers.map((s) => ({ id: s.id, name: s.name, currency: s.currency ?? null, payment_terms: s.payment_terms ?? null, lead_time_days: s.lead_time_days ?? null }))} // prettier-ignore
      lsxs={lsxs.map((l) => ({ id: l.id, code: l.code, customer_name: l.customer_name, order_codes: l.order_codes }))} // prettier-ignore
      perms={{ canEdit, canApprove, isSupply }}
      me={{ id: user.id, name: user.name ?? user.email }}
    />
  )
}
