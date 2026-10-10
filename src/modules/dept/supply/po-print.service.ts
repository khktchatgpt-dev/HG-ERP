import { settingsService } from '@/modules/core/settings/settings.service'
import { docTemplatesService } from '@/modules/core/doc-templates/doc-templates.service'
import { usersRepo } from '@/modules/core/users/users.repo'
import type { User } from '@/modules/core/users/users.repo'
import { posRepo } from './pos.repo'
import { poAdjustmentsRepo } from './po-adjustments.repo'
import { poShipmentsRepo } from './po-shipments.repo'
import { suppliersRepo } from './supply.repo'
import { poRevisionLabel } from '@/lib/po-lsx-refs'
import { poLineAmount, type PoLineAmountInput } from '@/lib/po-line'
import { shipmentAmount } from '@/lib/po-shipments'

/**
 * DỮ LIỆU MỘT TỜ ĐƠN ĐẶT HÀNG — MỘT nguồn cho phiếu in (`/print/supply/[id]`),
 * file Excel (`pos/[id]/export`) và bản XEM TRƯỚC lúc soạn (`/print/supply/nhap`).
 *
 * 05/10/2026: phiếu in và Excel từng tự nạp riêng rồi trôi khỏi nhau. 10/10/2026:
 * "Xem trước" lúc sửa cũng từng tự dựng phiếu từ dữ liệu màn soạn — thiếu địa
 * chỉ / MST / người nhận của NCC và tên người lập — nên in ra một tờ khác tờ ở
 * chi tiết đơn. User chốt "dùng 1 loại thôi, loại trong chi tiết": bản xem trước
 * nay đi qua đúng `dungPhieu` dưới đây, chỉ thay đầu đơn + dòng bằng bản đang gõ.
 *
 * Không gác quyền ở đây — trang in và route tự gác đăng nhập như cũ.
 */

type ShipItem = { qty: number; line: (PoLineAmountInput & { material_name: string; material_unit: string; line_name?: string | null; line_unit?: string | null }) | undefined } // prettier-ignore

/**
 * LỊCH GIAO (28/08): tiền đợt chia TỶ LỆ từ thành tiền dòng (giá không đổi theo
 * đợt — xem shipmentAmount, cùng phép tính với thẻ "Kế hoạch giao" trên màn chi
 * tiết, để giấy và màn khớp nhau).
 */
function shipmentsForPrint(
  rows: { seq: number; expected_date: string; items: ShipItem[] }[],
) {
  return rows.map((sh) => ({
    seq: sh.seq,
    expected_date: sh.expected_date,
    lines: sh.items.map(({ qty, line }) => {
      const money = new Map([
        [
          'x',
          {
            amount: line && line.unit_price != null ? poLineAmount(line) : null,
            qty_ordered: line?.qty_ordered ?? 0,
            approx: line?.price_basis === 'unit2',
          },
        ],
      ])
      const m = shipmentAmount([{ po_line_id: 'x', qty }], money)
      return {
        name: line?.material_name || line?.line_name || '?',
        qty,
        unit: line?.material_unit || line?.line_unit || '',
        amount: m.priced ? m.amount : null,
      }
    }),
  }))
}

