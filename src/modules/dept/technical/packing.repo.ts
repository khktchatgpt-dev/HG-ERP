/**
 * Ghi PHƯƠNG ÁN ĐÓNG GÓI + KIỆN. Đọc thì vẫn `productProfileRepo.packingOptions`
 * (1 query lồng) — ở đây chỉ có đường ghi.
 */

import { db } from '@/server/db'
import type {
  PackageInput,
  PackingOptionInput,
  PackingOptionUpdate,
} from './packing.schema'

async function replacePackages(
  optionId: string,
  packages: PackageInput[],
): Promise<void> {
  const { error: delErr } = await db()
    .from('technical_packages')
    .delete()
    .eq('option_id', optionId)
  if (delErr) throw new Error(delErr.message)
  if (packages.length === 0) return
  const { error } = await db()
    .from('technical_packages')
    .insert(packages.map((p, i) => ({ ...p, option_id: optionId, sort_order: i + 1 })))
  if (error) throw new Error(error.message)
}

export const packingRepo = {
  async findOption(productId: string, optionId: string) {
    const { data, error } = await db()
      .from('technical_packing_options')
      .select('id, product_id, option_no, is_default')
      .eq('id', optionId)
      .eq('product_id', productId)
      .maybeSingle()
    if (error) throw new Error(error.message)
    return data
  },

  /** Tạo phương án với `option_no` kế tiếp; phương án đầu tiên tự là mặc định. */
  async create(productId: string, input: PackingOptionInput): Promise<string> {
    const { data: last } = await db()
      .from('technical_packing_options')
      .select('option_no')
      .eq('product_id', productId)
      .order('option_no', { ascending: false })
      .limit(1)
      .maybeSingle()
    const optionNo = (last?.option_no ?? 0) + 1
    const isDefault = input.is_default ?? optionNo === 1
    if (isDefault) await this.clearDefault(productId)
    const { packages, ...fields } = input
    const { data, error } = await db()
      .from('technical_packing_options')
      .insert({
        product_id: productId,
        option_no: optionNo,
        label: fields.label ?? null,
        cartons_per_set: fields.cartons_per_set ?? null,
        loading_40hc: fields.loading_40hc ?? null,
        note: fields.note ?? null,
        is_default: isDefault,
      })
      .select('id')
      .single()
    if (error || !data) throw new Error(error?.message ?? 'Tạo phương án thất bại')
    if (packages) await replacePackages(data.id, packages)
    return data.id
  },

  async update(
    productId: string,
    optionId: string,
    patch: PackingOptionUpdate,
  ): Promise<void> {
    const { packages, is_default, ...fields } = patch
    if (is_default) await this.clearDefault(productId)
    const row: {
      label?: string | null
      cartons_per_set?: number | null
      loading_40hc?: number | null
      note?: string | null
      is_default?: boolean
    } = {}
    if ('label' in fields) row.label = fields.label ?? null
    if ('cartons_per_set' in fields) row.cartons_per_set = fields.cartons_per_set ?? null
    if ('loading_40hc' in fields) row.loading_40hc = fields.loading_40hc ?? null
    if ('note' in fields) row.note = fields.note ?? null
    if (is_default != null) row.is_default = is_default
    if (Object.keys(row).length) {
      const { error } = await db()
        .from('technical_packing_options')
        .update(row)
        .eq('id', optionId)
        .eq('product_id', productId)
      if (error) throw new Error(error.message)
    }
    if (packages) await replacePackages(optionId, packages)
  },

  async clearDefault(productId: string): Promise<void> {
    const { error } = await db()
      .from('technical_packing_options')
      .update({ is_default: false })
      .eq('product_id', productId)
      .eq('is_default', true)
    if (error) throw new Error(error.message)
  },

  /** Xoá phương án (kiện xoá theo FK cascade). Trả về true nếu có dòng bị xoá. */
  async remove(productId: string, optionId: string): Promise<boolean> {
    const { error, count } = await db()
      .from('technical_packing_options')
      .delete({ count: 'exact' })
      .eq('id', optionId)
      .eq('product_id', productId)
    if (error) throw new Error(error.message)
    return (count ?? 0) > 0
  },

  /** Sau khi xoá phương án mặc định: phương án `option_no` nhỏ nhất lên làm mặc định. */
  async ensureDefault(productId: string): Promise<void> {
    const { data } = await db()
      .from('technical_packing_options')
      .select('id, is_default')
      .eq('product_id', productId)
      .order('option_no')
    if (!data?.length || data.some((o) => o.is_default)) return
    const { error } = await db()
      .from('technical_packing_options')
      .update({ is_default: true })
      .eq('id', data[0].id)
    if (error) throw new Error(error.message)
  },
}
