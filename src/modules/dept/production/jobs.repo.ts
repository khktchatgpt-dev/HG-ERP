import { db } from '@/server/db'

/**
 * production_jobs (0084) — TRỤC CHÍNH của thực thi sản xuất:
 * 1 dòng = LSX × dòng SP × công đoạn. Kế hoạch tạo (seq lộ trình + giao tổ +
 * hạn); trạng thái todo/doing/done là NGUỒN TRẠNG THÁI duy nhất (số lượng nằm
 * ở production_entries).
 */

export type JobStatus = 'todo' | 'doing' | 'done'

export type Job = {
  id: string
  production_order_id: string
  order_line_id: string
  stage: string
  seq: number
  team_department_id: string | null
  planned_start: string | null
  planned_end: string | null
  status: JobStatus
  done_by: string | null
  done_at: string | null
  note: string | null
  created_at: string
  updated_at: string
  team_name: string | null
}

const COLS =
  'id, production_order_id, order_line_id, stage, seq, team_department_id, planned_start, planned_end, status, done_by, done_at, note, created_at, updated_at'
const SELECT_JOINED = `${COLS}, team:departments(name)`

type Raw = Omit<Job, 'team_name'> & {
  team: { name: string } | { name: string }[] | null
}

function unwrap(rows: Raw[] | null): Job[] {
  return (rows ?? []).map((r) => {
    const t = Array.isArray(r.team) ? r.team[0] : r.team
    return { ...r, team: undefined, team_name: t?.name ?? null } as unknown as Job
  })
}

export const jobsRepo = {
  async findById(id: string): Promise<Job | null> {
    const { data } = await db()
      .from('production_jobs')
      .select(SELECT_JOINED)
      .eq('id', id)
      .maybeSingle()
    if (!data) return null
    return unwrap([data as unknown as Raw])[0]
  },

  async listByLsx(productionOrderId: string): Promise<Job[]> {
    const { data } = await db()
      .from('production_jobs')
      .select(SELECT_JOINED)
      .eq('production_order_id', productionOrderId)
      .order('order_line_id')
      .order('seq')
    return unwrap(data as unknown as Raw[] | null)
  },

  /** Jobs của NHIỀU lệnh một lượt — màn toàn cảnh/bảng tổng, tránh N query. */
  async listByLsxBulk(ids: string[]): Promise<Job[]> {
    if (!ids.length) return []
    const { data } = await db()
      .from('production_jobs')
      .select(SELECT_JOINED)
      .in('production_order_id', ids)
      .order('order_line_id')
      .order('seq')
      .limit(20000)
    return unwrap(data as unknown as Raw[] | null)
  },

  /** Việc của 1 tổ (mọi lệnh) — màn tổ trưởng. */
  async listByTeam(teamDepartmentId: string): Promise<Job[]> {
    const { data } = await db()
      .from('production_jobs')
      .select(SELECT_JOINED)
      .eq('team_department_id', teamDepartmentId)
      .order('created_at')
      .limit(5000)
    return unwrap(data as unknown as Raw[] | null)
  },

  /**
   * Ghi đè KẾ HOẠCH của 1 dòng SP (lộ trình theo seq + giao tổ + hạn) — giữ
   * nguyên trạng thái/xác nhận của job trùng công đoạn (kế hoạch sửa không
   * reset việc đã chạy). Caller đã validate không xoá công đoạn doing/done.
   */
  async replaceForLine(
    productionOrderId: string,
    orderLineId: string,
    stages: {
      stage: string
      team_department_id?: string | null
      planned_start?: string | null
      planned_end?: string | null
    }[],
  ): Promise<void> {
    const keep = new Set(stages.map((s) => s.stage))
    // Xoá job không còn trên lộ trình (caller đảm bảo toàn bộ là 'todo').
    const del = db()
      .from('production_jobs')
      .delete()
      .eq('production_order_id', productionOrderId)
      .eq('order_line_id', orderLineId)
    const { error: delErr } = keep.size
      ? await del.not('stage', 'in', `(${[...keep].map((s) => `"${s}"`).join(',')})`)
      : await del
    if (delErr) throw new Error(delErr.message)
    if (!stages.length) return
    // Upsert theo unique (lsx, line, stage): dòng mới status mặc định 'todo';
    // dòng cũ giữ status/done_* (không đụng cột ngoài danh sách update).
    const { error } = await db()
      .from('production_jobs')
      .upsert(
        stages.map((s, i) => ({
          production_order_id: productionOrderId,
          order_line_id: orderLineId,
          stage: s.stage,
          seq: i,
          team_department_id: s.team_department_id ?? null,
          planned_start: s.planned_start ?? null,
          planned_end: s.planned_end ?? null,
        })),
        { onConflict: 'production_order_id,order_line_id,stage' },
      )
    if (error) throw new Error(error.message)
  },

  async patch(
    id: string,
    patch: Partial<
      Pick<
        Job,
        | 'status'
        | 'done_by'
        | 'done_at'
        | 'note'
        | 'team_department_id'
        | 'planned_start'
        | 'planned_end'
      >
    >,
  ): Promise<Job> {
    const { data, error } = await db()
      .from('production_jobs')
      .update(patch)
      .eq('id', id)
      .select(SELECT_JOINED)
      .single()
    if (error || !data) throw new Error(error?.message ?? 'Update job failed')
    return unwrap([data as unknown as Raw])[0]
  },

  /** Nhích todo → doing khi có sản lượng đầu tiên (auto từ entries.service). */
  async markDoing(
    productionOrderId: string,
    orderLineId: string,
    stage: string,
  ): Promise<void> {
    const { error } = await db()
      .from('production_jobs')
      .update({ status: 'doing' })
      .eq('production_order_id', productionOrderId)
      .eq('order_line_id', orderLineId)
      .eq('stage', stage)
      .eq('status', 'todo')
    if (error) throw new Error(error.message)
  },
}
