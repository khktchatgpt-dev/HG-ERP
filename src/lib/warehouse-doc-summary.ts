/**
 * TÓM TẮT MỘT PHIẾU KHO từ các dòng chuyển động của nó — thuần, có test.
 *
 * Sổ chứng từ tới 15/09/2026 chỉ có: số phiếu · loại · người giao/nhận · người
 * lập · ngày. Nhìn 46 phiếu nhập mà không biết phiếu nào chứa gì, bao nhiêu,
 * đáng bao nhiêu tiền — muốn biết phải mở từng phiếu (chủ dự án: "nhập kho
 * chẳng biết đã nhập những gì").
 *
 * Tách khỏi truy vấn vì đây là phép tính về TIỀN: giá trị phiếu chảy vào đối
 * chiếu với kế toán, sai một chỗ thì sai cả sổ. Và vì "chưa biết giá" khác
 * "giá bằng 0" — phân biệt sai là bịa ra một con số không ai nhập.
 */

export type MovementLite = {
  direction: 'in' | 'out'
  material_id: string
  /** Số ĐẠT — phần vào tồn. */
  qty: number
  /** QC loại: NCC đã giao nhưng không vào tồn (BR-10). */
  qty_rejected?: number | null
  /** Giá vốn dòng. Null = chưa biết giá, KHÔNG phải giá 0. */
  unit_cost?: number | null
}

export type DocSummary = {
  /** Số dòng chuyển động. */
  dong: number
  /** Số MÃ vật tư khác nhau — 3 dòng cùng một mã vẫn là 1 mã. */
  ma: number
  /** Tổng số lượng đạt. */
  sl: number
  /** Tổng QC loại. */
  loai: number
  /**
   * Giá trị phiếu. `null` khi KHÔNG dòng nào có giá — chưa biết, không phải 0.
   */
  tien: number | null
  /**
   * `true` khi chỉ MỘT PHẦN số dòng có giá. Màn phải nói "≥ x" chứ không được
   * bày con số như thể đã đủ — thiếu giá vài dòng mà in ra số tròn trĩnh là
   * kế toán đối chiếu lệch rồi đi tìm nguyên nhân ở chỗ khác.
   */
  thieuGia: boolean
}

export function summariseDoc(mvs: MovementLite[]): DocSummary {
  const ma = new Set<string>()
  let sl = 0
  let loai = 0
  let tien = 0
  let coGia = 0

  for (const m of mvs) {
    ma.add(m.material_id)
    sl += Number(m.qty) || 0
    loai += Number(m.qty_rejected) || 0
    if (m.unit_cost != null) {
      coGia++
      tien += (Number(m.qty) || 0) * Number(m.unit_cost)
    }
  }

  return {
    dong: mvs.length,
    ma: ma.size,
    sl,
    loai,
    // Không dòng nào có giá → null. Một phần có giá → trả phần tính được, kèm cờ.
    tien: coGia === 0 ? null : tien,
    thieuGia: coGia > 0 && coGia < mvs.length,
  }
}
