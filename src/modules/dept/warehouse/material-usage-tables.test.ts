import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/*
 * CHỐT CHẶN XOÁ MÃ chỉ đúng khi `materialsRepo.usage` đếm ĐỦ mọi bảng có khoá
 * ngoại tới `warehouse_materials`. Ai thêm migration có bảng mới trỏ tới vật tư
 * mà quên thêm vào `usage` thì test này đỏ — không thì xoá mã sẽ lặng lẽ lọt
 * (bảng CASCADE mất dòng) hoặc ăn lỗi khoá ngoại thô (bảng RESTRICT).
 */
const ROOT = resolve(__dirname, '../../../..')

/** Bảng có khoá ngoại nhưng KHÔNG tính là "đã dùng" — kèm lý do. */
const NOT_USAGE: Record<string, string> = {
  // Thuộc chính vật tư (quy đổi ĐVT), xoá mã thì đi theo là đúng.
  item_uom: 'quy đổi ĐVT của chính mã',
  // Nhật ký sửa của chính mã — giữ khi xoá là việc của bước 2 (đổi FK).
  warehouse_material_changes: 'nhật ký sửa của chính mã',
  // Đã drop ở 0084.
  production_order_components: 'đã bỏ ở 0084',
  // Có trong 0045 nhưng không có trong DB thật (đo 05/10/2026).
  stock_cost_layers: 'không có trong DB',
}

function fkTables(): Set<string> {
  const dir = resolve(ROOT, 'supabase/migrations')
  const out = new Set<string>()
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.sql'))) {
    let table = ''
    for (const line of readFileSync(resolve(dir, f), 'utf8').split('\n')) {
      const t = line.match(/create table if not exists (?:public\.)?(\w+)/i)
      if (t) table = t[1]
      const a = line.match(/alter table (?:if exists )?(?:public\.)?(\w+)/i)
      if (a) table = a[1]
      if (/references (?:public\.)?warehouse_materials\b/i.test(line) && table) {
        if (table !== 'warehouse_materials') out.add(table)
      }
    }
  }
  return out
}

describe('materialsRepo.usage đếm đủ bảng trỏ tới vật tư', () => {
  it('mọi bảng có FK tới warehouse_materials đều được đếm (hoặc có lý do loại)', () => {
    const repo = readFileSync(
      resolve(ROOT, 'src/modules/dept/warehouse/warehouse.repo.ts'),
      'utf8',
    )
    const body = repo.slice(
      repo.indexOf('async usage('),
      repo.indexOf('async usage(') + 2500,
    )
    const counted = new Set([...body.matchAll(/n\('(\w+)'\)/g)].map((m) => m[1]))
    const missing = [...fkTables()].filter((t) => !counted.has(t) && !(t in NOT_USAGE))
    expect(missing).toEqual([])
    expect(counted.size).toBeGreaterThanOrEqual(9)
  })
})
