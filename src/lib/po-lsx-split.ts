/**
 * CHIA SL CỦA MỘT DÒNG ĐƠN CHO NHIỀU LỆNH — logic thuần, có test.
 *
 * Một đơn có thể mua chung cho nhiều lệnh (0125). Từ 0185, số lượng chia được
 * ở mức DÒNG: dòng 1.350 tấm ghi rõ lệnh 08 = 800, lệnh 09 = 550.
 *
 * QUY ƯỚC: dòng KHÔNG có phân bổ nào = 100% thuộc LSX CHÍNH của đơn. Nhờ vậy
 * mọi đơn một-lệnh và 66 đơn cũ không cần dữ liệu gì thêm.
 */

export type LsxSplit = { production_order_id: string; qty: number }

/** Làm tròn 4 số lẻ — SL có thể lẻ (kg, m²), tránh rác nhị phân khi cộng. */
const r4 = (n: number) => Math.round(n * 10000) / 10000

/**
 * Phần của dòng thuộc về MỘT lệnh.
 *
 * Không có phân bổ → cả dòng thuộc lệnh chính, các lệnh phụ được 0. Trả 0 chứ
 * không trả cả dòng: đó chính là con số sai mà 0185 sinh ra để sửa.
 */
export function qtyForLsx(
  lsxId: string,
  input: {
    qty_ordered: number
    main_lsx_id: string | null
    allocations?: LsxSplit[] | null
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
export function splitProblem(
  qtyOrdered: number,
  allocations: LsxSplit[] | null | undefined,
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
export function rescaleSplit(allocations: LsxSplit[], qtyOrdered: number): LsxSplit[] {
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

/* ── TỰ CHIA THEO NHU CẦU (10/10/2026) ───────────────────────────────────────
   "Gộp lệnh khi mua thì làm sao biết lệnh nào bao nhiêu" — 11 đơn gộp, 113
   dòng, 0 dòng chia: ô chia nằm khuất trong khay chi tiết, không ai gõ. Máy
   chia sẵn theo nhu cầu còn thiếu của từng lệnh, người mua sửa được. */

/** Nhu cầu CÒN PHẢI ĐẶT của một lệnh cho một vật tư (≤ 0 = lệnh này không cần). */
export type LsxNeedShare = { production_order_id: string; need: number }

/**
 * Chia SL đặt của MỘT vật tư cho các lệnh của đơn theo nhu cầu.
 *
 *  · Không lệnh nào cần → [] (dòng thuộc lệnh chính như quy ước cũ).
 *  · Đặt ĐỦ hoặc DƯ (mua tròn bó, làm tròn lên) → mỗi lệnh đúng phần cần, phần dư
 *    ghi cho LỆNH CHÍNH nếu lệnh chính có cần mã này; không thì cho lệnh cần nhiều
 *    nhất. Soi thật 10/10: NHO0090 chỉ lệnh 09 cần 62,18 kg, đặt tròn 63 — bản đầu
 *    đẩy 0,82 kg sang lệnh 08 vốn không dùng mã này, ra dòng "08 MX 0,82" vô nghĩa.
 *  · Đặt THIẾU (tồn kho bù phần còn lại) → chia theo tỉ lệ nhu cầu.
 *  · `nguyen` (SL đặt là số nguyên — cái, thanh, tấm) → chia số nguyên theo
 *    phần dư lớn nhất; còn lại (kg, m²) làm tròn 4 lẻ, phần lẻ dồn lệnh lớn nhất.
 */
export function chiaTheoNhuCau(
  qtyOrdered: number,
  needs: LsxNeedShare[],
  mainLsxId: string | null,
  nguyen = Number.isInteger(Number(qtyOrdered)),
): LsxSplit[] {
  const dat = Number(qtyOrdered) || 0
  const can = needs
    .map((n) => ({
      production_order_id: n.production_order_id,
      need: Number(n.need) || 0,
    }))
    .filter((n) => n.need > 0)
  if (dat <= 0 || can.length === 0) return []
  const tong = can.reduce((s, n) => s + n.need, 0)
  let out: LsxSplit[]
  if (dat >= tong - 1e-9) {
    out = can.map((n) => ({
      production_order_id: n.production_order_id,
      qty: r4(n.need),
    }))
    const du = r4(dat - out.reduce((s, a) => s + a.qty, 0))
    if (du > 0) {
      const nhan =
        out.find((x) => x.production_order_id === mainLsxId) ??
        out.reduce((m, x) => (x.qty > m.qty ? x : m), out[0])
      nhan.qty = r4(nhan.qty + du)
    }
  } else if (nguyen) {
    // Phần dư lớn nhất (Hamilton): sàn từng phần, phát nốt số còn thiếu cho phần
    // lẻ lớn nhất — tổng khớp tuyệt đối, không lệnh nào lệch quá 1.
    const raw = can.map((n) => (n.need / tong) * dat)
    const qty = raw.map(Math.floor)
    let con = Math.round(dat) - qty.reduce((s, q) => s + q, 0)
    const thu = raw
      .map((r, i) => ({ i, du: r - Math.floor(r) }))
      .sort((a, b) => b.du - a.du)
    for (const { i } of thu) {
      if (con <= 0) break
      qty[i]++
      con--
    }
    out = can.map((n, i) => ({ production_order_id: n.production_order_id, qty: qty[i] }))
  } else {
    out = rescaleSplit(
      can.map((n) => ({ production_order_id: n.production_order_id, qty: n.need })),
      dat,
    )
  }
  return out.filter((a) => a.qty > 0)
}

/**
 * CÙNG MỘT VẬT TƯ NẰM NHIỀU DÒNG (khác quy cách / chiều dài / mã SP — được phép từ
 * 07/10/2026): chia trên TỔNG SL của mã rồi rót lần lượt vào từng dòng theo thứ
 * tự dòng. Chia từng dòng riêng thì mỗi dòng ăn trọn nhu cầu và lệnh bị ghi gấp
 * đôi. Trả map khoá dòng → phần chia của dòng đó.
 */
export function chiaNhieuDong(
  lines: { key: string; qty: number }[],
  needs: LsxNeedShare[],
  mainLsxId: string | null,
): Map<string, LsxSplit[]> {
  const out = new Map<string, LsxSplit[]>()
  const tongDat = lines.reduce((s, l) => s + (Number(l.qty) || 0), 0)
  const nguyen = lines.every((l) => Number.isInteger(Number(l.qty) || 0))
  const quy = chiaTheoNhuCau(tongDat, needs, mainLsxId, nguyen).map((a) => ({ ...a }))
  for (const l of lines) {
    let can = Number(l.qty) || 0
    const mine: LsxSplit[] = []
    for (const a of quy) {
      if (can <= 1e-9) break
      if (a.qty <= 1e-9) continue
      const lay = r4(Math.min(a.qty, can))
      mine.push({ production_order_id: a.production_order_id, qty: lay })
      a.qty = r4(a.qty - lay)
      can = r4(can - lay)
    }
    out.set(l.key, mine)
  }
  return out
}

/**
 * GỠ MỘT LỆNH KHỎI ĐƠN: bỏ phần của lệnh đó, chia lại phần còn lại theo tỉ lệ cũ
 * cho đủ SL đặt. Không còn lệnh nào → [] (dòng về lệnh chính).
 */
export function boLenhKhoiChia(
  allocations: LsxSplit[],
  keepLsxIds: string[],
  qtyOrdered: number,
): LsxSplit[] {
  const giu = allocations.filter((a) => keepLsxIds.includes(a.production_order_id))
  if (giu.length === allocations.length) return allocations
  if (giu.length === 0) return []
  return rescaleSplit(giu, qtyOrdered)
}

/**
 * PHẦN CỦA MỘT BỘ LỆNH trong một dòng đơn, dạng tỉ lệ 0…1 — để đếm "đã đặt" theo
 * lệnh mà không đếm trùng đơn gộp (10/10/2026). Đơn nằm TRỌN trong bộ đang tính
 * → 1 (dù chia thế nào cũng là của bộ). Không thì cộng phần các lệnh của bộ theo
 * `qtyForLsx` — dòng chưa chia vẫn theo quy ước "thuộc lệnh chính".
 */
export function tiLeChoBo(
  line: {
    qty_ordered: number
    main_lsx_id: string | null
    allocations?: LsxSplit[] | null
  },
  poLsxIds: string[],
  boLenh: string[],
): number {
  const bo = new Set(boLenh)
  if (poLsxIds.length > 0 && poLsxIds.every((id) => bo.has(id))) return 1
  const dat = Number(line.qty_ordered) || 0
  if (dat <= 0) return 0
  const phan = boLenh.reduce((s, id) => s + qtyForLsx(id, line), 0)
  return Math.min(Math.max(phan / dat, 0), 1)
}
