import type { User } from '@/modules/core/users/users.repo'
import { assertAction, canAction } from '@/modules/core/rbac/rbac.service'
import { pricesRepo } from '@/modules/dept/supply/prices.repo'
import { BadRequest, Conflict, Forbidden, NotFound } from '@/server/http'
import { emit } from '@/events/bus'
import '@/events/register'
import { rbacRepo } from '@/modules/core/rbac/rbac.repo'
import { usersRepo } from '@/modules/core/users/users.repo'
import { dongTrong, tongDuKien, vuongGuiDuyet } from '@/lib/de-nghi'
import { kiemNhapDeNghi, soDuyet, vetVuot, type DongNhapDeNghi } from '@/lib/de-nghi-nhap'
import { kiemNgayChungTu } from '@/lib/ngay-chung-tu-nhap'
import { roDuyet, thangVn, tongTheoDuyet, type RoDuyet } from '@/lib/de-nghi-duyet'
import { todayVn } from '@/lib/date-vn'
import {
  deNghiRepo,
  type DeNghiDay,
  type DeNghiDong,
  type DongGhi,
  type PhieuNhapDong,
} from './de-nghi.repo'
import type { DeNghiDecideInput, DeNghiNhapInput, DeNghiSaveInput } from './de-nghi.schema'
import { capNhatTheoSoKho } from './de-nghi.so-kho'
import { stockService } from './stock.service'
import { canViewWarehouse } from './warehouse.service'

/**
 * ĐỀ NGHỊ MUA VẬT TƯ (0236) — Đ1: Kho lập, sửa nháp, gửi duyệt, rút về, huỷ.
 * Đ2: lãnh đạo duyệt (sửa số từng dòng) / từ chối có lý do + thông báo (0237).
 * Đ3/Đ4 (0238): KHO tự mua rồi nhập kho theo phiếu (không qua Cung ứng), tự
 * sang Xong khi đủ, Chốt xong có lý do khi thiếu. Bản vẽ
 * https://claude.ai/artifact/6bFb19HuFtSzT8y2wqT17g (duyệt 13/10/2026).
 */

/** Giá mua gần nhất của một mã — từ DÒNG ĐƠN thật (`pricesRepo.lastPurchases`). */
export type GiaGanNhat = {
  unit_price: number
  po_code: string
  supplier_name: string
  at: string
}

export type DongChiTiet = DeNghiDong & {
  /** Mã danh mục, null = dòng gõ tên tự do. */
  code: string | null
  /** Tồn dùng được hiện tại, null = dòng chưa có mã. */
  ton: number | null
  gia_gan_nhat: GiaGanNhat | null
  /** Số phải nhập = số duyệt (null = đúng số đề nghị). */
  can: number
  /** Đã nhập, đọc từ sổ kho (0238): Σ vào − Σ ra của dòng sổ trỏ về dòng này. */
  da_nhap: number
  /** Phiếu nhập kho đã nhập cho dòng (chưa đảo). */
  phieu_nhap: PhieuNhapDong[]
}

export type DeNghiChiTiet = Omit<DeNghiDay, 'lines'> & { lines: DongChiTiet[] }

/** Một dòng danh sách đề nghị cho lãnh đạo (Đ5 · DN-6) — chỉ số đếm, không gửi dòng hàng. */
export type DuyetRow = {
  id: string
  code: string
  status: DeNghiDay['status']
  ro: RoDuyet | 'khac'
  department: string
  nguoi: string | null
  submitted_at: string | null
  need_by: string | null
  lsx_code: string | null
  so_dong: number
  chua_ma: number
  /** Dự kiến: chờ duyệt = theo số đề nghị; đã duyệt trở đi = theo số duyệt. Chưa VAT. */
  du_kien: number
  thieu_gia: number
  /** Dòng phải mua (số duyệt > 0) / dòng đã nhập đủ. */
  mua_dong: number
  du_dong: number
  /** Tiền thật Kho đã nhập (Σ SL × đơn giá trên phiếu nhập, trừ phiếu đảo). */
  thuc_chi: number
  phieu_nhap: string[]
  rejected_reason: string | null
  approved_by_name: string | null
  closed: boolean
}

