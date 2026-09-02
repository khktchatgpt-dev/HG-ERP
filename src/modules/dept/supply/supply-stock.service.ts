/**
 * KHO & TỒN — GÓC NHÌN NGƯỜI MUA (02/09/2026).
 *
 * Trước đây `/planning/stock` chỉ `export default` lại nguyên màn Tồn kho của
 * Kho. Màn đó trả lời câu của THỦ KHO ("còn bao nhiêu, nằm kệ nào") nên người
 * mua đọc xong vẫn phải mở thêm 2-3 chỗ mới quyết được: đã đặt mã này chưa,
 * bao giờ về, lần trước mua của ai giá nào. Service này gom đúng bộ số đó về
 * MỘT dòng.
 *
 * BA ĐIỂM THIẾT KẾ, đều rút từ dữ liệu thật của kho (đo 02/09/2026):
 *
 * 1. KHÔNG dựng màn quanh "mua bù tồn theo ngưỡng". Chỉ 5/13.174 vật tư có
 *    `reorder_point`/`min_stock` > 0 — dựng vậy thì màn rỗng quanh năm. Ngưỡng
 *    vẫn hiện trên dòng nào có khai, nhưng TRỤC CHÍNH của màn là "đang có đơn
 *    chưa về" (số thật, có ngay hôm nay) + tra cứu một mã bất kỳ.
 *
 * 2. Lọc và phân trang Ở SERVER, đi qua `materialsRepo.list`. Bản cũ select
 *    thẳng `warehouse_stock` không phân trang nên dính trần 1.000 dòng của
 *    PostgREST: trang nạp 1.000 mã đầu theo alphabet (7,6% danh mục) trong khi
 *    CẢ 5 mã đang có tồn đều mang tiền tố "VT-" — nằm ngoài. Hệ quả là màn tồn
 *    kho không bao giờ hiện nổi một mã có tồn, mà KPI vẫn ghi "ĐANG CÓ TỒN 0"
 *    như thể đó là sự thật của cả kho.
 *
 * 3. KPI đếm bằng `count` ở SQL, không cộng từ mảng đã nạp — cùng lý do
 *    `materialsRepo.counts` đã phải làm vậy: cộng từ trang đang xem thì con số
 *    là của trang đó, mà nhãn thì không nói gì.
 */

import { Forbidden } from '@/server/http'
import { db } from '@/server/db'
import type { User } from '@/modules/core/users/users.repo'
import { materialsRepo } from '@/modules/dept/warehouse/warehouse.repo'
import { stockInfoMany } from '@/modules/dept/warehouse/stock.repo'
import { reservedByCommittedLsx } from '@/modules/dept/warehouse/stock.service'
import { canAction } from '@/modules/core/rbac/rbac.service'
import { supplyRepo, suppliersRepo } from './supply.repo'
import { isSupplyStaff } from './suppliers.service'
import { deriveBuyerFigures, sortForBuyer } from './supply-stock.calc'

/** Một dòng như người mua cần đọc: tồn — đang về — mua lần trước. */
export type SupplyStockRow = {
  material_id: string
  code: string
  name: string
  unit: string
  group_name: string | null
  /** Tồn sổ hiện tại (tổng nhập đạt − tổng xuất). */
  on_hand: number
  /** Giữ chỗ cho LSX đã cam kết. */
  reserved: number
  /** on_hand − reserved. Âm = đã thiếu cho lệnh đang chạy. */
  available: number
  /** Đã đặt còn phải về (PO đã duyệt, qty_open). */
  ordered: number
  /** Đang chờ Giám đốc duyệt — CHƯA chắc chắn, không cộng vào vị thế. */
  pending: number
  /** available + ordered — số thật sự sẽ có trong tay. */
  position: number
  /** Ngày về sớm nhất trong các đơn còn mở (ISO), null = chưa hẹn/không có đơn. */
  eta: string | null
  po_code: string | null
  po_id: string | null
  po_count: number
  /** Ngưỡng bù tồn nếu Kho có khai (reorder_point ưu tiên, sau đó min_stock). */
  threshold: number
  /** max(threshold − position, 0) — chỉ có nghĩa khi threshold > 0. */
  shortage: number
  last_purchase_price: number | null
  supplier_name: string | null
}

