import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  ACTIONS,
  evalRule,
  canDo,
  referencedPermissionKeys,
  type Action,
  type Rule,
} from './actions'

// Permission key THẬT lấy từ seed 0073 + 0085 (nguồn sự thật) — chống gõ sai /
// drift. Insert permissions: ('key.with.dot', 'label', 'domain', N).
// role_permissions bắt đầu bằng role key (không dấu chấm) nên không lọt vào đây.
const seedSql = [
  'supabase/migrations/0073_rbac.sql',
  'supabase/migrations/0085_production_v2_perms_receipt.sql',
  'supabase/migrations/0128_po_owner_and_supply_lead.sql',
  'supabase/migrations/0149_sales_quote_approval.sql',
  'supabase/migrations/0175_tach_vai_thong_ke_to_truong.sql',
]
  .map((p) => readFileSync(resolve(process.cwd(), p), 'utf8'))
  .join('\n')
const seedKeys = new Set(
  [...seedSql.matchAll(/\('([a-z_]+\.[a-z._]+)',\s*'/g)].map((m) => m[1]),
)

const has = (keys: string[]) => (k: string) => keys.includes(k)

describe('actions registry', () => {
  it('mọi permission key tham chiếu đều tồn tại trong seed', () => {
    const unknown = referencedPermissionKeys().filter((k) => !seedKeys.has(k))
    expect(unknown).toEqual([])
  })

  it('không trùng action key', () => {
    const keys = ACTIONS.map((a) => a.key)
    expect(new Set(keys).size).toBe(keys.length)
  })
})

describe('evalRule', () => {
  const ctx = (role: 'admin' | 'manager' | 'employee', keys: string[]) => ({
    role,
    has: has(keys),
  })

  it('public → luôn true', () => {
    expect(evalRule({ kind: 'public' }, ctx('employee', []))).toBe(true)
  })

  it('perm → theo tập quyền', () => {
    const r = { kind: 'perm', key: 'sales.member' } as const
    expect(evalRule(r, ctx('employee', ['sales.member']))).toBe(true)
    expect(evalRule(r, ctx('employee', []))).toBe(false)
  })

  it('role → theo vai toàn cục', () => {
    const r = { kind: 'role', of: ['admin', 'manager'] } satisfies Rule
    expect(evalRule(r, ctx('manager', []))).toBe(true)
    expect(evalRule(r, ctx('employee', []))).toBe(false)
  })

  it('allOf = VÀ, anyOf = HOẶC', () => {
    const both = {
      kind: 'allOf',
      of: [
        { kind: 'perm', key: 'technical.member' },
        { kind: 'perm', key: 'technical.edit' },
      ],
    } satisfies Rule
    expect(evalRule(both, ctx('employee', ['technical.member']))).toBe(false)
    expect(evalRule(both, ctx('employee', ['technical.member', 'technical.edit']))).toBe(
      true,
    )

    const either = {
      kind: 'anyOf',
      of: [
        { kind: 'perm', key: 'sales.member' },
        { kind: 'perm', key: 'technical.member' },
      ],
    } satisfies Rule
    expect(evalRule(either, ctx('employee', ['sales.member']))).toBe(true)
    expect(evalRule(either, ctx('employee', ['hr.member']))).toBe(false)
  })
})

/**
 * Hồ sơ sản phẩm = khu DÙNG CHUNG (user chốt 07/08/2026): mọi phòng XEM, chỉ
 * Kỹ thuật / Bán hàng / Giám đốc SỬA. Bộ test dưới chốt đúng ba nhóm đó — và
 * chốt cả mặt còn lại: phòng khác (Kho) chỉ xem.
 */
describe('canDo — hồ sơ SP: mọi phòng xem, 3 nhóm sửa', () => {
  const byKey = (k: string) => ACTIONS.find((a) => a.key === k) as Action
  const ctxOf = (keys: string[]) => ({ role: 'employee' as const, has: has(keys) })

  // Tập quyền đúng như seed 0073 + 0118 cho từng vai.
  const sales = ctxOf(['sales.member', 'technical.bom.edit', 'technical.edit'])
  const technical = ctxOf(['technical.member', 'technical.edit', 'technical.bom.edit'])
  const director = ctxOf(['technical.edit', 'technical.bom.edit'])
  const warehouse = ctxOf(['warehouse.member', 'warehouse.edit'])

  const VIEW = ['technical.product.view', 'technical.bom.view']
  const EDIT = [
    'technical.product.create',
    'technical.product.update',
    'technical.product.clone',
    'technical.product.remove',
    'technical.product.attach_file',
    'technical.bom.save',
  ]

  it('MỌI vai xem được thư viện SP + BOM (kể cả Kho)', () => {
    for (const c of [sales, technical, director, warehouse]) {
      expect(VIEW.every((k) => canDo(byKey(k), c))).toBe(true)
    }
  })

  it('Kỹ thuật / Bán hàng / Giám đốc sửa được cả hồ sơ lẫn định mức', () => {
    for (const c of [technical, sales, director]) {
      expect(EDIT.filter((k) => !canDo(byKey(k), c))).toEqual([])
    }
  })

  it('phòng khác (Kho) KHÔNG sửa được gì trong hồ sơ SP', () => {
    expect(EDIT.filter((k) => canDo(byKey(k), warehouse))).toEqual([])
  })

  it('Giám đốc sửa được dù KHÔNG có technical.member (lỗi luật cũ)', () => {
    // Luật cũ `technical.member AND technical.edit` chặn đúng ca này.
    expect(canDo(byKey('technical.product.update'), director)).toBe(true)
  })

  it('Sales tạo nhanh SP + đặt ảnh + điền quy cách → được', () => {
    expect(canDo(byKey('technical.product.quick_create'), sales)).toBe(true)
    expect(canDo(byKey('technical.product.set_image'), sales)).toBe(true)
    expect(canDo(byKey('technical.product.fill_specs'), sales)).toBe(true)
  })

  it('sale KHÔNG có technical.edit vẫn tạo nhanh/đặt ảnh được (nhánh sales.member)', () => {
    const salesOnly = ctxOf(['sales.member'])
    expect(canDo(byKey('technical.product.quick_create'), salesOnly)).toBe(true)
    expect(canDo(byKey('technical.product.set_image'), salesOnly)).toBe(true)
    expect(canDo(byKey('technical.product.update'), salesOnly)).toBe(false)
  })

  it('showroom vẫn là của phòng Kỹ thuật — Bán hàng/Giám đốc không quản mẫu', () => {
    expect(canDo(byKey('technical.sample.manage'), technical)).toBe(true)
    expect(canDo(byKey('technical.sample.manage'), sales)).toBe(false)
    expect(canDo(byKey('technical.sample.manage'), director)).toBe(false)
  })

  it('admin bypass → làm được mọi thao tác', () => {
    const adminCtx = { role: 'admin' as const, has: has([]) }
    expect(ACTIONS.every((a) => canDo(a, adminCtx))).toBe(true)
  })
})

/**
 * Nhóm / nhóm phụ vật tư (03/09/2026): user chốt "không để admin quản lí phần
 * này" — Cung ứng và Kho tự thêm/đổi tên/gộp/xoá; nhân viên phòng khác không.
 */
describe('canDo — quản lý nhóm vật tư: Cung ứng + Kho, không cần admin', () => {
  const byKey = (k: string) => ACTIONS.find((a) => a.key === k) as Action
  const ctxOf = (keys: string[]) => ({ role: 'employee' as const, has: has(keys) })
  const supply = ctxOf(['supply.member'])
  const warehouse = ctxOf(['warehouse.member', 'warehouse.edit'])
  const sales = ctxOf(['sales.member'])
  const KEY = 'warehouse.material.group_manage'

  it('Cung ứng (chỉ cần supply.member) và Kho (member + edit) quản lý được nhóm', () => {
    expect(canDo(byKey(KEY), supply)).toBe(true)
    expect(canDo(byKey(KEY), warehouse)).toBe(true)
  })

  it('phòng khác không đổi được cấu trúc nhóm', () => {
    expect(canDo(byKey(KEY), sales)).toBe(false)
  })
})

/**
 * Khuôn nhôm (29/09/2026): user chốt Cung ứng được THÊM / SỬA khuôn (kể cả ảnh
 * mặt cắt + nhật ký) cạnh Kỹ thuật và Giám đốc. XOÁ vẫn chỉ Kỹ thuật — Cung ứng
 * gỡ khuôn bằng tình trạng "Đã bỏ", không xoá mất nhật ký.
 */
describe('canDo — khuôn nhôm: Kỹ thuật + GĐ + Cung ứng sửa, chỉ Kỹ thuật xoá', () => {
  const byKey = (k: string) => ACTIONS.find((a) => a.key === k) as Action
  const ctxOf = (keys: string[]) => ({ role: 'employee' as const, has: has(keys) })
  const technical = ctxOf(['technical.member', 'technical.edit', 'technical.bom.edit'])
  const director = ctxOf(['technical.edit', 'technical.bom.edit'])
  const supply = ctxOf(['supply.member', 'warehouse.material.create'])
  const supplyLead = ctxOf(['supply.member', 'supply.lead'])
  const production = ctxOf(['production.member', 'production.progress.track'])
  const warehouse = ctxOf(['warehouse.member', 'warehouse.edit'])
  const WRITE = ['technical.die.create', 'technical.die.update']

  it('Kỹ thuật, Giám đốc, NV + trưởng phòng Cung ứng thêm/sửa được khuôn', () => {
    for (const c of [technical, director, supply, supplyLead]) {
      expect(WRITE.filter((k) => !canDo(byKey(k), c))).toEqual([])
    }
  })

  it('Sản xuất, Kho chỉ xem', () => {
    for (const c of [production, warehouse]) {
      expect(canDo(byKey('technical.die.view'), c)).toBe(true)
      expect(WRITE.filter((k) => canDo(byKey(k), c))).toEqual([])
    }
  })

  it('XOÁ chỉ Kỹ thuật (+ GĐ) — Cung ứng không xoá', () => {
    expect(canDo(byKey('technical.die.remove'), technical)).toBe(true)
    expect(canDo(byKey('technical.die.remove'), director)).toBe(true)
    expect(canDo(byKey('technical.die.remove'), supply)).toBe(false)
    expect(canDo(byKey('technical.die.remove'), supplyLead)).toBe(false)
  })
})

/**
 * Vật tư (05/10/2026, Bản 11): CẢ phòng Cung ứng thêm mã + ngừng dùng / xoá mã
 * chưa dùng — không phụ thuộc vai Kho gán tạm, cũng không phụ thuộc quyền lẻ
 * `warehouse.material.create`. Trường của Kho (kệ, ngưỡng tồn) vẫn của Kho.
 */
describe('canDo — vật tư: Cung ứng thêm + ngừng dùng/xoá, trường Kho vẫn của Kho', () => {
  const byKey = (k: string) => ACTIONS.find((a) => a.key === k) as Action
  const ctxOf = (keys: string[]) => ({ role: 'employee' as const, has: has(keys) })
  const supplyBare = ctxOf(['supply.member'])
  const warehouse = ctxOf(['warehouse.member', 'warehouse.edit'])
  const production = ctxOf(['production.member'])
  const SUPPLY_OK = [
    'warehouse.material.create',
    'warehouse.material.update_purchasing',
    'warehouse.material.retire',
    'warehouse.material.group_manage',
  ]

  it('NV Cung ứng chỉ có supply.member vẫn thêm / sửa trường mua / ngừng dùng được', () => {
    expect(SUPPLY_OK.filter((k) => !canDo(byKey(k), supplyBare))).toEqual([])
  })
  it('Cung ứng KHÔNG có quyền sửa đủ trường (kệ, ngưỡng tồn của Kho)', () => {
    expect(canDo(byKey('warehouse.material.update'), supplyBare)).toBe(false)
  })
  it('Kho ngừng dùng / xoá được; phòng khác thì không', () => {
    expect(canDo(byKey('warehouse.material.retire'), warehouse)).toBe(true)
    expect(canDo(byKey('warehouse.material.retire'), production)).toBe(false)
    expect(canDo(byKey('warehouse.material.create'), production)).toBe(false)
  })
})
