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

// Permission key THẬT lấy từ seed 0073 (nguồn sự thật) — chống gõ sai / drift.
// Insert permissions: ('key.with.dot', 'label', 'domain', N). role_permissions
// bắt đầu bằng role key (không dấu chấm) nên không lọt vào đây.
const seedSql = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/0073_rbac.sql'),
  'utf8',
)
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

describe('canDo — Sales xem KT được, sửa không (ví dụ user nêu)', () => {
  const salesCtx = {
    role: 'employee' as const,
    has: has(['sales.member', 'technical.bom.edit']),
  }
  const byKey = (k: string) => ACTIONS.find((a) => a.key === k) as Action

  it('Sales XEM thư viện SP + BOM → được', () => {
    expect(canDo(byKey('technical.product.view'), salesCtx)).toBe(true)
    expect(canDo(byKey('technical.bom.view'), salesCtx)).toBe(true)
  })

  it('Sales SỬA sản phẩm / BOM → KHÔNG', () => {
    expect(canDo(byKey('technical.product.update'), salesCtx)).toBe(false)
    expect(canDo(byKey('technical.bom.save'), salesCtx)).toBe(false)
  })

  it('Sales tạo nhanh SP + đặt ảnh → được (ngoại lệ có chủ ý)', () => {
    expect(canDo(byKey('technical.product.quick_create'), salesCtx)).toBe(true)
    expect(canDo(byKey('technical.product.set_image'), salesCtx)).toBe(true)
  })

  it('admin bypass → làm được mọi thao tác', () => {
    const adminCtx = { role: 'admin' as const, has: has([]) }
    expect(ACTIONS.every((a) => canDo(a, adminCtx))).toBe(true)
  })
})
