import { earliestExpectedDate, shipmentStatusesFromReceipts } from '@/lib/po-shipments'
import { posRepo } from './pos.repo'
import { poShipmentsRepo } from './po-shipments.repo'
import { supplyRepo } from './supply.repo'

/**
 * ĐỒNG BỘ ĐỢT GIAO + HẸN GIAO CỦA ĐƠN THEO SỔ KHO (27/09/2026).
 *
 * Gọi sau MỌI thứ làm đổi số đã nhận của đơn: phiếu nhập, phiếu trả NCC, đảo
 * phiếu. Hai việc:
 *   1. trạng thái từng đợt tính lại từ số nhận CỘNG DỒN
 *      (`shipmentStatusesFromReceipts`) — đợt nhận bằng hai phiếu đóng được,
 *      nhận dư đợt 1 tự lấp đợt 2;
 *   2. `expected_at` của đơn = đợt còn sống sớm nhất — nhận xong đợt 1 thì
 *      mốc nhảy sang đợt 2. Bản cũ để nguyên ngày đợt đã nhận, đơn đang chạy
 *      đúng hẹn vẫn bị tô "trễ".
 * Không còn đợt sống thì giữ mốc cũ (đừng xoá hẹn của đơn).
 */
export async function syncShipmentsFromReceipts(poId: string): Promise<void> {
  const [ships, lines, linked] = await Promise.all([
    poShipmentsRepo.listByPo(poId),
    supplyRepo.lineStatus(poId),
    supplyRepo.receiptsByShipment(poId),
  ])
  if (ships.length === 0) return
  const received = new Map(lines.map((l) => [l.id, Number(l.qty_received ?? 0)]))
  const changes = shipmentStatusesFromReceipts(ships, received, linked)
  for (const [id, status] of changes) await poShipmentsRepo.patch(id, { status })
  await syncPoExpectedAt(
    poId,
    ships.map((s) => ({ ...s, status: changes.get(s.id) ?? s.status })),
  )
}

/** `expected_at` của đơn = ngày đợt CÒN SỐNG sớm nhất; hết đợt sống thì giữ mốc cũ. */
export async function syncPoExpectedAt(
  poId: string,
  ships?: { expected_date: string; status: string }[],
): Promise<void> {
  const list = ships ?? (await poShipmentsRepo.listByPo(poId))
  const minDate = earliestExpectedDate(list)
  if (minDate) await posRepo.patch(poId, { expected_at: minDate })
}
