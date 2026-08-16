import { authService } from '@/modules/core/auth/auth.service'
import { canAction } from '@/modules/core/rbac/rbac.service'
import { supplyRepo } from '@/modules/dept/supply/supply.repo'
import { poShipmentsRepo } from '@/modules/dept/supply/po-shipments.repo'
import { DonNccScreen } from './DonNccScreen'

/**
 * ĐƠN ĐẶT NCC — GÓC NHÌN CỦA KHO (yêu cầu chủ dự án 16/08/2026).
 *
 * `/warehouse/nhap` xếp theo NGÀY (hôm nay nhận gì); trang này xếp theo ĐƠN:
 * Kho tra "đơn này gồm dòng nào, về tới đâu, còn chờ bao nhiêu, đợt nào sắp
 * tới" để chuẩn bị mặt bằng/nhân lực, và lập PHIẾU NHẬP NHANH đúng đơn/đợt.
 * Tìm được theo LSX — chuẩn bị vật tư cho một lệnh là gõ mã lệnh ra hết đơn.
 *
 * Kho KHÔNG quản đơn (phân tách người mua ≠ người nhận) — mọi nút ở đây chỉ
 * NHẬN hàng hoặc XEM; sửa đơn vẫn là việc của Cung ứng bên /planning/pos.
 */
export default async function WarehousePoPage({
  searchParams,
}: {
  searchParams: Promise<{ lsx?: string }>
}) {
  const user = await authService.requirePageUser()
  const sp = await searchParams
  const canEdit =
    user.role === 'admin' || (await canAction(user, 'warehouse.stock.write'))

  const pos = await supplyRepo.listOpenPos()
  const [lineDone, openShipments, extraLsx] = await Promise.all([
    supplyRepo.lineDoneByPoIds(pos.map((p) => p.id)),
    poShipmentsRepo.listOpen(),
    // Đơn mua chung (0125): nhóm theo LSX phải thấy đơn ở MỌI lệnh nó phục vụ.
    supplyRepo.extraLsxCodesByPoIds(pos.map((p) => p.id)),
  ])

  // Đợt CÒN SỐNG sớm nhất + cờ "xe đã tới" theo đơn — nhìn lướt là biết độ gấp.
  const nextShipment = new Map<
    string,
    { date: string; seq: number; id: string; arrived: boolean }
  >()
  for (const s of openShipments) {
    const cur = nextShipment.get(s.po_id)
    if (!cur || s.expected_date < cur.date) {
      nextShipment.set(s.po_id, {
        date: s.expected_date,
        seq: s.seq,
        id: s.id,
        arrived: s.status === 'arrived',
      })
    } else if (s.status === 'arrived') {
      cur.arrived = true
    }
  }

  return (
    <DonNccScreen
      pos={pos.map((p) => {
        const done = lineDone.get(p.id)
        const next = nextShipment.get(p.id)
        return {
          ...p,
          lsx_codes: [...(p.lsx_code ? [p.lsx_code] : []), ...(extraLsx.get(p.id) ?? [])],
          lines_done: done?.done ?? 0,
          lines_total: done?.total ?? 0,
          next_shipment: next ?? null,
        }
      })}
      initialQ={sp.lsx ?? ''}
      canEdit={canEdit}
    />
  )
}
