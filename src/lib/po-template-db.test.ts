import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { PO_TEMPLATES } from './po-template'

/**
 * ĐỐI CHIẾU danh sách mẫu đơn trong code với HAI check constraint trong DB.
 *
 * Bài học 0135: 0106 tạo check `template` trên header đơn với 5 giá trị; các
 * đợt thêm mẫu 0122/0123/0129/0134 chỉ nới check của
 * `warehouse_materials.po_template` mà quên header — 8 mẫu thêm sau bị DB chặn
 * tạo đơn mà KHÔNG AI BIẾT cho tới smoke test DB thật ngày 12/08/2026.
 *
 * Test này đọc thẳng `supabase/migrations/*`, lấy bản khai MỚI NHẤT của từng
 * constraint (migration sau đè migration trước — cùng thứ tự áp vào DB) và so
 * với `PO_TEMPLATES`. Thêm mẫu vào code mà quên nới check → đỏ ngay trên máy.
 *
 * Quy ước để parse được: nới check bằng đúng dạng 0135 —
 *   `add constraint <tên> check (template in ('a', 'b', …))`
 * (po_template thêm `is null or`). Parser KHÔNG parse được thì test PHẢI đỏ,
 * không được lặng lẽ pass (rủi ro ghi ở kế hoạch đợt 1).
 */

const MIGRATIONS_DIR = join(process.cwd(), 'supabase', 'migrations')

/** Giá trị chết còn trong check DB nhưng đã gỡ khỏi code — được phép LỆCH THỪA. */
const LEGACY_DB_ONLY = new Set(['outsourcing']) // mẫu gia công gỡ 12/08/2026

/** Bản khai MỚI NHẤT của một constraint trong toàn bộ migrations. */
function latestConstraint(name: string): { file: string; values: string[] } | null {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort() // NNNN_ đầu tên — thứ tự file = thứ tự áp vào DB

  let hit: { file: string; values: string[] } | null = null
  for (const file of files) {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8')
    // `[\s\S]*?\)\)` — danh sách in (...) nằm được trên nhiều dòng như 0135.
    const re = new RegExp(
      `add\\s+constraint\\s+${name}[\\s\\S]*?check\\s*\\(([\\s\\S]*?)\\)\\s*;`,
      'gi',
    )
    for (const m of sql.matchAll(re)) {
      const values = [...m[1].matchAll(/'([a-z_]+)'/g)].map((v) => v[1])
      if (values.length > 0) hit = { file, values }
    }
  }
  return hit
}

describe('PO_TEMPLATES ↔ check constraint DB (bài học 0135)', () => {
  const CONSTRAINTS = [
    'supply_purchase_orders_template_check',
    'warehouse_materials_po_template_check',
  ] as const

  for (const name of CONSTRAINTS) {
    it(`${name}: chứa đủ mọi mẫu trong code`, () => {
      const c = latestConstraint(name)
      // Parse hỏng (đổi cách viết migration) phải đỏ — đừng nghĩ là "hết check".
      expect(c, `không tìm thấy/không parse được constraint ${name}`).toBeTruthy()
      const dbSet = new Set(c!.values)
      for (const t of PO_TEMPLATES) {
        expect(
          dbSet.has(t),
          `mẫu "${t}" có trong PO_TEMPLATES nhưng THIẾU trong ${name} ` +
            `(bản mới nhất: ${c!.file}) — thêm mẫu là phải nới CẢ HAI check, xem 0135`,
        ).toBe(true)
      }
    })

    it(`${name}: giá trị thừa so với code đều là legacy đã biết`, () => {
      const c = latestConstraint(name)!
      const code = new Set<string>(PO_TEMPLATES)
      const extras = c.values.filter((v) => !code.has(v))
      for (const v of extras) {
        expect(
          LEGACY_DB_ONLY.has(v),
          `check ${name} có giá trị "${v}" không thuộc PO_TEMPLATES và không nằm ` +
            `trong danh sách legacy — hoặc code thiếu mẫu, hoặc cần ghi nhận legacy mới`,
        ).toBe(true)
      }
    })
  }
})