/** Gợi ý khi thêm dòng có mã: tồn + giá mua gần nhất (VND). */
async function goiYTheoMa(ids: string[]): Promise<{
  ton: Map<string, number>
  gia: Map<string, GiaGanNhat>
}> {
  if (ids.length === 0) return { ton: new Map(), gia: new Map() }
  const [ton, mua] = await Promise.all([
    deNghiRepo.tonDungDuoc(ids),
    pricesRepo.lastPurchases(ids),
  ])
  const gia = new Map<string, GiaGanNhat>()
  // Phiếu đề nghị tính bằng VND; giá đơn USD không gợi ý (đổi tỷ giá là đoán).
  for (const p of mua)
    if (p.currency === 'VND')
      gia.set(p.material_id, {
        unit_price: p.unit_price,
        po_code: p.po_code,
        supplier_name: p.supplier_name,
        at: p.at,
      })
  return { ton, gia }
}

async function canManage(user: User) {
  return canAction(user, 'warehouse.request.manage')
}

async function canApprove(user: User) {
  return canAction(user, 'warehouse.request.approve')
}

/**
 * Ai XEM được phiếu: Kho (lập), người duyệt (lãnh đạo — thường không có quyền
 * vào khu Kho), Cung ứng (chỉ xem — từ 13/10 Kho tự mua, không qua Cung ứng).
 */
async function xemDuoc(user: User) {
  const [kho, duyet, cungUng] = await Promise.all([
    canViewWarehouse(user),
    canApprove(user),
    canAction(user, 'supply.po.manage'),
  ])
  if (!kho && !duyet && !cungUng)
    throw Forbidden('Chỉ Kho, người duyệt và Cung ứng xem được đề nghị mua')
}

/** Người nhận thông báo duyệt: có quyền duyệt đơn mua thật ∪ admin, trừ người gửi. */
async function nguoiDuyet(tru: string): Promise<string[]> {
  const [coQuyen, users] = await Promise.all([
    rbacRepo.userIdsWithPermission('supply.po.approve'),
    usersRepo.list(),
  ])
  const ids = new Set(coQuyen)
  for (const u of users) if (u.role === 'admin') ids.add(u.id)
  ids.delete(tru)
  return [...ids]
}

/** Chuẩn hoá dòng gửi lên: bỏ dòng trống, dòng có mã lấy tên / ĐVT từ danh mục. */
async function chuanDong(input: DeNghiSaveInput['lines']): Promise<DongGhi[]> {
  const dong = input.filter(
    (l) => !dongTrong({ material_id: l.material_id ?? null, name: l.name, qty: l.qty }),
  )
  const ids = [...new Set(dong.map((l) => l.material_id).filter((x): x is string => !!x))]
  const vt = await deNghiRepo.vatTu(ids)
  return dong.map((l) => {
    const m = l.material_id ? vt.get(l.material_id) : undefined
    if (l.material_id && !m) throw BadRequest(`Mã vật tư của dòng "${l.name}" không còn trong danh mục`) // prettier-ignore
    return {
      material_id: l.material_id ?? null,
      name: m ? m.name : l.name,
      unit: m ? m.unit : l.unit,
      qty: l.qty,
      unit_price: l.unit_price ?? null,
      purpose: l.purpose ?? null,
      note: l.note ?? null,
    }
  })
}

async function phieu(id: string): Promise<DeNghiDay> {
  const p = await deNghiRepo.findById(id)
  if (!p) throw NotFound('Không thấy phiếu đề nghị')
  return p
}

