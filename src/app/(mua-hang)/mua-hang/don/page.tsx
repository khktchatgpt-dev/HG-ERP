import { authService } from '@/modules/core/auth/auth.service'
import { canAction } from '@/modules/core/rbac/rbac.service'
import { posService } from '@/modules/dept/supply/pos.service'
import { posRepo } from '@/modules/dept/supply/pos.repo'
import { supplyRepo } from '@/modules/dept/supply/supply.repo'
import { suppliersService, isSupplyStaff } from '@/modules/dept/supply/suppliers.service'
import { productionRepo } from '@/modules/dept/production/production.repo'
import { todayIso } from '@/app/(workspace)/planning/_data/watch'
import { DonScreen } from './DonScreen'
import { DEFAULT_VIEW_ID, decodeView, namedView } from './views'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Mua hàng · Phiếu mua' }

/**
 * KHUÔN C — PHIẾU MUA. Bản dựng lại của `/planning/pos`.
 *
 * Phân tích + quyết định thiết kế nằm ở `docs/mua-hang-phieu-mua.md` — đối
 * chiếu SAP Fiori / Dynamics 365 / Odoo / NetSuite, tám lối mòn đo được của màn
 * cũ, và bản đồ tính năng cũ → mới để kiểm không sót. Đọc file đó trước khi sửa
 * file này.
 *
 * TẦNG SERVER NÀY NẠP Y HỆT MÀN CŨ — cùng truy vấn, cùng trần 1.000, cùng ba
 * lượt gộp (tiền / dòng đã về / lệnh phụ). Không có nguồn số thứ hai: hai màn
 * phải đếm ra cùng một con số, không thì người dùng bỏ cả hai.
 *
 * Khung nhìn giải mã từ URL ở đây để HTML đầu tiên đã đúng — không nháy từ
 * "Tất cả" sang "Đơn của tôi" sau khi hydrate.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const sp = await searchParams
  const user = await authService.requirePageUser()
  const [supplyStaff, canManageAny, canApprove] = await Promise.all([
    isSupplyStaff(user),
    canAction(user, 'supply.po.manage_any'),
    canAction(user, 'supply.po.approve'),
  ])
  const canEdit = user.role === 'admin' || supplyStaff

  const PAGE_CAP = 1000
  const [{ rows: pos }, { rows: suppliers }, lsxs] = await Promise.all([
    posService.list(user, { page: 1, page_size: PAGE_CAP }),
    suppliersService.list(user, { active_only: true, page: 1, page_size: 500 }),
    productionRepo.listActive(),
  ])
  const poIds = pos.map((p) => p.id)
  const [totals, lineDone, extraLsx] = await Promise.all([
    posRepo.totalsByPoIds(poIds),
    supplyRepo.lineDoneByPoIds(poIds),
    posRepo.extraLsxByPoIds(poIds),
  ])

  /**
   * `?mo=<id>` (và `?view=<id>` cho tương thích với form soạn đơn cũ, vốn
   * redirect về đây sau khi lưu nháp): mở KHAY của đúng đơn đó. Màn cũ đẩy
   * thẳng sang trang chi tiết — người soạn vừa lưu xong đã bị lôi khỏi danh
   * sách. Khay giữ chỗ đứng.
   *
   * Đơn vừa lưu thường là nháp của mình nên nằm trong khung nhìn mặc định;
   * nếu URL không chỉ khung nhìn nào thì mở "Tất cả" cho chắc — mở khay mà
   * dòng bị bộ lọc giấu đi thì người dùng tưởng đơn mất.
   */
  const openId = sp.mo ?? sp.view ?? null
  const asked = sp.nhin ?? (openId ? 'tat-ca' : DEFAULT_VIEW_ID)
  const hasCustom = Object.keys(sp).some((k) =>
    ['q', 'trang_thai', 'ncc', 'loai', 'toi', 'tre', 'chua_hen', 'gom', 'sap'].includes(
      k,
    ),
  )
  const initial = hasCustom ? decodeView(sp) : (namedView(asked)?.state ?? decodeView(sp))

  return (
    <DonScreen
      today={todayIso()}
      pos={pos.map((p) => ({
        ...p,
        total: totals[p.id] ?? 0,
        lines_done: lineDone.get(p.id)?.done ?? 0,
        lines_total: lineDone.get(p.id)?.total ?? 0,
        extra_lsx: extraLsx.get(p.id) ?? [],
      }))}
      suppliers={suppliers.map((s) => ({ id: s.id, name: s.name }))}
      lsxs={lsxs.map((l) => ({
        id: l.id,
        code: l.code,
        order_codes: l.order_codes,
        customer_name: l.customer_name,
        materials_due_at: l.materials_due_at,
      }))}
      meId={user.id}
      canEdit={!!canEdit}
      canApprove={canApprove}
      canManageAny={user.role === 'admin' || canManageAny}
      truncatedAt={pos.length >= PAGE_CAP ? PAGE_CAP : null}
      initial={initial}
      openId={openId}
    />
  )
}
