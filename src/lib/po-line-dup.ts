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
}

export function poLineDupKey(l: DupLine): string | null {
  if (!l.material_id) return null
  const len =
    l.bar_length_m == null ||
    l.bar_length_m === '' ||
    !Number.isFinite(Number(l.bar_length_m))
      ? ''
      : String(Number(l.bar_length_m))
  const spec = (l.spec ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
  return `${l.material_id}|${spec}|${len}`
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
  return `${list}: cùng mã, cùng quy cách, cùng chiều dài cây`
}

/**
 * Mẫu đơn cho CÙNG MỘT MÃ nằm nhiều dòng khi soạn: hàng cắt theo chiều dài
 * (nhôm định hình, sắt/inox theo kg). Chọn lại mã đã có trên đơn thì màn thêm
 * dòng mới để khai chiều dài khác thay vì nhảy về dòng cũ — không vậy thì không
 * có đường nào nhập được dòng thứ hai (đơn GIGA anh Truyền, 30/09/2026).
 */
export function sameMaterialManyLines(template: string | null | undefined): boolean {
  return template === 'aluminium' || template === 'metal_kg'
}
