import { notFound } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { canAction } from '@/modules/core/rbac/rbac.service'
import { posService } from '@/modules/dept/supply/pos.service'
import { posRepo } from '@/modules/dept/supply/pos.repo'
import { poCostsService } from '@/modules/dept/supply/po-costs.service'
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
import { poFinanceForPo } from '@/modules/dept/accounting/supplier-invoices.service'
import { poTrackingService } from '@/modules/dept/supply/po-tracking.service'
import { todayIso } from '@/app/(mua-hang)/mua-hang/_data/watch'
import { approvalEventsRepo } from '@/modules/core/approvals/approvals.repo'
import { usersRepo } from '@/modules/core/users/users.repo'
import { toCostRow } from '../../van-chuyen/van-chuyen.shared'
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
  searchParams: Promise<{ sua?: string; muc?: string }>
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams])
  const user = await authService.requirePageUser()

  /*
    HAI CHẶNG, không phải bốn (28/09/2026). Bản trước chờ nối đuôi: quyền → đơn →
    nhóm lớn → mẫu đơn theo NCC — ~2,2 s mỗi lần mở đơn đo trên máy dev, mỗi lượt
    đi–về Supabase ~145 ms. Mọi thứ KHÔNG cần biết đơn (quyền, danh sách NCC /
    lệnh, đầu phiếu, mẫu in) nay khởi động CÙNG LÚC với tải đơn; chỉ phần cần
    `po` mới đợi đơn về.
  */
  const indep = Promise.all([
    isSupplyStaff(user),
    canAction(user, 'supply.po.manage_any'),
    canAction(user, 'supply.po.approve'),
    canAction(user, 'supply.po_cost.manage'),
    canAction(user, 'accounting.supplier_invoice.manage'),
    canAction(user, 'supply.po_issue.manage'),
    suppliersService.list(user, { active_only: true, page: 1, page_size: 500 }),
    productionRepo.listActive(),
    // Đầu phiếu + mẫu in cho "Xem trước phiếu" lúc sửa — settings có cache.
    settingsService.getAll(),
    docTemplatesService.get('PO'),
    posRepo.lastTemplateBySupplier(),
    // Người có thể đã trả phí tại chỗ (chi hộ) — ô "Người trả" của hộp ghi phí.
    usersRepo.list({ active_only: true }),
  ])

  let detail
  try {
    detail = await posService.detail(user, id)
  } catch (e) {
    // Đơn hỏng thì nhóm trên vẫn đang bay — gắn catch để lỗi muộn của nó
    // không thành unhandled rejection.
    indep.catch(() => {})
    if (e instanceof HttpError && e.status === 404) notFound()
    throw e
  }
  const { po, lines, status_lines, extra_lsx, warehouse_docs } = detail

  const [
    [supplyStaff, canManageAny, canApprove, canRecordCost, canInvoice, canIssue, { rows: suppliers }, lsxs, company, tpl, lastTemplates, users], // prettier-ignore
    [position, supplier, facts, stockRows, shipments, shipmentReceipts, receiptBatches, adjustments, costs, finance, tracking, links, submittedAt], // prettier-ignore
  ] = await Promise.all([
    indep,
    Promise.all([
      poPosition(po.id),
      po.supplier_id ? suppliersRepo.findById(po.supplier_id) : Promise.resolve(null),
      po.supplier_id ? supplierFacts(po.supplier_id, po.id) : Promise.resolve(null),
      stockInfoMany(
        lines.map((l) => l.material_id).filter((x): x is string => x != null),
      ),
      posService.listShipments(user, po.id),
      // Đã về CÓ CHỨNG TỪ theo đợt (PNK nối shipment_id) — phần không nối đợt
      // thì client suy diễn, xem allocateReceiptsToShipments.
      posService.shipmentReceipts(user, po.id),
      // Đợt về theo PHIẾU cho ma trận dòng × đợt — cùng hàm với Excel lệnh.
      loadReceiptBatches([po.id]).then((r) => r[po.id] ?? []),
      // Sổ điều chỉnh (0210): bản duyệt → phát sinh lần N → hiện hành.
      posService.listAdjustments(user, po.id),
      // Phiếu chi phí mua hàng (0211): phí vận chuyển / bốc xếp gắn đơn này.
      poCostsService.listByPo(user, po.id),
      // Mục Tài chính (27/09/2026): đối chiếu + hoá đơn + phiếu chi — cùng hàm
      // màn Kế toán. Hỏng thì mục báo "chưa tải được", không làm chết cả đơn.
      poFinanceForPo(po.id).catch(() => null),
      // Sổ hẹn giao + sổ sự cố (0213).
      poTrackingService.forPo(user, po.id),
      // Đơn bổ sung ↔ đơn gốc (0213).
      posRepo.supplementLinks(po),
      // Mốc gửi duyệt cuối — dải "ai giữ" đếm ngày chờ duyệt từ đây (27/09/2026).
      po.status === 'pending_approval'
        ? approvalEventsRepo
            .lastSubmittedAt('po', [po.id])
            .then((m) => m.get(po.id) ?? null)
        : Promise.resolve(null),
    ]),
  ])
  const stock: Record<string, number> = {}
  for (const r of stockRows) stock[r.material_id] = r.on_hand

  /*
    LỆNH ĐANG GẮN ĐƠN mà không còn trong danh sách đang chạy ( chỉ
    lấy approved | in_progress) — lệnh nháp, chờ duyệt, đã xong. Thiếu ở đây thì ô
    Lệnh lúc sửa hiện TRỐNG dù đơn vẫn giữ lệnh (đơn GIGA / BLACKIN của anh Truyền,
    30/09/2026). Chỉ tốn thêm một lượt khi thật sự có lệnh như vậy.
  */
  const activeIds = new Set(lsxs.map((l) => l.id))
  const offList = (
    await Promise.all(
      [po.production_order_id, ...extra_lsx.map((x) => x.id)]
        .filter((id): id is string => !!id && !activeIds.has(id))
        .map((id) => productionRepo.findById(id)),
    )
  ).filter((l) => l != null)

  const isSupply = user.role === 'admin' || supplyStaff
  const manageAny = user.role === 'admin' || canManageAny
  const canEdit = isSupply && (manageAny || (po.assigned_to != null && po.assigned_to === user.id)) // prettier-ignore

  // Danh sách NCC (~32 KB, 72% dữ liệu của trang) chỉ nuôi ô CHỌN NCC lúc sửa —
  // người không sửa được đơn (GĐ, kho, kế toán) chỉ cần đúng NCC của đơn này.
  const pickable = canEdit ? suppliers : suppliers.filter((s) => s.id === po.supplier_id)

  return (
    <DonChungTuScreen
      initialMuc={sp.muc}
      finance={finance}
      tracking={tracking}
      links={links}
      canIssue={canIssue}
      canInvoice={canInvoice}
      // Dựng lại màn khi đơn vừa được điều chỉnh: dòng thêm mới phải nhận mã
      // dòng DB, không thì lần điều chỉnh sau coi chúng là dòng mới lần nữa.
      key={`${po.id}:${adjustments.length}`}
      adjustments={adjustments.map((a) => ({ seq: a.seq, reason: a.reason, created_at: a.created_at, created_by_name: a.created_by_name, currency: a.currency, subtotal_before: a.subtotal_before, subtotal_after: a.subtotal_after, vat_before: a.vat_before, vat_after: a.vat_after, total_before: a.total_before, total_after: a.total_after, delta_by_price: a.delta_by_price, delta_by_qty: a.delta_by_qty, lines: a.lines, sent_at: a.sent_at, sent_by_name: a.sent_by_name, sent_note: a.sent_note }))} // prettier-ignore
      costs={costs.map(toCostRow)}
      payers={users.map((u) => ({ id: u.id, name: u.name ?? u.email }))}
      mode={sp.sua === '1' && canEdit && po.status === 'draft' ? 'edit' : 'view'}
      today={todayIso()}
      po={{ ...po, submitted_at: submittedAt }}
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
      lastTemplates={canEdit ? lastTemplates : undefined}
      suppliers={pickable.map((s) => ({ id: s.id, name: s.name, currency: s.currency ?? null, payment_terms: s.payment_terms ?? null, lead_time_days: s.lead_time_days ?? null, can_order: s.can_order !== false, lock_reason: s.lock_reason ?? null, moq: s.moq ?? null }))} // prettier-ignore
      lsxs={[...lsxs.map((l) => ({ id: l.id, code: l.code, customer_name: l.customer_name, order_codes: l.order_codes })), ...offList.map((l) => ({ id: l.id, code: l.code, customer_name: l.customer_name, order_codes: l.order_codes, status: l.status }))]} // prettier-ignore
      perms={{
        canEdit,
        canApprove,
        isSupply,
        privileged: manageAny || canApprove,
        lead: user.role === 'admin' || manageAny,
        canRecordCost: user.role === 'admin' || canRecordCost,
      }}
      me={{ id: user.id, name: user.name ?? user.email }}
    />
  )
}
