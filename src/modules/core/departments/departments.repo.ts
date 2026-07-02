import { db } from '@/server/db'

export type Department = {
  id: string
  name: string
  description: string | null
  head_user_id: string | null
  created_at: string
  updated_at: string
}

export const departmentsRepo = {
  async list(): Promise<Department[]> {
    const { data } = await db()
      .from('departments')
      .select('id, name, description, head_user_id, created_at, updated_at')
      .order('name')
    return (data ?? []) as Department[]
  },

  async findById(id: string): Promise<Department | null> {
    const { data } = await db()
      .from('departments')
      .select('id, name, description, head_user_id, created_at, updated_at')
      .eq('id', id)
      .maybeSingle()
    return (data as Department | null) ?? null
  },

  async insert(row: { name: string; description?: string }): Promise<Department> {
    const { data, error } = await db()
      .from('departments')
      .insert(row)
      .select('id, name, description, head_user_id, created_at, updated_at')
      .single()
    if (error || !data) throw new Error(error?.message ?? 'Insert failed')
    return data as Department
  },

  async update(
    id: string,
    patch: { name?: string; description?: string | null; head_user_id?: string | null },
  ): Promise<Department> {
    const { data, error } = await db()
      .from('departments')
      .update(patch)
      .eq('id', id)
      .select('id, name, description, head_user_id, created_at, updated_at')
      .single()
    if (error || !data) throw new Error(error?.message ?? 'Update failed')
    return data as Department
  },

  async delete(id: string): Promise<void> {
    const { error } = await db().from('departments').delete().eq('id', id)
    if (error) throw new Error(error.message)
  },

  async count(): Promise<number> {
    const { count } = await db()
      .from('departments')
      .select('id', { count: 'exact', head: true })
    return count ?? 0
  },

  /** Returns each department's id → number of active members. */
  async memberCounts(): Promise<Record<string, number>> {
    const { data } = await db()
      .from('users')
      .select('department_id')
      .eq('is_active', true)
      .not('department_id', 'is', null)

    const counts: Record<string, number> = {}
    for (const row of (data ?? []) as { department_id: string }[]) {
      counts[row.department_id] = (counts[row.department_id] ?? 0) + 1
    }
    return counts
  },

  /** Department this user heads (if any). */
  async findHeadedBy(userId: string): Promise<Department | null> {
    const { data } = await db()
      .from('departments')
      .select('id, name, description, head_user_id, created_at, updated_at')
      .eq('head_user_id', userId)
      .maybeSingle()
    return (data as Department | null) ?? null
  },
}
