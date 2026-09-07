import {
  buildLsxSupplyRows,
  type LsxSupplyRow,
} from '@/modules/dept/supply/lsx-supply.service'
import { buildMeeting, type MeetingRow } from '@/lib/supply-meeting'
import type { User } from '@/modules/core/users/users.repo'

/**
 * DỮ LIỆU HỌP CUNG ỨNG — dùng chung cho Tổng quan, Vấn đề cần xử lý, Việc cần
 * quyết định (tách trang 05/09/2026: nhiều lệnh nên mỗi trang một vai trò).
 *
 * Ba trang đọc CÙNG một phép tính (`buildLsxSupplyRows` → `buildMeeting`) —
 * cùng nguồn với màn Vật tư theo lệnh và file Excel họp tuần, nên số ở trang
 * nào cũng khớp nhau.
 */
export type MeetingData = {
  today: string
  rows: MeetingRow<LsxSupplyRow>[]
  counts: ReturnType<typeof buildMeeting<LsxSupplyRow>>['counts']
  issues: MeetingRow<LsxSupplyRow>[]
}

export async function loadMeeting(user: User): Promise<MeetingData> {
  const today = new Date().toISOString().slice(0, 10)
  const rows = await buildLsxSupplyRows(user, today)
  const m = buildMeeting(rows, today)
  return { today, rows: m.rows, counts: m.counts, issues: m.issues }
}
