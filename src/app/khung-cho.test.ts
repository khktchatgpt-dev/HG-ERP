import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * KHUNG CHỜ Ở MỌI CHẶNG CHUYỂN TRANG CÓ THỂ ĐỔI (11/11/2026, chủ dự án: "chuyển
 * trang hầu hết không có loading, người dùng không biết đã nhấn chưa và nhấn
 * nhiều lần").
 *
 * CƠ CHẾ (đọc trong `next/dist/client/components/layout-router.js`): khung chờ
 * `loading.tsx` của thư mục D bọc THƯ MỤC CON của D, khoá theo tên con bỏ phần
 * `?…` (`createRouterCacheKey(segment, true)`). Nên khung chờ chỉ hiện khi CON
 * của D đổi — một `loading.tsx` ở gốc khu chỉ chạy lúc đi TỪ KHU KHÁC VÀO, còn
 * danh sách → chi tiết thì màn cũ đứng im tới khi máy chủ dựng xong.
 *
 * LUẬT: thư mục D CẦN `loading.tsx` khi
 *   1. con của D đổi được — D có ≥ 2 đường vào trang (thư mục con có trang + trang
 *      của chính D), hoặc có con động `[x]` (đổi mã là đổi con); VÀ
 *   2. có layout VẼ SHELL (`<…Shell` trong JSX) ở D hoặc phía trên. Không có thì
 *      khung chờ hiện ra KHÔNG có sidebar — gốc `(workspace)` (shell nằm ở layout
 *      từng phòng), `finance/*` và trang gốc `hr` (trang tự vẽ shell) bị loại vì
 *      đặt ở đó là nháy mất cả menu mỗi lần chuyển.
 *
 * Hỏng IM LẶNG (thiếu một file chỉ là một chặng đứng im), nên phải có test canh.
 */
const APP = join(process.cwd(), 'src', 'app')
const BO_QUA = new Set(['api', 'print'])

const conCua = (d: string) =>
  readdirSync(d, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith('_') && !e.name.startsWith('.'))
    .map((e) => join(d, e.name))

/** Có trang ở thư mục này hoặc bên dưới. */
const coTrang = (d: string): boolean =>
  existsSync(join(d, 'page.tsx')) || conCua(d).some(coTrang)

/** Có layout vẽ shell ở D hoặc tổ tiên (dưới `src/app`). */
function coShell(d: string): boolean {
  for (let x = d; x !== APP && x.startsWith(APP); x = dirname(x)) {
    const f = join(x, 'layout.tsx')
    if (existsSync(f) && /<[A-Z]\w*Shell\b/.test(readFileSync(f, 'utf8'))) return true
  }
  return false
}

function canKhungCho(): string[] {
  const out: string[] = []
  const duyet = (d: string) => {
    const con = conCua(d).filter(coTrang)
    const soDuong = con.length + (existsSync(join(d, 'page.tsx')) ? 1 : 0)
    const dong = con.some((c) => /^\[.+\]$/.test(c.slice(dirname(c).length + 1)))
    if ((soDuong >= 2 || dong) && coShell(d)) out.push(d)
    con.forEach(duyet)
  }
  for (const g of conCua(APP)) if (!BO_QUA.has(g.slice(APP.length + 1))) duyet(g)
  return out
}

const ten = (d: string) => relative(APP, d).replaceAll('\\', '/')

describe('khung chờ ở mọi chặng chuyển trang', () => {
  const can = canKhungCho()

  it('luật dò đúng: có danh sách → chi tiết, KHÔNG có gốc khu chứa shell ở tầng dưới', () => {
    const ds = can.map(ten)
    expect(ds).toEqual(
      expect.arrayContaining([
        '(mua-hang)/mua-hang',
        '(mua-hang)/mua-hang/don',
        '(workspace)/sales/orders',
        '(workspace)/warehouse',
      ]),
    )
    // shell nằm ở layout từng phòng → khung chờ ở đây nuốt sidebar khi đổi phòng
    expect(ds).not.toContain('(workspace)')
    // các trang Tài chính tự vẽ shell trong page.tsx — không có shell bên trên
    expect(ds.filter((x) => x.startsWith('(workspace)/finance'))).toEqual([])
  })

  for (const d of can) {
    it(`${ten(d)}/loading.tsx`, () => {
      expect(existsSync(join(d, 'loading.tsx'))).toBe(true)
    })
  }
})
