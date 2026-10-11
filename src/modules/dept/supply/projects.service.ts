import type { User } from '@/modules/core/users/users.repo'
import { assertAction } from '@/modules/core/rbac/rbac.service'
import { BadRequest, NotFound } from '@/server/http'
import { productionRepo } from '@/modules/dept/production/production.repo'
import { poFinanceForPo } from '@/modules/dept/accounting/supplier-invoices.service'
import { assessPoLate } from '@/lib/late-risk'
import { poMoneyOf } from '@/lib/po-line'
import { todayVn } from '@/lib/date-vn'
import { canChuY, lenhCuaKhach, soHangMuc, type HangMucSo } from '@/lib/hang-muc'
import { posRepo, type PoWithRefs } from './pos.repo'
import { projectsRepo, type ProjectWithOwner } from './projects.repo'
import type {
  ProjectCreateInput,
  ProjectStatus,
  ProjectUpdateInput,
} from './projects.schema'

/** Một đơn của hạng mục, đủ để bày lưới + cộng số (lib/hang-muc). */
export type ProjectPo = PoWithRefs & {
  gross: number
  received_net: number | null
  invoiced_gross: number | null
  paid: number | null
  /** Dòng đã về mà phiếu nhập thiếu giá (mục Tài chính "thiếu giá"). */
  missing_price_lines: number
  /** Đọc mục Tài chính của đơn lỗi — số của đơn này chưa có trong tổng. */
  finance_error: boolean
  overdue: boolean
  materials: string[]
}

export type ProjectRow = ProjectWithOwner & { so: HangMucSo; chu_y: string[] }

/** Ô "Cho việc" của màn soạn đơn — nhẹ, không đọc tài chính. */
export type ProjectOption = Pick<ProjectWithOwner, 'id' | 'code' | 'name' | 'kind' | 'budget' | 'currency' | 'status'> & { n: number; ordered: number } // prettier-ignore

/**
 * Đơn của nhiều hạng mục + số mục Tài chính của TỪNG đơn. Gọi đúng
 * `poFinanceForPo` của tab Tài chính (không công thức thứ hai) — đơn ngoài lệnh
 * ít (7 đơn lúc làm), nên một lượt mỗi đơn là đủ. Đơn nháp / huỷ không đọc.
 */
/** Trần một lượt đọc: PostgREST trả tối đa 1.000 dòng — chạm trần là phải NÓI, không im lặng cắt. */
const TRAN = 1000
/** Đọc tài chính từng lượt 8 đơn — mỗi đơn ~5 truy vấn, bắn cả trăm đơn một lúc là dồn Supabase. */
const LUOT = 8

async function posOf(projectIds: string[], withFinance: boolean): Promise<ProjectPo[]> {
  if (projectIds.length === 0) return []
  const { rows, total } = await posRepo.list({
    project_ids: projectIds,
    page: 1,
    page_size: TRAN,
  })
  if (total > rows.length)
    throw new Error(
      `Hạng mục có ${total} đơn, vượt trần đọc ${TRAN} — cần chia trang trước khi cộng số`,
    )
  const ids = rows.map((r) => r.id)
  const [totals, mats] = await Promise.all([
    posRepo.totalsByPoIds(ids),
    withFinance ? posRepo.materialNamesByPoIds(ids) : Promise.resolve(new Map<string, string[]>()), // prettier-ignore
  ])
  const today = todayVn()
  const out: ProjectPo[] = []
  for (let i = 0; i < rows.length; i += LUOT) {
    const part = await Promise.all(
      rows.slice(i, i + LUOT).map(async (r) => {
        const can = withFinance && r.status !== 'draft' && r.status !== 'cancelled'
        // Lỗi đọc KHÔNG nuốt thành số 0: gắn cờ để màn nói "chưa đọc được" (lib/hang-muc).
        const f = can ? await poFinanceForPo(r.id).catch(() => 'loi' as const) : null
        const ok = f && f !== 'loi' ? f : null
        return {
          ...r,
          gross: poMoneyOf(r, totals[r.id] ?? 0).grandTotal,
          received_net: ok?.received_net ?? null,
          invoiced_gross: ok?.invoiced_gross ?? null,
          paid: ok?.paid ?? null,
          missing_price_lines: ok?.missing_price_lines ?? 0,
          finance_error: f === 'loi',
          overdue: assessPoLate(r, today) === 'overdue',
          materials: mats.get(r.id) ?? [],
        }
      }),
    )
    out.push(...part)
  }
  return out
}

