import { posRepo, type Po, type PoLineInput } from './pos.repo'
import {
  FREE_LINE_TEMPLATES,
  deriveLine,
  poTemplateMeta,
  type PoTemplate,
} from '@/lib/po-template'
import { suppliersRepo, supplyRepo } from './supply.repo'
import { assertAction, canAction } from '@/modules/core/rbac/rbac.service'
import { rbacRepo } from '@/modules/core/rbac/rbac.repo'
import { productionRepo } from '@/modules/dept/production/production.repo'
import { departmentsRepo } from '@/modules/core/departments/departments.repo'
import { usersRepo, type User } from '@/modules/core/users/users.repo'
import { emit } from '@/events/bus'
import '@/events/register' // Đăng ký handler event ở lần import đầu (notif PO + audit).
import {
  buildCatalogSuggestions,
  linesByMaterial,
  specFromLine,
  type CatalogSuggestion,
} from '@/lib/po-catalog-backfill'
import { materialsRepo } from '@/modules/dept/warehouse/warehouse.repo'
import { BadRequest, Forbidden, NotFound } from '@/server/http'
import { canReschedule, rescheduleNote } from '@/lib/po-reschedule'
import { poShipmentsRepo, type PoShipment } from './po-shipments.repo'
import {
  earliestExpectedDate,
  nextSeq,
  validateShipments,
  type ShipmentInput,
} from '@/lib/po-shipments'

type PoInput = {
  /** LSX gắn với đơn; null/bỏ trống = PO ngoài LSX (0076). */
  production_order_id?: string | null
  /** LSX PHỤ gộp thêm (0125) — "LSX 01+2+3/26-27". Chỉ khi có LSX chính. */
  extra_lsx_ids?: string[]
  supplier_id: string
  template?: PoTemplate
  currency: string
  vat_rate?: number | null
  price_includes_vat: boolean
  discount_amount?: number | null
  contract_no?: string | null
  expected_at?: string | null
  terms?: string | null
  terms_quality?: string | null
  terms_delivery_place?: string | null
  terms_payment?: string | null
  terms_invoice?: string | null
  terms_lead_time?: string | null
  signer_role?: string | null
  note?: string | null
  lines: PoLineInput[]
}

/**
 * Chốt (qty2, unit2, price_basis) của từng dòng theo MẪU ĐƠN — server tính, không
 * tin số client gửi. Client vẫn tính y hệt để hiển thị (cùng `deriveLine`), nhưng
 * con số vào DB phải là con số server dẫn ra từ chính thông số của dòng; nếu
 * không, một request thủ công có thể ghi tổng kg không khớp kg/m × dài × cây rồi
 * đi thẳng qua bàn duyệt của Giám đốc.
 */
function withDerived(template: PoTemplate, lines: PoLineInput[]): PoLineInput[] {
  return lines.map((l) => ({ ...l, ...deriveLine(template, l) }))
}

/** Trường mô tả của dòng đơn có thể chảy về danh mục (13/08/2026). */
function catalogLines(lines: PoLineInput[]) {
  return lines.map((l) => ({
    material_id: l.material_id ?? null,
    // Quy cách SUY từ dòng khi mẫu không có ô "Quy cách" (carton gõ lọt lòng,
    // kính/xốp gõ dimension_text) — xem specFromLine.
    spec: specFromLine(l),
    material_grade: l.material_grade ?? null,
    finish: l.finish ?? null,
    open_style: l.open_style ?? null,
    pcs_per_ctn: l.pcs_per_ctn ?? null,
  }))
}

/**
 * DÒNG TỰ DO (0134) chỉ dành cho mẫu gỗ — các mẫu khác bắt buộc gắn vật tư
 * danh mục để tồn kho, giá mua gần nhất và sổ nhận hàng có chỗ bám.
 * Schema đã bắt "null thì phải có tên"; đây là lớp chặn THEO MẪU (schema không
 * biết template sau khi update fallback về mẫu cũ của đơn).
 */
function assertFreeLinesAllowed(template: PoTemplate, lines: PoLineInput[]): void {
  if (FREE_LINE_TEMPLATES.includes(template)) return
  if (lines.some((l) => !l.material_id)) {
    throw BadRequest('Dòng không gắn vật tư chỉ dùng được ở mẫu "Gỗ chi tiết theo m³"')
  }
}

/**
 * Chuẩn hoá + kiểm tra bộ LSX PHỤ (0125): bỏ trùng, bỏ trùng với LSX chính,
 * từng lệnh phải tồn tại và đã qua duyệt (cùng luật với LSX chính). Đơn ngoài
 * LSX mà gửi LSX phụ là dữ liệu mâu thuẫn — chặn thẳng.
 */
async function checkedExtraLsxIds(
  primaryLsxId: string | null,
  ids: string[] | undefined,
): Promise<string[]> {
  const list = [...new Set(ids ?? [])].filter((id) => id !== primaryLsxId)
  if (list.length === 0) return []
  if (!primaryLsxId) {
    throw BadRequest('Đơn ngoài LSX không gộp thêm LSX phụ được — chọn LSX chính trước')
  }
  for (const id of list) {
    const lsx = await productionRepo.findById(id)
    if (!lsx) throw NotFound('LSX phụ không tồn tại')
    if (lsx.status === 'pending_approval' || lsx.status === 'rejected') {
      throw BadRequest(`LSX ${lsx.code} chưa được Giám đốc duyệt — chưa đặt vật tư được`)
    }
  }
  return list
}

