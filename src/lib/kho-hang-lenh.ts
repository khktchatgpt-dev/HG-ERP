/**
 * HÀNG CỦA LỆNH — logic thuần cho "Lấy hàng của lệnh" ở phiếu xuất Kho (Kho đợt
 * 2 · Bước 4, bản vẽ https://claude.ai/artifact/4x4FTaGvwxx1xqF6ozFZLA, duyệt
 * 12/10/2026).
 *
 * Câu trả lời: hàng đã MUA cho lệnh này, đã về kho, chưa ghi xuất cho lệnh, và
 * kho còn bao nhiêu. KHÔNG phải định mức (chốt 16/09: xuất theo thực tế lấy) —
 * nguồn là dòng đơn mua của lệnh, không phải "lệnh cần bao nhiêu".
 *
 *  · Phần của lệnh trên một dòng đơn: dòng có chia lệnh (0185 `supply_po_line_lsx`)
 *    thì lấy phần chia; không chia thì cả dòng thuộc lệnh chính của đơn.
 *  · Đã về cho lệnh = SL đã nhận của dòng × phần của lệnh / SL đặt (Q2: chia theo
 *    tỉ lệ — hiện 0 dòng có chia nên chưa đổi số nào).
 *  · Đã xuất = xuất RÒNG cho lệnh (xuất − hoàn kho − phiếu đảo), cùng `issuedByLsx`.
 *  · Gợi ý lấy = min(còn của lệnh, tồn dùng được) (Q1). Kho hết thì vẫn bày, mờ,
 *    không gợi ý (Q4) — giấu đi là người xem tưởng lệnh chưa nhận hàng.
 */

export type DongDonLenh = {
  line_id: string
  material_id: string
  qty_ordered: number
  /** Phần của lệnh trên dòng này (theo ĐVT mua). */
  phan_lenh: number
}

export type HangLenhRow = {
  material_id: string
  code: string
  name: string
  unit: string
  /** Đã về cho lệnh. */
  ve: number
  /** Đã xuất ròng cho lệnh (≥ 0). */
  xuat: number
  /** Còn của lệnh = ve − xuat (> 0). */
  con: number
  /** Tồn dùng được trong kho (`qty_ok`) — của mọi lệnh. */
  ton: number
  /** Số điền sẵn = min(con, tồn); 0 khi kho hết. */
  goi_y: number
  /** Kho hết: hiện mờ, không tích được. */
  het: boolean
}

const EPS = 1e-6
const tron = (n: number) => Math.round(n * 10_000) / 10_000

export function tinhHangLenh(input: {
  dong: DongDonLenh[]
  /** SL đã nhận ròng theo dòng đơn (vào − ra của phiếu gắn dòng). */
  nhanTheoDong: ReadonlyMap<string, number>
  /** Đã xuất ròng cho lệnh theo vật tư (`issuedByLsx`). */
  daXuat: ReadonlyMap<string, number>
  /** Tồn dùng được theo vật tư. */
  ton: ReadonlyMap<string, number>
  vatTu: ReadonlyMap<string, { code: string; name: string; unit: string }>
}): HangLenhRow[] {
  const ve = new Map<string, number>()
  for (const d of input.dong) {
    const nhan = input.nhanTheoDong.get(d.line_id) ?? 0
    if (nhan <= EPS || d.qty_ordered <= EPS || d.phan_lenh <= EPS) continue
    const phan = Math.min(1, d.phan_lenh / d.qty_ordered)
    ve.set(d.material_id, (ve.get(d.material_id) ?? 0) + nhan * phan)
  }
  const out: HangLenhRow[] = []
  for (const [m, v] of ve) {
    const xuat = Math.max(0, input.daXuat.get(m) ?? 0)
    const con = v - xuat
    if (con <= EPS) continue
    const ton = Math.max(0, input.ton.get(m) ?? 0)
    const vt = input.vatTu.get(m) ?? { code: '?', name: '(vật tư không còn trong danh mục)', unit: '' } // prettier-ignore
    out.push({
      material_id: m,
      code: vt.code,
      name: vt.name,
      unit: vt.unit,
      ve: tron(v),
      xuat: tron(xuat),
      con: tron(con),
      ton: tron(ton),
      goi_y: tron(Math.min(con, ton)),
      het: ton <= EPS,
    })
  }
  // Còn tồn trước, kho hết sau; trong mỗi nhóm theo mã.
  return out.sort((a, b) =>
    a.het !== b.het ? (a.het ? 1 : -1) : a.code.localeCompare(b.code, 'vi'),
  )
}
