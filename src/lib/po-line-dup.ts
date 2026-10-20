/**
 * TRÙNG DÒNG trên đơn mua — luật chung cho lưu đơn (pos.schema) và điều chỉnh
 * đơn đã gửi (po-adjust).
 *
 * Bản đầu chặn MỌI cặp dòng cùng vật tư. Sai với đơn nhôm/sắt thật: NCC cắt
 * theo chiều dài, một cây hộp 25x50 mềm đặt 6 dòng 5,1 / 5,3 / 5,5 / 5,8 / 5,9 /
 * 6 m (đơn GIGA của anh Truyền, PO-2026-0114, 30/09/2026) — gộp một dòng là
 * sai tổng kg và sai tiền. Đơn nạp từ file có sẵn các dòng như vậy, mở ra sửa
 * là không lưu được, tạo mới cũng không nhập được.
 *
 * TRÙNG THẬT = cùng vật tư + cùng quy cách + cùng chiều dài cây. Khác một
 * trong hai là hai mặt hàng khác nhau với NCC, được nằm hai dòng.
 * Dòng tự do (không gắn vật tư) không xét — mỗi dòng một SP.
 *
 * TRÙNG THẬT CHỈ CẢNH BÁO, KHÔNG CHẶN (30/09/2026, theo thông lệ SAP/Dynamics/
 * Odoo: dòng đơn định danh bằng SỐ DÒNG, cùng mã nhiều dòng là chuyện thường —
 * khác lệnh, khác SP dùng, khác ngày giao). Chặn cứng thì các đơn chia cùng
 * một tem nhãn cho nhiều mã SP (PO-2026-0099) mở ra sửa là kẹt. Màn soạn báo
 * ngay trên lưới kèm nút gộp (`trung-dong.tsx`), bảng kiểm trước khi gửi duyệt
 * nhắc lại (`poChecks`); server không chặn.
 */
export type DupLine = {
  material_id?: string | null
  spec?: string | null
  bar_length_m?: number | string | null
  /*
    07/10/2026 — "giống hệt" mới là trùng. Cùng mã nhiều dòng là chuyện thường
    (đo 16/127 đơn): chia theo SP/lệnh qua GHI CHÚ, tem nhãn theo MÃ SP, carton
    khác LỌT LÒNG, nhôm khác KHUÔN… Khác một ô trong số này là hai mặt hàng khác
    nhau với NCC — không báo trùng, không mời gộp.
  */
  note?: string | null
  product_code?: string | null
  material_grade?: string | null
  die_code?: string | null
  dimension_text?: string | null
  finish?: string | null
  inner_l_mm?: number | string | null
  inner_w_mm?: number | string | null
  inner_h_mm?: number | string | null
}

const txt = (v: string | null | undefined) =>
  (v ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
const num = (v: number | string | null | undefined) =>
  v == null || v === '' || !Number.isFinite(Number(v)) ? '' : String(Number(v))

export function poLineDupKey(l: DupLine): string | null {
  if (!l.material_id) return null
  return [
    l.material_id,
    txt(l.spec),
    num(l.bar_length_m),
    txt(l.note),
    txt(l.product_code),
    txt(l.material_grade),
    txt(l.die_code),
    txt(l.dimension_text),
    txt(l.finish),
    num(l.inner_l_mm),
    num(l.inner_w_mm),
    num(l.inner_h_mm),
  ].join('|')
}

/** Cặp [dòng trước, dòng trùng] theo chỉ số 0 — dòng thứ ba trùng thì trỏ về dòng đầu tiên. */
export function duplicateLinePairs(lines: readonly DupLine[]): [number, number][] {
  const first = new Map<string, number>()
  const out: [number, number][] = []
  lines.forEach((l, i) => {
    const k = poLineDupKey(l)
    if (k == null) return
    const at = first.get(k)
    if (at == null) first.set(k, i)
    else out.push([at, i])
  })
  return out
}

/** Câu cảnh báo, đánh số dòng như trên lưới (bắt đầu từ 1). */
export function duplicateLinesMessage(pairs: readonly [number, number][]): string | null {
  if (pairs.length === 0) return null
  const list = pairs.map(([a, b]) => `Dòng ${b + 1} trùng dòng ${a + 1}`).join(', ')
  return `${list}: giống hệt nhau (cùng mã, quy cách, chiều dài, ghi chú, mã SP)`
}
