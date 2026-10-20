import { db } from '@/server/db'
import type { ProjectStatus } from './projects.schema'

/** Hạng mục ngoài sản xuất (0230). */
export type Project = {
  id: string
  /** HM-YYYY-NNNN — next_doc_code('HM'). */
  code: string
  name: string
  /** Loại việc: "Khuôn mẫu", "Dự trữ kho", "Đơn khách chưa ra lệnh"… */
  kind: string
  /** Dự toán, null = không theo dõi trần. */
  budget: number | null
  currency: string
  owner_id: string | null
  status: ProjectStatus
  note: string | null
  closed_at: string | null
  closed_by: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export type ProjectWithOwner = Project & { owner_name: string | null }

const COLS =
  'id, code, name, kind, budget, currency, owner_id, status, note, closed_at, closed_by, created_by, created_at, updated_at'
const SEL = `${COLS}, owner:users!supply_projects_owner_id_fkey(name, email)`

type Raw = Project & {
  budget: number | string | null
  owner: { name: string | null; email: string } | { name: string | null; email: string }[] | null // prettier-ignore
}

function unwrap(r: Raw): ProjectWithOwner {
  const { owner, ...rest } = r
  const o = Array.isArray(owner) ? owner[0] : owner
  return {
    ...rest,
    budget: r.budget == null ? null : Number(r.budget),
    owner_name: o ? o.name || o.email : null,
  }
}

export const projectsRepo = {
  async list(opts: { status?: ProjectStatus } = {}): Promise<ProjectWithOwner[]> {
    let q = db().from('supply_projects').select(SEL).order('created_at', { ascending: false }) // prettier-ignore
    if (opts.status) q = q.eq('status', opts.status)
    const { data, error } = await q.limit(1000)
    if (error) throw new Error(error.message)
    return ((data ?? []) as unknown as Raw[]).map(unwrap)
  },

  async findById(id: string): Promise<ProjectWithOwner | null> {
    const { data, error } = await db().from('supply_projects').select(SEL).eq('id', id).maybeSingle() // prettier-ignore
    if (error) throw new Error(error.message)
    return data ? unwrap(data as unknown as Raw) : null
  },

  async nextCode(): Promise<string> {
    const { data, error } = await db().rpc('next_doc_code', { p_kind: 'HM' })
    if (error || !data) throw new Error(error?.message ?? 'Không cấp được mã hạng mục')
    return data as string
  },

  async insert(row: {
    code: string
    name: string
    kind: string
    budget: number | null
    currency: string
    note: string | null
    owner_id: string
    created_by: string
  }): Promise<Project> {
    const { data, error } = await db().from('supply_projects').insert(row).select(COLS).single() // prettier-ignore
    if (error || !data) throw new Error(error?.message ?? 'Tạo hạng mục lỗi')
    return {
      ...(data as Project),
      budget: data.budget == null ? null : Number(data.budget),
    }
  },

  async patch(id: string, patch: Partial<Project>): Promise<void> {
    const { error } = await db().from('supply_projects').update(patch).eq('id', id)
    if (error) throw new Error(error.message)
  },
}
