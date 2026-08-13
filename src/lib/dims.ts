/**
 * ĐỌC BỘ BA KÍCH THƯỚC "D×R×C" TỪ CHUỖI QUY CÁCH — dùng chung cho form soạn
 * đơn (tách lọt lòng carton, quy cách xốp) và form khai vật tư (preview sống
 * "máy hiểu gì từ ô Quy cách" — chống gõ sai dạng, 13/08/2026).
 *
 * Dời từ `planning/pos/new/po-line.ts` về lib để component kho dùng được mà
 * không import ngược vào thư mục form; po-line re-export giữ chỗ gọi cũ.
 *
 * Chỉ nhận đúng dạng số×số×số; quy cách kiểu "25×50×1li" (ống, li = độ dày) có
 * chữ dính liền số thứ ba nên KHÔNG khớp — và đúng ra là không được khớp, đó
 * không phải lọt lòng thùng.
 */
export function parseInnerDims(
  spec: string | null | undefined,
): [number, number, number] | null {
  if (!spec) return null
  const m = spec.match(
    /(\d+(?:[.,]\d+)?)\s*[x×*]\s*(\d+(?:[.,]\d+)?)\s*[x×*]\s*(\d+(?:[.,]\d+)?)(?![.,\d])/i,
  )
  if (!m) return null
  // "1li"/"5c"…: chữ DÍNH LIỀN số thứ ba nghĩa là đơn vị khác (li = độ dày) chứ
  // không phải mm lọt lòng — loại. "mm" dính liền, hoặc chữ đứng sau CÓ khoảng
  // trắng ("…105 thùng âm dương"), thì chỉ là đơn vị/mô tả — vẫn nhận.
  const after = spec.slice((m.index ?? 0) + m[0].length)
  if (/^[a-zà-ỹ]/i.test(after) && !/^mm\b/i.test(after)) return null
  const dims = [m[1], m[2], m[3]].map((s) => Number(s.replace(',', '.')))
  return dims.every((d) => Number.isFinite(d) && d > 0)
    ? (dims as [number, number, number])
    : null
}
