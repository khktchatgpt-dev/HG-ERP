import { emit } from '@/events/bus'
import '@/events/register' // handler audit + chuông đơn mua phải được đăng ký trước khi emit.
import { ngayGioVn } from '@/lib/date-vn'
import {
  GIU_DUYET_THAY_NGAY,
  giaTruocCungNcc,
  lamDuocNgay,
  type DuyetThay,
  type HopXem,
  type XemDon,
} from '@/lib/cho-xem'
import { isBigApprovalWith } from '@/lib/exec-ops'
import { poLineAmount, poMoneyOf } from '@/lib/po-line'
import { properName, supplierShortName } from '@/lib/po-list-labels'
import { nhanNgoaiLenh } from '@/lib/po-muc-dich'
import { reasonLine } from '@/lib/po-note'
import {
  laDuyetKhiChuaXem,
  lyDoChuaTrinh,
  reviewMark,
  reviewMarks,
  traLaiNhap,
  vuaDoiCau,
  vuaGuiDuyetCau,
  type DauDaXem,
  type TraLaiNhap,
  type TruongPhongCtx,
  type VetKy,
} from '@/lib/po-review'
import { poTemplateShort } from '@/lib/po-template'
import {
  approvalEventsRepo,
  type ApprovalAction,
} from '@/modules/core/approvals/approvals.repo'
import { docNotesRepo } from '@/modules/core/doc-notes/doc-notes.repo'
import { assertAction } from '@/modules/core/rbac/rbac.service'
import { settingsService } from '@/modules/core/settings/settings.service'
import { usersRepo, type User } from '@/modules/core/users/users.repo'
import { Conflict, NotFound } from '@/server/http'
import { posRepo, type Po, type PoWithRefs } from './pos.repo'
import { approverIds, leadIds, posService, traceReason } from './pos.service'
import { suppliersRepo } from './supply.repo'
import { productionRepo } from '@/modules/dept/production/production.repo'

/**
 * TRƯỞNG PHÒNG CUNG ỨNG XEM ĐƠN MUA TRƯỚC KHI LÊN BÀN GIÁM ĐỐC (05/11/2026,
 * bản vẽ https://claude.ai/artifact/RcqWLU7F1z33btAR97gZBo, chủ dự án duyệt
 * Q1–Q6).
 *
 * LUỒNG CHỐT 05/11/2026 chiều (sau khi thử trên đơn thật): NV lập NHÁP — không
 * có mốc "gửi trưởng phòng"; trưởng phòng thấy MỌI nháp ở "Chờ tôi xem", bấm
 * "Đã xem — trình GĐ" là đơn lên bàn Giám đốc (= gửi duyệt do anh gọi, tự tính
 * đã xem), hoặc "Trả lại để sửa" (nháp rời hộp tới khi NV sửa). Khi cần NV
 * "Gửi thẳng Giám đốc" — đơn chờ duyệt chưa có dấu xem, anh xem bổ sung được;
 * Giám đốc vẫn duyệt được, `posService.decide` ghi "duyệt khi trưởng phòng
 * chưa xem". "Đã xem" = dòng `reviewed` sau lần `submitted` cuối (lib/po-review).
 *
 * Quyền: `supply.po.manage_any` (permission `supply.lead`, vai trưởng phòng CƯ —
 * Q5). Không có người thay khi trưởng phòng vắng: Giám đốc duyệt thẳng là lối
 * thoát.
 */

/** Các mốc cần để suy dấu "đã xem" của nhiều đơn (lib/po-review `reviewMarks`). */
const VET_XEM: ApprovalAction[] = [
  'submitted',
  'reviewed',
  'withdrawn',
  'returned',
  'rejected',
  'reopened',
]

/** "HH:mm" giờ VN — cho câu "vừa được … lúc 09:18". */
const gioVn = (iso: string) => ngayGioVn(iso).slice(11)

/** Trạng thái màn đang thấy — gửi kèm để bấm trên màn cũ không làm sai việc. */
export type TuTrangThai = 'draft' | 'pending_approval'

/**
 * Màn thấy trạng thái `tu` mà đơn đã đổi → 409 nói thật. Thấy nháp mà đơn đã
 * chờ duyệt = NV vừa gửi thẳng GĐ (câu "vừa gửi duyệt"); còn lại như `daDoi`.
 */
function lech(
  po: Pick<Po, 'code' | 'status'>,
  events: Parameters<typeof vuaDoiCau>[1],
  tu: TuTrangThai,
  viec: string,
) {
  const gui =
    tu === 'draft' && po.status === 'pending_approval'
      ? vuaGuiDuyetCau(po.code, events, gioVn)
      : null
  return gui ? Conflict(gui) : daDoi(po, events, viec)
}