async function lenhDangChay() {
  const ls = await productionRepo.listActive()
  return ls.map((l) => ({ code: l.code, customer_name: l.customer_name }))
}

export const projectsService = {
  /** Danh sách hạng mục kèm số + "cần chú ý" — trang /mua-hang/hang-muc. */
  async list(_user: User, opts: { status?: ProjectStatus } = {}): Promise<ProjectRow[]> {
    const projects = await projectsRepo.list(opts)
    const [pos, lenh] = await Promise.all([
      posOf(
        projects.map((p) => p.id),
        true,
      ),
      lenhDangChay(),
    ])
    return projects.map((p) => {
      const so = soHangMuc(
        p,
        pos.filter((x) => x.project_id === p.id),
      )
      return { ...p, so, chu_y: canChuY(p, so, lenhCuaKhach(p, lenh)) }
    })
  },

  /** Hồ sơ một hạng mục: số + đơn. */
  async detail(
    _user: User,
    id: string,
  ): Promise<{ project: ProjectRow; pos: ProjectPo[] }> {
    const project = await projectsRepo.findById(id)
    if (!project) throw NotFound('Hạng mục không tồn tại')
    const [pos, lenh] = await Promise.all([posOf([id], true), lenhDangChay()])
    const so = soHangMuc(project, pos)
    return { project: { ...project, so, chu_y: canChuY(project, so, lenhCuaKhach(project, lenh)) }, pos } // prettier-ignore
  },

  /**
   * Lựa chọn cho ô "Cho việc": hạng mục ĐANG MỞ (nhiều tiền trước), cộng hạng mục
   * của chính đơn đang mở nếu nó đã đóng — để ô vẫn đọc ra tên.
   */
  async options(keepId?: string | null): Promise<ProjectOption[]> {
    const open = await projectsRepo.list({ status: 'open' })
    const extra = keepId && !open.some((p) => p.id === keepId) ? await projectsRepo.findById(keepId) : null // prettier-ignore
    const all = extra ? [...open, extra] : open
    const pos = await posOf(
      all.map((p) => p.id),
      false,
    )
    return all
      .map((p) => {
        const so = soHangMuc(
          p,
          pos.filter((x) => x.project_id === p.id),
        )
        return { id: p.id, code: p.code, name: p.name, kind: p.kind, budget: p.budget, currency: p.currency, status: p.status, n: so.n + so.nhap, ordered: so.ordered } // prettier-ignore
      })
      .sort((a, b) => b.n - a.n || b.code.localeCompare(a.code))
  },

  /** Số của MỘT hạng mục — màn ký của Giám đốc ("đã tiêu / dự toán"). */
  async summary(
    id: string,
  ): Promise<(ProjectWithOwner & { so: HangMucSo; pos: ProjectPo[] }) | null> {
    const project = await projectsRepo.findById(id)
    if (!project) return null
    const pos = await posOf([id], false)
    return { ...project, so: soHangMuc(project, pos), pos }
  },

  async create(user: User, input: ProjectCreateInput) {
    await assertAction(user, 'supply.po.manage')
    return projectsRepo.insert({
      code: await projectsRepo.nextCode(),
      name: input.name.replace(/\s+/g, ' ').trim(),
      kind: input.kind.replace(/\s+/g, ' ').trim(),
      budget: input.budget ?? null,
      currency: input.currency,
      note: input.note?.trim() || null,
      owner_id: user.id,
      created_by: user.id,
    })
  },

  async update(user: User, id: string, input: ProjectUpdateInput): Promise<void> {
    await assertAction(user, 'supply.po.manage')
    const before = await projectsRepo.findById(id)
    if (!before) throw NotFound('Hạng mục không tồn tại')
    const patch: Parameters<typeof projectsRepo.patch>[1] = {}
    if (input.name !== undefined) patch.name = input.name.replace(/\s+/g, ' ').trim()
    if (input.kind !== undefined) patch.kind = input.kind.replace(/\s+/g, ' ').trim()
    if (input.budget !== undefined) patch.budget = input.budget ?? null
    if (input.note !== undefined) patch.note = input.note?.trim() || null
    if (input.owner_id !== undefined) patch.owner_id = input.owner_id
    if (input.status && input.status !== before.status) {
      patch.status = input.status
      patch.closed_at = input.status === 'closed' ? new Date().toISOString() : null
      patch.closed_by = input.status === 'closed' ? user.id : null
    }
    if (Object.keys(patch).length === 0) throw BadRequest('Không có gì thay đổi')
    await projectsRepo.patch(id, patch)
  },
}
