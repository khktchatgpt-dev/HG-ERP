import type { ComponentProps } from 'react'
import type { User } from '@/modules/core/users/users.repo'
import { canAction } from '@/modules/core/rbac/rbac.service'
import { posService } from '@/modules/dept/supply/pos.service'
import { poShipmentsRepo } from '@/modules/dept/supply/po-shipments.repo'
import { RECEIVABLE } from '@/modules/dept/supply/supply.repo'
import { PO_STATUS_LABEL, type PoStatus } from '@/lib/po-status'
import { settingsService } from '@/modules/core/settings/settings.service'
import { docTemplatesService } from '@/modules/core/doc-templates/doc-templates.service'
import { todayVn } from '@/lib/date-vn'
import { dungLuoi } from '@/lib/kho-phieu-nhap'
import type { NoiNhan, PhieuNhapScreen } from './PhieuNhapScreen'

type Props = ComponentProps<typeof PhieuNhapScreen>

/**
 * NẠP PHIẾU NHẬP THEO ĐƠN — dùng chung cho HAI cửa vào cùng một form:
 * Kho › Hàng về (`/warehouse/nhap/[poId]`) và Cung ứng › Đang về
 * (`/mua-hang/don/[id]/nhan`, 01/10/2026 — Cung ứng tạm nhận hàng thay Kho).
 *
 * KHÔNG TRUY VẤN MỚI: dòng đơn + đặt/đã về/còn mở lấy từ đúng
 * `posService.detail` mà `/mua-hang/don/[id]` dùng, nên các màn không thể hiện
 * hai con số cho một dòng. Đợt giao từ `poShipmentsRepo.listByPo`.
 *
 * Trả `chan` khi đơn không nhận được — page nói thẳng vì sao, không mở form
 * ghi sổ vào đơn sai. Cửa Cung ứng chặn thêm đơn ĐÃ DUYỆT CHƯA GỬI NCC (chủ dự
 * án chốt 01/10): không có chuyện hàng về cho một đơn nhà cung cấp chưa nhận.
 */
export async function taiPhieuNhap(
  user: User,
  poId: string,
  dotId: string | undefined,
  noi: NoiNhan,
): Promise<
  | { kind: 'chan'; po: { id: string; code: string }; reason: string; chuaGui: boolean }
  | { kind: 'ok'; props: Props }
> {
  const [{ po, lines, status_lines }, shipments, company, tpl, canEdit] =
    await Promise.all([
      posService.detail(user, poId),
      poShipmentsRepo.listByPo(poId),
      // Xem bản in TRƯỚC khi ghi sổ (yêu cầu 16/09): mẫu 01-VT + khối công ty.
      settingsService.getAll(),
      docTemplatesService.get('PNK'),
      user.role === 'admin'
        ? Promise.resolve(true)
        : canAction(user, 'warehouse.stock.write'),
    ])

  const chuaGui = noi === 'cung-ung' && po.status === 'approved'
  if (!(RECEIVABLE as readonly string[]).includes(po.status) || chuaGui) {
    return {
      kind: 'chan',
      po: { id: po.id, code: po.code },
      chuaGui,
      reason: chuaGui
        ? 'Đơn đã duyệt nhưng CHƯA GỬI nhà cung cấp — nhà cung cấp chưa nhận đơn thì chưa thể có hàng về. Gửi đơn cho NCC trước, rồi mới nhận hàng.'
        : `Đơn đang ở trạng thái "${PO_STATUS_LABEL[po.status as PoStatus] ?? po.status}". Chỉ đơn đã gửi nhà cung cấp và còn phần chưa về mới lập được phiếu nhập.`,
    }
  }

  // Cách tính giá / đơn vị 2 của dòng đơn → biết dòng nào phải ghi kg cân.
  const lineById = new Map(lines.map((l) => [l.id, l]))
  const dongDon = status_lines.map((s) => {
    const l = lineById.get(s.id)
    return {
      ...s,
      price_basis: l?.price_basis ?? null,
      unit2: l?.unit2 ?? null,
      qty2: l?.qty2 ?? null,
    }
  })
  const dot = dotId ? (shipments.find((s) => s.id === dotId) ?? null) : null
  const { rows, bo_qua_tu_do } = dungLuoi(dongDon, dot?.lines ?? null, po.template)

  return {
    kind: 'ok',
    props: {
      noi,
      po: {
        id: po.id,
        code: po.code,
        supplier_name: po.supplier_name,
        lsx_code: po.lsx_code,
        expected_at: po.expected_at,
      },
      dot: dot
        ? {
            id: dot.id,
            seq: dot.seq,
            total: shipments.length,
            expected_date: dot.expected_date,
          }
        : null,
      dots: shipments.map((s) => ({
        id: s.id,
        seq: s.seq,
        expected_date: s.expected_date.slice(0, 10),
        status: s.status,
        lines: s.lines,
      })),
      rows,
      boQuaTuDo: bo_qua_tu_do,
      today: todayVn(),
      nguoiNhan: user.name ?? user.email,
      canEdit,
      company,
      tpl,
    },
  }
}
