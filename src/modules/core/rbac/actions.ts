/**
 * SỔ TAY THAO TÁC (action registry) — mô tả TƯỜNG MINH luật authz của từng thao
 * tác được bảo vệ, để /admin/permissions hiển thị "permission khoá việc gì" và
 * "ai làm được gì". Ma trận vai×quyền chỉ nói VAI CÓ PERMISSION NÀO; file này bổ
 * sung 3 tầng vô hình trên ma trận: đọc-mở, tổ hợp AND/OR, và guard theo vai
 * toàn cục.
 *
 * Hiện là NGUỒN MÔ TẢ (Phase A): phải khớp guard trong service. Phase B sẽ để
 * guard đọc thẳng từ đây (assertAction) → hết drift. `actions.test.ts` chặn gõ
 * sai key permission.
 *
 * Điều kiện ROW-LEVEL (chủ sở hữu/tổ/đơn của mình) KHÔNG biểu diễn bằng công
 * thức permission được — ghi ở `rowLevel` để người đọc biết còn ràng buộc dữ liệu.
 */

export type GlobalRole = 'admin' | 'manager' | 'employee'

export type Rule =
  | { kind: 'public' } // mọi nhân viên đã đăng nhập (đọc mở, không gác quyền)
  | { kind: 'perm'; key: string } // hasPermission(key)
  | { kind: 'role'; of: GlobalRole[] } // vai toàn cục users.role (vd admin/manager)
  | { kind: 'allOf'; of: Rule[] } // VÀ
  | { kind: 'anyOf'; of: Rule[] } // HOẶC

export type Action = {
  key: string
  label: string
  domain: string
  rule: Rule
  /** Ràng buộc dữ liệu bổ sung ngoài permission (chủ sở hữu, tổ, đơn của mình…). */
  rowLevel?: string
}

// Builder gọn cho dễ đọc.
const PUBLIC: Rule = { kind: 'public' }
const perm = (key: string): Rule => ({ kind: 'perm', key })
const role = (...of: GlobalRole[]): Rule => ({ kind: 'role', of })
const allOf = (...of: Rule[]): Rule => ({ kind: 'allOf', of })
const anyOf = (...of: Rule[]): Rule => ({ kind: 'anyOf', of })

// Tổ hợp hay lặp: "thành viên phòng X VÀ quyền sửa".
const memberEdit = (member: string, edit: string) => allOf(perm(member), perm(edit))

