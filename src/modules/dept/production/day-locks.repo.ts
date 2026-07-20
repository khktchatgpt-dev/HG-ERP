import { db } from '@/server/db'

export type DayLock = {
  id: string
  team_department_id: string
  entry_date: string
  locked_by: string | null
  locked_at: string
  team_name: string | null
  locked_by_name: string | null
}

const COLS = 'id, team_department_id, entry_date, locked_by, locked_at'
const SELECT_JOINED = `${COLS}, team:departments(name), actor:users(name)`

type Raw = Omit<DayLock, 'team_name' | 'locked_by_name'> & {
  team: { name: string } | { name: string }[] | null
  actor: { name: string | null } | { name: string | null }[] | null
}

function unwrap(rows: Raw[] | null): DayLock[] {
  return (rows ?? []).map((r) => {
    const t = Array.isArray(r.team) ? r.team[0] : r.team
    const a = Array.isArray(r.actor) ? r.actor[0] : r.actor
    return {
      ...r,
      team: undefined,
      actor: undefined,
      team_name: t?.name ?? null,
      locked_by_name: a?.name ?? null,
    } as unknown as DayLock
  })
}

/** Chốt sổ mềm theo tổ + ngày (0068) — tồn tại dòng = đã chốt. */
export const dayLocksRepo = {
  async find(teamId: string, date: string): Promise<DayLock | null> {
    const { data } = await db()
      .from('production_day_locks')
      .select(SELECT_JOINED)
      .eq('team_department_id', teamId)
      .eq('entry_date', date)
      .maybeSingle()
    if (!data) return null
    return unwrap([data as unknown as Raw])[0]
  },

  async listByDate(date: string): Promise<DayLock[]> {
    const { data } = await db()
      .from('production_day_locks')
      .select(SELECT_JOINED)
      .eq('entry_date', date)
    return unwrap(data as unknown as Raw[] | null)
  },

  /** duplicate = tổ đã chốt ngày này (unique 23505) — service trả Conflict. */
  async insert(row: {
    team_department_id: string
    entry_date: string
    locked_by: string
  }): Promise<{ lock: DayLock | null; duplicate: boolean }> {
    const { data, error } = await db()
      .from('production_day_locks')
      .insert(row)
      .select(SELECT_JOINED)
      .single()
    if (error) {
      if (error.code === '23505') return { lock: null, duplicate: true }
      throw new Error(error.message)
    }
    return { lock: unwrap([data as unknown as Raw])[0], duplicate: false }
  },

  async deleteByTeamDate(teamId: string, date: string): Promise<void> {
    const { error } = await db()
      .from('production_day_locks')
      .delete()
      .eq('team_department_id', teamId)
      .eq('entry_date', date)
    if (error) throw new Error(error.message)
  },
}