/** Đơn đã rời hàng "chờ trưởng phòng xem" → 409 kèm câu nói thật vì sao. */
function daDoi(
  po: Pick<Po, 'code'>,
  events: Parameters<typeof vuaDoiCau>[1],
  viec: string,
) {
  return Conflict(
    vuaDoiCau(po.code, events, gioVn) ??
      `${po.code} không còn chờ duyệt — không ${viec} được`,
  )
}

/** Phân loại một đơn trong hộp — đủ để `trangThaiXem` (lib/cho-xem) chia nhóm. */
type PhanLoai = {
  mark: DauDaXem | null
  chan: string | null
  traLai: TraLaiNhap | null
}

/**
 * TẬP ĐƠN CỦA HỘP "CHỜ TÔI XEM" + PHÂN LOẠI — `box()` và `choXemCount()` dùng
 * CHUNG (Q7, bản 2 duyệt 06/11/2026): số đỏ trên menu phải đúng bằng số dòng của
 * nhóm "Trình được ngay" + "NV gửi thẳng GĐ" trong hộp.
 *
 * Nháp: MỌI nháp (05/11/2026 đo 6 nháp của 3 người) — kể cả nháp còn thiếu
 * (`lyDoChuaTrinh`) và nháp bị trả lại chưa sửa (`traLaiNhap`), bày ở nhóm riêng.
 * Chờ duyệt: dấu "đã xem" (`reviewMark`) — chưa có = NV gửi thẳng GĐ.
 */
async function tapXem(): Promise<{
  rows: PoWithRefs[]
  phanLoai: Map<string, PhanLoai>
}> {
  const [nhap, pend] = await Promise.all([
    posRepo.list({ status: 'draft', page: 1, page_size: 300 }),
    posRepo.list({ status: 'pending_approval', page: 1, page_size: 300 }),
  ])
  // Nháp (đường thường) đứng trước đơn NV đã gửi thẳng GĐ.
  const rows = [...nhap.rows, ...pend.rows]
  const phanLoai = new Map<string, PhanLoai>()
  if (rows.length === 0) return { rows, phanLoai }
  const nccIds = [...new Set(nhap.rows.map((p) => p.supplier_id))]
  const [ev, soDong, nccs] = await Promise.all([
    approvalEventsRepo.listForEntities(
      'po',
      rows.map((p) => p.id),
      VET_XEM,
    ),
    posRepo.lineCountsByPoIds(nhap.rows.map((p) => p.id)),
    // NCC của nháp — để nói trước "NCC đang khoá đặt hàng" thay vì để anh bấm rồi lỗi.
    Promise.all(nccIds.map((id) => suppliersRepo.findById(id))),
  ])
  const nccOf = new Map(nccs.filter((x) => !!x).map((x) => [x!.id, x!]))
  const theoDon = new Map<string, VetKy[]>()
  for (const e of ev) theoDon.set(e.entity_id, [...(theoDon.get(e.entity_id) ?? []), e])
  for (const p of rows) {
    const vet = theoDon.get(p.id) ?? []
    if (p.status === 'draft') {
      phanLoai.set(p.id, {
        mark: null,
        traLai: traLaiNhap(vet, p.updated_at),
        chan: lyDoChuaTrinh({
          so_dong: soDong.get(p.id) ?? 0,
          expected_at: p.expected_at ?? null,
          production_order_id: p.production_order_id,
          project_id: p.project_id ?? null,
          marketplace_shop: p.marketplace_shop ?? null,
          ncc: nccOf.get(p.supplier_id) ?? null,
        }),
      })
    } else {
      const m = reviewMark(vet)
      if (m) m.by_name = properName(m.by_name) || m.by_name
      phanLoai.set(p.id, { mark: m, chan: null, traLai: null })
    }
  }
  return { rows, phanLoai }
}

/** Hình tối thiểu cho `trangThaiXem` / `lamDuocNgay`. */
const choPhanLoai = (p: { status: string }, l: PhanLoai | undefined) => ({
  nhap: p.status === 'draft',
  mark: l?.mark ?? null,
  chan: l?.chan ?? null,
  tra_lai: l?.traLai ?? null,
})

