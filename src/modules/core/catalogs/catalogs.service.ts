import { db } from '@/server/db'
import type { CatalogType } from './catalogs.schema'
import type { User } from '@/modules/core/users/users.repo'
import { Conflict, Forbidden, NotFound } from '@/server/http'

export type CatalogItem = {
  id: string
  type: CatalogType
  code: string
  label: string
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}

const COLS = 'id, type, code, label, sort_order, is_active, created_at, updated_at'

/** Danh mục dùng chung là cấu hình hệ thống — chỉ admin sửa (FR-ADM-04). */
function assertAdmin(user: User): void {
  if (user.role !== 'admin')
    throw Forbidden('Chỉ quản trị viên sửa được danh mục dùng chung')
}

export const catalogsService = {
  /** Đọc: mọi NV (dropdown ĐVT/nhóm/giai đoạn dùng khắp nơi). */
  async list(_user: User, type?: CatalogType): Promise<CatalogItem[]> {
    let q = db().from('catalog_items').select(COLS).order('type').order('sort_order')
    if (type) q = q.eq('type', type)
    const { data } = await q
    return (data ?? []) as CatalogItem[]
  },

  async create(
    user: User,
    input: { type: CatalogType; code: string; label: string; sort_order: number },
  ): Promise<CatalogItem> {
    assertAdmin(user)
    const { data, error } = await db()
      .from('catalog_items')
      .insert(input)
      .select(COLS)
      .single()
    if (error) {
      if (error.code === '23505') {
        throw Conflict(`Code "${input.code}" đã tồn tại trong loại này`, 'CODE_TAKEN')
      }
      throw new Error(error.message)
    }
    return data as CatalogItem
  },

  /** Chỉ label/sort/active — type + code bất biến vì nghiệp vụ tham chiếu bằng code. */
  async update(
    user: User,
    id: string,
    patch: { label?: string; sort_order?: number; is_active?: boolean },
  ): Promise<CatalogItem> {
    assertAdmin(user)
    const { data, error } = await db()
      .from('catalog_items')
      .update(patch)
      .eq('id', id)
      .select(COLS)
      .maybeSingle()
    if (error) throw new Error(error.message)
    if (!data) throw NotFound('Mục danh mục không tồn tại')
    return data as CatalogItem
  },
}