export const deNghiService = {
  async list(user: User): Promise<DeNghiDay[]> {
    await xemDuoc(user)
    return deNghiRepo.list()
  },

  /**
   * DANH SÁCH CHO LÃNH ĐẠO (Đ5 · DN-6): mọi phiếu đã gửi duyệt ít nhất một lần,
   * xếp rổ theo `roDuyet` (cùng luật Hộp ký + số đếm menu), kèm tiến độ mua đếm
   * từ sổ kho và tổng THÁNG NÀY (phiếu duyệt trong tháng: dự kiến vs tiền thật).
   */
  async danhSachDuyet(user: User): Promise<{
    rows: DuyetRow[]
    thang: { ma: string; so_phieu: number; du_kien: number; thuc_chi: number }
  }> {
    if (!(await canApprove(user)))
      throw Forbidden('Chỉ người duyệt đơn mua xem được danh sách duyệt đề nghị')
    const ds = (await deNghiRepo.list())
      .map((p) => ({ p, ro: roDuyet(p, user) }))
      .filter((x): x is { p: DeNghiDay; ro: RoDuyet | 'khac' } => x.ro != null)
    const daDuyet = (st: string) => st === 'approved' || st === 'ordering' || st === 'done'
    const so = await deNghiRepo.soKho(
      ds.filter((x) => daDuyet(x.p.status)).flatMap((x) => x.p.lines.map((l) => l.id)),
    )
    const rows: DuyetRow[] = ds.map(({ p, ro }) => {
      const duyet = daDuyet(p.status)
      const mua = p.lines.filter((l) => soDuyet(l) > 0)
      const t = tongDuKien(p.lines)
      return {
        id: p.id,
        code: p.code,
        status: p.status,
        ro,
        department: p.department,
        nguoi: p.requested_by_name,
        submitted_at: p.submitted_at,
        need_by: p.need_by,
        lsx_code: p.lsx_code,
        so_dong: p.lines.length,
        chua_ma: p.lines.filter((l) => !l.material_id).length,
        du_kien: duyet ? tongTheoDuyet(p.lines) : t.tong,
        thieu_gia: t.thieuGia,
        mua_dong: mua.length,
        du_dong: duyet
          ? mua.filter((l) => (so.get(l.id)?.daNhap ?? 0) >= soDuyet(l) - 1e-9).length
          : 0,
        thuc_chi: Math.round(p.lines.reduce((a, l) => a + (so.get(l.id)?.tien ?? 0), 0)),
        phieu_nhap: [
          ...new Set(p.lines.flatMap((l) => (so.get(l.id)?.phieu ?? []).map((x) => x.code))),
        ].sort(),
        rejected_reason: p.rejected_reason,
        approved_by_name: p.approved_by_name,
        closed: !!p.closed_at,
      }
    })
    const ma = thangVn(new Date())
    const trongThang = ds.filter(
      (x) => daDuyet(x.p.status) && x.p.approved_at && thangVn(x.p.approved_at) === ma,
    )
    const ids = new Set(trongThang.map((x) => x.p.id))
    const rt = rows.filter((r) => ids.has(r.id))
    return {
      rows,
      thang: {
        ma,
        so_phieu: rt.length,
        du_kien: rt.reduce((a, r) => a + r.du_kien, 0),
        thuc_chi: rt.reduce((a, r) => a + r.thuc_chi, 0),
      },
    }
  },

  async get(
    user: User,
    id: string,
  ): Promise<{
    phieu: DeNghiChiTiet
    canManage: boolean
    canApprove: boolean
    /** Ghi phiếu nhập được: quản phiếu đề nghị + ghi sổ kho. */
    canNhap: boolean
  }> {
    await xemDuoc(user)
    const p = await phieu(id)
    const ids = [
      ...new Set(p.lines.map((l) => l.material_id).filter((x): x is string => !!x)),
    ]
    const [vt, { ton, gia }, sua, duyet, ghiSo, so] = await Promise.all([
      deNghiRepo.vatTu(ids),
      goiYTheoMa(ids),
      canManage(user),
      canApprove(user),
      canAction(user, 'warehouse.stock.write'),
      deNghiRepo.soKho(p.lines.map((l) => l.id)),
    ])
    return {
      phieu: {
        ...p,
        lines: p.lines.map((l) => ({
          ...l,
          code: l.material_id ? (vt.get(l.material_id)?.code ?? null) : null,
          ton: l.material_id ? (ton.get(l.material_id) ?? 0) : null,
          gia_gan_nhat: l.material_id ? (gia.get(l.material_id) ?? null) : null,
          can: soDuyet(l),
          da_nhap: so.get(l.id)?.daNhap ?? 0,
          phieu_nhap: so.get(l.id)?.phieu ?? [],
        })),
      },
      canManage: sua,
      canNhap: sua && ghiSo,
      // Không tự duyệt phiếu mình đề nghị (trừ admin) — màn ẩn nút theo cờ này.
      canApprove: duyet && (user.role === 'admin' || p.requested_by !== user.id),
    }
  },

  /** Gợi ý tồn + giá gần nhất cho các mã vừa thêm trên màn lập phiếu. */
  async goiY(
    user: User,
    ids: string[],
  ): Promise<Record<string, { ton: number; gia: GiaGanNhat | null }>> {
    await xemDuoc(user)
    const { ton, gia } = await goiYTheoMa([...new Set(ids)].slice(0, 200))
    const out: Record<string, { ton: number; gia: GiaGanNhat | null }> = {}
    for (const id of new Set(ids))
      out[id] = { ton: ton.get(id) ?? 0, gia: gia.get(id) ?? null }
    return out
  },

  async create(
    user: User,
    input: DeNghiSaveInput,
  ): Promise<{ id: string; code: string }> {
    await assertAction(user, 'warehouse.request.manage')
    const lines = await chuanDong(input.lines)
    const code = await deNghiRepo.nextCode()
    const { id } = await deNghiRepo.insert({
      code,
      department: input.department,
      need_by: input.need_by ?? null,
      note: input.note ?? null,
      production_order_id: input.production_order_id ?? null,
      requested_by: user.id,
      created_by: user.id,
    })
    await deNghiRepo.replaceLines(id, lines)
    return { id, code }
  },

  /** Lưu nháp: đầu phiếu + cả bộ dòng. Chỉ khi phiếu còn NHÁP. */
  async save(user: User, id: string, input: DeNghiSaveInput): Promise<void> {
    await assertAction(user, 'warehouse.request.manage')
    const p = await phieu(id)
    if (p.status !== 'draft')
      throw Conflict(`Phiếu ${p.code} đang "${p.status === 'pending' ? 'chờ duyệt' : p.status}" — rút về nháp rồi mới sửa`) // prettier-ignore
    const lines = await chuanDong(input.lines)
    const ok = await deNghiRepo.update(
      id,
      {
        department: input.department,
        need_by: input.need_by ?? null,
        note: input.note ?? null,
        production_order_id: input.production_order_id ?? null,
      },
      ['draft'],
    )
    if (!ok) throw Conflict(`Phiếu ${p.code} vừa đổi trạng thái — tải lại trang`)
    await deNghiRepo.replaceLines(id, lines)
  },

  /** Gửi lãnh đạo duyệt: draft → pending. Luật vướng giống hệt nút trên màn. */
  async submit(user: User, id: string): Promise<void> {
    await assertAction(user, 'warehouse.request.manage')
    const p = await phieu(id)
    if (p.status !== 'draft') throw Conflict(`Phiếu ${p.code} không còn là nháp`)
    const vuong = vuongGuiDuyet(p.lines)
    if (vuong.length > 0) throw BadRequest(vuong.map((v) => v.cau).join(' · '))
    const ok = await deNghiRepo.update(
      id,
      {
        status: 'pending',
        submitted_at: new Date().toISOString(),
        submitted_by: user.id,
      },
      ['draft'],
    )
    if (!ok) throw Conflict(`Phiếu ${p.code} vừa đổi trạng thái — tải lại trang`)
    await emit({
      name: 'de_nghi.submitted',
      request_id: id,
      code: p.code,
      department: p.department,
      submitted_by: user.id,
      approver_ids: await nguoiDuyet(user.id),
      so_dong: p.lines.length,
      tong: tongDuKien(p.lines).tong,
    })
  },

  /**
   * Lãnh đạo QUYẾT (Đ2): duyệt — sửa được số từng dòng (0 = không mua dòng đó) —
   * hoặc từ chối về nháp kèm lý do. Chỉ khi phiếu đang chờ duyệt.
   */
  async decide(user: User, id: string, input: DeNghiDecideInput): Promise<void> {
    await assertAction(user, 'warehouse.request.approve')
    const p = await phieu(id)
    if (p.status !== 'pending')
      throw Conflict(
        `Phiếu ${p.code} không còn chờ duyệt — Kho vừa rút về hoặc người khác đã quyết`,
      )
    if (p.requested_by === user.id && user.role !== 'admin')
      throw Forbidden('Không tự duyệt phiếu mình đề nghị — nhờ người duyệt khác')
    const now = new Date().toISOString()

    if (input.decision === 'reject') {
      const reason = (input.reason ?? '').trim()
      const ok = await deNghiRepo.update(
        id,
        {
          status: 'draft',
          rejected_at: now,
          rejected_by: user.id,
          rejected_reason: reason,
        },
        ['pending'],
      )
      if (!ok) throw Conflict(`Phiếu ${p.code} vừa được xử lý — tải lại trang`)
      await emit({
        name: 'de_nghi.decided',
        request_id: id,
        code: p.code,
        decision: 'rejected',
        reason,
        decided_by: user.id,
        requester_id: p.requested_by,
      })
      return
    }

    // Số duyệt: chỉ nhận dòng của CHÍNH phiếu này; trùng số đề nghị thì để null.
    const theoId = new Map(p.lines.map((l) => [l.id, l]))
    const doi = (input.lines ?? []).filter((x) => theoId.has(x.id))
    const soDuyet = new Map(doi.map((x) => [x.id, x.approved_qty]))
    if (p.lines.length > 0 && p.lines.every((l) => (soDuyet.get(l.id) ?? l.qty) <= 0))
      throw BadRequest('Duyệt 0 cho mọi dòng là không mua gì — bấm Từ chối và ghi lý do')
    await deNghiRepo.setApprovedQty(
      doi.map((x) => ({
        id: x.id,
        approved_qty:
          Math.abs(x.approved_qty - theoId.get(x.id)!.qty) < 1e-9 ? null : x.approved_qty,
      })),
    )
    const ok = await deNghiRepo.update(
      id,
      { status: 'approved', approved_at: now, approved_by: user.id },
      ['pending'],
    )
    if (!ok) throw Conflict(`Phiếu ${p.code} vừa được xử lý — tải lại trang`)
    await emit({
      name: 'de_nghi.decided',
      request_id: id,
      code: p.code,
      decision: 'approved',
      reason: (input.reason ?? '').trim() || null,
      decided_by: user.id,
      requester_id: p.requested_by,
    })
  },

  /**
   * KHO NHẬP HÀNG ĐÃ MUA (0238 · Đ3, bản vẽ DN-3): ghi một PNK mã lý do N2 có
   * ĐƠN GIÁ THẬT, mỗi dòng sổ trỏ về dòng đề nghị. Nhập được nhiều lần; sau mỗi
   * lần trạng thái phiếu tính lại từ sổ kho (đủ hết → Xong).
   *
   * Luật chặn = đúng hàm màn dùng (`kiemNhapDeNghi`): thiếu nơi mua, dòng có số
   * mà chưa gắn mã / chưa có giá, giá 0 không ghi chú, vượt số duyệt quá 10% không
   * lý do (Q11, Q12). Dòng "chưa có mã" được gắn mã lúc này — SAU khi ghi sổ xong.
   */
  async nhapKho(
    user: User,
    id: string,
    input: DeNghiNhapInput,
  ): Promise<{ doc_id: string; code: string; status: string }> {
    await assertAction(user, 'warehouse.request.manage')
    const p = await phieu(id)
    if (p.status !== 'approved' && p.status !== 'ordering')
      throw Conflict(
        p.status === 'done'
          ? `Phiếu ${p.code} đã xong — không nhập thêm`
          : `Phiếu ${p.code} chưa được duyệt — chưa nhập kho được`,
      )
    const ngay = kiemNgayChungTu({
      docDate: input.doc_date,
      today: todayVn(),
      lyDo: input.backdate_reason,
    })
    if (ngay.muc !== 'ok') throw BadRequest(ngay.message)

    const theoId = new Map(p.lines.map((l) => [l.id, l]))
    const so = await deNghiRepo.soKho(p.lines.map((l) => l.id))
    const gap = new Set<string>()
    const rows: DongNhapDeNghi[] = input.lines.map((x) => {
      const l = theoId.get(x.line_id)
      if (!l) throw BadRequest('Có dòng không thuộc phiếu đề nghị này — tải lại trang')
      if (gap.has(x.line_id)) throw BadRequest(`Dòng "${l.name}" gửi hai lần`)
      gap.add(x.line_id)
      if (l.material_id && x.material_id && x.material_id !== l.material_id)
        throw BadRequest(`Dòng "${l.name}" đã có mã — không đổi mã lúc nhập`)
      return {
        line_id: l.id,
        name: l.name,
        material_id: l.material_id ?? x.material_id ?? null,
        can: soDuyet(l),
        daNhap: so.get(l.id)?.daNhap ?? 0,
        qty: x.qty,
        unit_price: x.unit_price ?? null,
        note: x.note ?? '',
      }
    })
    const kiem = kiemNhapDeNghi({ noi_mua: input.noi_mua }, rows)
    if (!kiem.ok) throw BadRequest(kiem.message)

    const nhap = rows.filter((r) => r.qty > 0)
    const ganMoi = nhap.filter((r) => !theoId.get(r.line_id)!.material_id)
    const vt = await deNghiRepo.vatTu(ganMoi.map((r) => r.material_id!))
    for (const r of ganMoi)
      if (!vt.has(r.material_id!))
        throw BadRequest(`Mã gắn cho dòng "${r.name}" không còn trong danh mục`)

    const res = await stockService.createReceiptDoc(user, {
      po_id: null,
      counterparty: input.noi_mua.trim(),
      reason: `Mua theo đề nghị ${p.code}`,
      supplier_doc_no: input.supplier_doc_no ?? null,
      doc_date: input.doc_date ?? null,
      backdate_reason: input.backdate_reason ?? null,
      note: input.note ?? null,
      purchase_request_id: id,
      lines: nhap.map((r) => ({
        material_id: r.material_id!,
        qty: r.qty,
        unit_cost: r.unit_price,
        purchase_request_line_id: r.line_id,
        note:
          [r.note.trim(), vetVuot(r.can, r.daNhap, r.qty)].filter(Boolean).join(' · ') ||
          null,
      })),
    })
    for (const r of ganMoi) {
      const m = vt.get(r.material_id!)!
      await deNghiRepo.ganMa(r.line_id, {
        material_id: r.material_id!,
        name: m.name,
        unit: m.unit,
      })
    }
    await capNhatTheoSoKho([id])
    const sau = await deNghiRepo.findById(id)
    return { doc_id: res.id, code: res.code, status: sau?.status ?? p.status }
  },

  /** CHỐT XONG khi còn dòng thiếu mà không mua nữa (Q14): bắt lý do, khoá ở Xong. */
  async chot(user: User, id: string, reason: string): Promise<void> {
    await assertAction(user, 'warehouse.request.manage')
    const p = await phieu(id)
    if (p.status !== 'approved' && p.status !== 'ordering')
      throw Conflict(
        `Chỉ chốt được phiếu đã duyệt / đang nhập — ${p.code} không ở bước đó`,
      )
    const ok = await deNghiRepo.update(
      id,
      {
        status: 'done',
        closed_at: new Date().toISOString(),
        closed_by: user.id,
        closed_reason: reason.trim(),
      },
      ['approved', 'ordering'],
    )
    if (!ok) throw Conflict(`Phiếu ${p.code} vừa được xử lý — tải lại trang`)
  },

  /** Rút về nháp khi lãnh đạo CHƯA duyệt (pending → draft). */
  async withdraw(user: User, id: string): Promise<void> {
    await assertAction(user, 'warehouse.request.manage')
    const p = await phieu(id)
    if (p.status !== 'pending')
      throw Conflict(`Chỉ rút được phiếu đang chờ duyệt — ${p.code} không còn chờ duyệt`)
    const ok = await deNghiRepo.update(id, { status: 'draft' }, ['pending'])
    if (!ok) throw Conflict(`Phiếu ${p.code} vừa được xử lý — tải lại trang`)
  },

  /** Huỷ (không xoá): nháp hoặc chờ duyệt, bắt lý do. */
  async cancel(user: User, id: string, reason: string): Promise<void> {
    await assertAction(user, 'warehouse.request.manage')
    const p = await phieu(id)
    if (p.status !== 'draft' && p.status !== 'pending')
      throw Conflict(`Phiếu ${p.code} đã duyệt — không huỷ ở Kho được`)
    const ok = await deNghiRepo.update(
      id,
      {
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancelled_by: user.id,
        cancel_reason: reason,
      },
      ['draft', 'pending'],
    )
    if (!ok) throw Conflict(`Phiếu ${p.code} vừa được xử lý — tải lại trang`)
  },
}
