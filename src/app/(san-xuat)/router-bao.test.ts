import { readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * CHUYỂN TRANG BẰNG MÃ TRONG KHU THỐNG KÊ PHẢI BÁO LỚP CHỜ (16/11/2026, chủ dự án:
 * "chuyển đổi hay call api không thấy loading rất dễ gây hiểu nhầm phần thống kê").
 *
 * Cùng luật với khu Mua hàng (`(mua-hang)/router-bao.test.ts`): `router.push` /
 * `replace` của `useRouter()` trần đi im lặng — đổi tab công đoạn, đổi lệnh, đổi
 * ngày là đổi `?…` nên khung chờ `loading.tsx` không hiện, màn đứng im tới khi máy
 * chủ dựng xong và người ghi sổ bấm tiếp vào màn cũ. Dùng `useRouterBao()`
 * (`@/lib/tai-trang`) để lớp chờ `LopTaiTrang` (gắn ở vỏ khu `thongke`) phủ màn.
 * Hỏng IM LẶNG, nên phải có test canh.
 */
const GOC = [
  join(process.cwd(), 'src', 'app', '(san-xuat)'),
  join(process.cwd(), 'src', 'app', '(workspace)', 'thongke'),
]

function tep(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name)
    if (e.isDirectory()) return tep(p)
    return /\.(tsx?|jsx?)$/.test(e.name) && !/\.test\./.test(e.name) ? [p] : []
  })
}

describe('khu Thống kê: push/replace đi qua useRouterBao', () => {
  const vi = GOC.flatMap(tep).filter((f) => {
    const s = readFileSync(f, 'utf8')
    return (
      /\brouter\.(push|replace)\(/.test(s) &&
      /import \{[^}]*\buseRouter\b[^}]*\} from 'next\/navigation'/.test(s)
    )
  })
  it('không file nào gọi push/replace bằng useRouter trần', () => {
    expect(vi.map((f) => relative(process.cwd(), f).replaceAll('\\', '/'))).toEqual([])
  })
  it('test thật sự quét được file (đường dẫn route group không sai)', () => {
    expect(GOC.flatMap(tep).length).toBeGreaterThan(20)
  })
})
