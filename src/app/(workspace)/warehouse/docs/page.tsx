import { authService } from '@/modules/core/auth/auth.service'
import { canAction } from '@/modules/core/rbac/rbac.service'
import { stockService } from '@/modules/dept/warehouse/stock.service'
import { docsRepo } from '@/modules/dept/warehouse/stock.repo'
import { materialsRepo } from '@/modules/dept/warehouse/warehouse.repo'
import { supplyRepo } from '@/modules/dept/supply/supply.repo'
import { productionRepo } from '@/modules/dept/production/production.repo'
import { DocsManager } from './DocsManager'

/**
 * Phiếu kho: lập phiếu nhập (PNK) / xuất (PXK) nhiều dòng + danh sách phiếu.
 *
 * DEEP-LINK từ các màn nghiệp vụ (plan-kho-redesign GĐ1):
 * `?new=receipt|issue|return` mở sẵn form; `&po=`+`&shipment=` chọn sẵn đơn/đợt
 * cho phiếu nhập, `&lsx=` chọn sẵn lệnh cho phiếu xuất — Kho không phải dò lại
 * trong dropdown thứ mà màn trước đã biết.
 */
export default async function WarehouseDocsPage({
  searchParams,
}: {
  searchParams: Promise<{
    new?: string
    po?: string
    shipment?: string
    lsx?: string
    kind?: string
    page?: string
  }>
}) {
  const user = await authService.requirePageUser()
  const sp = await searchParams
  const initialForm =
    sp.new === 'receipt' || sp.new === 'issue' || sp.new === 'return' ? sp.new : null
  // Deep-link lọc loại phiếu (0157: dashboard trỏ thẳng vào tab Kiểm kê chờ duyệt).
  const initialKind = ['receipt', 'issue', 'transfer', 'stocktake'].includes(
    sp.kind ?? '',
  )
    ? (sp.kind as 'receipt' | 'issue' | 'transfer' | 'stocktake')
    : null
  /*
   * Quyền THẬT (`warehouse.stock.write` — memberEdit) thay vì role: bản cũ
   * `admin || (manager && isWh)` giấu nút lập phiếu với NHÂN VIÊN Kho, trong
   * khi warehouse_staff được seed đủ warehouse.edit và API vẫn cho ghi. Server
   * enforce lại trong service — đây chỉ là ẩn/hiện nút.
   */
  const canEdit =
    user.role === 'admin' || (await canAction(user, 'warehouse.stock.write'))

  // Phân trang + lọc loại Ở SERVER: sổ vượt 100 phiếu là bản cũ âm thầm cắt đuôi.
  const page = Math.max(1, Number(sp.page) || 1)
  const [{ rows: docs, total }, kindCounts, { rows: materials }, pos, { rows: lsxAll }] =
    await Promise.all([
      stockService.listDocs(user, {
        kind: initialKind ?? undefined,
        page,
        page_size: 50,
      }),
      docsRepo.countByKind(),
      materialsRepo.list({ active_only: true, page: 1, page_size: 1000 }),
      supplyRepo.listOpenPos(),
      productionRepo.list({ page: 1, page_size: 200 }),
    ])

  return (
    <DocsManager
      initial={
        initialForm
          ? {
              form: initialForm,
              poId: sp.po ?? null,
              shipmentId: sp.shipment ?? null,
              lsxId: sp.lsx ?? null,
            }
          : null
      }
      initialKind={initialKind}
      docs={docs}
      total={total}
      page={page}
      kindCounts={kindCounts}
      materials={materials.map((m) => ({
        id: m.id,
        code: m.code,
        name: m.name,
        unit: m.unit,
        barcode: m.barcode,
        shelf_location: m.shelf_location,
      }))}
      pos={pos}
      lsxs={lsxAll
        // Chỉ LSX xuất vật tư được: đã duyệt / đang SX (service cũng guard).
        .filter((l) => l.status === 'approved' || l.status === 'in_progress')
        .map((l) => ({ id: l.id, code: l.code, customer_name: l.customer_name }))}
      canEdit={canEdit}
    />
  )
}
