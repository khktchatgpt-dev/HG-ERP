import { targetsRepo, type DailyTarget } from './targets.repo'
import { productionRepo } from './production.repo'
import { departmentsRepo } from '@/modules/core/departments/departments.repo'
import { assertAction } from '@/modules/core/rbac/rbac.service'
import type { User } from '@/modules/core/users/users.repo'
import { BadRequest } from '@/server/http'

/**
 * CHỈ TIÊU NGÀY (GĐ 2.2 — 0168): Kế hoạch giao chỉ tiêu per tổ × công đoạn
 * cho một ngày. Ô bỏ trống = KHÔNG giao → Toàn cảnh dùng số suy từ lộ trình;
 * ô = 0 là chỉ tiêu thật ("hôm nay tổ này làm việc khác").
 */

export const targetsService = {
  /** Lưới của 1 ngày: danh mục tổ SX + công đoạn + các ô đã giao. Đọc: mọi NV. */
  async getDay(
    _user: User,
    date: string,
  ): Promise<{
    date: string
    teams: { id: string; name: string }[]
    stages: { code: string; label: string }[]
    targets: DailyTarget[]
  }> {
    const [depts, stages, targets] = await Promise.all([
      departmentsRepo.list(),
      productionRepo.listStages(),
      targetsRepo.listByDate(date),
    ])
    return {
      date,
      teams: depts
        .filter((d) => d.workspace_id === 'production')
        .map((d) => ({ id: d.id, name: d.name })),
      stages,
      targets,
    }
  },

  /** Ghi đè trọn ngày — quyền Kế hoạch (cùng màn lộ trình/giao tổ). */
  async saveDay(
    user: User,
    date: string,
    rows: {
      team_department_id: string
      stage: string
      qty: number
      note?: string | null
    }[],
  ): Promise<void> {
    await assertAction(user, 'production.plan.manage')
    const seen = new Set<string>()
    for (const r of rows) {
      const k = `${r.team_department_id}|${r.stage}`
      if (seen.has(k)) {
        throw BadRequest('Trùng ô (tổ × công đoạn) trong một lượt lưu')
      }
      seen.add(k)
    }
    await targetsRepo.replaceDay(
      date,
      rows.map((r) => ({
        team_department_id: r.team_department_id,
        stage: r.stage,
        qty: r.qty,
        note: r.note ?? null,
        created_by: user.id,
      })),
    )
  },
}
