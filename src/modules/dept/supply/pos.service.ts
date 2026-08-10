import { posRepo, type Po, type PoLineInput } from './pos.repo'
import { deriveLine, poTemplateMeta, type PoTemplate } from '@/lib/po-template'
import { suppliersRepo, supplyRepo } from './supply.repo'
import { assertAction, canAction } from '@/modules/core/rbac/rbac.service'
import { rbacRepo } from '@/modules/core/rbac/rbac.repo'
import { productionRepo } from '@/modules/dept/production/production.repo'
import { usersRepo, type User } from '@/modules/core/users/users.repo'
import { emit } from '@/events/bus'
import '@/events/register' // Đăng ký handler event ở lần import đầu (notif PO + audit).
import { BadRequest, Forbidden, NotFound } from '@/server/http'
import { canReschedule, rescheduleNote } from '@/lib/po-reschedule'

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

  async detail(_user: User, id: string) {
    const po = await posRepo.findById(id)
    if (!po) throw NotFound('Đơn đặt không tồn tại')
    const [lines, status_lines, extra_lsx] = await Promise.all([
      posRepo.listLines(id),
      supplyRepo.lineStatus(id), // đặt / đã nhận / còn thiếu (BR-08, FR-SUP-05)
      posRepo.listExtraLsx(id), // LSX phụ gộp vào đơn (0125)
    ])
    return { po, lines, status_lines, extra_lsx }
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
      created_by: before.created_by,
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
    to: 'ordered' | 'confirmed' | 'in_transit',
  ): Promise<Po> {
    await assertAction(user, 'supply.po.manage')
    const before = await posRepo.findById(id)
    if (!before) throw NotFound('Đơn đặt không tồn tại')
    await assertPoOwner(user, before)

    const allowed: Record<string, string[]> = {
      ordered: ['approved'], // ⭐ BR-05: chỉ từ approved
      confirmed: ['ordered'],
      in_transit: ['confirmed', 'ordered'],
    }
    if (!allowed[to].includes(before.status)) {
      throw BadRequest(
        to === 'ordered'
          ? 'BR-05: đơn phải được Giám đốc duyệt mới gửi được cho NCC'
          : `Không chuyển được từ "${before.status}" sang "${to}"`,
      )
    }
    return posRepo.patch(id, {
      status: to,
      ...(to === 'ordered' ? { ordered_at: new Date().toISOString() } : {}),
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
