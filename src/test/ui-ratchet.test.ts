import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * BÁNH CÓC NỢ GIAO DIỆN (28/09/2026) — ba con số chỉ được GIẢM.
 *
 * Chủ dự án chê "chất lượng code UI kém" nhiều lần. Đo 28/09/2026 trên mã màn
 * (src/app + src/components, trừ nơi ĐỊNH NGHĨA chuẩn: kit/erp/shadcn/ui và
 * design-lab):
 *  · tự tô màu bằng biến token (`text-[var(--ink-3)]`…) thay vì dùng thành phần
 *    kit (`Hint`, `ToneText`, `Tag`, `Num`…) — mỗi màn một cỡ, một độ đậm;
 *  · `style={{…}}` viết thẳng vào thẻ — bố cục ngoài hệ bậc khoảng cách;
 *  · màu Tailwind cứng (`text-zinc-500`, `bg-emerald-50`…) — màn theme cũ.
 *
 * Luật ESLint `hg/no-hardcoded-color` đã chặn màu cứng ở file MỚI; test này
 * canh TỔNG: thêm một màn tự tô là test đỏ. Dọn bớt thì HẠ con số dưới đây
 * xuống đúng số mới (test in ra số hiện tại) — không bao giờ nâng lên.
 */
const MAX = {
  tokenColor: 1301,
  inlineStyle: 207,
  hardPalette: 1694,
}

const ROOTS = ['src/app', 'src/components']
const SKIP = /design-lab|[\\/]components[\\/](kit|erp|shadcn|ui)[\\/]|\.test\./

function walk(d: string): string[] {
  return fs
    .readdirSync(d, { withFileTypes: true })
    .flatMap((e) =>
      e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)],
    )
}

function count() {
  let tokenColor = 0
  let inlineStyle = 0
  let hardPalette = 0
  for (const f of ROOTS.flatMap(walk)) {
    if (!f.endsWith('.tsx') || SKIP.test(f)) continue
    const s = fs.readFileSync(f, 'utf8')
    tokenColor += (s.match(/(text|bg|border)-\[var\(--[a-z0-9-]+\)\]/g) ?? []).length
    inlineStyle += (s.match(/style=\{\{/g) ?? []).length
    hardPalette += (
      s.match(
        /\b(text|bg|border)-(zinc|gray|slate|neutral|stone|sky|blue|emerald|green|red|amber|yellow|violet)-[0-9]{2,3}\b/g,
      ) ?? []
    ).length
  }
  return { tokenColor, inlineStyle, hardPalette }
}

describe('bánh cóc nợ giao diện — chỉ được giảm', () => {
  const now = count()
  it(`tự tô màu bằng biến token: ${now.tokenColor} ≤ ${MAX.tokenColor}`, () => {
    expect(now.tokenColor).toBeLessThanOrEqual(MAX.tokenColor)
  })
  it(`style viết thẳng vào thẻ: ${now.inlineStyle} ≤ ${MAX.inlineStyle}`, () => {
    expect(now.inlineStyle).toBeLessThanOrEqual(MAX.inlineStyle)
  })
  it(`màu Tailwind cứng: ${now.hardPalette} ≤ ${MAX.hardPalette}`, () => {
    expect(now.hardPalette).toBeLessThanOrEqual(MAX.hardPalette)
  })
})
