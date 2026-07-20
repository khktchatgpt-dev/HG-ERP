import { db } from '@/server/db'

export type DefectCode = {
  id: string
  code: string
  label: string
  /** null = áp dụng mọi công đoạn. */
  stage_code: string | null
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}

const COLS = 'id, code, label, stage_code, sort_order, is_active, created_at, updated_at'

/** Danh mục nguyên nhân lỗi SX (0067) — sổ lưu CODE, sửa label không đổi dữ liệu cũ. */
export const defectCodesRepo = {
  async listActive(): Promise<DefectCode[]> {
    const { data } = await db()
      .from('production_defect_codes')
      .select(COLS)
      .eq('is_active', true)
      .order('sort_order')
      .order('label')
    return (data ?? []) as DefectCode[]
  },

  async listAll(): Promise<DefectCode[]> {
    const { data } = await db()
      .from('production_defect_codes')
      .select(COLS)
      .order('sort_order')
      .order('label')
    return (data ?? []) as DefectCode[]
  },

  async findById(id: string): Promise<DefectCode | null> {
    const { data } = await db()
      .from('production_defect_codes')
      .select(COLS)
      .eq('id', id)
      .maybeSingle()
    return (data as DefectCode | null) ?? null
  },

  /** duplicate = code đã tồn tại (unique 23505). */
  async insert(row: {
    code: string
    label: string
    stage_code: string | null
    sort_order: number
  }): Promise<{ item: DefectCode | null; duplicate: boolean }> {
    const { data, error } = await db()
      .from('production_defect_codes')
      .insert(row)
      .select(COLS)
      .single()
    if (error) {
      if (error.code === '23505') return { item: null, duplicate: true }
      throw new Error(error.message)
    }
    return { item: data as DefectCode, duplicate: false }
  },

  async update(
    id: string,
    patch: Partial<{
      label: string
      stage_code: string | null
      sort_order: number
      is_active: boolean
    }>,
  ): Promise<DefectCode> {
    const { data, error } = await db()
      .from('production_defect_codes')
      .update(patch)
      .eq('id', id)
      .select(COLS)
      .single()
    if (error || !data) throw new Error(error?.message ?? 'Update defect code failed')
    return data as DefectCode
  },
}