export async function loadPoPrint(id: string) {
  const po = await posRepo.findById(id)
  if (!po) return null
  const [lines, supplier, company, refs, tpl, rawShipments, adjs, creator] =
    await Promise.all([
      posRepo.listLines(id),
      suppliersRepo.findById(po.supplier_id),
      settingsService.getAll(),
      posRepo.printRefs(po),
      docTemplatesService.get('PO'),
      poShipmentsRepo.listByPo(id),
      poAdjustmentsRepo.listByPo(id),
      po.created_by ? usersRepo.findById(po.created_by) : Promise.resolve(null),
    ])

  const lineById = new Map(lines.map((l) => [l.id, l]))
  // Chỉ đợt còn sống.
  const shipments = shipmentsForPrint(
    rawShipments
      .filter((sh) => sh.status !== 'cancelled')
      .map((sh) => ({
        seq: sh.seq,
        expected_date: sh.expected_date,
        items: sh.lines.map((l) => ({ qty: l.qty, line: lineById.get(l.po_line_id) })),
      })),
  )

  /*
   * Tên NGƯỜI LẬP dưới nét ký. Ưu tiên người soạn đơn; đơn nạp từ dữ liệu cũ
   * không có `created_by` thì lấy người phụ trách (0128) — thà đúng một người
   * đang cầm đơn còn hơn để trống nét ký trên tờ gửi NCC.
   */
  const creatorName = creator ? (creator.name ?? creator.email) : po.assignee_name

  return {
    company,
    tpl,
    shipments,
    supplier,
    lines,
    // Đơn gộp nhiều LSX (0125): phiếu ghi "LSX 04.26.27 + 02.26.27" như sổ thật.
    po: {
      ...po,
      template: po.template ?? 'simple',
      lsx_code: refs.lsx_code,
      lsx_set: refs.lsx_set,
      order_code: refs.order_code,
      revision_label: poRevisionLabel(adjs),
      creator_name: creatorName,
    },
  }
}

/** Bản đang gõ gửi lên để xem trước — đầu đơn + dòng đã dựng sẵn ở màn soạn. */
export type PoPrintDraftInput<H, L> = {
  /** Đơn đang sửa; null = đơn mới chưa lưu. */
  po_id: string | null
  supplier_id: string | null
  lsx_id: string | null
  extra_lsx_ids: string[]
  header: H
  lines: L[]
  /** Đợt giao đang khai trên màn soạn — `line_index` trỏ vào `lines`. */
  shipments: { expected_date: string; lines: { line_index: number; qty: number }[] }[]
}

/**
 * PHIẾU XEM TRƯỚC TỪ BẢN ĐANG GÕ — cùng nguồn với `loadPoPrint`: công ty, mẫu chứng
 * từ, hồ sơ NCC ĐẦY ĐỦ (địa chỉ, MST, người nhận), khung LSX, người lập, nhãn điều
 * chỉnh đều nạp ở server như trang in chi tiết. Chỉ đầu đơn + dòng + đợt giao lấy
 * từ bản đang gõ (chưa lưu). Không ghi gì.
 */
export async function loadPoPrintDraft<
  H extends { supplier_name: string; created_at: string },
  L extends ShipItem['line'] & object,
>(user: User, input: PoPrintDraftInput<H, L>) {
  const po = input.po_id ? await posRepo.findById(input.po_id) : null
  const [supplier, company, refs, tpl, adjs, creator] = await Promise.all([
    input.supplier_id ? suppliersRepo.findById(input.supplier_id) : Promise.resolve(null),
    settingsService.getAll(),
    posRepo.printRefsByIds(
      input.lsx_id,
      input.extra_lsx_ids.map((id) => ({ id })),
    ),
    docTemplatesService.get('PO'),
    po ? poAdjustmentsRepo.listByPo(po.id) : Promise.resolve([]),
    po?.created_by ? usersRepo.findById(po.created_by) : Promise.resolve(null),
  ])
  // Đơn mới: người lập là người đang soạn — đúng người sẽ đứng tên khi lưu.
  const creatorName = po
    ? creator
      ? (creator.name ?? creator.email)
      : po.assignee_name
    : (user.name ?? user.email)
  const shipments = shipmentsForPrint(
    input.shipments.map((sh, k) => ({
      seq: k + 1,
      expected_date: sh.expected_date,
      items: sh.lines.map((l) => ({ qty: l.qty, line: input.lines[l.line_index] })),
    })),
  )
  return {
    company,
    tpl,
    shipments,
    supplier,
    lines: input.lines,
    po: {
      ...input.header,
      code: po?.code ?? '(cấp khi lưu)',
      created_at: po?.created_at ?? input.header.created_at,
      supplier_name: supplier?.name ?? input.header.supplier_name,
      lsx_code: refs.lsx_code,
      lsx_set: refs.lsx_set,
      order_code: refs.order_code,
      revision_label: po ? poRevisionLabel(adjs) : null,
      creator_name: creatorName,
    },
  }
}