export const ACTIONS: Action[] = [
  // ── Kỹ thuật (thư viện SP + BOM) ─────────────────────────────────────────
  {
    key: 'technical.product.view',
    label: 'Xem thư viện sản phẩm',
    domain: 'technical',
    rule: PUBLIC,
  },
  {
    key: 'technical.bom.view',
    label: 'Xem BOM / định mức',
    domain: 'technical',
    rule: PUBLIC,
  },
  {
    key: 'technical.product.create',
    label: 'Tạo sản phẩm (đầy đủ)',
    domain: 'technical',
    rule: memberEdit('technical.member', 'technical.edit'),
  },
  {
    key: 'technical.product.quick_create',
    label: 'Tạo nhanh sản phẩm (từ báo giá/đơn)',
    domain: 'technical',
    rule: anyOf(perm('sales.member'), memberEdit('technical.member', 'technical.edit')),
  },
  {
    key: 'technical.product.set_image',
    label: 'Đặt ảnh đại diện sản phẩm',
    domain: 'technical',
    rule: anyOf(perm('sales.member'), memberEdit('technical.member', 'technical.edit')),
  },
  {
    key: 'technical.product.update',
    label: 'Sửa sản phẩm',
    domain: 'technical',
    rule: memberEdit('technical.member', 'technical.edit'),
  },
  {
    key: 'technical.product.clone',
    label: 'Nhân bản sản phẩm',
    domain: 'technical',
    rule: memberEdit('technical.member', 'technical.edit'),
  },
  {
    key: 'technical.product.remove',
    label: 'Xoá sản phẩm',
    domain: 'technical',
    rule: memberEdit('technical.member', 'technical.edit'),
    rowLevel: 'Chặn nếu SP đang nằm trong báo giá/đơn/mẫu — dùng "Ngừng dùng".',
  },
  {
    key: 'technical.bom.save',
    label: 'Bóc tách / sửa BOM',
    domain: 'technical',
    rule: allOf(perm('technical.bom.edit'), perm('technical.edit')),
  },
  {
    key: 'technical.sample.manage',
    label: 'Quản lý mẫu showroom',
    domain: 'technical',
    rule: perm('technical.member'),
  },
  {
    key: 'technical.sample.loan',
    label: 'Ghi sổ mượn mẫu',
    domain: 'technical',
    rule: perm('technical.member'),
  },

  // ── Bán hàng (khách hàng, báo giá, đơn) ──────────────────────────────────
  { key: 'sales.customer.view', label: 'Xem khách hàng', domain: 'sales', rule: PUBLIC },
  {
    key: 'sales.customer.create',
    label: 'Tạo khách hàng',
    domain: 'sales',
    rule: perm('sales.member'),
  },
  {
    key: 'sales.customer.update',
    label: 'Sửa khách hàng',
    domain: 'sales',
    rule: perm('sales.member'),
    rowLevel: 'Sale chỉ sửa KH của mình; GĐ/QL sửa mọi KH.',
  },
  {
    key: 'sales.customer.remove',
    label: 'Xoá khách hàng',
    domain: 'sales',
    rule: perm('sales.member'),
    rowLevel: 'Sale chỉ xoá KH của mình; GĐ/QL mọi KH.',
  },
  { key: 'sales.quote.view', label: 'Xem báo giá', domain: 'sales', rule: PUBLIC },
  {
    key: 'sales.quote.manage',
    label: 'Lập / chốt / sửa báo giá',
    domain: 'sales',
    rule: perm('sales.member'),
  },
  { key: 'sales.order.view', label: 'Xem đơn hàng', domain: 'sales', rule: PUBLIC },
  {
    key: 'sales.order.manage',
    label: 'Tạo / sửa / huỷ đơn hàng',
    domain: 'sales',
    rule: perm('sales.member'),
  },
  {
    key: 'sales.order.confirm_delivery',
    label: 'Xác nhận giao hàng',
    domain: 'sales',
    rule: anyOf(role('admin', 'manager'), perm('sales.member')),
  },

  // ── Cung ứng (NCC, bảng giá, PO) ─────────────────────────────────────────
  {
    key: 'supply.supplier.view',
    label: 'Xem nhà cung cấp',
    domain: 'supply',
    rule: PUBLIC,
  },
  {
    key: 'supply.supplier.manage',
    label: 'Quản lý NCC / nhóm hàng',
    domain: 'supply',
    rule: perm('supply.member'),
  },
  {
    key: 'supply.cert.manage',
    label: 'Quản lý chứng chỉ NCC',
    domain: 'supply',
    rule: perm('supply.member'),
  },
  {
    key: 'supply.price.manage',
    label: 'Nhập / sửa bảng giá NCC',
    domain: 'supply',
    rule: perm('supply.member'),
  },
  {
    key: 'supply.po.view',
    label: 'Xem đơn đặt vật tư (PO)',
    domain: 'supply',
    rule: PUBLIC,
  },
  {
    key: 'supply.po.manage',
    label: 'Tạo / sửa / gửi PO',
    domain: 'supply',
    rule: perm('supply.member'),
  },
  {
    key: 'supply.po.approve',
    label: 'Duyệt / từ chối PO',
    domain: 'supply',
    rule: perm('supply.po.approve'),
  },

  // ── Kho (vật tư, tồn, nhập/xuất) ─────────────────────────────────────────
  {
    key: 'warehouse.material.view',
    label: 'Xem vật tư / tồn kho',
    domain: 'warehouse',
    rule: PUBLIC,
  },
  {
    key: 'warehouse.material.create',
    label: 'Tạo vật tư mới',
    domain: 'warehouse',
    rule: perm('warehouse.material.create'),
  },
  {
    key: 'warehouse.material.update',
    label: 'Sửa / xoá danh mục vật tư',
    domain: 'warehouse',
    rule: memberEdit('warehouse.member', 'warehouse.edit'),
  },
  {
    // Chia chủ quyền danh mục vật tư (1 danh mục chung, 2 nhóm trường):
    // Cung ứng sửa trường MUA HÀNG (NCC mặc định, VAT, profile giá…) + trường nền;
    // trường TỒN TRỮ (min/max, kệ, barcode, ngừng dùng) vẫn của Kho — service enforce.
    key: 'warehouse.material.update_purchasing',
    label: 'Sửa trường mua hàng của vật tư (Cung ứng)',
    domain: 'warehouse',
    rule: anyOf(perm('supply.member'), memberEdit('warehouse.member', 'warehouse.edit')),
  },
  {
    key: 'warehouse.stock.write',
    label: 'Ghi phiếu nhập / xuất tồn',
    domain: 'warehouse',
    rule: memberEdit('warehouse.member', 'warehouse.edit'),
  },

  // ── Sản xuất (LSX, tiến độ, sổ, sự cố, tổ) ───────────────────────────────
  {
    key: 'production.lsx.view',
    label: 'Xem LSX / bảng tiến độ',
    domain: 'production',
    rule: PUBLIC,
  },
  {
    key: 'production.lsx.issue',
    label: 'Phát / gửi lại LSX',
    domain: 'production',
    rule: perm('production.lsx.issue'),
  },
  {
    key: 'production.lsx.approve',
    label: 'Duyệt / từ chối LSX',
    domain: 'production',
    rule: perm('production.lsx.approve'),
  },
  {
    key: 'production.progress.track',
    label: 'Cập nhật tiến độ / báo hoàn thành / nhận VT',
    domain: 'production',
    rule: perm('production.progress.track'),
  },
  {
    key: 'production.components.edit',
    label: 'Định hình: bảng chi tiết + lộ trình',
    domain: 'production',
    rule: perm('production.components.edit'),
  },
  {
    key: 'production.output.record',
    label: 'Nhập sổ sản lượng',
    domain: 'production',
    rule: perm('production.output.record'),
    rowLevel: 'Sửa dòng đã ghi: người tạo hoặc GĐ/QL; sổ đã chốt ngày thì khoá.',
  },
  {
    key: 'production.outsource.record',
    label: 'Ghi giao / nhận gia công ngoài',
    domain: 'production',
    rule: perm('production.outsource.record'),
    rowLevel: 'Sửa dòng đã ghi: người tạo hoặc GĐ/QL.',
  },
  {
    key: 'production.daylock.lock',
    label: 'Chốt sổ ngày (theo tổ)',
    domain: 'production',
    rule: perm('production.daylock.lock'),
    rowLevel: 'NV xưởng bị ép tổ mình; GĐ/QL chốt hộ tổ chỉ định.',
  },
  {
    key: 'production.daylock.unlock',
    label: 'Mở lại sổ ngày',
    domain: 'production',
    rule: perm('production.daylock.unlock'),
  },
  {
    key: 'production.incident.report',
    label: 'Báo sự cố sản xuất',
    domain: 'production',
    rule: perm('production.incident.report'),
  },
  {
    key: 'production.incident.close',
    label: 'Đóng sự cố sản xuất',
    domain: 'production',
    rule: perm('production.incident.close'),
  },
  {
    key: 'production.team.board',
    label: 'Xem bảng việc của tổ',
    domain: 'production',
    rule: perm('production.team.manage'),
  },
  {
    key: 'production.team.mark_stage',
    label: 'Tổ đánh dấu Bắt đầu / Xong công đoạn',
    domain: 'production',
    rule: anyOf(role('admin', 'manager'), perm('production.member')),
    rowLevel: 'NV xưởng chỉ thao tác ĐÚNG công đoạn tổ mình; GĐ/QL mọi công đoạn.',
  },

  // ── Nhân sự (nghỉ phép) ──────────────────────────────────────────────────
  {
    key: 'hr.leave.create',
    label: 'Tạo đơn nghỉ phép',
    domain: 'hr',
    rule: PUBLIC,
    rowLevel: 'Chỉ tạo đơn cho chính mình.',
  },
  {
    key: 'hr.leave.list_all',
    label: 'Xem tất cả đơn nghỉ',
    domain: 'hr',
    rule: perm('hr.member'),
  },
  {
    key: 'hr.leave.decide',
    label: 'Duyệt / từ chối đơn nghỉ',
    domain: 'hr',
    rule: perm('hr.leave.decide'),
  },
  {
    key: 'hr.leave.cancel',
    label: 'Huỷ đơn nghỉ',
    domain: 'hr',
    rule: PUBLIC,
    rowLevel: 'Chỉ huỷ đơn của mình (admin huỷ mọi đơn).',
  },

  // ── Kế toán (hoá đơn) ────────────────────────────────────────────────────
  {
    key: 'accounting.invoice.view',
    label: 'Xem hoá đơn',
    domain: 'accounting',
    rule: perm('accounting.member'),
  },
  {
    key: 'accounting.invoice.manage',
    label: 'Tạo / sửa hoá đơn',
    domain: 'accounting',
    rule: perm('accounting.member'),
  },

  // ── Ban Giám Đốc ─────────────────────────────────────────────────────────
  {
    key: 'exec.tower.view',
    label: 'Xem tháp điều hành',
    domain: 'exec',
    rule: perm('exec.tower.view'),
  },
  {
    key: 'exec.approvals.view',
    label: 'Xem lịch sử phê duyệt',
    domain: 'exec',
    rule: perm('exec.approvals.view'),
  },

  // ── Quản trị hệ thống (dùng vai users.role='admin', chưa gắn permission) ──
  {
    key: 'system.users.manage',
    label: 'Quản lý người dùng',
    domain: 'system',
    rule: role('admin'),
    rowLevel: 'Không tự đổi vai/khoá/xoá chính mình.',
  },
  {
    key: 'system.departments.manage',
    label: 'Quản lý phòng ban',
    domain: 'system',
    rule: role('admin'),
  },
  {
    key: 'system.catalogs.manage',
    label: 'Quản lý danh mục dùng chung',
    domain: 'system',
    rule: role('admin'),
  },
  {
    key: 'system.settings.manage',
    label: 'Quản lý cấu hình hệ thống',
    domain: 'system',
    rule: role('admin'),
  },
  {
    key: 'system.rbac.manage',
    label: 'Quản trị phân quyền (trang này)',
    domain: 'system',
    rule: role('admin'),
  },

  // ── Công việc (ACL riêng theo quan hệ giao/nhận, không qua permission) ────
  {
    key: 'task.assign',
    label: 'Giao việc cho người khác',
    domain: 'task',
    rule: role('admin', 'manager'),
  },
  {
    key: 'task.manage',
    label: 'Sửa / xoá / duyệt việc',
    domain: 'task',
    rule: role('admin', 'manager'),
    rowLevel: 'Chỉ quản lý ĐÃ giao việc đó; việc tự-tạo thì người tạo tự sửa.',
  },
  {
    key: 'task.view',
    label: 'Xem việc',
    domain: 'task',
    rule: PUBLIC,
    rowLevel: 'Người giao / người nhận / quản lý cùng phòng của việc đó.',
  },
]

