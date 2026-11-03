import { db } from '@/server/db'
import type { Json } from '@/lib/database.types'
import type {
  StageMetaInput,
  StageFieldInput,
  DefectCodeInput,
} from './stage-config.schema'

/**
 * Data access cho CẤU HÌNH CÔNG ĐOẠN (B1, 0287). Bốn bảng đã có, không bảng
 * mới: catalog_items (meta) · departments (stage_code) · production_stage_fields
 * · production_defect_codes. Cộng một đếm phiếu PBS theo công đoạn để màn nói
 * "đổi cấu hình có chạm sổ cũ không".
 */

export type StageRow = {
  id: string
  code: string
  label: string
  sort_order: number
  is_active: boolean
  meta: unknown
}

export type TeamRow = { id: string; name: string; stage_code: string | null }

export type StageFieldRow = {
  id: string
  stage_code: string
  field_key: string
  label: string
  kind: 'text' | 'number' | 'select'
  options: string[] | null
  required: boolean
  min_value: number | null
  max_value: number | null
  sort_order: number
  is_active: boolean
}

export type DefectCodeRow = {
  id: string
  code: string
  label: string
  stage_code: string | null
  sort_order: number
  is_active: boolean
}

const numOrNull = (v: unknown) => (v == null ? null : Number(v))

