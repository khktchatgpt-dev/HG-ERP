import { authService } from '@/modules/core/auth/auth.service'
import { MEETING_LEVEL, type MeetingRiskLevel } from '@/lib/supply-meeting'
import { loadMeeting } from '../_data/meeting'
import { VanDeScreen } from './VanDeScreen'

export const dynamic = 'force-dynamic'

/**
 * VẤN ĐỀ CẦN XỬ LÝ — trang thứ hai của bảng họp: "lệnh nào có nguy cơ, vì sao,
 * ai đang cầm bóng". Chỉ ba mức có việc (khẩn / thiếu / chưa mốc); lệnh đang
 * về và đã đủ không có mặt — muốn xem toàn bộ lệnh thì sang Vật tư theo lệnh.
 *
 * `?muc=` là mức lọc ban đầu (Tổng quan bấm ô KPI là tới đây đã lọc sẵn) —
 * để trên URL cho người chiếu màn hình gửi link được.
 */
export default async function VanDePage({
  searchParams,
}: {
  searchParams: Promise<{ muc?: string }>
}) {
  const user = await authService.requirePageUser()
  const [{ today, issues, counts }, { muc }] = await Promise.all([
    loadMeeting(user),
    searchParams,
  ])
  const initialLevel = muc && muc in MEETING_LEVEL ? (muc as MeetingRiskLevel) : null

  return (
    <VanDeScreen
      today={today}
      issues={issues}
      counts={counts}
      initialLevel={initialLevel}
    />
  )
}
