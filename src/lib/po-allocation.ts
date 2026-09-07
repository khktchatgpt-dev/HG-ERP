/**
 * CHIA SL CỦA MỘT DÒNG ĐƠN CHO NHIỀU LỆNH — logic thuần, có test.
 *
 * Một đơn có thể mua chung cho nhiều lệnh (0125). Từ 0185, số lượng chia được
 * ở mức DÒNG: dòng 1.350 tấm ghi rõ lệnh 08 = 800, lệnh 09 = 550.
 *
 * QUY ƯỚC: dòng KHÔNG có phân bổ nào = 100% thuộc LSX CHÍNH của đơn. Nhờ vậy
 * mọi đơn một-lệnh và 66 đơn cũ không cần dữ liệu gì thêm.
 */

export type LineAllocation = { production_order_id: string; qty: number }

/** Làm tròn 4 số lẻ — SL có thể lẻ (kg, m²), tránh rác nhị phân khi cộng. */
const r4 = (n: number) => Math.round(n * 10000) / 10000

/**
 * Phần của dòng thuộc về MỘT lệnh.
 *
 * Không có phân bổ → cả dòng thuộc lệnh chính, các lệnh phụ được 0. Trả 0 chứ
 * không trả cả dòng: đó chính là con số sai mà 0185 sinh ra để sửa.
 */
export function allocatedTo(
  lsxId: string,
  input: {
    qty_ordered: number
    main_lsx_id: string | null
    allocations?: LineAllocation[] | null
  },
): number {
  const allocs = input.allocations ?? []
  if (allocs.length === 0) {
    return input.main_lsx_id === lsxId ? Number(input.qty_ordered) || 0 : 0
  }
  const hit = allocs.find((a) => a.production_order_id === lsxId)
  return hit ? r4(Number(hit.qty) || 0) : 0
}

/**
 * Câu báo lỗi khi tổng phân bổ không khớp SL đặt — null là hợp lệ.
 *
 * Chấp nhận lệch 0,0001 vì SL lẻ (kg/m²) cộng lại hay dư số nhị phân; lệch hơn
 * thế là người dùng gõ sai, phải nói ra trước khi đơn đi trình ký.
 */
export function allocationProblem(
  qtyOrdered: number,
  allocations: LineAllocation[] | null | undefined,
): string | null {
  const allocs = allocations ?? []
  if (allocs.length === 0) return null
  if (allocs.some((a) => !(Number(a.qty) > 0))) {
    return 'Phần chia cho mỗi lệnh phải lớn hơn 0 — bỏ lệnh không mua thay vì ghi 0'
  }
  const ids = new Set(allocs.map((a) => a.production_order_id))
  if (ids.size !== allocs.length) return 'Một lệnh xuất hiện hai lần trong phần chia'
  const tong = r4(allocs.reduce((s, a) => s + (Number(a.qty) || 0), 0))
  const dat = r4(Number(qtyOrdered) || 0)
  if (Math.abs(tong - dat) <= 0.0001) return null
  const fmt = (n: number) => n.toLocaleString('vi-VN', { maximumFractionDigits: 4 })
  return tong < dat
    ? `Chia thiếu ${fmt(r4(dat - tong))} so với SL đặt ${fmt(dat)}`
    : `Chia thừa ${fmt(r4(tong - dat))} so với SL đặt ${fmt(dat)}`
}

/**
 * Chia lại cho khớp khi SL đặt đổi — giữ nguyên tỉ lệ đang có.
 *
 * Người soạn đơn hay sửa SL đặt sau khi đã chia (NCC báo chỉ còn 600 thay vì
 * 630). Bắt họ gõ lại từng lệnh là mời gọi sai số; giữ tỉ lệ rồi dồn phần lẻ
 * vào lệnh lớn nhất để tổng luôn khớp tuyệt đối.
 */
export function rescaleAllocations(
  allocations: LineAllocation[],
  qtyOrdered: number,
): LineAllocation[] {
  const dat = Number(qtyOrdered) || 0
  const tong = allocations.reduce((s, a) => s + (Number(a.qty) || 0), 0)
  if (allocations.length === 0 || tong <= 0 || dat <= 0) return allocations
  const out = allocations.map((a) => ({
    production_order_id: a.production_order_id,
    qty: r4((Number(a.qty) / tong) * dat),
  }))
  // Dồn phần lẻ do làm tròn vào dòng lớn nhất — tổng phải khớp tuyệt đối, nếu
  // không thì đơn báo "chia thiếu 0,0001" và không ai hiểu vì sao.
  const lech = r4(dat - out.reduce((s, a) => s + a.qty, 0))
  if (lech !== 0) {
    let k = 0
    for (let i = 1; i < out.length; i++) if (out[i].qty > out[k].qty) k = i
    out[k].qty = r4(out[k].qty + lech)
  }
  return out
}
