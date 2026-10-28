import { authService } from '@/modules/core/auth/auth.service'
import { canAction } from '@/modules/core/rbac/rbac.service'
import { stockService } from '@/modules/dept/warehouse/stock.service'
import { docsRepo } from '@/modules/dept/warehouse/stock.repo'
import { soPhieuRepo } from '@/modules/dept/warehouse/so-phieu.repo'
import { todayVn } from '@/lib/date-vn'
import { laMaLyDo, suyMaTuLichSu } from '@/lib/kho-ma-ly-do'
import { SoPhieuScreen } from './SoPhieuScreen'
import { RO_PHIEU, demRo, locRo, type RoPhieu } from './ro-phieu'

export const metadata = { title: 'Kho · Phiếu đã ghi' }
export const dynamic = 'force-dynamic'

const PAGE_SIZE = 50

/**
 * SỔ PHIẾU KHO — `/warehouse/phieu` (hoàn thiện A1, `docs/kho-hoan-thien.md`).
 *
 * Bịt hai lỗ cùng một chỗ:
 *   · ba màn Kho đang trỏ "Xem sổ phiếu" sang `/planning/docs` — khu Cung
 *     ứng, vỏ khác. Thủ kho tra tờ phiếu mình vừa ghi là bị đá ra khỏi khu.
 *   · ghi nhầm KHÔNG sửa được từ khu Kho: `reverseDoc` có sẵn nhưng nút đảo
 *     chỉ nằm ở màn cũ.
 *
 * Service đã đủ (`listDocs` · `docDetail` · `reverseDoc`) — không migration.
 */
export default async function SoPhieuPage({
  searchParams,
}: {
  searchParams: Promise<{ ro?: string; ly_do?: string; trang?: string; nguoi?: string }>
}) {
  const user = await authService.requirePageUser()
  const sp = await searchParams
  const ro: RoPhieu = (RO_PHIEU as readonly string[]).includes(sp.ro ?? '')
    ? (sp.ro as RoPhieu)
    : 'all'
  const lyDo = laMaLyDo(sp.ly_do ?? '') ? sp.ly_do : undefined
  const trang = Math.max(1, Number(sp.trang) || 1)
  // Người lập: 'toi' = chính người xem; còn lại là id người lập (từ ô chọn).
  const nguoi = sp.nguoi === 'toi' ? user.id : sp.nguoi || undefined

  // Rổ "Thiếu số phiếu NCC" đếm trên TOÀN SỔ (không theo trang) — cùng hàm với
  // badge menu Sổ phiếu (`nav-badges.warehouseBadges`).
  const [thieu, dem, capDao, canEdit, nguoiLap] = await Promise.all([
    soPhieuRepo.thieuSoNcc(todayVn()),
    docsRepo.countByKind(),
    docsRepo.reversalPairs(),
    user.role === 'admin'
      ? Promise.resolve(true)
      : canAction(user, 'warehouse.stock.write'),
    soPhieuRepo.nguoiLap(),
  ])
  // Tab Nhập / Xuất chỉ phiếu GỐC; "Đã đảo" = gốc + phiếu đảo trên toàn sổ (K5).
  const res = await stockService.listDocs(user, {
    ...locRo(ro, { thieu: thieu.ids, goc: capDao.goc, dao: capDao.dao }),
    reason_code: lyDo,
    created_by: nguoi,
    page: trang,
    page_size: PAGE_SIZE,
  })

  // Mã lý do của từng phiếu: một truy vấn cho cả trang. Dòng cũ (trước 0197)
  // không có mã → suy lại từ ref_type + direction, nếu không sổ nói "tháng 8
  // không có phiếu nào" khi lọc theo mã.
  const pageIds = res.rows.map((d) => d.id)
  const thieuSet = new Set(thieu.ids)
  const [reasons, donLenh, lenhDong] = await Promise.all([
    docsRepo.reasonsByDocIds(pageIds),
    soPhieuRepo.donLenhByDocIds(pageIds),
    // Phiếu xuất cho lệnh không nối đơn mua — lệnh nằm trên dòng xuất.
    soPhieuRepo.lenhTheoDongByDocIds(pageIds),
  ])

  const rows = res.rows.map((d) => ({
    id: d.id,
    code: d.code,
    kind: d.kind,
    doc_date: d.doc_date,
    counterparty: d.counterparty,
    reason: d.reason,
    status: d.status,
    reversal_of_code: d.reversal_of_code,
    da_bi_dao: capDao.goc.has(d.id),
    created_by_name: d.created_by_name,
    supplier_doc_no: d.supplier_doc_no,
    don: donLenh.get(d.id) ?? null,
    lenh_dong: lenhDong.get(d.id) ?? [],
    dien_giai: d.note?.trim() || d.reason?.trim() || null,
    thieu_ncc: thieuSet.has(d.id),
    ma_ly_do: [
      ...new Set(
        (reasons.get(d.id) ?? [])
          .map((m) => m.code ?? suyMaTuLichSu(m.ref_type, m.direction))
          .filter((x): x is string => !!x),
      ),
    ],
  }))

  return (
    <SoPhieuScreen
      rows={rows}
      dem={demRo({ ...dem, goc: capDao.goc.size, thieu: thieu.ids.length })}
      thieuGanDay={thieu.ganDay}
      nguoi={sp.nguoi === 'toi' ? 'toi' : (sp.nguoi ?? '')}
      nguoiLap={nguoiLap}
      meId={user.id}
      total={res.total}
      trang={trang}
      soTrang={Math.max(1, Math.ceil(res.total / PAGE_SIZE))}
      ro={ro}
      lyDo={lyDo ?? ''}
      canEdit={canEdit}
    />
  )
}
