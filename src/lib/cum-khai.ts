import { khoaCum } from './khoa-cum'

/**
 * CỤM ĐÃ KHAI SL CỤM / SP CHƯA (16/11/2026). Thuần, có test.
 *
 * Trước đây "đã khai" = hồ sơ SP có cụm cùng tên VÀ ghi SL cụm/SP. Cụm chỉ có
 * trên LỆNH (kế hoạch / thống kê khai cụm theo cách xưởng đếm — lệnh 02/26-27
 * ROSCO: Đố trước, Chân góc ×2, Chân giữa ×2… mà hồ sơ chỉ có một cụm "Sofa")
 * vì thế bị coi "chưa khai" mãi: Ghi sản lượng bày "chưa có", Bảng chi tiết ẩn
 * số cụm/SP và lưu lại thì đặt về 1. Nay "chưa khai" chỉ còn nghĩa: hồ sơ CÓ cụm
 * cùng tên mà để trống SL — đúng điều 13/11 muốn nói ("chưa có định mức thì nói
 * chưa có, không bày số 1 máy tạm tính"). Cụm chỉ có trên lệnh lấy số trên lệnh.
 */
export type HoSoCum = {
  product_id: string
  name: string
  qty_per_product: number | string | null
}

export const khoaSpCum = (productId: string, cluster: string) =>
  `${productId}|${khoaCum(cluster)}`

/** Khoá "SP|cụm" mà hồ sơ có cụm nhưng CHƯA ghi SL cụm / SP. */
export function cumChuaKhai(hoSo: readonly HoSoCum[]): Set<string> {
  return new Set(
    hoSo
      .filter((c) => c.qty_per_product == null)
      .map((c) => khoaSpCum(c.product_id, c.name)),
  )
}