/**
 * ROW-LEVEL (0128): thao tác GHI trên đơn chỉ dành cho NGƯỜI PHỤ TRÁCH
 * (`assigned_to`, đơn cũ chưa backfill thì rơi về `created_by`) — trừ trưởng
 * phòng Cung ứng (`supply.po.manage_any` ← permission `supply.lead`) và admin.
 * Gọi SAU `assertAction('supply.po.manage')` — cổng "là nhân sự cung ứng" vẫn
 * đứng trước, đây là lớp "đúng người" bên trong phòng.
 */
async function assertPoOwner(
  user: User,
  po: { assigned_to: string | null; created_by: string | null },
): Promise<void> {
  if (user.role === 'admin') return
  if (await canAction(user, 'supply.po.manage_any')) return
  const ownerId = po.assigned_to ?? po.created_by
  if (ownerId === user.id) return
  const owner = ownerId ? await usersRepo.findById(ownerId) : null
  const label = owner?.name ?? owner?.email ?? 'người khác'
  throw Forbidden(
    `Đơn do ${label} phụ trách — chỉ người phụ trách hoặc trưởng phòng Cung ứng thao tác được`,
  )
}

/**
 * Người NHẬN thông báo duyệt PO: ai có quyền `supply.po.approve` thật (vai
 * director/…) ∪ admin (bypass không nằm trong role_permissions) — thay cho lọc
 * `role ∈ {admin, manager}` cũ vốn bắn cho mọi manager toàn công ty (G3).
 */
async function approverIds(excludeUserId: string): Promise<string[]> {
  const [withPerm, users] = await Promise.all([
    rbacRepo.userIdsWithPermission('supply.po.approve'),
    usersRepo.list(),
  ])
  const ids = new Set(withPerm)
  for (const u of users) if (u.role === 'admin') ids.add(u.id)
  ids.delete(excludeUserId)
  return [...ids]
}

/** Điều khoản/chữ ký bỏ trống → lấy mặc định của mẫu, để phiếu in không rỗng. */
function withTemplateDefaults(input: PoInput, template: PoTemplate) {
  const meta = poTemplateMeta(template)
  const pick = (v: string | null | undefined, fallback: string) =>
    v != null && v.trim() !== '' ? v.trim() : fallback || null
  return {
    terms_quality: pick(input.terms_quality, meta.terms.quality),
    terms_delivery_place: pick(input.terms_delivery_place, meta.terms.delivery_place),
    terms_payment: pick(input.terms_payment, meta.terms.payment),
    terms_invoice: pick(input.terms_invoice, meta.terms.invoice),
    terms_lead_time: pick(input.terms_lead_time, meta.terms.lead_time),
    signer_role: pick(input.signer_role, meta.signerRole),
  }
}

