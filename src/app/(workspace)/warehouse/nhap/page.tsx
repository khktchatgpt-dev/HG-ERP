import { authService } from '@/modules/core/auth/auth.service'
import { canAction } from '@/modules/core/rbac/rbac.service'
import { poShipmentsRepo } from '@/modules/dept/supply/po-shipments.repo'
import { RECEIVABLE, supplyRepo } from '@/modules/dept/supply/supply.repo'
import { todayVn } from '@/lib/date-vn'
import type { HangVeRow } from '@/lib/kho-hang-ve'
import { HangVeScreen } from './HangVeScreen'

export const metadata = { title: 'Kho · Hàng về' }
export const dynamic = 'force-dynamic'

/** Trần của hai hàm nguồn — chạm trần thì màn phải nói, không im lặng cắt đuôi. */
const TRAN_DOT = 300
const TRAN_DON = 200

/**
 * HÀNG VỀ — cửa vào của khu Kho (Bước 1, `docs/kho-buoc-1-nhap-kho.md`).
 *
 * Câu màn trả lời: "xe nào đang tới, cái nào trễ?" — trục là THỜI GIAN.
 *
 * KHÔNG VIẾT TRUY VẤN MỚI. Hai nguồn là đúng hai hàm màn Nhận hàng của Mua
 * hàng và trang Kho cũ đã dùng: `poShipmentsRepo.listOpen` (đợt giao đã hẹn,
 * planned/arrived) + `supplyRepo.listOpenPos` (đơn đã gửi NCC). Kho và Cung
 * ứng vì thế không thể đếm khác nhau.
 *
 * Một dòng = một lần xe tới: đơn có đợt thì mỗi đợt một dòng; đơn chưa khai
 * đợt vẫn là một dòng (xếp làn theo hẹn giao của ĐƠN, không có thì "Chưa hẹn
 * ngày"). Tiến độ "về x/y dòng" là của cả ĐƠN (0126) — Kho nhận từng mã một,
 * đó mới là câu nói được điều gì còn thiếu.
 */
export default async function WarehouseInboundPage() {
  const user = await authService.requirePageUser()
  const today = todayVn()

  const [shipmentsAll, openPos, canEdit] = await Promise.all([
    poShipmentsRepo.listOpen(),
    supplyRepo.listOpenPos(),
    user.role === 'admin'
      ? Promise.resolve(true)
      : canAction(user, 'warehouse.stock.write'),
  ])

  /*
    Chỉ đợt giao của đơn CÒN NHẬN ĐƯỢC. `listOpen` chỉ loại đơn huỷ, nên đợt
    `planned` của một đơn đã "Về đủ" vẫn lọt — đo 16/09/2026: đơn 02/26HG/BT
    về đủ mà 4 đợt còn planned, hiện thành 3 dòng "quá hẹn" mà bấm vào thì
    form từ chối. Cùng luật với màn Nhận hàng của Mua hàng (`isIncoming`).
  */
  const shipments = shipmentsAll.filter((s) =>
    (RECEIVABLE as readonly string[]).includes(s.po_status),
  )
  const poById = new Map(openPos.map((p) => [p.id, p]))
  const poIds = Array.from(
    new Set([...shipments.map((s) => s.po_id), ...openPos.map((p) => p.id)]),
  )
  const [lineDone, codes] = await Promise.all([
    supplyRepo.lineDoneByPoIds(poIds),
    poShipmentsRepo.codesByShipmentIds(shipments.map((s) => s.id)),
  ])

  const rows: HangVeRow[] = shipments.map((s) => {
    const po = poById.get(s.po_id)
    const ld = lineDone.get(s.po_id)
    return {
      key: s.id,
      po_id: s.po_id,
      po_code: s.po_code,
      supplier_name: s.supplier_name,
      lsx_code: po?.lsx_code ?? null,
      shipment_id: s.id,
      seq: s.seq,
      arrived: s.status === 'arrived',
      date: s.expected_date.slice(0, 10),
      line_count: s.line_count,
      total_qty: s.total_qty,
      lines_done: ld?.done ?? 0,
      lines_total: ld?.total ?? 0,
      codes: codes.get(s.id) ?? [],
    }
  })
  const coDot = new Set(shipments.map((s) => s.po_id))
  for (const p of openPos) {
    if (coDot.has(p.id)) continue
    const ld = lineDone.get(p.id)
    rows.push({
      key: p.id,
      po_id: p.id,
      po_code: p.code,
      supplier_name: p.supplier_name,
      lsx_code: p.lsx_code,
      shipment_id: null,
      seq: null,
      arrived: false,
      date: p.expected_at ? p.expected_at.slice(0, 10) : null,
      line_count: null,
      total_qty: null,
      lines_done: ld?.done ?? 0,
      lines_total: ld?.total ?? 0,
    })
  }

  const truncated =
    shipmentsAll.length >= TRAN_DOT || openPos.length >= TRAN_DON
      ? { dot: TRAN_DOT, don: TRAN_DON }
      : null

  return (
    <HangVeScreen rows={rows} today={today} canEdit={canEdit} truncated={truncated} />
  )
}
