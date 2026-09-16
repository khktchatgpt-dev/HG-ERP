import { authService } from '@/modules/core/auth/auth.service'
import { canAction } from '@/modules/core/rbac/rbac.service'
import { posService } from '@/modules/dept/supply/pos.service'
import { poShipmentsRepo } from '@/modules/dept/supply/po-shipments.repo'
import { RECEIVABLE } from '@/modules/dept/supply/supply.repo'
import { PO_STATUS_LABEL, type PoStatus } from '@/lib/po-status'
import { todayVn } from '@/lib/date-vn'
import { dungLuoi } from '@/lib/kho-phieu-nhap'
import { Btn, Empty } from '@/components/kit'
import { PhieuNhapScreen } from './PhieuNhapScreen'

export const metadata = { title: 'Kho · Nhận hàng' }
export const dynamic = 'force-dynamic'

/**
 * PHIẾU NHẬP THEO ĐƠN MUA — `/warehouse/nhap/[poId]?dot=<shipment_id>`
 * (Bước 1 Kho, việc 3: form; việc 4 nối ghi sổ).
 *
 * KHÔNG TRUY VẤN MỚI: dòng đơn + đặt/đã về/còn mở lấy từ đúng
 * `posService.detail` mà `/mua-hang/don/[id]` dùng, nên hai màn không thể
 * hiện hai con số cho một dòng. Đợt giao từ `poShipmentsRepo.listByPo`.
 *
 * Đơn không ở trạng thái nhận được (chưa gửi NCC, đã về đủ, đã huỷ) thì màn
 * nói thẳng vì sao và dẫn về đơn — không mở một form ghi sổ vào đơn sai.
 */
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ poId: string }>
  searchParams: Promise<{ dot?: string }>
}) {
  const user = await authService.requirePageUser()
  const [{ poId }, sp] = await Promise.all([params, searchParams])

  const [{ po, status_lines }, shipments, canEdit] = await Promise.all([
    posService.detail(user, poId),
    poShipmentsRepo.listByPo(poId),
    user.role === 'admin'
      ? Promise.resolve(true)
      : canAction(user, 'warehouse.stock.write'),
  ])

  if (!(RECEIVABLE as readonly string[]).includes(po.status)) {
    return (
      <div className="theme-v3 kit text-foreground -m-6 flex min-h-0 flex-col">
        <Empty
          headline={`${po.code} chưa nhận hàng được`}
          reason={`Đơn đang ở trạng thái "${PO_STATUS_LABEL[po.status as PoStatus] ?? po.status}". Chỉ đơn đã gửi nhà cung cấp và còn phần chưa về mới lập được phiếu nhập.`}
          next={
            <>
              <Btn href="/warehouse/nhap">Về Hàng về</Btn>
              <Btn primary href={`/mua-hang/don/${po.id}`}>
                Mở đơn {po.code}
              </Btn>
            </>
          }
        />
      </div>
    )
  }

  const dot = sp.dot ? (shipments.find((s) => s.id === sp.dot) ?? null) : null
  const { rows, bo_qua_tu_do } = dungLuoi(status_lines, dot?.lines ?? null)

  return (
    <PhieuNhapScreen
      po={{
        id: po.id,
        code: po.code,
        supplier_name: po.supplier_name,
        lsx_code: po.lsx_code,
        expected_at: po.expected_at,
      }}
      dot={
        dot
          ? {
              id: dot.id,
              seq: dot.seq,
              total: shipments.length,
              expected_date: dot.expected_date,
            }
          : null
      }
      rows={rows}
      boQuaTuDo={bo_qua_tu_do}
      today={todayVn()}
      nguoiNhan={user.name ?? user.email}
      canEdit={canEdit}
    />
  )
}
