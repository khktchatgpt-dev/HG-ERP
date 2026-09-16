/**
 * GIÁ TRỊ TỒN KHO — bình quân gia quyền. Thuần, có test.
 *
 * Kế toán hỏi mỗi cuối kỳ "tồn này đang là bao nhiêu tiền", mà hệ thống tới
 * 15/09/2026 chỉ trả lời được số LƯỢNG. `warehouse_movements.unit_cost` đã ghi
 * giá từng lần nhập từ lâu — thiếu đúng phép quy nó về một con số.
 *
 * VÌ SAO BÌNH QUÂN GIA QUYỀN, KHÔNG PHẢI FIFO. FIFO đòi biết từng lô còn lại
 * bao nhiêu — tức phải có lớp LÔ HÀNG trước (xem `kho-thiet-ke-lai.md`, đợt 2).
 * Bình quân chỉ cần những gì đã có, cho một con số đủ dùng cho báo cáo tồn, và
 * KHÔNG chặn đường lên FIFO sau: khi có lô, thay hàm này, dữ liệu không phải
 * sửa. Ghi chú dự án cũng đã chốt FIFO hoãn sang giai đoạn 2.
 *
 * BA THỨ DỄ SAI, và cả ba đều nói dối theo hướng nguy hiểm nếu làm ẩu:
 *
 *  1. CHỈ LẤY LẦN NHẬP CÓ GIÁ. Nhập không giá (kiểm kê, hoàn kho từ xưởng) mà
 *     tính là giá 0 thì kéo bình quân xuống — tồn đọc ra rẻ hơn thực.
 *  2. XUẤT KHÔNG ĐỤNG VÀO BÌNH QUÂN. Bình quân là giá của hàng ĐÃ MUA; xuất đi
 *     bao nhiêu không đổi giá mình đã trả.
 *  3. KHÔNG CÓ LẦN NHẬP NÀO CÓ GIÁ → `null`, KHÔNG phải 0. Tồn 2.400 cái mà
 *     ghi "0 đồng" là nói kho đang giữ hàng không đáng tiền.
 */

export type MovementCost = {
  direction: 'in' | 'out'
  /** Số lượng vào/ra (luôn dương). */
  qty: number
  /** Giá vốn lần nhập. Null = chưa biết giá. */
  unit_cost?: number | null
}

export type GiaTriVatTu = {
  /** Đơn giá bình quân gia quyền. Null = chưa lần nhập nào có giá. */
  donGia: number | null
  /** Tồn × đơn giá bình quân. Null khi chưa có đơn giá. */
  giaTri: number | null
  /** Tỷ lệ số lượng nhập ĐÃ có giá — dưới 1 nghĩa là đơn giá còn thiếu căn cứ. */
  phuGia: number
}

/**
 * @param onHand tồn hiện có, lấy từ view `warehouse_stock` (không tự cộng lại).
 */
export function giaTriTon(onHand: number, mvs: MovementCost[]): GiaTriVatTu {
  let luongCoGia = 0
  let tienCoGia = 0
  let luongNhap = 0

  for (const m of mvs) {
    if (m.direction !== 'in') continue // xuất không đụng vào bình quân
    const q = Number(m.qty) || 0
    if (q <= 0) continue
    luongNhap += q
    if (m.unit_cost == null) continue // nhập không giá: bỏ, KHÔNG coi là giá 0
    luongCoGia += q
    tienCoGia += q * Number(m.unit_cost)
  }

  if (luongCoGia === 0) return { donGia: null, giaTri: null, phuGia: 0 }
  const donGia = tienCoGia / luongCoGia
  return {
    donGia,
    giaTri: onHand * donGia,
    phuGia: luongNhap === 0 ? 0 : luongCoGia / luongNhap,
  }
}

/**
 * Cộng giá trị của nhiều vật tư thành tổng của cả kho.
 *
 * Trả kèm số mã CHƯA tính được: tổng mà không nói còn bao nhiêu mã ngoài vòng
 * thì người đọc tưởng đó là tổng đủ — đúng lỗi "số nào không kiểm được thì
 * không ai tin" của sổ thiết kế.
 */
export function tongGiaTri(rows: { giaTri: number | null }[]): {
  tong: number
  thieu: number
} {
  let tong = 0
  let thieu = 0
  for (const r of rows) {
    if (r.giaTri == null) thieu++
    else tong += r.giaTri
  }
  return { tong, thieu }
}