/** Đánh giá luật với tập quyền + vai toàn cục của user. KHÔNG gồm admin-bypass. */
export function evalRule(
  rule: Rule,
  ctx: { role: GlobalRole; has: (key: string) => boolean },
): boolean {
  switch (rule.kind) {
    case 'public':
      return true
    case 'perm':
      return ctx.has(rule.key)
    case 'role':
      return rule.of.includes(ctx.role)
    case 'allOf':
      return rule.of.every((r) => evalRule(r, ctx))
    case 'anyOf':
      return rule.of.some((r) => evalRule(r, ctx))
  }
}

/** true nếu user LÀM ĐƯỢC thao tác (admin bypass toàn quyền). */
export function canDo(
  action: Action,
  ctx: { role: GlobalRole; has: (key: string) => boolean },
): boolean {
  if (ctx.role === 'admin') return true
  return evalRule(action.rule, ctx)
}

/** Mọi permission key mà registry tham chiếu (cho test kiểm khớp seed). */
export function referencedPermissionKeys(): string[] {
  const keys = new Set<string>()
  const walk = (r: Rule) => {
    if (r.kind === 'perm') keys.add(r.key)
    else if (r.kind === 'allOf' || r.kind === 'anyOf') r.of.forEach(walk)
  }
  for (const a of ACTIONS) walk(a.rule)
  return [...keys]
}