export type SupplyStockFilter =
  /** Đang có đơn chưa về — mặc định, việc đang chạy của người mua. */
  | 'incoming'
  /** Có tồn > 0. */
  | 'in_stock'
  /** Dưới ngưỡng bù tồn (chỉ mã đã khai ngưỡng). */
  | 'low'
  /** Âm khả dụng — đã hứa cho LSX nhiều hơn số đang có. */
  | 'short'
  | 'all'

export type SupplyStockCounts = {
  materials: number
  incoming: number
  in_stock: number
  low: number
  /** Mã đã hứa cho LSX nhiều hơn số đang có — việc gấp nhất của người mua. */
  short: number
  ordered_value: number | null
}

async function assertCanView(user: User): Promise<void> {
  if (user.role === 'admin') return
  if (await isSupplyStaff(user)) return
  // Kho/các phòng xem được danh mục thì cũng xem được tồn của nó — cùng mức
  // với `/warehouse/stock` hôm nay (canViewWarehouse trả true cho mọi NV).
  if (await canAction(user, 'warehouse.material.view')) return
  throw Forbidden('Chỉ Cung ứng và Kho xem được tồn kho')
}

/**
 * Đếm cho hàng thẻ số — mỗi con số một truy vấn `head: true` nên không kéo dòng
 * nào về. Hai số KHÔNG hỏi SQL được: `incoming` (nằm ở bảng đơn) và `short`
 * (phụ thuộc giữ chỗ LSX tính trong bộ nhớ); cả hai đếm theo VẬT TƯ vì một mã
 * nằm trên nhiều đơn/nhiều lệnh vẫn là một mã phải lo.
 */
async function countAll(
  incomingIds: Set<string>,
  reserved: Map<string, number>,
): Promise<SupplyStockCounts> {
  const [materials, inStock, low] = await Promise.all([
    db()
      .from('warehouse_materials')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true),
    db()
      .from('warehouse_stock')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true)
      .gt('on_hand', 0),
    db()
      .from('warehouse_stock')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true)
      .eq('is_low', true),
  ])

  // Thiếu cho LSX: chỉ mã CÓ giữ chỗ mới có thể âm khả dụng, nên tra tồn đúng
  // tập đó thay vì quét cả kho.
  const reservedIds = [...reserved.keys()]
  const stock = await stockInfoMany(reservedIds)
  const onHand = new Map(stock.map((s) => [s.material_id, s.on_hand]))
  const short = reservedIds.filter(
    (id) => (onHand.get(id) ?? 0) - (reserved.get(id) ?? 0) < 0,
  ).length

  return {
    materials: materials.count ?? 0,
    incoming: incomingIds.size,
    in_stock: inStock.count ?? 0,
    low: low.count ?? 0,
    short,
    ordered_value: null,
  }
}

/**
 * Mã có tồn / dưới ngưỡng — LỌC Ở SQL rồi mới lấy id, vì cả hai điều kiện đều
 * là cột của view `warehouse_stock` (`is_low` do 0160 tính sẵn). Trần 1.000 id
 * ở đây là có ý: quá ngần ấy mã dưới ngưỡng thì danh sách không còn là việc
 * làm trong ngày nữa, người mua phải lọc theo nhóm.
 */
async function stockIds(kind: 'in_stock' | 'low'): Promise<string[]> {
  let q = db().from('warehouse_stock').select('material_id').eq('is_active', true)
  q = kind === 'in_stock' ? q.gt('on_hand', 0) : q.eq('is_low', true)
  const { data } = await q.limit(1000)
  return ((data as { material_id: string }[] | null) ?? []).map((r) => r.material_id)
}

/**
 * Danh sách + KPI cho màn Kho & tồn của Cung ứng.
 *
 * Bộ lọc `incoming`/`short` KHÔNG thể lọc ở SQL (một bên nằm ở bảng đơn, một
 * bên phụ thuộc giữ chỗ LSX tính trong bộ nhớ) nên đường đi là: dựng tập
 * material_id đủ điều kiện TRƯỚC, rồi mới hỏi danh mục theo đúng tập đó. Ngược
 * lại — nạp một trang danh mục rồi lọc — là lọt lưới y như bản cũ.
 */