export const posService = {
  /** Đọc: mọi NV đã đăng nhập (Kho nhận hàng, Kế toán xem phải trả…). */
  async list(_user: User, opts: Parameters<typeof posRepo.list>[0]) {
    return posRepo.list(opts)
  },

  /**
   * ĐỀ XUẤT cập nhật danh mục từ dòng đơn vừa lưu (13/08/2026): người soạn đã
   * gõ quy cách/vật liệu/cách mở… mà danh mục đang TRỐNG → route trả danh sách
   * này kèm response, form hiện hộp XÁC NHẬN — user chốt "không tự ghi ngầm";
   * bấm đồng ý mới ghi (qua /materials/enrich, nơi kiểm fill-empty lần nữa).
   */
  async catalogSuggestions(lines: PoLineInput[]): Promise<CatalogSuggestion[]> {
    const wanted = linesByMaterial(catalogLines(lines))
    const materials = []
    for (const id of wanted.keys()) {
      const m = await materialsRepo.findById(id)
      if (m) materials.push(m)
    }
    return buildCatalogSuggestions(catalogLines(lines), materials)
  },

  /**
   * LỊCH SỬ GIÁ MUA của một vật tư — đọc cùng mức với danh mục vật tư (mọi NV
   * đã đăng nhập; Kho đã thấy "giá mua gần nhất" trên lưới thì giấu lịch sử
   * chẳng để làm gì, mà lại là thứ duy nhất giải thích con số ấy ở đâu ra).
   */
  async materialPriceHistory(_user: User, materialId: string) {
    return posRepo.priceHistoryByMaterial(materialId)
  },

  /**
   * Đã về CÓ CHỨNG TỪ theo đợt (0153) — object thuần {đợt: {dòng: SL}} vì Map
   * không sống qua ranh giới server→client component.
   */
  async shipmentReceipts(_user: User, poId: string) {
    const m = await supplyRepo.receiptsByShipment(poId)
    const out: Record<string, Record<string, number>> = {}
    for (const [sid, per] of m) out[sid] = Object.fromEntries(per)
    return out
  },

  async detail(_user: User, id: string) {
    const po = await posRepo.findById(id)
    if (!po) throw NotFound('Đơn đặt không tồn tại')
    const [lines, rawStatus, extra_lsx, warehouse_docs] = await Promise.all([
      posRepo.listLines(id),
      supplyRepo.lineStatus(id), // đặt / đã nhận / còn thiếu (BR-08, FR-SUP-05)
      posRepo.listExtraLsx(id), // LSX phụ gộp vào đơn (0125)
      supplyRepo.docsByPo(id), // PNK/phiếu trả — mốc timeline (GĐ3)
    ])
    // Lý do chốt thiếu (0154) — view đối chiếu không mang cột này; chỉ trang
    // chi tiết cần (tooltip trên badge) nên tra thêm một lượt, đúng các dòng chốt.
    const reasons = rawStatus.some((l) => l.closed_short_at != null)
      ? await posRepo.closedShortReasons(id)
      : new Map<string, string | null>()
    const status_lines = rawStatus.map((l) => ({
      ...l,
      closed_short_reason: reasons.get(l.id) ?? null,
    }))
    return { po, lines, status_lines, extra_lsx, warehouse_docs }
  },

  /**
   * Tạo PO (FR-SUP-02, BR-06): đúng 1 NCC; LSX gắn hoặc không (0076) —
   * gắn LSX = PO theo lệnh SX (LSX phải đã được GĐ duyệt), null = PO ngoài LSX
   * (tiêu hao/dùng chung). Sinh mã PO-YYYY-NNNN, vào trạng thái NHÁP (0116 —
   * chủ dự án chốt 05/08/2026, thay đặc tả 4.3 cũ "vào thẳng pending"): người
   * soạn xem lại / sửa / xoá tự do, bấm `submit` mới tới bàn duyệt của GĐ và
   * lúc đó mới notify — không làm phiền sếp bằng đơn còn đang gõ dở.
   */
  async create(user: User, input: PoInput): Promise<Po> {
    await assertAction(user, 'supply.po.manage')
    const supplier = await suppliersRepo.findById(input.supplier_id)
    if (!supplier) throw NotFound('NCC không tồn tại')
    if (!supplier.is_active) throw BadRequest('NCC đã ngừng giao dịch')
    const lsxId = input.production_order_id ?? null
    let lsx: Awaited<ReturnType<typeof productionRepo.findById>> = null
    if (lsxId) {
      lsx = await productionRepo.findById(lsxId)
      if (!lsx) throw NotFound('LSX không tồn tại')
      if (lsx.status === 'pending_approval' || lsx.status === 'rejected') {
        throw BadRequest('LSX chưa được Giám đốc duyệt — chưa đặt vật tư được')
      }
    }

    const extraLsxIds = await checkedExtraLsxIds(lsxId, input.extra_lsx_ids)

    const template = input.template ?? 'simple'
    assertFreeLinesAllowed(template, input.lines)
    const code = await posRepo.nextCode()
    const po = await posRepo.insert(
      {
        code,
        production_order_id: lsxId,
        supplier_id: input.supplier_id,
        status: 'draft',
        template,
        currency: input.currency,
        vat_rate: input.vat_rate ?? null,
        price_includes_vat: input.price_includes_vat,
        discount_amount: input.discount_amount ?? null,
        contract_no: input.contract_no ?? null,
        expected_at: input.expected_at ?? null,
        terms: input.terms ?? null,
        ...withTemplateDefaults(input, template),
        note: input.note ?? null,
        created_by: user.id,
        assigned_to: user.id,
      },
      withDerived(template, input.lines),
    )
    if (extraLsxIds.length > 0) await posRepo.replaceExtraLsx(po.id, extraLsxIds)
    return po
  },

  /**
   * GỬI GĐ DUYỆT (0116): draft → pending_approval, và CHỈ lúc này mới notify
   * người duyệt — emit `po.submitted` chuyển từ create() sang đây.
   */
  async submit(user: User, id: string): Promise<Po> {
    await assertAction(user, 'supply.po.manage')
    const before = await posRepo.findById(id)
    if (!before) throw NotFound('Đơn đặt không tồn tại')
    await assertPoOwner(user, before)
    if (before.status !== 'draft') {
      throw BadRequest('Chỉ đơn nháp mới gửi duyệt được')
    }
    if ((await posRepo.listLines(id)).length === 0) {
      throw BadRequest('Đơn chưa có dòng vật tư nào — thêm hàng rồi hãy gửi duyệt')
    }
    /**
     * BẮT BUỘC HẸN GIAO. Không có `expected_at` thì `assessPoLate` và
     * `assessPoFit` đều trả null: đơn không bao giờ đỏ "quá hẹn", không lên đèn
     * "Trễ SX", không vào ô đếm nào — im lặng tuyệt đối đúng lúc cần kêu nhất.
     * Chặn ở cửa gửi duyệt (không phải lúc lưu nháp) để người soạn vẫn ghi dở
     * được, nhưng thứ đặt lên bàn Giám đốc thì luôn có mốc để đối chiếu.
     */
    if (!before.expected_at) {
      throw BadRequest(
        'Đơn chưa có hẹn giao — điền "Thời gian giao hàng" rồi mới gửi duyệt được (thiếu mốc thì cảnh báo trễ hàng bỏ qua đơn này)',
      )
    }
    const [supplier, lsx] = await Promise.all([
      suppliersRepo.findById(before.supplier_id),
      before.production_order_id
        ? productionRepo.findById(before.production_order_id)
        : Promise.resolve(null),
    ])
    const po = await posRepo.patch(id, { status: 'pending_approval' })

    await emit({
      name: 'po.submitted',
      po_id: po.id,
      code: po.code,
      supplier_name: supplier?.name ?? '—',
      lsx_code: lsx?.code ?? null,
      submitted_by: user.id,
      approver_ids: await approverIds(user.id),
    })
    return po
  },

  /**
   * RÚT VỀ NHÁP (0128 — 6.2b): đơn CHỜ DUYỆT không sửa trực tiếp nữa; muốn sửa
   * phải rút về nháp rồi gửi duyệt lại — con số Giám đốc thấy trong thông báo
   * luôn là con số cuối. Notify người duyệt để họ bỏ qua bản đã rút.
   */
  async withdraw(user: User, id: string): Promise<Po> {
    await assertAction(user, 'supply.po.manage')
    const before = await posRepo.findById(id)
    if (!before) throw NotFound('Đơn đặt không tồn tại')
    await assertPoOwner(user, before)
    if (before.status !== 'pending_approval') {
      throw BadRequest('Chỉ đơn đang chờ duyệt mới rút về nháp được')
    }
    const po = await posRepo.patch(id, { status: 'draft' })
    await emit({
      name: 'po.withdrawn',
      po_id: po.id,
      code: po.code,
      withdrawn_by: user.id,
      approver_ids: await approverIds(user.id),
    })
    return po
  },

  /**
   * Sửa — CHỈ đơn NHÁP (0128 siết từ "nháp hoặc chờ duyệt"): đơn đã gửi duyệt
   * muốn sửa phải `withdraw` về nháp trước, để nội dung trên bàn GĐ không đổi
   * sau lưng thông báo. Sau duyệt là cam kết với GĐ/NCC — không sửa.
   */
  /**
   * SỬA ĐIỀU KHOẢN & GHI CHÚ — mở cho MỌI trạng thái trừ đã huỷ (kể cả đã về
   * đủ: ghi chú đối chiếu vẫn cần sửa được). Chỉ chữ trên phiếu, không đụng
   * dòng hàng/giá — thứ đó đi đường update() và bị khoá ngoài nháp.
   */
  async updateTerms(
    user: User,
    id: string,
    input: {
      contract_no?: string | null
      terms_quality?: string | null
      terms_delivery_place?: string | null
      terms_payment?: string | null
      terms_invoice?: string | null
      terms_lead_time?: string | null
      signer_role?: string | null
      note?: string | null
    },
  ): Promise<Po> {
    await assertAction(user, 'supply.po.manage')
    const before = await posRepo.findById(id)
    if (!before) throw NotFound('Đơn đặt không tồn tại')
    await assertPoOwner(user, before)
    if (before.status === 'cancelled') {
      throw BadRequest('Đơn đã huỷ — hồ sơ đóng, không sửa nữa')
    }
    return posRepo.patch(id, {
      contract_no: input.contract_no ?? null,
      terms_quality: input.terms_quality ?? null,
      terms_delivery_place: input.terms_delivery_place ?? null,
      terms_payment: input.terms_payment ?? null,
      terms_invoice: input.terms_invoice ?? null,
      terms_lead_time: input.terms_lead_time ?? null,
      signer_role: input.signer_role ?? null,
      note: input.note ?? null,
    })
  },

  async update(user: User, id: string, input: PoInput): Promise<Po> {
    await assertAction(user, 'supply.po.manage')
    const before = await posRepo.findById(id)
    if (!before) throw NotFound('Đơn đặt không tồn tại')
    await assertPoOwner(user, before)
    if (before.status !== 'draft') {
      throw BadRequest(
        before.status === 'pending_approval'
          ? 'Đơn đang chờ duyệt — bấm "Rút về nháp" rồi mới sửa được'
          : 'Chỉ đơn nháp mới sửa được',
      )
    }
    // LSX chính của đơn không đổi khi sửa (patch không đụng production_order_id)
    // — LSX phụ thì đổi được, kiểm tra theo LSX chính ĐANG có của đơn.
    const extraLsxIds = await checkedExtraLsxIds(
      before.production_order_id,
      input.extra_lsx_ids,
    )
    // Đổi mẫu khi sửa đơn là hợp lệ (chọn nhầm mẫu lúc tạo) — dòng được dẫn xuất
    // lại theo mẫu mới, ô của mẫu cũ bị repo ghi null nên không sót số lạc.
    const template = input.template ?? before.template ?? 'simple'
    assertFreeLinesAllowed(template, input.lines)
    const po = await posRepo.patch(id, {
      supplier_id: input.supplier_id,
      template,
      currency: input.currency,
      vat_rate: input.vat_rate ?? null,
      price_includes_vat: input.price_includes_vat,
      discount_amount: input.discount_amount ?? null,
      contract_no: input.contract_no ?? null,
      expected_at: input.expected_at ?? null,
      terms: input.terms ?? null,
      ...withTemplateDefaults(input, template),
      note: input.note ?? null,
    })
    await posRepo.replaceLines(id, withDerived(template, input.lines))
    await posRepo.replaceExtraLsx(id, extraLsxIds)
    return po
  },

  /**
   * GĐ duyệt / từ chối (BR-05 nửa đầu): pending_approval → approved | draft.
   * Từ chối TRẢ VỀ NHÁP (0128 — 6.3b, trước là cancelled): người soạn sửa theo
   * lý do rồi gửi lại, giữ số PO + lịch sử; người/lý do từ chối nằm ở
   * approval_events, note chỉ nhắc nhanh trên đơn.
   */
  async decide(
    user: User,
    id: string,
    decision: 'approve' | 'reject',
    reason?: string,
  ): Promise<Po> {
    await assertAction(user, 'supply.po.approve')
    const before = await posRepo.findById(id)
    if (!before) throw NotFound('Đơn đặt không tồn tại')
    if (before.status !== 'pending_approval') {
      throw BadRequest('Chỉ duyệt được đơn đang chờ duyệt')
    }
    const po = await posRepo.patch(
      id,
      decision === 'approve'
        ? {
            status: 'approved',
            approved_by: user.id,
            approved_at: new Date().toISOString(),
          }
        : { status: 'draft', note: reason ? `[Từ chối] ${reason}` : before.note },
    )
    await emit({
      name: 'po.decided',
      po_id: id,
      code: before.code,
      decision: decision === 'approve' ? 'approved' : 'rejected',
      decided_by: user.id,
      owner_id: before.assigned_to ?? before.created_by,
      reason,
    })
    return po
  },

  /**
   * ⭐ BR-05 nửa sau: CHƯA DUYỆT THÌ KHÔNG GỬI ĐƯỢC CHO NCC.
   * approved → ordered (gửi NCC, đóng dấu ordered_at) → confirmed → in_transit.
   * partial/received do Kho tự cập nhật khi nhập hàng (BR-08).
   */
  async advance(
    user: User,
    id: string,
    to: 'ordered' | 'confirmed' | 'in_transit' | 'received',
  ): Promise<Po> {
    await assertAction(user, 'supply.po.manage')
    const before = await posRepo.findById(id)
    if (!before) throw NotFound('Đơn đặt không tồn tại')
    await assertPoOwner(user, before)

    const allowed: Record<string, string[]> = {
      ordered: ['approved'], // ⭐ BR-05: chỉ từ approved
      confirmed: ['ordered'],
      in_transit: ['confirmed', 'ordered'],
      received: ['ordered', 'confirmed', 'in_transit', 'partial'],
    }
    if (!allowed[to].includes(before.status)) {
      throw BadRequest(
        to === 'ordered'
          ? 'BR-05: đơn phải được Giám đốc duyệt mới gửi được cho NCC'
          : `Không chuyển được từ "${before.status}" sang "${to}"`,
      )
    }
    /**
     * "ĐÃ VỀ ĐỦ" bằng tay — cho đơn có DÒNG TỰ DO (gỗ/gia công 0134): dòng này
     * nghiệm thu ngoài sổ kho, không có phiếu nhập nào tự chốt, thiếu lối này
     * đơn treo "đang giao" vĩnh viễn. Luật: mọi DÒNG VẬT TƯ KHO (nếu có) phải
     * đã về đủ theo sổ — BR-08 giữ nguyên quyền quyết phần kho, con người chỉ
     * xác nhận phần tự do. Bản cũ chặn tuyệt đối khi "còn dòng vật tư kho" nên
     * đơn HỖN HỢP kẹt cả hai đường: sổ kho không bao giờ chốt (vì dòng tự do
     * không có movement), nút tay thì bị cấm.
     */
    if (to === 'received') {
      // qty_open (0154): dòng đã CHỐT THIẾU coi như xong — đơn hỗn hợp chốt
      // phần kho rồi thì nghiệm thu phần tự do được.
      const status = await supplyRepo.lineStatus(id)
      const missing = status.filter((l) => l.material_id != null && l.qty_open > 1e-6)
      if (missing.length > 0) {
        throw BadRequest(
          `Còn ${missing.length} dòng vật tư kho chưa về đủ — phần đó do phiếu nhập của Kho quyết định (BR-08), hoặc Chốt phần thiếu nếu NCC không giao nữa`,
        )
      }
    }
    const po = await posRepo.patch(id, {
      status: to,
      ...(to === 'ordered' ? { ordered_at: new Date().toISOString() } : {}),
    })
    // GỬI NCC = giá đã chốt thật → cập nhật "giá mua gần nhất" của danh mục
    // (handler po.catalog — chỉ đơn VND, xem po-catalog-backfill).
    if (to === 'ordered') {
      const lines = await posRepo.listLines(id)
      await emit({
        name: 'po.ordered',
        po_id: id,
        code: before.code,
        currency: before.currency ?? 'VND',
        ordered_by: user.id,
        lines: lines.map((l) => ({
          material_id: l.material_id,
          unit_price: l.unit_price,
        })),
      })
    }
    return po
  },

  /**
   * NCC XÁC NHẬN ĐƠN (0152 — plan-po-giao-nhan GĐ1). NCC không đăng nhập: đây
   * là NV cung ứng ghi lại cam kết (ai hứa, kênh nào, giao mấy đợt, ngày nào).
   *
   * Chỉ từ `ordered` — chưa gửi thì chưa có gì để NCC xác nhận. `shipments`
   * RỖNG được phép (NCC ừ nhưng chưa chốt lịch, hoặc đơn toàn dòng tự do);
   * có đợt thì validate cứng: dòng phải thuộc đơn, Σ các đợt không vượt SL đặt
   * (hụt thì CẢNH BÁO ở UI, không chặn — NCC xác nhận thiếu là chuyện thật).
   *
   * `expected_at` của đơn đồng bộ = ngày đợt sớm nhất, để toàn bộ cảnh báo trễ
   * hiện có (assessPoLate, badge, Hàng sắp về) chạy nguyên không sửa dòng nào.
   */
  async confirm(
    user: User,
    id: string,
    input: {
      confirmed_note?: string | null
      method?: string | null
      place?: string | null
      shipments: ShipmentInput[]
    },
  ): Promise<Po> {
    await assertAction(user, 'supply.po.manage')
    const before = await posRepo.findById(id)
    if (!before) throw NotFound('Đơn đặt không tồn tại')
    await assertPoOwner(user, before)
    if (before.status !== 'ordered') {
      throw BadRequest('Chỉ xác nhận được đơn ĐÃ GỬI NCC (đang ở "Đã gửi NCC")')
    }

    if (input.shipments.length > 0) {
      const lines = await posRepo.listLines(id)
      const v = validateShipments(
        input.shipments,
        lines.map((l) => ({
          id: l.id,
          qty_ordered: l.qty_ordered,
          name: l.material_name,
        })),
      )
      if (v.errors.length > 0) throw BadRequest(v.errors.join(' · '))
      await poShipmentsRepo.insertMany(
        id,
        input.shipments.map((s, i) => ({
          seq: i + 1,
          expected_date: s.expected_date,
          method: input.method ?? null,
          place: input.place ?? null,
          note: s.note ?? null,
          lines: s.lines,
        })),
        user.id,
      )
    }

    const minDate = earliestExpectedDate(
      input.shipments.map((s) => ({ expected_date: s.expected_date, status: 'planned' })),
    )
    return posRepo.patch(id, {
      status: 'confirmed',
      confirmed_at: new Date().toISOString(),
      confirmed_note: input.confirmed_note ?? null,
      // Không có đợt thì giữ nguyên hẹn giao cũ — đừng xoá mốc của đơn.
      ...(minDate ? { expected_at: minDate } : {}),
    })
  },

  /** Kế hoạch giao của đơn — cho trang chi tiết + form nhập kho (GĐ2). */
  async listShipments(user: User, poId: string): Promise<PoShipment[]> {
    // Cùng mức lộ với chi tiết đơn: ai đăng nhập cũng xem được (chỉ đọc).
    void user
    return poShipmentsRepo.listByPo(poId)
  },

  /**
   * THÊM ĐỢT bổ sung sau khi đã xác nhận (NCC hẹn giao bù phần thiếu). Validate
   * cộng dồn với các đợt còn sống — tổng mọi đợt không vượt SL đặt.
   */
  async addShipments(
    user: User,
    poId: string,
    shipments: ShipmentInput[],
  ): Promise<void> {
    await assertAction(user, 'supply.po.manage')
    const before = await posRepo.findById(poId)
    if (!before) throw NotFound('Đơn đặt không tồn tại')
    await assertPoOwner(user, before)
    if (!['confirmed', 'in_transit', 'partial'].includes(before.status)) {
      throw BadRequest('Chỉ thêm đợt cho đơn đã NCC xác nhận và chưa về đủ')
    }
    const [lines, existing, current] = await Promise.all([
      posRepo.listLines(poId),
      poShipmentsRepo.qtyByLine(poId),
      poShipmentsRepo.listByPo(poId),
    ])
    const v = validateShipments(
      shipments,
      lines.map((l) => ({ id: l.id, qty_ordered: l.qty_ordered, name: l.material_name })),
      existing,
    )
    if (v.errors.length > 0) throw BadRequest(v.errors.join(' · '))
    const start = nextSeq(current)
    await poShipmentsRepo.insertMany(
      poId,
      shipments.map((s, i) => ({
        seq: start + i,
        expected_date: s.expected_date,
        note: s.note ?? null,
        lines: s.lines,
      })),
      user.id,
    )
    await this.syncExpectedAt(poId)
  },

  /**
   * Thao tác trên MỘT đợt: dời ngày (bắt lý do — đổi cam kết đã ghi), đánh dấu
   * xe tới cổng, huỷ đợt (bắt lý do). Sau mỗi thao tác động tới lịch thì đồng
   * bộ lại `expected_at` của đơn.
   */
  async shipmentAction(
    user: User,
    shipmentId: string,
    input: {
      action: 'reschedule' | 'arrived' | 'cancel'
      expected_date?: string
      reason?: string
    },
  ): Promise<void> {
    await assertAction(user, 'supply.po.manage')
    const shipment = await poShipmentsRepo.findById(shipmentId)
    if (!shipment) throw NotFound('Đợt giao không tồn tại')
    const po = await posRepo.findById(shipment.po_id)
    if (!po) throw NotFound('Đơn đặt không tồn tại')
    await assertPoOwner(user, po)

    if (input.action === 'arrived') {
      if (shipment.status !== 'planned') {
        throw BadRequest('Chỉ đánh dấu "xe tới" cho đợt đang hẹn')
      }
      await poShipmentsRepo.patch(shipmentId, { status: 'arrived' })
      return
    }
    if (shipment.status !== 'planned' && shipment.status !== 'arrived') {
      throw BadRequest('Đợt đã nhận xong / đã huỷ — không sửa được')
    }
    if (input.action === 'reschedule') {
      const dmy = (iso: string) => iso.slice(0, 10).split('-').reverse().join('/')
      await poShipmentsRepo.patch(shipmentId, {
        expected_date: input.expected_date!,
        note: `[Dời ${dmy(shipment.expected_date)}→${dmy(input.expected_date!)}] ${input.reason}${
          shipment.note ? ` · ${shipment.note}` : ''
        }`,
      })
    } else {
      await poShipmentsRepo.patch(shipmentId, {
        status: 'cancelled',
        note: `[Huỷ đợt] ${input.reason}${shipment.note ? ` · ${shipment.note}` : ''}`,
      })
    }
    await this.syncExpectedAt(shipment.po_id)
  },

  /** `expected_at` của đơn = ngày đợt CÒN SỐNG sớm nhất; hết đợt sống thì giữ mốc cũ. */
  async syncExpectedAt(poId: string): Promise<void> {
    const shipments = await poShipmentsRepo.listByPo(poId)
    const minDate = earliestExpectedDate(shipments)
    if (minDate) await posRepo.patch(poId, { expected_at: minDate })
  },

  /**
   * CHỐT PHẦN THIẾU (0154 — plan-cung-ung-kho-hoan-thien GĐ A). NCC giao 98/100
   * rồi báo "hết hàng, không giao nữa": Cung ứng (người phụ trách — luật 0128)
   * tuyên bố phần còn lại KHÔNG VỀ NỮA trên từng dòng (line_id) hoặc mọi dòng
   * còn thiếu (line_id bỏ trống), bắt buộc lý do.
   *
   * KHÔNG sửa số đã nhận — BR-08 giữ nguyên chủ quyền sổ kho; chỉ ghi
   * closed_short_* để view tính qty_open = 0. Hệ quả dây chuyền tự chạy:
   * refreshStatusFromReceipts đọc qty_open → đơn thoát 'partial'; đề xuất mua
   * hết bị "đã đặt" ảo đè (tự giục mua chỗ khác — đúng ý); đơn rời "Hàng sắp
   * về" + màn Nhập kho; đợt planned chỉ còn dòng đã chốt tự huỷ.
   *
   * `reopen`: mở lại dòng đã chốt (NCC đổi ý giao bù) — đơn 'received' tự quay
   * 'partial' qua refresh. Đơn chưa nhận được GÌ mà chốt hết phần thiếu = huỷ
   * đơn trá hình → chặn, chỉ đường sang "Huỷ đơn" (giữ ngữ nghĩa trạng thái:
   * received nghĩa là CÓ hàng về).
   */
  async closeShort(
    user: User,
    poId: string,
    input: { action: 'close' | 'reopen'; line_id?: string | null; reason?: string },
  ): Promise<void> {
    await assertAction(user, 'supply.po.manage')
    const before = await posRepo.findById(poId)
    if (!before) throw NotFound('Đơn đặt không tồn tại')
    await assertPoOwner(user, before)

    const EPS = 1e-6
    // View đã lọc dòng tự do (0134) — status chỉ gồm dòng vật tư kho.
    const status = await supplyRepo.lineStatus(poId)
    const anyReceived = status.some((l) => l.qty_received > EPS)

    if (input.action === 'reopen') {
      if (before.status === 'cancelled') {
        throw BadRequest('Đơn đã huỷ — không mở lại dòng được')
      }
      const line = status.find((l) => l.id === input.line_id)
      if (!line) throw NotFound('Dòng không tồn tại trong đơn')
      if (!line.closed_short_at) throw BadRequest('Dòng này chưa chốt thiếu')
      await posRepo.patchLineClosedShort(line.id, {
        closed_short_at: null,
        closed_short_by: null,
        closed_short_reason: null,
      })
      // Mở lại phần thiếu → đơn 'received' phải quay 'partial'. Chưa có phiếu
      // nhập nào thì đừng gọi refresh — nó sẽ dựng 'partial' cho đơn chưa về gì.
      if (anyReceived) await supplyRepo.refreshStatusFromReceipts(poId)
      return
    }

    if (!['ordered', 'confirmed', 'in_transit', 'partial'].includes(before.status)) {
      throw BadRequest(
        'Chỉ chốt thiếu cho đơn ĐÃ GỬI NCC và chưa kết thúc (đã gửi / NCC xác nhận / đang giao / về một phần)',
      )
    }
    const reason = input.reason?.trim()
    if (!reason) throw BadRequest('Chốt phần thiếu phải kèm lý do')

    const targets = input.line_id
      ? status.filter((l) => l.id === input.line_id)
      : status.filter((l) => l.qty_open > EPS)
    if (input.line_id) {
      const line = targets[0]
      if (!line) throw NotFound('Dòng không tồn tại trong đơn')
      if (line.closed_short_at) throw BadRequest('Dòng này đã chốt thiếu rồi')
      if (line.qty_open <= EPS) {
        throw BadRequest('Dòng này không còn thiếu — không có gì để chốt')
      }
    }
    if (targets.length === 0) {
      throw BadRequest('Đơn không còn dòng nào thiếu để chốt')
    }
    // Chưa nhận được gì + chốt nốt phần thiếu cuối = đơn "về đủ" với 0 hàng.
    const targetIds = new Set(targets.map((t) => t.id))
    const stillOpen = status.some((l) => l.qty_open > EPS && !targetIds.has(l.id))
    if (!anyReceived && !stillOpen) {
      throw BadRequest(
        'Đơn chưa nhận được hàng nào — NCC không giao gì nữa thì dùng "Huỷ đơn" (kèm lý do), không chốt thiếu',
      )
    }

    const now = new Date().toISOString()
    for (const t of targets) {
      await posRepo.patchLineClosedShort(t.id, {
        closed_short_at: now,
        closed_short_by: user.id,
        closed_short_reason: reason,
      })
    }

    // Đợt PLANNED chỉ gồm dòng đã chốt → tự huỷ (không còn gì để chờ). Đợt lẫn
    // dòng còn mở giữ nguyên; đợt 'arrived' (xe đã tới) không tự động đụng.
    const closedIds = new Set([
      ...targetIds,
      ...status.filter((l) => l.closed_short_at != null).map((l) => l.id),
    ])
    const shipments = await poShipmentsRepo.listByPo(poId)
    for (const s of shipments) {
      if (s.status !== 'planned' || s.lines.length === 0) continue
      if (s.lines.every((l) => closedIds.has(l.po_line_id))) {
        await poShipmentsRepo.patch(s.id, {
          status: 'cancelled',
          note: `[Chốt thiếu] ${reason}${s.note ? ` · ${s.note}` : ''}`,
        })
      }
    }
    await this.syncExpectedAt(poId)

    if (anyReceived) await supplyRepo.refreshStatusFromReceipts(poId)

    // Báo Kho (ngừng chờ lô này) + GĐ/QL. Người phụ trách là người bấm — khỏi báo.
    const [depts, users] = await Promise.all([departmentsRepo.list(), usersRepo.list()])
    const whDeptIds = new Set(
      depts.filter((d) => d.workspace_id === 'warehouse').map((d) => d.id),
    )
    const notifyIds = users
      .filter(
        (u) =>
          u.id !== user.id &&
          (u.role === 'admin' ||
            u.role === 'manager' ||
            (u.department_id != null && whDeptIds.has(u.department_id))),
      )
      .map((u) => u.id)
    const summary = targets
      .map((t) =>
        `${t.material_name}: thiếu ${t.qty_open.toLocaleString('vi-VN')} ${t.material_unit}`.trim(),
      )
      .join(' · ')
    await emit({
      name: 'po.closed_short',
      po_id: poId,
      code: before.code,
      closed_by: user.id,
      reason,
      summary,
      notify_ids: notifyIds,
    })
  },

  /**
   * DỜI HẸN GIAO của đơn đã duyệt/đã gửi — thao tác HẸP, chỉ đụng `expected_at`.
   *
   * Vì sao không mở lại `update`: sau khi duyệt, giá và dòng hàng là cam kết với
   * Giám đốc và bản NCC đang cầm. Nhưng ngày giao thì đổi thật và đổi thường
   * xuyên; không có đường ghi lại thì người dùng phải chọn giữa để ngày sai trên
   * hệ thống (cảnh báo "quá hẹn" kêu oan) hoặc huỷ đơn tạo lại (mất số PO đã gửi
   * NCC). Cả hai đều tệ hơn là cho dời ngày kèm lý do và ghi vết.
   */
  async reschedule(
    user: User,
    id: string,
    input: { expected_at: string; reason: string },
  ): Promise<Po> {
    await assertAction(user, 'supply.po.manage')
    const before = await posRepo.findById(id)
    if (!before) throw NotFound('Đơn đặt không tồn tại')
    await assertPoOwner(user, before)
    const guard = canReschedule(before.status)
    if (!guard.ok) throw BadRequest(guard.reason)

    return posRepo.patch(id, {
      expected_at: input.expected_at,
      note: rescheduleNote(
        before.expected_at,
        input.expected_at,
        input.reason,
        before.note,
      ),
    })
  },

  /** Huỷ (trước khi nhận hàng) — kèm lý do. Nháp thì dùng `remove` (xoá hẳn). */
  async cancel(user: User, id: string, reason: string): Promise<Po> {
    await assertAction(user, 'supply.po.manage')
    const before = await posRepo.findById(id)
    if (!before) throw NotFound('Đơn đặt không tồn tại')
    await assertPoOwner(user, before)
    if (before.status === 'received' || before.status === 'cancelled') {
      throw BadRequest('Đơn đã về đủ / đã huỷ — không huỷ được')
    }
    return posRepo.patch(id, {
      status: 'cancelled',
      note: `[Huỷ] ${reason}${before.note ? ` · ${before.note}` : ''}`,
    })
  },

  /**
   * XOÁ HẲN — chỉ đơn NHÁP (0116). Nháp chưa qua bàn duyệt, chưa gửi ai, nên
   * xoá là sạch (dòng hàng cascade theo). Đơn đã gửi duyệt trở đi KHÔNG xoá:
   * số PO đã lọt vào thông báo/nhật ký của người khác — chỉ được huỷ có lý do.
   */
  async remove(user: User, id: string): Promise<void> {
    await assertAction(user, 'supply.po.manage')
    const before = await posRepo.findById(id)
    if (!before) throw NotFound('Đơn đặt không tồn tại')
    await assertPoOwner(user, before)
    if (before.status !== 'draft') {
      throw BadRequest('Chỉ đơn nháp mới xoá được — đơn đã gửi duyệt thì dùng Huỷ')
    }
    await posRepo.delete(id)
  },

  /**
   * BÀN GIAO đơn (0128): đổi NGƯỜI PHỤ TRÁCH — cho ca NV vắng/nghỉ việc. Chỉ
   * trưởng phòng CƯ (`supply.po.manage_any`), người duyệt (GĐ) hoặc admin;
   * người nhận phải là nhân sự cung ứng (đừng gán đơn cho người ngoài phòng).
   * Đơn đã kết thúc (về đủ / huỷ) thì thôi — không còn gì để phụ trách.
   */
  async reassign(user: User, id: string, toUserId: string): Promise<Po> {
    if (
      user.role !== 'admin' &&
      !(await canAction(user, 'supply.po.manage_any')) &&
      !(await canAction(user, 'supply.po.approve'))
    ) {
      throw Forbidden('Chỉ trưởng phòng Cung ứng / Giám đốc bàn giao được đơn')
    }
    const before = await posRepo.findById(id)
    if (!before) throw NotFound('Đơn đặt không tồn tại')
    if (before.status === 'received' || before.status === 'cancelled') {
      throw BadRequest('Đơn đã về đủ / đã huỷ — không cần bàn giao')
    }
    const target = await usersRepo.findById(toUserId)
    if (!target || !target.is_active) throw NotFound('Người nhận không tồn tại')
    if (!(await canAction(target, 'supply.po.manage'))) {
      throw BadRequest('Người nhận phải là nhân sự Cung ứng')
    }
    const po = await posRepo.patch(id, { assigned_to: toUserId })
    await emit({
      name: 'po.reassigned',
      po_id: po.id,
      code: po.code,
      from_user_id: before.assigned_to ?? before.created_by,
      to_user_id: toUserId,
      reassigned_by: user.id,
    })
    return po
  },
}
