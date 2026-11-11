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

export type UnlockNote = {
  team_department_id: string
  entry_date: string
  reason: string | null
  actor_name: string | null
  created_at: string
}
type RawUnlock = Omit<UnlockNote, 'actor_name'> & {
  actor: { name: string | null } | { name: string | null }[] | null
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

  /** Khoá trong khoảng ngày — đối chiếu "ngày cũ có sổ mà chưa chốt". */
  async listRange(fromDate: string, toDate: string): Promise<DayLock[]> {
    const { data } = await db()
      .from('production_day_locks')
      .select(SELECT_JOINED)
      .gte('entry_date', fromDate)
      .lte('entry_date', toDate)
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

  /**
   * Nhật ký chốt / mở khoá (0295) — chỉ chèn. NUỐT LỖI: bảng chưa áp migration
   * thì việc chốt vẫn thành, chỉ thiếu vết (ghi warn để biết mà áp).
   */
  async log(row: {
    team_department_id: string
    entry_date: string
    action: 'lock' | 'unlock'
    reason: string | null
    actor_id: string
  }): Promise<void> {
    const { error } = await db().from('production_day_lock_log').insert(row)
    if (error) console.warn('[day-locks] không ghi được nhật ký:', error.message)
  },

  /** Lần mở khoá gần nhất của từng (tổ × ngày) trong khoảng — bày "mở lại: lý do". */
  async lastUnlocks(fromDate: string, toDate: string): Promise<UnlockNote[]> {
    const { data, error } = await db()
      .from('production_day_lock_log')
      .select('team_department_id, entry_date, reason, created_at, actor:users(name)')
      .eq('action', 'unlock')
      .gte('entry_date', fromDate)
      .lte('entry_date', toDate)
      .order('created_at', { ascending: false })
      .limit(500)
    if (error) return []
    const seen = new Set<string>()
    const out: UnlockNote[] = []
    for (const r of (data ?? []) as unknown as RawUnlock[]) {
      const k = `${r.team_department_id}|${r.entry_date}`
      if (seen.has(k)) continue
      seen.add(k)
      const a = Array.isArray(r.actor) ? r.actor[0] : r.actor
      out.push({
        team_department_id: r.team_department_id,
        entry_date: r.entry_date,
        reason: r.reason,
        actor_name: a?.name ?? null,
        created_at: r.created_at,
      })
    }
    return out
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
