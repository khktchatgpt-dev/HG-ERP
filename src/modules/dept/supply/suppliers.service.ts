import { suppliersRepo, materialGroupsRepo, type Supplier } from './supply.repo'
import type { supplierCreateSchema } from './suppliers.schema'
import { usersRepo, type User } from '@/modules/core/users/users.repo'
import { rbacRepo } from '@/modules/core/rbac/rbac.repo'
import type { z } from 'zod'
import { hasPermission, assertAction } from '@/modules/core/rbac/rbac.service'
import { Conflict, NotFound } from '@/server/http'
import { nextSupplierCode } from '@/lib/supplier-code'
import { findSupplierDupes, normTaxNo } from '@/lib/supplier-dup'

/**
 * Tên phòng CUNG ỨNG như trong public.departments. KHÔNG dùng cho authz nữa
 * (đã chuyển sang permission supply.member) — chỉ còn để tính NGƯỜI-NHẬN thông
 * báo "ai thuộc phòng Cung ứng" ở orders.service / stock.service (đề xuất mua).
 * - 'Cung Ứng - Mua Hàng'          — phòng mới, CHỈ vai mua hàng.
 * - 'Kế Hoạch Sản Xuất-cung ứng'   — phòng gộp cũ, giữ CẢ HAI vai.
 */
const SUPPLY_DEPT_NAMES = new Set(['Kế Hoạch Sản Xuất-cung ứng', 'Cung Ứng - Mua Hàng'])

// Phase 2 RBAC: guard đọc thẳng permission (bỏ hardcode tên phòng cho authz).
async function isSupplyStaff(user: User): Promise<boolean> {
  return hasPermission(user, 'supply.member')
}

type SupplierInput = z.infer<typeof supplierCreateSchema>

/** '' → null cho các trường text (form gửi chuỗi rỗng). */
function nn<T>(v: T | '' | undefined | null): T | null {
  return v === '' || v === undefined ? null : (v as T | null)
}

export const suppliersService = {
  /** Đọc: mọi NV (Kho/Kế toán tra thông tin NCC — ma trận đặc tả mục 6). */
  async list(
    _user: User,
    opts: { q?: string; active_only?: boolean; page: number; page_size: number },
  ) {
    return suppliersRepo.list({
      q: opts.q,
      active_only: opts.active_only ?? false,
      page: opts.page,
      page_size: opts.page_size,
    })
  },

  async create(user: User, input: SupplierInput): Promise<Supplier> {
    await assertAction(user, 'supply.supplier.manage')
    const status = input.status ?? 'active'
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { is_active: _ignore, ...rest } = input as SupplierInput & {
      is_active?: boolean
    }
    /*
     * MÃ NCC: bỏ trống thì server tự cấp (03/09/2026, user chốt). Đo được 120/157
     * NCC không có mã — người tạo đang vội thì bỏ qua ô đó, và không ai quay lại
     * đặt. Mã sinh theo ĐÚNG nếp 37 mã người dùng tự đặt (chữ đầu của tên riêng),
     * không đẻ khuôn thứ hai kiểu "NCC-0001".
     *
     * Cấp ở SERVICE chứ không ở form: mọi đường ghi (form, API, script nạp) đều
     * đi qua đây, và chỉ ở đây mới biết mã nào đang bị chiếm.
     */
    const code =
      input.code?.trim() || nextSupplierCode(input.name, await suppliersRepo.allCodes())
    const tax_no = await assertTaxNoFree(input.tax_no)

    return suppliersRepo.insert({
      ...toRow(rest),
      tax_no,
      code: code || null,
      name: input.name,
      status,
      is_active: status === 'active', // đồng bộ cổng chọn NCC khi tạo PO
      can_order: input.can_order ?? true,
      created_by: user.id,
      updated_by: user.id,
    })
  },

  async update(
    user: User,
    id: string,
    patch: Partial<SupplierInput> & { is_active?: boolean },
  ): Promise<Supplier> {
    await assertAction(user, 'supply.supplier.manage')
    const before = await suppliersRepo.findById(id)
    if (!before) throw NotFound('NCC không tồn tại')

    const row: Partial<Supplier> = { ...toRow(patch), updated_by: user.id }
    // Chỉ soát MST khi nó ĐỔI: 3 cặp trùng cũ (29/09) vẫn phải sửa được ô khác.
    if (patch.tax_no !== undefined) {
      const next = normTaxNo(patch.tax_no)
      row.tax_no = next === normTaxNo(before.tax_no) ? before.tax_no : await assertTaxNoFree(patch.tax_no, id) // prettier-ignore
    }
    // Đồng bộ status ↔ is_active 2 chiều.
    if (patch.status !== undefined) row.is_active = patch.status === 'active'
    else if (patch.is_active !== undefined) {
      row.is_active = patch.is_active
      row.status = patch.is_active ? 'active' : 'suspended'
    }
    // Có chấm điểm/hạng → ghi mốc đánh giá (M5).
    const scored =
      patch.quality_score !== undefined ||
      patch.service_score !== undefined ||
      patch.price_score !== undefined ||
      patch.complaint_count !== undefined ||
      patch.rating !== undefined
    if (scored) {
      row.evaluated_at = new Date().toISOString()
      row.evaluated_by = user.id
    }
    return suppliersRepo.patch(id, row)
  },

  /** Nhóm hàng NCC cung cấp (M4). */
  async listGroups(_user: User, supplierId: string): Promise<string[]> {
    return materialGroupsRepo.forSupplier(supplierId)
  },

  async setGroups(user: User, supplierId: string, groupIds: string[]): Promise<void> {
    await assertAction(user, 'supply.supplier.manage')
    await materialGroupsRepo.setForSupplier(supplierId, groupIds)
  },
}

