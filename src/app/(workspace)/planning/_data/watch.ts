import { posService } from '@/modules/dept/supply/pos.service'
import { posRepo } from '@/modules/dept/supply/pos.repo'
import { supplyRepo } from '@/modules/dept/supply/supply.repo'
import type { User } from '@/modules/core/users/users.repo'

/**
 * Nạp đơn mua kèm TIỀN và TIẾN ĐỘ VỀ KHO — dùng chung cho hai màn theo dõi
 * ("Chờ tôi xử lý", "Hàng sắp về").
 *
 * Cùng lối với `planning/pos/page.tsx`: nạp một lượt có trần rồi cộng thêm hai
 * truy vấn gộp (tiền, số dòng đã về) thay vì N+1 theo từng đơn. Hai màn này chỉ
 * quan tâm đơn ĐANG MỞ, nhưng vẫn nạp cả rồi lọc ở client-side của server: lọc
 * sẵn theo từng trạng thái là 6 lượt truy vấn, mà tập đơn vốn đã nhỏ.
 */

export type WatchPo = Awaited<ReturnType<typeof posService.list>>['rows'][number] & {
  total: number
  lines_done: number
  lines_total: number
}

const PAGE_CAP = 1000

export async function loadWatchPos(
  user: User,
): Promise<{ rows: WatchPo[]; truncatedAt: number | null }> {
  const { rows } = await posService.list(user, { page: 1, page_size: PAGE_CAP })
  const ids = rows.map((p) => p.id)
  const [totals, lineDone] = await Promise.all([
    posRepo.totalsByPoIds(ids),
    supplyRepo.lineDoneByPoIds(ids),
  ])
  return {
    rows: rows.map((p) => ({
      ...p,
      total: totals[p.id] ?? 0,
      lines_done: lineDone.get(p.id)?.done ?? 0,
      lines_total: lineDone.get(p.id)?.total ?? 0,
    })),
    truncatedAt: rows.length >= PAGE_CAP ? PAGE_CAP : null,
  }
}

/** Hôm nay dạng yyyy-mm-dd — mọi so sánh hạn dùng chung một mốc. */
export function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}
