import Link from 'next/link'
import { authService } from '@/modules/core/auth/auth.service'
import { canAction } from '@/modules/core/rbac/rbac.service'
import { loadDonTheoLenh } from '@/modules/dept/warehouse/don-theo-lenh.service'
import { todayVn } from '@/lib/date-vn'
import { KhoKhung, Rong } from '../../../_erp/khung'
import { LA_UUID, URL_THEO_LENH } from '../theo-lenh.shared'
import { LenhScreen, type LenhTab } from './LenhScreen'
import { cheDoMacDinh, khopGiu } from '@/lib/kho-phu-trach'
import {
  nguoiGiuTheoDon,
  phamViCuaToi,
} from '@/modules/dept/warehouse/phu-trach.service'

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
  const [data, canEdit, pv] = await Promise.all([
    LA_UUID.test(lsxId)
      ? loadDonTheoLenh(today, lsxId)
      : Promise.resolve({ lenh: [], rows: [] }),
    user.role === 'admin'
      ? Promise.resolve(true)
      : canAction(user, 'warehouse.stock.write'),
    phamViCuaToi(user),
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

  // Kho giữ từng đơn (phụ trách nhóm vật tư, 0305): nhân viên Kho thấy đơn của người
  // khác chữ nhạt — vẫn hiện, vì trang lệnh trả lời "lệnh này còn chờ gì" cho CẢ lệnh.
  const poIds = [...new Set(data.rows.map((r) => r.po_id))]
  const giuBy = await nguoiGiuTheoDon(poIds, pv.pc, pv.thuKho)
  const toi = cheDoMacDinh(user.id, pv.nguoi, [...giuBy.values()].map((g) => g.giu)) === 'toi'
  const giu = Object.fromEntries(
    poIds.map((id) => {
      const g = giuBy.get(id)?.giu ?? []
      return [
        id,
        {
          ten: g.map((u) => pv.nguoi.find((n) => n.id === u)?.name).filter(Boolean).join(' · '),
          khac: toi && !khopGiu(g, 'toi', user.id),
        },
      ]
    }),
  )

  return (
    <LenhScreen
      lenh={lenh}
      rows={data.rows}
      tab={tab}
      today={today}
      canEdit={canEdit}
      giu={pv.nguoi.length > 0 ? giu : undefined}
    />
  )
}