/** Chuẩn hoá payload text → null; loại field không thuộc bảng. */
/**
 * MST ĐÃ CÓ CHỦ THÌ CHẶN (29/09/2026, chủ dự án duyệt). Trả MST đã chuẩn hoá
 * (null nếu trống) để ghi xuống — hai cách gõ một MST không thành hai giá trị.
 */
async function assertTaxNoFree(taxNo: string | null | undefined, exceptId?: string) {
  const tax = normTaxNo(taxNo)
  if (!tax) return null
  const { taxOwner: o } = findSupplierDupes(await suppliersRepo.withTaxNo(), { name: '', tax_no: tax }, exceptId) // prettier-ignore
  if (o)
    throw Conflict(
      `MST ${tax} đã gắn cho ${o.code ? `${o.code} · ` : ''}${o.name} — một trong hai đang gõ sai. Sửa MST ở hồ sơ kia, hoặc bỏ trống ô MST để lưu trước.`,
      'TAX_NO_TAKEN',
    )
  return tax
}

function toRow(
  input: Partial<SupplierInput> & { is_active?: boolean },
): Partial<Supplier> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(input)) {
    if (k === 'is_active' || k === 'lead_time_days' || k === 'can_order') continue
    out[k] = nn(v as string)
  }
  if (input.lead_time_days !== undefined) out.lead_time_days = input.lead_time_days
  // Khoá đặt hàng là BOOLEAN — vòng lặp trên bỏ qua nó (nn() chỉ cho chữ) mà trước
  // 27/09/2026 không ghi lại ở đây, nên bật/tắt "khoá đặt hàng" ở hồ sơ NCC chưa
  // bao giờ lưu được: can_order luôn true, chỉ lock_reason đổi.
  if (input.can_order !== undefined) out.can_order = input.can_order
  return out as Partial<Supplier>
}

export { isSupplyStaff, SUPPLY_DEPT_NAMES }

/**
 * NGƯỜI MUA — thành viên phòng Cung ứng còn làm việc (quyền `supply.member`,
 * tài khoản đang bật, chưa xoá). Nguồn cho ô "Người phụ trách" của hồ sơ NCC
 * (27/09/2026). Admin cũng mang quyền này nhưng không phải người mua — bỏ.
 */
export async function listSupplyBuyers(): Promise<{ id: string; name: string }[]> {
  const [ids, users] = await Promise.all([
    rbacRepo.userIdsWithPermission('supply.member'),
    usersRepo.list(),
  ])
  const set = new Set(ids)
  return users
    .filter((u) => set.has(u.id) && u.is_active && !u.deleted_at && u.role !== 'admin')
    .map((u) => ({ id: u.id, name: u.name ?? u.email }))
    .sort((a, b) => a.name.localeCompare(b.name, 'vi'))
}
