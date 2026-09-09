import { db } from '@/server/db'
import type { BalanceRow } from './balance.calc'

/**
 * ĐỌC SỔ CÂN ĐỐI VẬT TƯ.
 *
 * Toàn bộ phép cân đối nằm ở view `v_supply_balance` (migration 0187), không ở
 * đây. Lý do: cùng một phép trừ phải dùng được cho màn hình, cho file Excel và
 * cho badge trên nav — làm ở DB thì cả ba đọc chung một nguồn, làm ở TypeScript
 * thì mỗi nơi gọi một kiểu và sớm muộn lệch nhau.
 *
 * View đã lọc sẵn lệnh `draft`/`cancelled` và chỉ giữ mã có `material_code`
 * trong định mức. Repo này chỉ còn việc phân trang, lọc và ép kiểu số.
 */

/** Postgres trả `numeric` về dưới dạng chuỗi qua PostgREST — ép một chỗ. */
const num = (v: unknown): number => (v == null ? 0 : Number(v))

export type BalanceQuery = {
  /** Tìm theo mã hoặc tên vật tư. */
  q?: string
  /** Chỉ lấy dòng còn thiếu. Mặc định `true` — đó là câu hỏi của màn. */
  short_only?: boolean
  page?: number
  page_size?: number
}

export const balanceRepo = {
  /**
   * Danh sách cân đối, một dòng mỗi mã vật tư.
   *
   * KHÔNG có trần ngầm: `page_size` phải truyền rõ. Bản `/planning/pos` cũ để
   * trần 300 im lặng và khi vượt thì mất đơn mà không ai biết — cùng loại bẫy.
   */
  async list(q: BalanceQuery = {}): Promise<{ rows: BalanceRow[]; total: number }> {
    const page = Math.max(1, q.page ?? 1)
    const size = Math.min(Math.max(1, q.page_size ?? 200), 1000)
    const from = (page - 1) * size

    let query = db()
      .from('v_supply_balance')
      .select('*', { count: 'exact' })
      // Hạn sớm lên trước; mã CHƯA CÓ HẠN xuống cuối chứ không lẫn lên đầu —
      // null trong Postgres sắp trước theo mặc định ở `asc`, và nếu để vậy thì
      // 3 mã không hạn sẽ chiếm mất chỗ của mã đang trễ thật.
      .order('need_by', { ascending: true, nullsFirst: false })
      .order('qty_short', { ascending: false })

    if (q.short_only !== false) query = query.gt('qty_short', 0)
    if (q.q?.trim()) {
      const term = `%${q.q.trim()}%`
      query = query.or(`material_code.ilike.${term},material_name.ilike.${term}`)
    }

    const { data, error, count } = await query.range(from, from + size - 1)
    if (error) throw error

    return {
      rows: (data ?? []).map(toRow),
      total: count ?? 0,
    }
  },

  /**
   * Nhu cầu của MỘT mã, tách theo lệnh sản xuất.
   *
   * Dùng cho hộp thoại "đề nghị mua": người mua cần thấy mã này thiếu cho
   * những lệnh nào trước khi quyết gộp hay tách đơn.
   */
  async demandByMaterial(materialCode: string) {
    const { data, error } = await db()
      .from('v_supply_demand')
      .select('production_order_id, lsx_code, qty_needed, need_by')
      .eq('material_code', materialCode.trim().toUpperCase())
      .order('need_by', { ascending: true, nullsFirst: false })
    if (error) throw error
    return (data ?? []).map((d) => ({
      production_order_id: d.production_order_id ?? '',
      lsx_code: d.lsx_code ?? '',
      qty_needed: num(d.qty_needed),
      need_by: d.need_by,
    }))
  },
}

function toRow(d: Record<string, unknown>): BalanceRow {
  return {
    material_code: (d.material_code as string | null) ?? '',
    material_name: (d.material_name as string | null) ?? null,
    unit: (d.unit as string | null) ?? null,
    qty_needed: num(d.qty_needed),
    qty_on_hand: num(d.qty_on_hand),
    qty_incoming: num(d.qty_incoming),
    qty_drafted: num(d.qty_drafted),
    qty_short: num(d.qty_short),
    need_by: (d.need_by as string | null) ?? null,
    lsx_count: num(d.lsx_count),
    lsx_codes: (d.lsx_codes as string[] | null) ?? [],
  }
}

/**
 * VỊ TRÍ CỦA MỘT ĐƠN TRONG DANH SÁCH — cho điều hướng bản ghi ‹14 / 68›.
 *
 * Thứ web hầu như không có, nhưng người ERP dùng liên tục: mở một đơn rồi bấm
 * ‹ › duyệt hết cả tập mà không quay ra danh sách lần nào. Không có nó thì
 * duyệt 68 đơn là 68 lần vào–ra, và mỗi lần ra là mất chỗ đang đứng.
 *
 * Đếm bằng truy vấn `head` (không kéo dòng nào về) thay vì nạp cả danh sách
 * rồi tìm chỉ số: danh sách đơn có trần 1.000 dòng, mà vị trí thì chỉ cần hai
 * con số.
 */
export async function poPosition(
  poId: string,
): Promise<{ index: number; total: number } | null> {
  const cur = await db()
    .from('supply_purchase_orders')
    .select('created_at')
    .eq('id', poId)
    .single()
  if (cur.error || !cur.data?.created_at) return null

  const [{ count: total }, { count: after }] = await Promise.all([
    db().from('supply_purchase_orders').select('id', { count: 'exact', head: true }),
    // Danh sách xếp MỚI NHẤT TRƯỚC, nên số đơn mới hơn đơn này = số đứng trước.
    db()
      .from('supply_purchase_orders')
      .select('id', { count: 'exact', head: true })
      .gt('created_at', cur.data.created_at),
  ])
  return { index: (after ?? 0) + 1, total: total ?? 0 }
}
