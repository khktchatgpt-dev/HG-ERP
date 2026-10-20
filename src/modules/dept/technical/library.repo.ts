/**
 * THƯ VIỆN SẢN PHẨM — truy vấn cho màn danh sách `/products` (08/10/2026).
 *
 * Tách khỏi `technical.repo.ts` (1.250 dòng) vì đây là những phép đọc GOM CẢ
 * THƯ VIỆN để đếm chip và chấm checklist hồ sơ, không phải CRUD một SP.
 *
 * Vì sao đọc cả thư viện thay vì đếm bằng HEAD count: checklist 6 ô cần biết
 * SP nào có dòng định mức / phương án đóng gói / mẫu / nằm trên lệnh — toàn
 * thứ nằm ở bảng KHÁC, PostgREST không `NOT EXISTS` được. Đọc một lần các cột
 * hẹp rồi tính ở app thì chip và dòng ra từ cùng một tập dữ liệu (nguyên tắc
 * 3). Thư viện đang 144 SP (08/10, sau khi rút gọn); 800 SP × 15 cột vẫn dưới
 * 100 kB — rẻ hơn 24 lượt gọi ảnh của một trang.
 *
 * Mọi hàm trả về cho MỌI SP (kể cả ngừng dùng); người gọi tự lọc.
 */

import { db } from '@/server/db'

export type LibFlagRow = {
  id: string
  code: string
  is_active: boolean
  customer_name: string | null
  product_type: string | null
  frame_material: string | null
  bom_status: 'none' | 'drawing' | 'done'
  length_mm: number | null
  width_mm: number | null
  height_mm: number | null
  image_file_id: string | null
  /**
   * Giá kế hoạch (0220) — bí mật của Bán hàng. Đọc ở đây để ĐẾM "chưa có giá"
   * và bày cột Giá KH; `library.service` xoá hai trường này khỏi dòng trả về
   * khi người xem không có `technical.plan_cost.view`.
   */
  plan_price: number | null
  plan_currency: string | null
  showroom_sample: boolean
  /** `packing->>carton_l_cm` — jsonb đóng gói cũ có kích thước thùng không. */
  carton_l_cm: string | null
  /** `packing->>loading_40hc` — số xếp cont ở jsonb cũ (bù khi chưa có phương án thật). */
  loading_40hc: string | null
}

/** Supabase trả tối đa 1.000 dòng/lượt — kéo theo trang cho tới hết. */
async function allPages<T>(
  build: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build(from, from + 999)
    if (error) throw new Error(error.message)
    out.push(...(data ?? []))
    if (!data || data.length < 1000) return out
  }
}

export const libraryRepo = {
  async flagRows(): Promise<LibFlagRow[]> {
    return allPages<LibFlagRow>(
      (from, to) =>
        db()
          .from('technical_products')
          .select(
            'id, code, is_active, customer_name, product_type, frame_material, bom_status, length_mm, width_mm, height_mm, image_file_id, plan_price, plan_currency, showroom_sample, carton_l_cm:packing->>carton_l_cm, loading_40hc:packing->>loading_40hc',
          )
          .order('code')
          .range(from, to) as unknown as PromiseLike<{
          data: LibFlagRow[] | null
          error: { message: string } | null
        }>,
    )
  },

  /** Số dòng định mức theo SP — ô BOM của checklist + cột "Định mức". */
  async partsCountByProduct(): Promise<Map<string, number>> {
    const rows = await allPages<{ product_id: string }>((from, to) =>
      db().from('technical_product_parts').select('product_id').range(from, to),
    )
    const m = new Map<string, number>()
    for (const r of rows) m.set(r.product_id, (m.get(r.product_id) ?? 0) + 1)
    return m
  },

  /**
   * Phương án đóng gói theo SP: số phương án + số xếp cont 40HC của phương án
   * mặc định (không có mặc định thì `option_no` nhỏ nhất) — cùng thứ tự ưu
   * tiên với `packingLoadingByProducts` của trang chi tiết.
   */
  async packingByProduct(): Promise<
    Map<string, { options: number; loading: number | null }>
  > {
    const rows = await allPages<{
      product_id: string
      loading_40hc: number | null
      is_default: boolean
      option_no: number
    }>((from, to) =>
      db()
        .from('technical_packing_options')
        .select('product_id, loading_40hc, is_default, option_no')
        .order('option_no')
        .range(from, to),
    )
    const m = new Map<string, { options: number; loading: number | null; def: boolean }>()
    for (const r of rows) {
      const cur = m.get(r.product_id)
      if (!cur)
        m.set(r.product_id, { options: 1, loading: r.loading_40hc, def: r.is_default })
      else {
        cur.options++
        if (r.is_default && !cur.def) {
          cur.loading = r.loading_40hc
          cur.def = true
        }
      }
    }
    return new Map(
      [...m].map(([k, v]) => [k, { options: v.options, loading: v.loading }]),
    )
  },

  /** SP có hiện vật mẫu chưa thanh lý. */
  async sampleProductIds(): Promise<Set<string>> {
    const rows = await allPages<{ product_id: string | null }>((from, to) =>
      db()
        .from('technical_samples')
        .select('product_id')
        .neq('status', 'disposed')
        .not('product_id', 'is', null)
        .range(from, to),
    )
    return new Set(rows.map((r) => r.product_id!).filter(Boolean))
  },

  /**
   * Lệnh SX theo SP: `open` = lệnh chưa xong (không completed/cancelled/rejected),
   * `total` = mọi lệnh từng ghi SP này. Đếm theo LỆNH, không theo dòng — một
   * lệnh chia nhiều đợt xuất là nhiều dòng cùng SP.
   */
  async lsxByProduct(): Promise<Map<string, { open: number; total: number }>> {
    type R = {
      product_id: string | null
      production_order_id: string
      production_orders: { status: string } | null
    }
    const rows = await allPages<R>(
      (from, to) =>
        db()
          .from('production_order_lines')
          .select('product_id, production_order_id, production_orders!inner(status)')
          .not('product_id', 'is', null)
          .range(from, to) as unknown as PromiseLike<{
          data: R[] | null
          error: { message: string } | null
        }>,
    )
    const seen = new Map<string, Map<string, boolean>>()
    for (const r of rows) {
      if (!r.product_id) continue
      const per = seen.get(r.product_id) ?? new Map<string, boolean>()
      const st = r.production_orders?.status ?? ''
      per.set(r.production_order_id, !['completed', 'cancelled', 'rejected'].includes(st))
      seen.set(r.product_id, per)
    }
    const out = new Map<string, { open: number; total: number }>()
    for (const [pid, per] of seen) {
      let open = 0
      for (const isOpen of per.values()) if (isOpen) open++
      out.set(pid, { open, total: per.size })
    }
    return out
  },

  /** Món của các BỘ đang hiện trên trang — để bày hàng con thụt lề dưới bộ. */
  async setItemsByProducts(setIds: string[]): Promise<
    {
      set_product_id: string
      item_product_id: string | null
      item_label: string
      qty: number
    }[]
  > {
    if (setIds.length === 0) return []
    const { data, error } = await db()
      .from('technical_product_set_items')
      .select('set_product_id, item_product_id, item_label, qty, sort_order')
      .in('set_product_id', setIds)
      .order('sort_order')
    if (error) throw new Error(error.message)
    return (data ?? []).map((r) => ({
      set_product_id: r.set_product_id,
      item_product_id: r.item_product_id,
      item_label: r.item_label,
      qty: Number(r.qty),
    }))
  },
}
