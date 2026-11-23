import { authService } from '@/modules/core/auth/auth.service'
import { loadDonTheoLenh } from '@/modules/dept/warehouse/don-theo-lenh.service'
import { KD_RO, type KdRo } from '@/lib/kho-don-theo-lenh'
import { todayVn } from '@/lib/date-vn'
import { DonTheoLenhScreen } from './DonTheoLenhScreen'

export const metadata = { title: 'Kho · Đơn mua theo lệnh' }
export const dynamic = 'force-dynamic'

/**
 * KHO › NHẬN HÀNG › THEO LỆNH — tầng ① danh sách lệnh (23/11/2026, bản vẽ 2
 * https://claude.ai/artifact/69uVsoeKimjmBMCiXD9Tsp, Q1–Q9 duyệt theo đề xuất).
 *
 * Ba tầng, mỗi tầng một trang có URL: ① danh sách lệnh (đây) → ② trang một lệnh
 * `theo-lenh/[lsxId]` → ③ trang một đơn `/warehouse/don-mua/[poId]`.
 * Chỉ xem — Kho không sửa đơn mua.
 *
 * Rổ + lệnh đang chọn nằm trên URL (`?ro=&chon=`): quay lại từ trang lệnh vẫn
 * đứng đúng dòng.
 */
export default async function DonTheoLenhPage({
  searchParams,
}: {
  searchParams: Promise<{ ro?: string; chon?: string }>
}) {
  const [, sp] = await Promise.all([authService.requirePageUser(), searchParams])
  const today = todayVn()
  const data = await loadDonTheoLenh(today)
  const ro: KdRo = (KD_RO as readonly string[]).includes(sp.ro ?? '')
    ? (sp.ro as KdRo)
    : 'cho'
  const chon = sp.chon && data.lenh.some((l) => l.id === sp.chon) ? sp.chon : null

  return (
    <DonTheoLenhScreen
      lenh={data.lenh}
      rows={data.rows}
      ro={ro}
      chon={chon}
      today={today}
    />
  )
}