export const stageConfigRepo = {
  /** Mọi công đoạn, kể cả đã ngừng dùng (màn cấu hình cần thấy để bật lại). */
  async listStagesAll(): Promise<StageRow[]> {
    const { data } = await db()
      .from('catalog_items')
      .select('id, code, label, sort_order, is_active, meta')
      .eq('type', 'production_stage')
      .order('sort_order')
    return (data ?? []) as StageRow[]
  },

  async findStage(code: string): Promise<StageRow | null> {
    const { data } = await db()
      .from('catalog_items')
      .select('id, code, label, sort_order, is_active, meta')
      .eq('type', 'production_stage')
      .eq('code', code)
      .maybeSingle()
    return (data as StageRow | null) ?? null
  },

  async updateStage(
    code: string,
    patch: { label?: string; meta?: StageMetaInput; is_active?: boolean },
  ): Promise<void> {
    const row: { label?: string; is_active?: boolean; meta?: Json } = {}
    if (patch.label !== undefined) row.label = patch.label
    if (patch.is_active !== undefined) row.is_active = patch.is_active
    if (patch.meta !== undefined) row.meta = patch.meta as unknown as Json
    if (Object.keys(row).length === 0) return
    const { error } = await db()
      .from('catalog_items')
      .update(row)
      .eq('type', 'production_stage')
      .eq('code', code)
    if (error) throw new Error(error.message)
  },

  /** Thêm công đoạn; trả `null` khi mã đã có (người gọi báo trùng). */
  async createStage(input: {
    code: string
    label: string
    sort_order: number
    meta: StageMetaInput
  }): Promise<StageRow | null> {
    const { data, error } = await db()
      .from('catalog_items')
      .insert({
        type: 'production_stage',
        code: input.code,
        label: input.label,
        sort_order: input.sort_order,
        meta: input.meta as unknown as Json,
      })
      .select('id, code, label, sort_order, is_active, meta')
      .single()
    if (error) {
      if (error.code === '23505') return null
      throw new Error(error.message)
    }
    return data as StageRow
  },

  /** Tổ xưởng = phòng ban thuộc workspace production. */
  async listTeams(): Promise<TeamRow[]> {
    const { data } = await db()
      .from('departments')
      .select('id, name, stage_code')
      .eq('workspace_id', 'production')
      .order('name')
    return (data ?? []) as TeamRow[]
  },

  /** Gán tổ ↔ công đoạn: tổ trong danh sách nhận mã, tổ đang mang mã mà rời danh sách thì bỏ. */
  async setTeams(code: string, teamIds: string[]): Promise<void> {
    const current = (await this.listTeams()).filter((t) => t.stage_code === code)
    const drop = current.filter((t) => !teamIds.includes(t.id)).map((t) => t.id)
    if (drop.length) {
      const { error } = await db()
        .from('departments')
        .update({ stage_code: null })
        .in('id', drop)
      if (error) throw new Error(error.message)
    }
    if (teamIds.length) {
      const { error } = await db()
        .from('departments')
        .update({ stage_code: code })
        .in('id', teamIds)
        .eq('workspace_id', 'production')
      if (error) throw new Error(error.message)
    }
  },

  async listFieldsAll(): Promise<StageFieldRow[]> {
    const { data } = await db()
      .from('production_stage_fields')
      .select(
        'id, stage_code, field_key, label, kind, options, required, min_value, max_value, sort_order, is_active',
      )
      .order('stage_code')
      .order('sort_order')
    return ((data as Record<string, unknown>[] | null) ?? []).map((r) => ({
      ...(r as unknown as StageFieldRow),
      options: Array.isArray(r.options) ? (r.options as string[]) : null,
      min_value: numOrNull(r.min_value),
      max_value: numOrNull(r.max_value),
    }))
  },

  /**
   * Thay trọn bộ ô riêng của một công đoạn: upsert theo (stage_code,
   * field_key); ô của công đoạn không còn trong danh sách → ngừng dùng (giữ
   * dòng vì sổ cũ còn giá trị theo khoá đó).
   */
  async replaceFields(code: string, rows: StageFieldInput[]): Promise<void> {
    const keep = rows.map((r) => r.field_key)
    const all = (await this.listFieldsAll()).filter((f) => f.stage_code === code)
    const off = all.filter((f) => !keep.includes(f.field_key)).map((f) => f.id)
    if (off.length) {
      const { error } = await db()
        .from('production_stage_fields')
        .update({ is_active: false })
        .in('id', off)
      if (error) throw new Error(error.message)
    }
    if (rows.length) {
      const { error } = await db()
        .from('production_stage_fields')
        .upsert(
          rows.map((r, i) => ({
            stage_code: code,
            field_key: r.field_key,
            label: r.label,
            kind: r.kind,
            options: r.kind === 'select' ? ((r.options ?? []) as unknown as Json) : null,
            required: r.required,
            min_value: r.kind === 'number' ? (r.min_value ?? null) : null,
            max_value: r.kind === 'number' ? (r.max_value ?? null) : null,
            sort_order: r.sort_order || (i + 1) * 10,
            is_active: true,
          })),
          { onConflict: 'stage_code,field_key' },
        )
      if (error) throw new Error(error.message)
    }
  },

  async listDefectCodesAll(): Promise<DefectCodeRow[]> {
    const { data } = await db()
      .from('production_defect_codes')
      .select('id, code, label, stage_code, sort_order, is_active')
      .order('sort_order')
    return (data ?? []) as DefectCodeRow[]
  },

  /**
   * Thay trọn bộ mã lỗi RIÊNG của một công đoạn (mã dùng chung stage_code null
   * không chạm). Mã rời danh sách → ngừng dùng, không xoá.
   */
  async replaceDefectCodes(code: string, rows: DefectCodeInput[]): Promise<void> {
    const keep = rows.map((r) => r.code)
    const mine = (await this.listDefectCodesAll()).filter((d) => d.stage_code === code)
    const off = mine.filter((d) => !keep.includes(d.code)).map((d) => d.id)
    if (off.length) {
      const { error } = await db()
        .from('production_defect_codes')
        .update({ is_active: false })
        .in('id', off)
      if (error) throw new Error(error.message)
    }
    if (rows.length) {
      const { error } = await db()
        .from('production_defect_codes')
        .upsert(
          rows.map((r, i) => ({
            code: r.code,
            label: r.label,
            stage_code: code,
            sort_order: r.sort_order || (i + 1) * 10,
            is_active: true,
          })),
          { onConflict: 'code' },
        )
      if (error) throw new Error(error.message)
    }
  },

  /** Số phiếu PBS theo công đoạn — để màn nói đổi cấu hình có chạm sổ cũ không. */
  async docCountByStage(): Promise<Record<string, number>> {
    const out: Record<string, number> = {}
    for (let from = 0; ; from += 1000) {
      const { data } = await db()
        .from('production_entry_docs')
        .select('stage')
        .range(from, from + 999)
      const rows = (data ?? []) as { stage: string }[]
      for (const r of rows) out[r.stage] = (out[r.stage] ?? 0) + 1
      if (rows.length < 1000) break
    }
    return out
  },
}
