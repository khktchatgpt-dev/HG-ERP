import { db } from '@/server/db'

/**
 * production_daily_targets (0168) — CHỈ TIÊU ngày × tổ × công đoạn do Kế
 * hoạch giao. Overview ưu tiên số thật, thiếu dòng thì rơi về số suy
 * (resolveDailyTargets — lib production-summary).
 */

export type DailyTarget = {
  id: string
  target_date: string
  team_department_id: string
  stage: string
  qty: number
  note: string | null
  team_name: string | null
}

const SELECT =
  'id, target_date, team_department_id, stage, qty, note, team:departments(name)'

type Raw = Omit<DailyTarget, 'team_name'> & {
  team: { name: string } | { name: string }[] | null
}

function unwrap(rows: Raw[] | null): DailyTarget[] {
  return (rows ?? []).map((r) => {
    const t = Array.isArray(r.team) ? r.team[0] : r.team
    return {
      ...r,
      team: undefined,
      qty: Number(r.qty),
      team_name: t?.name ?? null,
    } as unknown as DailyTarget
  })
}

export const targetsRepo = {
  async listByDate(date: string): Promise<DailyTarget[]> {
    const { data } = await db()
      .from('production_daily_targets')
      .select(SELECT)
      .eq('target_date', date)
      .limit(1000)
    return unwrap(data as unknown as Raw[] | null)
  },

  /** Chỉ tiêu trong khoảng ngày [from..to] — màn Kế hoạch tuần. */
  async listRange(from: string, to: string): Promise<DailyTarget[]> {
    const { data } = await db()
      .from('production_daily_targets')
      .select(SELECT)
      .gte('target_date', from)
      .lte('target_date', to)
      .limit(5000)
    return unwrap(data as unknown as Raw[] | null)
  },

  /** Ghi đè TRỌN NGÀY (lưới gửi đủ mọi ô có số) — idempotent, dễ hiểu. */
  async replaceDay(
    date: string,
    rows: {
      team_department_id: string
      stage: string
      qty: number
      note: string | null
      created_by: string
    }[],
  ): Promise<void> {
    const del = await db()
      .from('production_daily_targets')
      .delete()
      .eq('target_date', date)
    if (del.error) throw new Error(del.error.message)
    if (!rows.length) return
    const { error } = await db()
      .from('production_daily_targets')
      .insert(rows.map((r) => ({ ...r, target_date: date })))
    if (error) throw new Error(error.message)
  },
}