export async function listSupplyStock(
  user: User,
  opts: {
    q?: string
    group_name?: string
    filter?: SupplyStockFilter
    page?: number
    page_size?: number
  },
): Promise<{
  rows: SupplyStockRow[]
  total: number
  counts: SupplyStockCounts
}> {
  await assertCanView(user)
  const filter = opts.filter ?? 'incoming'
  const page = opts.page ?? 1
  const pageSize = opts.page_size ?? 25

  const [orderInfo, reserved] = await Promise.all([
    supplyRepo.openOrderInfoByMaterial(),
    reservedByCommittedLsx(),
  ])
  const incomingIds = new Set(
    [...orderInfo.entries()]
      .filter(([, v]) => v.ordered > 0 || v.pending > 0)
      .map(([id]) => id),
  )

  /*
   * TẬP ỨNG VIÊN DỰNG TRƯỚC, rồi mới hỏi danh mục theo đúng tập đó.
   *
   * Lọc SAU khi phân trang là bẫy đã làm hỏng bản cũ: nạp 25 mã đầu theo
   * alphabet (ACQ…) rồi lọc `on_hand > 0` thì ra rỗng, trong khi KPI đếm ở SQL
   * vẫn nói có 3 mã — màn tự mâu thuẫn với chính nó. `undefined` = không giới
   * hạn, để SQL của danh mục phân trang trên toàn bộ 13k mã.
   */
  let ids: string[] | undefined
  if (filter === 'incoming') ids = [...incomingIds]
  else if (filter === 'short') ids = [...reserved.keys()]
  else if (filter === 'in_stock' || filter === 'low') ids = await stockIds(filter)

  const { rows: mats, total } = await materialsRepo.list({
    active_only: true,
    q: opts.q,
    group_name: opts.group_name,
    page: ids ? 1 : page,
    // Tập ứng viên đã nhỏ (đơn đang mở / mã có giữ chỗ) nên lấy hết rồi cắt
    // trang trong bộ nhớ; danh mục đầy đủ thì để SQL cắt.
    page_size: ids ? 1000 : pageSize,
    ...(ids ? { ids } : {}),
  })

  const stock = await stockInfoMany(mats.map((m) => m.id))
  const onHand = new Map(stock.map((s) => [s.material_id, s.on_hand]))

  const supplierIds = [
    ...new Set(mats.map((m) => m.default_supplier_id).filter((v): v is string => !!v)),
  ]
  const supplierName = await suppliersRepo.namesByIds(supplierIds)

  let rows: SupplyStockRow[] = mats.map((m) => {
    const oh = onHand.get(m.id) ?? 0
    const res = reserved.get(m.id) ?? 0
    const info = orderInfo.get(m.id)
    const ordered = info?.ordered ?? 0
    const { available, position, threshold, shortage } = deriveBuyerFigures({
      on_hand: oh,
      reserved: res,
      ordered,
      min_stock: m.min_stock,
      reorder_point: m.reorder_point,
    })
    return {
      material_id: m.id,
      code: m.code,
      name: m.name,
      unit: m.unit,
      group_name: m.group_name,
      on_hand: oh,
      reserved: res,
      available,
      ordered,
      pending: info?.pending ?? 0,
      position,
      eta: info?.eta ?? null,
      po_code: info?.po_code ?? null,
      po_id: info?.po_id ?? null,
      po_count: info?.po_count ?? 0,
      threshold,
      shortage,
      last_purchase_price: m.last_purchase_price,
      supplier_name: m.default_supplier_id
        ? (supplierName.get(m.default_supplier_id) ?? null)
        : null,
    }
  })

  if (filter === 'in_stock') rows = rows.filter((r) => r.on_hand > 0)
  else if (filter === 'low') rows = rows.filter((r) => r.threshold > 0 && r.shortage > 0)
  else if (filter === 'short') rows = rows.filter((r) => r.available < 0)

  rows.sort(sortForBuyer)

  const counts = await countAll(incomingIds, reserved)
  /*
   * CẮT TRANG ĐÚNG MỘT LẦN. Đường `ids` lấy cả tập rồi lọc/sắp trong bộ nhớ
   * nên phải tự cắt; đường "Toàn danh mục" đã được SQL cắt sẵn — cắt thêm lần
   * nữa là từ trang 2 trở đi bảng rỗng trong khi thanh phân trang vẫn ghi
   * 13.174 mã.
   */
  if (!ids) return { rows, total, counts }
  const from = (page - 1) * pageSize
  return { rows: rows.slice(from, from + pageSize), total: rows.length, counts }
}
