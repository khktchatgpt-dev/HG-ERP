import { TZ_VN } from './date-vn'
import type { DeNghiStatus } from './de-nghi'

/**
 * DANH SÁCH ĐỀ NGHỊ MUA CHO LÃNH ĐẠO (Đ5, bản vẽ DN-6
 * https://claude.ai/artifact/Tu7kTTCUPr2aALmAZ2g18b, duyệt 13/10/2026).
 *
 * Một chỗ cho: phiếu nào "chờ TÔI duyệt" (cùng luật Hộp ký, số đếm menu, trang
 * danh sách — ba nơi đếm một hàm), phiếu thuộc rổ nào, tổng tháng.
 */

export type RoDuyet = 'cho' | 'mua' | 'xong' | 'tra_lai'

export const RO_DUYET_NHAN: Record<RoDuyet | 'all', string> = {
  cho: 'Chờ tôi duyệt',
  mua: 'Đang mua',
  xong: 'Xong',
  tra_lai: 'Trả lại',
  all: 'Tất cả',
}

type PhieuToi = { status: DeNghiStatus; requested_by: string | null }

/** Chờ chính người xem duyệt: đang chờ + không phải phiếu mình đề nghị (admin thì được). */
export function choToiDuyet(p: PhieuToi, u: { id: string; role: string }): boolean {
  return p.status === 'pending' && (u.role === 'admin' || p.requested_by !== u.id)
}

/**
 * Rổ của phiếu trong danh sách lãnh đạo. null = lãnh đạo không cần thấy (nháp
 * Kho chưa gửi lần nào; phiếu huỷ chỉ nằm ở "Tất cả").
 */
export function roDuyet(
  p: PhieuToi & { submitted_at: string | null; rejected_at: string | null },
  u: { id: string; role: string },
): RoDuyet | 'khac' | null {
  if (!p.submitted_at) return null
  if (p.status === 'pending') return choToiDuyet(p, u) ? 'cho' : 'khac'
  if (p.status === 'approved' || p.status === 'ordering') return 'mua'
  if (p.status === 'done') return 'xong'
  if (p.status === 'draft') return p.rejected_at ? 'tra_lai' : 'khac'
  return 'khac'
}

/** "2026-10" theo giờ VN — để gom "duyệt tháng này". */
export function thangVn(iso: string | Date): string {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: TZ_VN,
      year: 'numeric',
      month: '2-digit',
    })
      .formatToParts(typeof iso === 'string' ? new Date(iso) : iso)
      .map((x) => [x.type, x.value]),
  )
  return `${p.year}-${p.month}`
}

/** Tổng theo SỐ DUYỆT (null = đúng số đề nghị) × giá dự kiến — dòng chưa giá không cộng. */
export function tongTheoDuyet(
  lines: readonly {
    qty: number
    approved_qty: number | null
    unit_price: number | null
  }[],
): number {
  let t = 0
  for (const l of lines)
    if (l.unit_price != null) t += (l.approved_qty ?? l.qty) * l.unit_price
  return Math.round(t)
}
