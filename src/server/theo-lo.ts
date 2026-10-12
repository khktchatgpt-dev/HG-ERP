/**
 * Chạy một truy vấn `.in(cột, ids)` THEO LÔ + đọc hết từng trang — cho tập id
 * lớn dần theo thời gian (dòng sổ, dòng đơn, phiếu…).
 *
 * Hai trần, cả hai đều IM LẶNG nếu không canh:
 *   1. Độ dài URL. `.in()` nhét mọi id vào query string; ~350 uuid (≈13 KB) là
 *      supabase-js ném "TypeError: fetch failed". Đo 12/10/2026: màn Theo dõi ›
 *      Đã về của Cung ứng sập vì `in('id', 410 dòng đơn)` — 300 id qua, 400 hỏng.
 *   2. Trần 1000 dòng mỗi lần của PostgREST — lô nhỏ mà mỗi id kéo nhiều dòng
 *      (dòng sổ của 200 phiếu) vẫn có thể vượt, cắt đuôi không báo. Nên mỗi lô
 *      đọc tiếp bằng `range` cho tới khi trang về ít hơn cỡ trang.
 *
 * `q` dựng truy vấn cho MỘT lô (đủ select/in/not/eq…, CHƯA gọi range). Lỗi của
 * bất kỳ lô nào đều ném — nuốt lỗi là màn rỗng câm.
 */
type Trang = PromiseLike<{ data: unknown; error: { message: string } | null }>

export const LO_MAC_DINH = 200
const CO_TRANG = 1000

export async function theoLo<T>(
  ids: readonly string[],
  q: (lo: string[]) => { range(from: number, to: number): Trang },
  lo: number = LO_MAC_DINH,
): Promise<T[]> {
  const uniq = [...new Set(ids)]
  if (uniq.length === 0) return []
  const cacLo: string[][] = []
  for (let i = 0; i < uniq.length; i += lo) cacLo.push(uniq.slice(i, i + lo))
  const parts = await Promise.all(
    cacLo.map(async (ma) => {
      const out: T[] = []
      for (let tu = 0; ; tu += CO_TRANG) {
        const { data, error } = await q(ma).range(tu, tu + CO_TRANG - 1)
        if (error) throw new Error(error.message)
        const rows = (data ?? []) as T[]
        out.push(...rows)
        if (rows.length < CO_TRANG) break
      }
      return out
    }),
  )
  return parts.flat()
}
