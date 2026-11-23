import Link from 'next/link'
import { authService } from '@/modules/core/auth/auth.service'
import { canAction } from '@/modules/core/rbac/rbac.service'
import { loadDonTheoLenh } from '@/modules/dept/warehouse/don-theo-lenh.service'
import { todayVn } from '@/lib/date-vn'
import { KhoKhung, Rong } from '../../_erp/khung'
import { taiHangCuaDon } from '../../nhap/tai-hang-cua-don'
import { LA_UUID } from '../../nhap/theo-lenh/theo-lenh.shared'
import { DonMuaScreen, type DonTab, type PhanLenh } from './DonMuaScreen'

export const metadata = { title: 'Kho · Đơn mua' }
export const dynamic = 'force-dynamic'

const TABS: readonly DonTab[] = ['dong', 'phieu', 'dot', 'su_co']

/**
 * KHO · TRANG MỘT ĐƠN MUA — tầng ③ (bản vẽ 2, Q8 duyệt 23/11/2026):
 * `/warehouse/don-mua/[poId]?lenh=<lsxId>`. Kho xem đơn chở gì, mỗi dòng đã nhận
 * bao nhiêu, qua phiếu nào, đợt nào sắp tới — không rời khu Kho (NV Kho không
 * vào khu Mua hàng). CHỈ XEM; nút ghi là Nhận hàng + Báo sự cố.
 *
 * Số dòng / phiếu / đợt từ `taiHangCuaDon` — đúng bộ nạp hộp "Hàng của đơn"
 * (cùng hàm trang đơn Cung ứng dùng). `?lenh=` (mở từ trang lệnh) nạp thêm phần
 * của lệnh đó qua CÙNG `loadDonTheoLenh` với trang lệnh, nên "phần của lệnh"
 * ở đây khớp số trên trang lệnh.
 */
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ poId: string }>
  searchParams: Promise<{ lenh?: string; tab?: string }>
}) {
  const [user, { poId }, sp] = await Promise.all([
    authService.requirePageUser(),
    params,
    searchParams,
  ])
  const today = todayVn()
  const lsxId = sp.lenh && LA_UUID.test(sp.lenh) ? sp.lenh : null
  const [data, theoLenh, canEdit] = await Promise.all([
    LA_UUID.test(poId) ? taiHangCuaDon(user, poId) : Promise.resolve(null),
    lsxId ? loadDonTheoLenh(today, lsxId) : Promise.resolve(null),
    user.role === 'admin'
      ? Promise.resolve(true)
      : canAction(user, 'warehouse.stock.write'),
  ])

  if (!data) {
    return (
      <KhoKhung label="Không tìm thấy đơn">
        <Rong
          tieuDe="Không tìm thấy đơn mua này"
          lyDo="Đường dẫn sai hoặc đơn đã bị xoá."
          tiep={
            <Link href="/warehouse/nhap" className="kh-btn">
              Về Nhận hàng
            </Link>
          }
        />
      </KhoKhung>
    )
  }

  const lenh = theoLenh?.lenh[0] ?? null
  const row = theoLenh?.rows.find((r) => r.po_id === poId) ?? null
  const phan: PhanLenh | null =
    lenh && row
      ? {
          lsx_id: lenh.id,
          code: lenh.code,
          lenh_chinh: row.lenh_chinh,
          gop: row.gop,
          dong: Object.fromEntries(
            row.dong.map((d) => [d.id, { dat: d.dat, ve: d.ve, chia: d.chia }]),
          ),
        }
      : null
  const tab = (TABS as readonly string[]).includes(sp.tab ?? '')
    ? (sp.tab as DonTab)
    : 'dong'

  return (
    <DonMuaScreen
      data={data}
      phan={phan}
      lenhLink={lenh ? { id: lenh.id, code: lenh.code } : null}
      tab={tab}
      today={today}
      canEdit={canEdit}
    />
  )
}
