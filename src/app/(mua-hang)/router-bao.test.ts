import { readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * CHUYỂN TRANG BẰNG MÃ TRONG KHU MUA HÀNG PHẢI BÁO THANH TIẾN TRÌNH (11/11/2026).
 *
 * `router.push` / `replace` của `useRouter()` trần đi im lặng — đổi `?…` thì
 * khung chờ không hiện, màn đứng im tới khi máy chủ dựng xong. Dùng
 * `useRouterBao()` (`@/lib/tai-trang`): push/replace báo lớp chờ `LopTaiTrang` trước.
 * Hỏng IM LẶNG (chỉ là một chỗ không có vạch chạy), nên phải có test canh.
 */
const GOC = join(process.cwd(), 'src', 'app', '(mua-hang)')

function tep(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name)
    if (e.isDirectory()) return tep(p)
    return /\.(tsx?|jsx?)$/.test(e.name) && !/\.test\./.test(e.name) ? [p] : []
  })
}

describe('khu Mua hàng: push/replace đi qua useRouterBao', () => {
  const vi = tep(GOC).filter((f) => {
    const s = readFileSync(f, 'utf8')
    return (
      /\brouter\.(push|replace)\(/.test(s) &&
      /import \{[^}]*\buseRouter\b[^}]*\} from 'next\/navigation'/.test(s)
    )
  })
  it('không file nào gọi push/replace bằng useRouter trần', () => {
    expect(vi.map((f) => relative(GOC, f).replaceAll('\\', '/'))).toEqual([])
  })
})
