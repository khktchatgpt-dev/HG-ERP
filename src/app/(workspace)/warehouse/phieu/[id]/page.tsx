import { notFound } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { canAction } from '@/modules/core/rbac/rbac.service'
import { stockService } from '@/modules/dept/warehouse/stock.service'
import { suyMaTuLichSu } from '@/lib/kho-ma-ly-do'
import { canDao } from '@/lib/kho-dao-phieu'
import { PhieuChiTietScreen } from './PhieuChiTietScreen'

export const metadata = { title: 'Kho · Chi tiết phiếu' }
export const dynamic = 'force-dynamic'

/**
 * CHI TIẾT MỘT PHIẾU KHO — Khuôn D.
 *
 * Lý do tồn tại không phải "xem lại cho đẹp" mà là chỗ ĐẢO PHIẾU: tới
 * 16/09/2026 thủ kho ghi nhầm thì không có đường sửa nào trong khu Kho —
 * `reverseDoc` đã chạy được từ 0161 nhưng nút gọi nó nằm ở màn Cung ứng.
 *
 * Điều kiện đảo được TÍNH Ở SERVER (`canDao`, thuần + có test) rồi truyền
 * xuống, vì luật chặn nằm trong service: bày nút rồi để service ném lỗi là
 * đúng lối mòn "cho bấm rồi mới báo" mà luật kiểm của /design-lab cấm.
 */
export default async function PhieuChiTietPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await authService.requirePageUser()
  const { id } = await params

  const detail = await stockService.docDetail(user, id).catch(() => null)
  if (!detail) notFound()
  const { doc, lines, stocktake_lines, reversed_by } = detail

  const canEdit =
    user.role === 'admin' ? true : await canAction(user, 'warehouse.stock.write')

  return (
    <PhieuChiTietScreen
      doc={{
        id: doc.id,
        code: doc.code,
        kind: doc.kind,
        doc_date: doc.doc_date,
        counterparty: doc.counterparty,
        reason: doc.reason,
        note: doc.note,
        status: doc.status,
        supplier_doc_no: doc.supplier_doc_no,
        reversal_of_code: doc.reversal_of_code,
        created_by_name: doc.created_by_name,
        created_at: doc.created_at,
        approved_by_name: doc.approved_by_name,
        approved_at: doc.approved_at,
        reject_reason: doc.reject_reason,
      }}
      lines={lines.map((l) => ({
        id: l.id,
        material_code: l.material_code,
        material_name: l.material_name,
        material_unit: l.material_unit,
        direction: l.direction,
        qty: l.qty,
        qty_rejected: l.qty_rejected,
        qty_ordered: l.qty_ordered,
        shelf_location: l.shelf_location,
        note: l.note,
        // Dòng trước 0197 không mang mã — suy lại tại chỗ ĐỌC, không ghi đè
        // lịch sử (cùng luật với sổ phiếu).
        ma_ly_do: l.reason_code ?? suyMaTuLichSu(l.ref_type, l.direction),
      }))}
      soDongKiemKe={stocktake_lines.length}
      reversedBy={reversed_by}
      dao={canDao({
        kind: doc.kind,
        status: doc.status,
        laPhieuDao: doc.reversal_of_code != null,
        daBiDaoBoi: reversed_by?.code ?? null,
        coHangLoai: lines.some((l) => (l.qty_rejected ?? 0) > 0),
        soDong: lines.length,
      })}
      canEdit={canEdit}
    />
  )
}
