import { db } from '@/server/db'
import type { Product, ProductPart } from './technical.repo'

/**
 * LỊCH SỬ PHIÊN BẢN HỒ SƠ SP (0143).
 *
 * Không có thao tác riêng để "tạo phiên bản": bản mới sinh ra ở đúng nhịp KHOÁ
 * hồ sơ (0140), dòng mở khoá là vết đi kèm. Xem `productsService.lock/unlock`.
 */

export type ProductRevision = {
  id: string
  product_id: string
  rev: number
  /** 'status' = chuyển trạng thái hồ sơ (0145) — không chốt bản mới. */
  action: 'lock' | 'unlock' | 'status'
  reason: string | null
  changed_fields: string[]
  fields_snapshot: Record<string, unknown>
  parts_snapshot: unknown[]
  created_at: string
  created_by: string | null
}

/**
 * Thuộc tính ĐƯA VÀO ẢNH CHỤP — cố ý KHÔNG chụp cả dòng: cột kiểm soát
 * (locked_*, sample_*, updated_at, search_text) đổi ở mọi nhịp khoá nên chụp
 * vào thì diff lần nào cũng báo "có đổi" mà chẳng nói được gì.
 */
const SNAPSHOT_FIELDS = [
  'code',
  'name',
  'name_foreign',
  'description_en',
  'category',
  'product_type',
  'frame_material',
  'customer_name',
  'customer_item_code',
  'unit',
  'material',
  'base_material',
  'length_mm',
  'width_mm',
  'height_mm',
  'length_open_mm',
  'width_open_mm',
  'height_open_mm',
  'net_weight_kg',
  'frame_weight_kg',
  'actual_weight_kg',
  'frame_length_m',
  'paint_area_m2',
  'paint_coverage_m2_per_kg',
  'part_count',
  'max_load_kg',
  'assembly',
  'set_contents',
  'is_upholstered',
  'has_glass',
  'is_set',
  'hs_code',
  'origin_country',
  'barcode',
  'shipping_mark',
  'packing',
  'tech_spec',
  'bom_rev',
  'bom_status',
  'bom_file_id',
] as const

/** Ảnh chụp thuộc tính hồ sơ tại một thời điểm. */
export function snapshotFields(p: Product): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const k of SNAPSHOT_FIELDS) out[k] = (p as unknown as Record<string, unknown>)[k]
  return out
}

/**
 * Trường đã đổi so với bản chốt trước. So bằng JSON để `packing`/`tech_spec`
 * (jsonb) cũng bắt được; `parts` là một khoá ảo nói "bảng định mức có đổi".
 */
export function diffFields(
  before: Record<string, unknown> | null,
  after: Record<string, unknown>,
  partsChanged: boolean,
): string[] {
  const out: string[] = []
  if (before) {
    for (const k of Object.keys(after)) {
      if (JSON.stringify(before[k] ?? null) !== JSON.stringify(after[k] ?? null)) {
        out.push(k)
      }
    }
  }
  if (partsChanged) out.push('parts')
  return out
}

/**
 * Định mức rút gọn để chụp — giữ đúng những gì cần để sau này đối chiếu "lệnh
 * đó chạy theo định mức nào", không chụp cả 40 cột hình học.
 */
export function snapshotParts(parts: ProductPart[]): unknown[] {
  return parts.map((p) => ({
    part_no: p.part_no,
    part_name: p.part_name,
    group_code: p.group_code,
    material_code: p.material_code,
    qty: p.qty,
    unit: p.unit,
    weight_kg: p.weight_kg,
  }))
}

export const productRevisionsRepo = {
  async list(productId: string): Promise<ProductRevision[]> {
    const { data, error } = await db()
      .from('technical_product_revisions')
      .select('*')
      .eq('product_id', productId)
      .order('rev', { ascending: false })
      .order('created_at', { ascending: false })
    if (error) throw new Error(error.message)
    return (data ?? []) as unknown as ProductRevision[]
  },

  /** Số bản lớn nhất đã chốt (0 = chưa chốt lần nào). */
  async maxRev(productId: string): Promise<number> {
    const { data, error } = await db()
      .from('technical_product_revisions')
      .select('rev')
      .eq('product_id', productId)
      .order('rev', { ascending: false })
      .limit(1)
    if (error) throw new Error(error.message)
    return data?.[0]?.rev ?? 0
  },

  /** Ảnh chụp của bản chốt gần nhất — nguồn để tính danh sách trường đã đổi. */
  async lastLockSnapshot(productId: string): Promise<{
    fields: Record<string, unknown>
    parts: unknown[]
  } | null> {
    const { data, error } = await db()
      .from('technical_product_revisions')
      .select('fields_snapshot, parts_snapshot')
      .eq('product_id', productId)
      .eq('action', 'lock')
      .order('rev', { ascending: false })
      .limit(1)
    if (error) throw new Error(error.message)
    const row = data?.[0]
    if (!row) return null
    return {
      fields: (row.fields_snapshot ?? {}) as Record<string, unknown>,
      parts: (row.parts_snapshot ?? []) as unknown[],
    }
  },

  async insert(row: {
    product_id: string
    rev: number
    action: 'lock' | 'unlock' | 'status'
    reason: string | null
    changed_fields?: string[]
    fields_snapshot?: Record<string, unknown>
    parts_snapshot?: unknown[]
    created_by: string | null
  }): Promise<void> {
    const { error } = await db()
      .from('technical_product_revisions')
      .insert({
        product_id: row.product_id,
        rev: row.rev,
        action: row.action,
        reason: row.reason,
        changed_fields: row.changed_fields ?? [],
        fields_snapshot: (row.fields_snapshot ?? {}) as never,
        parts_snapshot: (row.parts_snapshot ?? []) as never,
        created_by: row.created_by,
      })
    if (error) throw new Error(error.message)
  },
}
