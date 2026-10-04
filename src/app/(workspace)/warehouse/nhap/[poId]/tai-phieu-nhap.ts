import type { ComponentProps } from 'react'
import type { User } from '@/modules/core/users/users.repo'
import { canAction } from '@/modules/core/rbac/rbac.service'
import { posService } from '@/modules/dept/supply/pos.service'
import { poShipmentsRepo } from '@/modules/dept/supply/po-shipments.repo'
import { RECEIVABLE } from '@/modules/dept/supply/supply.repo'
import { docsRepo } from '@/modules/dept/warehouse/stock.repo'
import { PO_STATUS_LABEL, type PoStatus } from '@/lib/po-status'
import { settingsService } from '@/modules/core/settings/settings.service'
import { docTemplatesService } from '@/modules/core/doc-templates/doc-templates.service'
import { todayVn } from '@/lib/date-vn'
import { dungLuoi } from '@/lib/kho-phieu-nhap'
import { gopMa } from '@/lib/phieu-nhap-cho'
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
  /** "Sửa phiếu nhập" (02/10/2026): id phiếu cũ ĐÃ ĐẢO — điền sẵn phiếu mới bằng số của nó. */
  suaId?: string,
): Promise<
  | { kind: 'chan'; po: { id: string; code: string }; reason: string; chuaGui: boolean }
  | { kind: 'ok'; props: Props }
> {
  const [{ po, lines, status_lines, extra_lsx }, shipments, company, tpl, canEdit, cu, cuDong, cuDao] =
    await Promise.all([
      posService.detail(user, poId),
      poShipmentsRepo.listByPo(poId),
      // Xem bản in TRƯỚC khi ghi sổ (yêu cầu 16/09): mẫu 01-VT + khối công ty.
      settingsService.getAll(),
      docTemplatesService.get('PNK'),
      user.role === 'admin'
        ? Promise.resolve(true)
        : canAction(user, 'warehouse.stock.write'),
      suaId ? docsRepo.findById(suaId) : Promise.resolve(null),
      suaId ? docsRepo.redoLines(suaId) : Promise.resolve(null),
      suaId ? docsRepo.findReversalOf(suaId) : Promise.resolve(null),
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
      product_code: l?.product_code ?? null,
      spec: l?.spec ?? null,
      line_note: l?.note ?? null,
    }
  })
  const dot = dotId ? (shipments.find((s) => s.id === dotId) ?? null) : null
  const luoi = dungLuoi(dongDon, dot?.lines ?? null, po.template)
  const { bo_qua_tu_do } = luoi
  /*
    SỬA PHIẾU NHẬP: chỉ nhận phiếu NHẬP của CHÍNH đơn này và ĐÃ ĐẢO (đảo trước,
    lập lại sau — ở hộp Sửa phiếu). Không khớp thì mở phiếu trống như thường, không
    điền số lạ. Dòng không có trong phiếu cũ để 0: chỉ ghi lại đúng thứ đã ghi.
  */
  const suaHop =
    cu && cuDong && cuDao && cu.kind === 'receipt' && [...cuDong.keys()].some((k) => lineById.has(k))
  const rows = suaHop
    ? luoi.rows.map((r) => {
        const o = cuDong.get(r.po_line_id)
        if (!o || !r.editable) return { ...r, qty: 0 }
        return { ...r, qty: o.qty, status: o.stock_status === 'blocked' ? ('blocked' as const) : ('ok' as const), note: o.note ?? '', kg_can: o.qty2_actual } // prettier-ignore
      })
    : luoi.rows

  return {
    kind: 'ok',
    props: {
      noi,
      suaLai: suaHop
        ? { code: cu.code, daoBoi: cuDao.code, docDate: cu.doc_date.slice(0, 10), supplierDocNo: cu.supplier_doc_no ?? '', counterparty: cu.counterparty ?? '' } // prettier-ignore
        : null,
      po: {
        id: po.id,
        code: po.code,
        supplier_name: po.supplier_name,
        lsx_code: po.lsx_code,
        // Đơn gom nhiều lệnh (0125): đủ mọi lệnh — đầu phiếu + bản in (04/10/2026).
        lsx_codes: gopMa([po.lsx_code, ...extra_lsx.map((x) => x.code)]),
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
