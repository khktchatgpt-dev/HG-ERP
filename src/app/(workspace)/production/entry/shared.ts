import { authService } from '@/modules/core/auth/auth.service'
import { productionRepo } from '@/modules/dept/production/production.repo'
import { isProductionStaff } from '@/modules/dept/production/production.service'
import { assessLateRisk } from '@/lib/late-risk'
import type { RunningLsx } from './EntryWorkbench'

/** Lệnh đang chạy + cờ trễ hạn — dữ liệu chung cho 2 màn nhập theo chức năng. */
export async function loadRunningLsx(): Promise<RunningLsx[]> {
  const tracking = await productionRepo.listTracking()
  const today = new Date().toISOString().slice(0, 10)
  return tracking
    .filter(
      (r) =>
        r.production_order_id &&
        (r.lsx_status === 'approved' || r.lsx_status === 'in_progress'),
    )
    .map((r) => ({
      id: r.production_order_id!,
      code: r.lsx_code ?? '?',
      customer_name: r.customer_name,
      order_code: r.code,
      ship_date: r.ship_date,
      late: assessLateRisk(r, today)?.level ?? null,
    }))
}

/** Nhập sổ — khớp canRecordOutput ở service: CHỈ bộ phận sản xuất + admin. */
export async function canRecordHere(): Promise<boolean> {
  const user = (await authService.currentUser())!
  return user.role === 'admin' || (await isProductionStaff(user))
}
