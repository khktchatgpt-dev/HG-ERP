import { db } from '@/server/db'

/**
 * Dữ liệu cho quản lý NHÓM / NHÓM PHỤ vật tư (03/09/2026).
 *
 * Hai nguồn: nhóm CHÍNH là mục `catalog_items` (type material_group, label là
 * tên hiện trên vật tư); nhóm PHỤ chỉ là cột text `sub_group` trên từng vật tư
 * — không có bảng, nên "danh sách nhóm phụ" là distinct từ dữ liệu, và đếm mã
 * phải quét cả danh mục (PostgREST trần 1.000 dòng/lượt → phân trang như
 * `materialTaxonomy`).
 */
export type GroupItem = {
  id: string
  code: string
  label: string
  sort_order: number
  is_active: boolean
}

export type GroupCounts = Map<
  string,
  { total: number; noSub: number; subs: Map<string, number> }
>

const COLS = 'id, code, label, sort_order, is_active'

export const materialGroupsRepo = {
  async listItems(): Promise<GroupItem[]> {
    const { data, error } = await db()
      .from('catalog_items')
      .select(COLS)
      .eq('type', 'material_group')
      .order('sort_order')
      .order('label')
    if (error) throw new Error(error.message)
    return (data ?? []) as GroupItem[]
  },

  async findItem(id: string): Promise<GroupItem | null> {
    const { data } = await db()
      .from('catalog_items')
      .select(COLS)
      .eq('id', id)
      .eq('type', 'material_group')
      .maybeSingle()
    return (data as GroupItem | null) ?? null
  },

  /**
   * Đếm mã theo nhóm và nhóm phụ trên TOÀN danh mục đang dùng — 14 lượt 1.000
   * dòng. Chỉ chọn hai cột nên rẻ; đây là màn quản trị, không phải màn mở
   * liên tục.
   */
  async counts(): Promise<GroupCounts> {
    const out: GroupCounts = new Map()
    for (let from = 0; from < 60_000; from += 1000) {
      const { data, error } = await db()
        .from('warehouse_materials')
        .select('group_name, sub_group')
        .eq('is_active', true)
        .range(from, from + 999)
      if (error) throw new Error(error.message)
      const page = (data ?? []) as {
        group_name: string | null
        sub_group: string | null
      }[]
      for (const r of page) {
        const g = r.group_name ?? ''
        const e = out.get(g) ?? { total: 0, noSub: 0, subs: new Map<string, number>() }
        e.total++
        if (r.sub_group) e.subs.set(r.sub_group, (e.subs.get(r.sub_group) ?? 0) + 1)
        else e.noSub++
        out.set(g, e)
      }
      if (page.length < 1000) break
    }
    return out
  },

  /** Mã kế tiếp theo quy ước seed `g01…g14` — bỏ qua các mã chữ của nhóm cũ. */
  async nextCode(): Promise<string> {
    const items = await this.listItems()
    let max = 0
    for (const it of items) {
      const m = /^g(\d+)$/.exec(it.code)
      if (m) max = Math.max(max, Number(m[1]))
    }
    return `g${String(max + 1).padStart(2, '0')}`
  },

  async insertItem(row: {
    code: string
    label: string
    sort_order: number
  }): Promise<GroupItem> {
    const { data, error } = await db()
      .from('catalog_items')
      .insert({ type: 'material_group', ...row })
      .select(COLS)
      .single()
    if (error || !data) throw new Error(error?.message ?? 'Insert group failed')
    return data as GroupItem
  },

  async patchItem(
    id: string,
    patch: { label?: string; is_active?: boolean },
  ): Promise<GroupItem> {
    const { data, error } = await db()
      .from('catalog_items')
      .update(patch)
      .eq('id', id)
      .select(COLS)
      .single()
    if (error || !data) throw new Error(error?.message ?? 'Update group failed')
    return data as GroupItem
  },

  async deleteItem(id: string): Promise<void> {
    const { error } = await db().from('catalog_items').delete().eq('id', id)
    if (error) throw new Error(error.message)
  },

  /** Số mã (kể cả ngừng dùng) đang mang tên nhóm này — quyết định có xoá/ngừng được không. */
  async countByGroup(groupName: string): Promise<number> {
    const { count, error } = await db()
      .from('warehouse_materials')
      .select('*', { count: 'exact', head: true })
      .eq('group_name', groupName)
    if (error) throw new Error(error.message)
    return count ?? 0
  },

  /** Đổi tên nhóm trên mọi vật tư — một câu update, trả số mã đã đổi. */
  async renameGroupOnMaterials(from: string, to: string): Promise<number> {
    const { data, error } = await db()
      .from('warehouse_materials')
      .update({ group_name: to })
      .eq('group_name', from)
      .select('id')
    if (error) throw new Error(error.message)
    return data?.length ?? 0
  },

  /** Nhóm phụ: đổi tên (to đã có = gộp) hoặc xoá (to = null), trong một nhóm chính. */
  async setSubGroup(groupName: string, from: string, to: string | null): Promise<number> {
    const { data, error } = await db()
      .from('warehouse_materials')
      .update({ sub_group: to })
      .eq('group_name', groupName)
      .eq('sub_group', from)
      .select('id')
    if (error) throw new Error(error.message)
    return data?.length ?? 0
  },
}
