import {
  customersRepo,
  type Customer,
  type CustomerActivity,
  type CustomerCounts,
  type CustomerStatusFilter,
  type CustomerWithOwner,
} from './sales.repo'
import { type User } from '@/modules/core/users/users.repo'
import { hasPermission, assertAction } from '@/modules/core/rbac/rbac.service'
import { Conflict, Forbidden, NotFound } from '@/server/http'

// Phase 2 RBAC: guard đọc thẳng permission (bỏ hardcode tên phòng).
async function isSalesUser(user: User): Promise<boolean> {
  return hasPermission(user, 'sales.member')
}

// canEdit: manager-tier sửa mọi KH; sale chỉ sửa KH của mình (row-level, giữ ở
// service). Không hardcode tên phòng nên không cần permission riêng (seed cũng
// chưa có sales.edit) — giữ role-tier + ownership.
function canEdit(user: User, customer: Customer): boolean {
  if (user.role === 'admin') return true
  if (user.role === 'manager') return true // manager Sales edits all
  return customer.owner_id === user.id // sale chỉ sửa KH của mình
}

type CreateInput = {
  name: string
  code?: string | null
  email?: string | null
  phone?: string | null
  address?: string | null
  notes?: string | null
  owner_id?: string | null
  tax_code?: string | null
  country?: string | null
  contact_person?: string | null
  default_currency?: string | null
  default_price_term?: string | null
  default_payment_terms?: string | null
  port_of_discharge?: string | null
  fax?: string | null
  representative_title?: string | null
  fsc_cert?: string | null
}

type UpdateInput = Partial<CreateInput & { is_active: boolean }>

export const salesService = {
  // Xem mở cho mọi NV đã đăng nhập — workspace Sales có openView (xem chéo
  // phòng ban, workspaces/access.ts); ghi vẫn khoá phòng Bán hàng bên dưới.
  async list(
    _user: User,
    opts: {
      q?: string
      owner_id?: string
      unassigned?: boolean
      status?: CustomerStatusFilter
      page: number
      page_size: number
    },
  ) {
    return customersRepo.list({
      q: opts.q,
      owner_id: opts.owner_id,
      unassigned: opts.unassigned,
      status: opts.status ?? 'active',
      page: opts.page,
      page_size: opts.page_size,
    })
  },

  /**
   * Số cho StatsBar của danh sách KH — không phụ thuộc bộ lọc đang bật. Danh mục
   * KH đọc mở (`sales.customer.view` = PUBLIC) nên không gác theo user.
   */
  async counts(): Promise<CustomerCounts> {
    return customersRepo.counts()
  },

  /** Số báo giá/đơn của đúng các KH đang hiện trên trang. */
  async activity(_user: User, ids: string[]): Promise<Record<string, CustomerActivity>> {
    return customersRepo.activityByCustomers(ids)
  },

  async get(_user: User, id: string): Promise<CustomerWithOwner> {
    const c = await customersRepo.findById(id)
    if (!c) throw NotFound('Khách hàng không tồn tại')
    return c
  },

  async create(user: User, input: CreateInput): Promise<Customer> {
    await assertAction(user, 'sales.customer.create')
    // Default owner = current user when not specified.
    const owner_id = input.owner_id ?? user.id
    if (input.code && (await customersRepo.existsByCode(input.code))) {
      throw Conflict(`Mã KH "${input.code}" đã có khách khác dùng`, 'CODE_TAKEN')
    }

    return customersRepo.insert({
      name: input.name,
      code: input.code ?? null,
      email: input.email || null,
      phone: input.phone ?? null,
      address: input.address ?? null,
      notes: input.notes ?? null,
      owner_id,
      tax_code: input.tax_code ?? null,
      country: input.country ?? null,
      contact_person: input.contact_person ?? null,
      default_currency: input.default_currency ?? null,
      default_price_term: input.default_price_term ?? null,
      default_payment_terms: input.default_payment_terms ?? null,
      port_of_discharge: input.port_of_discharge ?? null,
      fax: input.fax ?? null,
      representative_title: input.representative_title ?? null,
      fsc_cert: input.fsc_cert ?? null,
    })
  },

  async update(user: User, id: string, patch: UpdateInput): Promise<Customer> {
    await assertAction(user, 'sales.customer.update')
    const before = await customersRepo.findById(id)
    if (!before) throw NotFound('Khách hàng không tồn tại')
    if (!canEdit(user, before)) {
      throw Forbidden('Bạn chỉ sửa được KH do mình phụ trách')
    }
    if (
      patch.code &&
      patch.code !== before.code &&
      (await customersRepo.existsByCode(patch.code, id))
    ) {
      throw Conflict(`Mã KH "${patch.code}" đã có khách khác dùng`, 'CODE_TAKEN')
    }
    return customersRepo.patch(id, patch)
  },

  /**
   * Xoá KH — chỉ khi CHƯA có lịch sử.
   *
   * `sales_quotes.customer_id` và `sales_orders.customer_id` đều `on delete
   * restrict`: xoá KH đã từng báo giá / đặt hàng sẽ bị DB chặn và người dùng nhận
   * lỗi Postgres thô. Đếm trước để nói đúng chuyện và chỉ sang "Ngừng giao dịch" —
   * đó mới là việc người ta thật sự muốn làm (giữ lịch sử, ẩn khỏi danh sách).
   */
  async remove(user: User, id: string): Promise<void> {
    await assertAction(user, 'sales.customer.remove')
    const before = await customersRepo.findById(id)
    if (!before) throw NotFound('Khách hàng không tồn tại')
    if (!canEdit(user, before)) {
      throw Forbidden('Bạn chỉ xoá được KH do mình phụ trách')
    }
    const used = await customersRepo.usageCounts(id)
    if (used.quotes > 0 || used.orders > 0) {
      const parts = [
        used.quotes > 0 && `${used.quotes} báo giá`,
        used.orders > 0 && `${used.orders} đơn hàng`,
      ].filter(Boolean)
      throw Conflict(
        `Không xoá được: KH đang có ${parts.join(' và ')}. Dùng "Ngừng giao dịch" để ẩn khỏi danh sách mà vẫn giữ lịch sử.`,
        'CUSTOMER_IN_USE',
      )
    }
    await customersRepo.delete(id)
  },
}

export { isSalesUser }
