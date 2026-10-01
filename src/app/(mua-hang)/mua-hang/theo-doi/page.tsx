import { canAction } from '@/modules/core/rbac/rbac.service'
import { defaultScope, isMyPo, parseScope } from '@/lib/supply-scope'
import { authService } from '@/modules/core/auth/auth.service'
import { isSupplyStaff } from '@/modules/dept/supply/suppliers.service'
import { incomingBucket, isIncoming } from '@/lib/supply-watch'
import { cachGiao, tenChanh } from '@/lib/cach-giao'
import { loadWatchPos, todayIso } from '@/app/(mua-hang)/mua-hang/_data/watch'
import { tripsService } from '@/modules/dept/supply/trips.service'
import { poCostsRepo } from '@/modules/dept/supply/po-costs.repo'
import { DangVeScreen } from './DangVeScreen'
import { taiGiaoNhan } from './giao-nhan/tai-giao-nhan'

export const metadata = { title: 'Mua hàng · Theo dõi đơn hàng' }
export const dynamic = 'force-dynamic'

/**
 * ĐƠN MUA › ĐANG VỀ (01/10/2026) — thay mục "Nhận hàng" riêng. Bản vẽ: canvas
 * "Cung ứng · Hàng về", artboard C2 (chủ dự án duyệt 01/10).
 *
 * Câu màn trả lời: "hàng nào về hôm nay, cái nào trễ, cái nào chưa có ngày?"
 * — trục là THỜI GIAN. Đơn chưa gửi NCC không có mặt (`isIncoming` loại
 * `approved`): chưa ai chuẩn bị hàng thì chưa thể "đang về".
 *
 * KHÔNG VIẾT TRUY VẤN MỚI: `loadWatchPos` + `incomingBucket` là đúng thứ Hộp
 * thư, Bàn làm việc và Kho › Hàng về đang dùng — các nơi không đếm khác nhau.
 *
 * Mới so với "Nhận hàng": cột Cách giao (suy từ câu nơi giao, `lib/cach-giao`),
 * và ghi hẹn giao / NCC xác nhận NGAY TRÊN DÒNG, không phải mở đơn.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    /** Mở hộp Giao nhận của một đơn (bản vẽ H1). */
    don?: string
    pham_vi?: string
    nhom?: string
    /** Vừa ghi sổ phiếu nhập ở cửa Cung ứng (`/mua-hang/don/[id]/nhan`). */
    vua_ghi?: string
    ma?: string
    chi_tiet?: string
  }>
}) {
  const sp = await searchParams
  const user = await authService.requirePageUser()
  const [
    { rows, truncatedAt },
    supplyStaff,
    canApprove,
    canManageAny,
    trips,
    carriers,
    canReceive,
    giaoNhan,
  ] = await Promise.all([
      loadWatchPos(user),
      isSupplyStaff(user),
      user.role === 'admin'
        ? Promise.resolve(true)
        : canAction(user, 'supply.po.approve'),
      user.role === 'admin'
        ? Promise.resolve(true)
        : canAction(user, 'supply.po.manage_any'),
      // Chuyến hàng còn theo dõi (0216) + danh mục nhà xe để gợi ý tên.
      tripsService.list(user, { openOnly: true }),
      poCostsRepo.carriers(),
      // Cung ứng TẠM nhận hàng thay Kho (01/10/2026): nút Nhận hàng hiện theo
      // ĐÚNG quyền ghi phiếu kho — gỡ vai Kho là nút tự ẩn, không sửa code.
      user.role === 'admin'
        ? Promise.resolve(true)
        : canAction(user, 'warehouse.stock.write'),
      sp.don ? taiGiaoNhan(user, sp.don) : Promise.resolve(null),
    ])
  const today = todayIso()
  const staff = user.role === 'admin' || supplyStaff
  const incoming = rows.filter(isIncoming)
  // Gợi ý tên chành: danh mục nhà xe + tên chành đọc được trên câu nơi giao của đơn.
  const carrierNames = new Map<string, string | null>()
  for (const c of carriers) carrierNames.set(c.name, c.id)
  for (const p of rows) {
    const t = tenChanh(p.terms_delivery_place)
    if (
      t &&
      ![...carrierNames.keys()].some((k) => k.toLowerCase().includes(t.toLowerCase()))
    )
      carrierNames.set('Chành xe ' + t, null)
  }

  return (
    <DangVeScreen
      today={today}
      truncatedAt={truncatedAt}
      rows={incoming.map((p) => ({
        id: p.id,
        code: p.code,
        supplier_name: p.supplier_name,
        lsx_code: p.lsx_code,
        status: p.status,
        expected_at: p.expected_at,
        currency: p.currency,
        total: p.total,
        assignee_name: p.assignee_name,
        lines_done: p.lines_done ?? 0,
        lines_total: p.lines_total ?? 0,
        bucket: incomingBucket(p, today) ?? 'no_eta',
        mine: isMyPo(p, user.id),
        cach: cachGiao(p.terms_delivery_place),
        chanh: tenChanh(p.terms_delivery_place),
        // Cùng luật với `assertPoOwner` ở server: người phụ trách (chưa giao ai
        // thì người lập) hoặc người được thao tác mọi đơn. Server vẫn là người quyết.
        editable: staff && (canManageAny || (p.assigned_to ?? p.created_by) === user.id),
      }))}
      trips={trips.map((t) => ({
        id: t.id,
        code: t.code,
        mode: t.mode,
        carrier_name: t.carrier_name,
        carrier_id: t.carrier_id,
        receipt_no: t.receipt_no,
        sent_on: t.sent_on,
        eta: t.eta,
        packages: t.packages,
        package_unit: t.package_unit,
        weight_kg: t.weight_kg,
        note: t.note,
        status: t.status,
        pos: t.pos.map((p) => ({
          id: p.id,
          code: p.code,
          supplier_name: p.supplier_name,
        })),
      }))}
      carriers={[...carrierNames].map(([name, id]) => ({ id, name }))}
      canTrip={staff}
      canReceive={canReceive}
      vuaGhi={
        sp.vua_ghi && sp.ma
          ? { id: sp.vua_ghi, code: sp.ma, detail: sp.chi_tiet ?? 'đã vào sổ' }
          : null
      }
      meId={user.id}
      defaultScope={defaultScope({ canApprove })}
      urlScope={parseScope(sp.pham_vi)}
      initialNhom={sp.nhom ?? null}
      giaoNhan={giaoNhan}
    />
  )
}