export const poReviewService = {
  /** Dấu "đã xem" còn hiệu lực của nhiều đơn — cho hộp "Chờ tôi xem" + hộp ký. */
  async marksFor(ids: string[]): Promise<Map<string, DauDaXem>> {
    if (ids.length === 0) return new Map()
    return reviewMarks(await approvalEventsRepo.listForEntities('po', ids, VET_XEM))
  },

  /**
   * TRƯỞNG PHÒNG cho hộp ký + màn ký đơn của Giám đốc (B3): tên người giữ vai
   * trưởng phòng CƯ + dấu đã xem của các đơn `ids`. Chưa ai giữ vai → null
   * (không áp — cột, nhóm, khoá ký nhanh đều tắt; cùng luật `leadIds` mà
   * `posService.decide` dùng để đánh dấu "duyệt khi chưa xem").
   */
  async truongPhongCho(ids: string[]): Promise<TruongPhongCtx> {
    const leads = await leadIds()
    if (leads.length === 0) return null
    const [marks, names] = await Promise.all([
      this.marksFor(ids),
      usersRepo.displayNamesByIds(leads),
    ])
    for (const m of marks.values()) m.by_name = properName(m.by_name) || m.by_name
    const ten =
      leads
        .map((id) => properName(names.get(id)))
        .filter(Boolean)
        .join(' · ') || null
    return { ten, ids: leads, marks }
  },

  /** Dấu "đã xem" của một đơn — cho màn ký đơn và trang đơn. */
  async markOf(id: string): Promise<DauDaXem | null> {
    return reviewMark(await approvalEventsRepo.listByEntity('po', id))
  },

  /**
   * SỐ ĐỎ TRÊN MENU "Chờ tôi xem" (Q7) — chỉ việc anh làm được ngay: nháp trình
   * được + đơn NV gửi thẳng GĐ mà anh chưa xem. Cùng tập đơn (`tapXem`) và cùng
   * vị từ (`lamDuocNgay`) với số trên tab của hộp.
   */
  async choXemCount(): Promise<number> {
    const { rows, phanLoai } = await tapXem()
    return lamDuocNgay(rows.map((p) => choPhanLoai(p, phanLoai.get(p.id)))).length
  },

  /**
   * HỘP "CHỜ TÔI XEM" (khung 1 + 2 của bản vẽ): đơn chờ duyệt kèm dấu xem, dòng
   * hàng + giá đơn trước cùng NCC (Q6), và đơn GĐ duyệt khi chưa xem 7 ngày qua
   * (Q4). Tiền = tổng thanh toán GỒM VAT và "giá trị lớn" theo cùng ngưỡng hộp
   * ký Giám đốc (`poMoneyOf` + `isBigApprovalWith`) — hai hộp nói một con số.
   */
  async box(user: User): Promise<HopXem> {
    await assertAction(user, 'supply.po.manage_any')
    const now = new Date()
    const [{ rows, phanLoai }, thresholds, recent] = await Promise.all([
      tapXem(),
      settingsService.approvalThresholds(),
      approvalEventsRepo.listRecent({
        entity_type: 'po',
        action: 'approved',
        limit: 300,
      }),
    ])
    const ids = rows.map((p) => p.id)
    const tu = now.getTime() - GIU_DUYET_THAY_NGAY * 86_400_000
    const thay = recent.filter((e) => laDuyetKhiChuaXem(e) && Date.parse(e.created_at) >= tu) // prettier-ignore
    const thayIds = [...new Set(thay.map((e) => e.entity_id))]

    const lsxIds = [
      ...new Set(rows.map((p) => p.production_order_id).filter((x): x is string => !!x)),
    ]
    const [totals, mats, submitted, lines, thayPos, lenhs, daDat] = await Promise.all([
      posRepo.totalsByPoIds([...ids, ...thayIds]),
      posRepo.materialNamesByPoIds([...ids, ...thayIds]),
      approvalEventsRepo.lastSubmittedAt('po', [...ids, ...thayIds]),
      Promise.all(ids.map((id) => posRepo.listLines(id))),
      Promise.all(thayIds.map((id) => posRepo.findById(id))),
      // Ngày xuất của lệnh — khung chi tiết nói "lệnh xuất 17/03/2027 · còn 131 ngày".
      Promise.all(lsxIds.map((id) => productionRepo.findById(id))),
      posRepo.orderedCountBySuppliers([...new Set(rows.map((p) => p.supplier_id))]),
    ])
    const xuatOf = new Map(
      lenhs.filter((l) => !!l).map((l) => [l!.id, l!.ship_date ?? null]),
    )
    const ownerOf = (p: { assigned_to: string | null; created_by: string | null }) =>
      p.assigned_to ?? p.created_by ?? null
    const [names, prices] = await Promise.all([
      usersRepo.displayNamesByIds(rows.map(ownerOf).filter((x): x is string => !!x)),
      posRepo.pricesForSuppliers(
        [...new Set(rows.map((p) => p.supplier_id))],
        [
          ...new Set(
            lines
              .flat()
              .map((l) => l.material_id)
              .filter((x): x is string => !!x),
          ),
        ],
      ),
    ])

    const items: XemDon[] = rows.map((p, i) => {
      const money = poMoneyOf(p, totals[p.id] ?? 0)
      const owner = ownerOf(p)
      const l = choPhanLoai(p, phanLoai.get(p.id))
      return {
        id: p.id,
        code: p.code,
        href: `/mua-hang/don/${p.id}`,
        ncc: supplierShortName(p.supplier_name),
        ncc_day_du: p.supplier_name,
        loai: poTemplateShort(p.template),
        materials: [...new Set(mats.get(p.id) ?? [])],
        lsx: p.lsx_code ?? null,
        lenh_xuat: p.production_order_id
          ? (xuatOf.get(p.production_order_id) ?? null)
          : null,
        ngoai_lenh: p.lsx_code ? null : nhanNgoaiLenh(p),
        expected_at: p.expected_at ?? null,
        owner_id: owner,
        owner_name: owner ? properName(names.get(owner)) || null : null,
        lap_at: p.created_at,
        sua_at: p.updated_at,
        hop_dong: p.contract_no?.trim() || null,
        ghi_chu: p.note?.trim() || null,
        ncc_da_dat: daDat.get(p.supplier_id) ?? 0,
        currency: p.currency,
        tien_hang: money.subtotal,
        vat_rate: Number(p.vat_rate ?? 0) || 0,
        vat: money.vatAmount,
        value: money.grandTotal,
        big: isBigApprovalWith(money.grandTotal, p.currency, thresholds),
        // Nháp: lần sửa cuối (không có mốc gửi); chờ duyệt: lần gửi duyệt cuối.
        submitted_at:
          p.status === 'draft' ? p.updated_at : (submitted.get(p.id) ?? p.created_at),
        thanh_toan: p.terms_payment?.trim() || null,
        mark: l.mark as DauDaXem | null,
        nhap: l.nhap,
        chan: l.chan,
        tra_lai: l.tra_lai,
        dong: lines[i].map((l) => ({
          id: l.id,
          ma: l.material_id ? l.material_code : null,
          ten: l.material_name || l.line_name || '—',
          quy_cach: l.spec?.trim() || l.dimension_text?.trim() || null,
          sl: Number(l.qty_ordered) || 0,
          dvt: l.material_unit || l.line_unit || null,
          qd: l.price_basis === 'unit2' ? Number(l.qty2) || 0 : null,
          dvt_gia:
            l.price_basis === 'unit2' ? l.unit2 : l.material_unit || l.line_unit || null,
          don_gia: l.unit_price == null ? null : Number(l.unit_price),
          thanh_tien: poLineAmount(l),
          truoc: giaTruocCungNcc(prices, p.supplier_id, l.material_id, p.id),
        })),
      }
    })

    const duyet_thay: DuyetThay[] = []
    for (const e of thay) {
      const p = thayPos[thayIds.indexOf(e.entity_id)]
      if (!p || duyet_thay.some((d) => d.id === p.id)) continue
      const gui = submitted.get(p.id)
      duyet_thay.push({
        id: p.id,
        code: p.code,
        href: `/mua-hang/don/${p.id}`,
        ncc: supplierShortName(p.supplier_name),
        loai: poTemplateShort(p.template),
        materials: [...new Set(mats.get(p.id) ?? [])],
        lsx: p.lsx_code ?? null,
        by_name: properName(e.actor_name) || null,
        at: e.created_at,
        sau_phut:
          gui && gui <= e.created_at
            ? Math.round((Date.parse(e.created_at) - Date.parse(gui)) / 60_000)
            : null,
        currency: p.currency,
        value: poMoneyOf(p, totals[p.id] ?? 0).grandTotal,
      })
    }
    return { items, duyet_thay, nguong: thresholds, at: now.toISOString() }
  },

  /**
   * ĐÃ XEM — TRÌNH GĐ. Ghi dòng `reviewed` TRỰC TIẾP (không qua handler: handler
   * nuốt lỗi, mà đây là trạng thái của đơn) rồi báo người duyệt.
   *
   * Bấm trùng / đã có người xem → trả dấu cũ, không ghi thêm. Đơn đổi đúng lúc
   * vừa ghi (NV rút về nháp) → đọc lại thấy dấu vô hiệu → 409 nói thật.
   */
  async review(
    user: User,
    id: string,
    note?: string | null,
    tu?: TuTrangThai,
  ): Promise<{ mark: DauDaXem; already: boolean }> {
    await assertAction(user, 'supply.po.manage_any')
    const po = await posRepo.findById(id)
    if (!po) throw NotFound('Đơn đặt không tồn tại')
    // Màn đang thấy trạng thái khác (NV vừa rút về / vừa gửi thẳng) → không làm
    // việc khác ý người ta: 409 nói ai vừa làm gì lúc nào.
    if (tu && po.status !== tu)
      throw lech(po, await approvalEventsRepo.listByEntity('po', id), tu, 'ghi đã xem')
    /*
      NHÁP: "Đã xem — trình GĐ" = gửi duyệt do chính trưởng phòng gọi — đơn lên
      bàn GĐ, tính luôn là đã xem, kèm ghi chú. Hàng rào gửi duyệt áp nguyên
      (thiếu hẹn giao… thì anh thấy câu lỗi đó, màn đã khoá nút từ trước).
    */
    if (po.status === 'draft') {
      await posService.submit(user, id, { note })
      const sau = await approvalEventsRepo.listByEntity('po', id)
      const mark = reviewMark(sau)
      if (!mark) throw daDoi(po, sau, 'trình GĐ')
      return { mark, already: false }
    }
    const truoc = await approvalEventsRepo.listByEntity('po', id)
    if (po.status !== 'pending_approval') throw daDoi(po, truoc, 'ghi đã xem')
    const cu = reviewMark(truoc)
    if (cu) return { mark: cu, already: true }

    await approvalEventsRepo.log({
      entity_type: 'po',
      entity_id: po.id,
      entity_code: po.code,
      action: 'reviewed',
      actor_id: user.id,
      reason: note?.trim() || null,
    })
    const sau = await approvalEventsRepo.listByEntity('po', id)
    const mark = reviewMark(sau)
    if (!mark) throw daDoi(po, sau, 'ghi đã xem')

    const [supplier, approvers] = await Promise.all([
      suppliersRepo.findById(po.supplier_id),
      approverIds(user.id),
    ])
    await emit({
      name: 'po.reviewed',
      po_id: po.id,
      code: po.code,
      supplier_name: supplier?.name ?? '—',
      reviewed_by: user.id,
      note: mark.note,
      approver_ids: approvers,
    })
    return { mark, already: false }
  },

  /**
   * TRẢ LẠI ĐỂ SỬA (trưởng phòng): chờ duyệt → nháp, lý do bắt buộc (schema
   * ≥ 5 ký tự). Lý do vào Trao đổi nội bộ như Giám đốc trả lại — KHÔNG vào
   * `note` (ô đó in lên phiếu gửi NCC). Ghi có điều kiện trạng thái: Giám đốc
   * vừa duyệt cùng lúc thì không kéo đơn đã duyệt về nháp.
   */
  async returnForEdit(
    user: User,
    id: string,
    reason: string,
    tu?: TuTrangThai,
  ): Promise<Po> {
    await assertAction(user, 'supply.po.manage_any')
    const before = await posRepo.findById(id)
    if (!before) throw NotFound('Đơn đặt không tồn tại')
    if (tu && before.status !== tu)
      throw lech(before, await approvalEventsRepo.listByEntity('po', id), tu, 'trả lại')
    /*
      NHÁP: trả lại = mốc `returned` (handler audit ghi) + lý do vào Trao đổi + báo
      NV; đơn vẫn nháp và RỜI hộp trưởng phòng tới khi NV sửa (lib/po-review
      `traLaiNhap`).
    */
    if (before.status === 'draft') {
      await traceReason(user, id, reasonLine('Trả lại để sửa', reason))
      await emit({
        name: 'po.returned',
        po_id: id,
        code: before.code,
        returned_by: user.id,
        reason,
        owner_id: before.assigned_to ?? before.created_by,
      })
      return before
    }
    const po = await posRepo.patchFrom(id, ['pending_approval'], { status: 'draft' })
    if (!po)
      throw daDoi(before, await approvalEventsRepo.listByEntity('po', id), 'trả lại')

    await traceReason(user, id, reasonLine('Trả lại để sửa', reason))
    // Đơn rời bàn duyệt: câu hỏi Giám đốc đang treo trên nó hết đối tượng (như decide).
    await docNotesRepo.resolveQuestions('po', id, user.id, 'decided')
    await emit({
      name: 'po.returned',
      po_id: id,
      code: before.code,
      returned_by: user.id,
      reason,
      owner_id: before.assigned_to ?? before.created_by,
    })
    return po
  },
}
