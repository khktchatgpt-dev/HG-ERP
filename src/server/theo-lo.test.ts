import { describe, expect, it, vi } from 'vitest'
import { theoLo } from './theo-lo'

/** Giả một bảng: mỗi id kéo `perId` dòng; truy vấn trả đúng lát `range`. */
function bang(perId: number) {
  const calls: { lo: string[]; from: number; to: number }[] = []
  const q = (lo: string[]) => ({
    range: (from: number, to: number) => {
      calls.push({ lo, from, to })
      const all = lo.flatMap((id) => Array.from({ length: perId }, (_, k) => ({ id, k })))
      return Promise.resolve({ data: all.slice(from, to + 1), error: null })
    },
  })
  return { q, calls }
}

describe('theoLo', () => {
  it('rỗng thì không gọi truy vấn nào', async () => {
    const { q, calls } = bang(1)
    expect(await theoLo([], q)).toEqual([])
    expect(calls).toHaveLength(0)
  })

  it('410 id (ca sập màn Đã về 12/10) → 3 lô ≤ 200, đủ 410 dòng, bỏ trùng', async () => {
    const ids = Array.from({ length: 410 }, (_, i) => `id${i}`)
    const { q, calls } = bang(1)
    const rows = await theoLo<{ id: string }>([...ids, 'id0', 'id5'], q)
    expect(rows).toHaveLength(410)
    expect(calls.map((c) => c.lo.length)).toEqual([200, 200, 10])
  })

  it('một lô kéo hơn 1000 dòng thì đọc tiếp trang sau, không cắt đuôi', async () => {
    const { q, calls } = bang(6) // 200 id × 6 = 1200 dòng
    const ids = Array.from({ length: 200 }, (_, i) => `p${i}`)
    const rows = await theoLo(ids, q)
    expect(rows).toHaveLength(1200)
    expect(calls.map((c) => [c.from, c.to])).toEqual([
      [0, 999],
      [1000, 1999],
    ])
  })

  it('lỗi ở một lô thì ném, không trả nửa kết quả', async () => {
    const q = vi.fn((lo: string[]) => ({
      range: () =>
        Promise.resolve(
          lo[0] === 'b0'
            ? { data: null, error: { message: 'TypeError: fetch failed' } }
            : { data: [{ id: lo[0] }], error: null },
        ),
    }))
    await expect(theoLo(['a0', 'b0'], q, 1)).rejects.toThrow('fetch failed')
  })
})
