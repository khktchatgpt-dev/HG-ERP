import { assertAction } from '@/modules/core/rbac/rbac.service'
import type { User } from '@/modules/core/users/users.repo'
import { BadRequest, NotFound } from '@/server/http'
import { todayVn } from '@/lib/date-vn'
import { isOpenTrip, tripStatus, type TripStatus } from '@/lib/chuyen-hang'
import { tripsRepo, type TripRow } from './trips.repo'
import type { TripInput } from './trips.schema'

/**
 * CHUYẾN HÀNG (0216, 01/10/2026) — hàng đã rời NCC, đang trên xe nào, bao giờ
 * về kho. KHÔNG MANG TIỀN: phí vận chuyển ghi riêng (`po-costs`).
 *
 * Quyền ghi: `supply.po.manage` (nhân viên Cung ứng). Không gác theo người phụ
 * trách từng đơn: một chuyến chở đơn của nhiều người mua, ai nhận ảnh biên nhận
 * trước thì ghi.
 *
 * Trạng thái ĐƠN MUA không đổi khi ghi chuyến — vòng đời đơn vẫn do phiếu nhập
 * quyết. Chuyến tự "đã về kho" khi mọi đơn trong nó có phiếu nhập (lib).
 */

/** Đơn đang về — nhận vào chuyến MỚI. Đơn đã về đủ / chưa gửi thì không. */
const EN_ROUTE = new Set(['ordered', 'confirmed', 'in_transit', 'partial'])

/** Chuyến gửi quá 60 ngày không còn hiện — đủ dài cho một chuyến chành trễ. */
const LOOKBACK_DAYS = 60

export type TripView = TripRow & {
  status: TripStatus
  pos: { id: string; code: string; status: string; supplier_name: string }[]
}

function addDays(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

async function assertPos(poIds: string[], keep: string[] = []): Promise<void> {
  const brief = await tripsRepo.posBrief(poIds)
  const missing = poIds.filter((id) => !brief.has(id))
  if (missing.length) throw BadRequest('Có đơn không tồn tại trong chuyến')
  const bad = poIds
    .filter((id) => !keep.includes(id))
    .map((id) => brief.get(id)!)
    .filter((p) => !EN_ROUTE.has(p.status))
  if (bad.length)
    throw BadRequest(
      `${bad.map((p) => p.code).join(', ')} không phải đơn đang về (chưa gửi NCC hoặc đã về đủ) — không đưa vào chuyến mới được`,
    )
}

export const tripsService = {
  /** Chuyến gửi trong 60 ngày, kèm đơn và trạng thái suy ra. `openOnly` = chỉ chuyến còn theo dõi. */
  async list(_user: User, opts: { openOnly?: boolean } = {}): Promise<TripView[]> {
    const trips = await tripsRepo.listSince(addDays(todayVn(), -LOOKBACK_DAYS))
    const links = await tripsRepo.posOf(trips.map((t) => t.id))
    const poIds = [...new Set(links.map((l) => l.po_id))]
    const [brief, lastIn] = await Promise.all([
      tripsRepo.posBrief(poIds),
      tripsRepo.lastReceiptByPoIds(poIds),
    ])
    const views = trips.map((t) => {
      const pos = links
        .filter((l) => l.trip_id === t.id)
        .map((l) => brief.get(l.po_id))
        .filter((p): p is NonNullable<typeof p> => !!p)
      const status = tripStatus(
        t,
        pos.map((p) => ({ status: p.status, last_receipt_on: lastIn.get(p.id) ?? null })),
      )
      return { ...t, status, pos }
    })
    return opts.openOnly ? views.filter((v) => isOpenTrip(v.status)) : views
  },

  async create(user: User, input: TripInput): Promise<TripRow> {
    await assertAction(user, 'supply.po.manage')
    await assertPos(input.po_ids)
    const { po_ids, ...fields } = input
    return tripsRepo.insert(
      {
        ...fields,
        carrier_id: fields.carrier_id ?? null,
        eta: fields.eta ?? null,
        packages: fields.packages ?? null,
        weight_kg: fields.weight_kg ?? null,
        code: await tripsRepo.nextCode(),
        created_by: user.id,
      },
      po_ids,
    )
  },

  async update(user: User, id: string, input: TripInput): Promise<TripRow> {
    await assertAction(user, 'supply.po.manage')
    const before = await tripsRepo.findById(id)
    if (!before) throw NotFound('Chuyến hàng không tồn tại')
    if (before.cancelled_at) throw BadRequest('Chuyến đã huỷ — không sửa được')
    // Đơn đã có sẵn trong chuyến được giữ dù nay đã về đủ; chỉ đơn THÊM mới phải đang về.
    const current = (await tripsRepo.posOf([id])).map((r) => r.po_id)
    await assertPos(input.po_ids, current)
    const { po_ids, ...fields } = input
    return tripsRepo.update(
      id,
      {
        ...fields,
        carrier_id: fields.carrier_id ?? null,
        eta: fields.eta ?? null,
        packages: fields.packages ?? null,
        weight_kg: fields.weight_kg ?? null,
      },
      po_ids,
    )
  },

  async cancel(user: User, id: string, reason: string): Promise<void> {
    await assertAction(user, 'supply.po.manage')
    const before = await tripsRepo.findById(id)
    if (!before) throw NotFound('Chuyến hàng không tồn tại')
    if (before.cancelled_at) throw BadRequest('Chuyến đã huỷ trước đó')
    await tripsRepo.cancel(id, user.id, reason)
  },
}
