import Link from 'next/link'
import { authService } from '@/modules/core/auth/auth.service'
import { canAction } from '@/modules/core/rbac/rbac.service'
import { loadDonTheoLenh } from '@/modules/dept/warehouse/don-theo-lenh.service'
import { todayVn } from '@/lib/date-vn'
import { KhoKhung, Rong } from '../../../_erp/khung'
import { LA_UUID, URL_THEO_LENH } from '../theo-lenh.shared'
import { LenhScreen, type LenhTab } from './LenhScreen'

export const metadata = { title: 'Kho · Đơn mua của lệnh' }
export const dynamic = 'force-dynamic'

const TABS: readonly LenhTab[] = ['cho', 'chua_dat', 'du', 'phieu']

/**
 * KHO · TRANG MỘT LỆNH — tầng ② (bản vẽ 2, Q7 duyệt 23/11/2026). Các đơn mua
 * của MỘT lệnh, bảng phẳng chia bốn tab; bấm mã đơn sang trang đơn (tầng ③).
 * Số từ CÙNG `loadDonTheoLenh` với danh sách (lọc một lệnh) nên hai trang khớp.
 */
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ lsxId: string }>
  searchParams: Promise<{ tab?: string }>
}) {
  const [user, { lsxId }, sp] = await Promise.all([
    authService.requirePageUser(),
    params,
    searchParams,
  ])
  const today = todayVn()
  const [data, canEdit] = await Promise.all([
    LA_UUID.test(lsxId)
      ? loadDonTheoLenh(today, lsxId)
      : Promise.resolve({ lenh: [], rows: [] }),
    user.role === 'admin'
      ? Promise.resolve(true)
      : canAction(user, 'warehouse.stock.write'),
  ])
  const lenh = data.lenh[0]
  if (!lenh) {
    return (
      <KhoKhung label="Không tìm thấy lệnh">
        <Rong
          tieuDe="Không tìm thấy lệnh này"
          lyDo="Đường dẫn sai hoặc lệnh đã bị xoá."
          tiep={
            <Link href={URL_THEO_LENH} className="kh-btn">
              Về danh sách lệnh
            </Link>
          }
        />
      </KhoKhung>
    )
  }
  const tab = (TABS as readonly string[]).includes(sp.tab ?? '')
    ? (sp.tab as LenhTab)
    : null

  return (
    <LenhScreen lenh={lenh} rows={data.rows} tab={tab} today={today} canEdit={canEdit} />
  )
}
