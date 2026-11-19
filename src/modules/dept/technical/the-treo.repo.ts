import { db } from '@/server/db'

/** Cột hồ sơ SP mà thẻ treo cần — không kéo cả hồ sơ. */
const COLS =
  'id, code, name, description_en, frame_material, length_mm, width_mm, height_mm, tech_spec, customer_name, customer_item_code, image_file_id, showroom_zone, showroom_sample, showroom_tagged_at, packing, net_weight_kg, origin_country'

export type TheRow = {
  id: string
  code: string
  name: string
  description_en: string | null
  frame_material: string | null
  length_mm: number | null
  width_mm: number | null
  height_mm: number | null
  tech_spec: Record<string, unknown> | null
  customer_name: string | null
  customer_item_code: string | null
  image_file_id: string | null
  showroom_zone: string | null
  showroom_sample: boolean
  showroom_tagged_at: string | null
  packing: Record<string, unknown> | null
  net_weight_kg: number | null
  origin_country: string | null
}

/** `.in()` đi trên URL — chia lô để không vượt trần độ dài URL của PostgREST. */
const LO = 200
const lo = <T>(a: T[]) =>
  Array.from({ length: Math.ceil(a.length / LO) }, (_, i) =>
    a.slice(i * LO, (i + 1) * LO),
  )

export const theTreoRepo = {
  async listByIds(ids: string[]): Promise<TheRow[]> {
    const out: TheRow[] = []
    for (const part of lo(ids)) {
      const { data, error } = await db()
        .from('technical_products')
        .select(COLS)
        .in('id', part)
      if (error) throw error
      out.push(...((data ?? []) as unknown as TheRow[]))
    }
    return out
  },

  /**
   * Đánh dấu đã treo thẻ cho nhiều SP một lượt. Chỉ chạm dòng CHƯA treo — không
   * ghi đè ngày treo cũ. Treo thẻ ⇒ có mẫu (cùng luật `productsService.setShowroom`).
   * Trả id các dòng vừa ghi.
   */
  async setTaggedMany(ids: string[], at: string): Promise<string[]> {
    const done: string[] = []
    for (const part of lo(ids)) {
      const { data, error } = await db()
        .from('technical_products')
        .update({ showroom_sample: true, showroom_tagged_at: at })
        .in('id', part)
        .is('showroom_tagged_at', null)
        .select('id')
      if (error) throw error
      done.push(...((data ?? []) as { id: string }[]).map((r) => r.id))
    }
    return done
  },
}
