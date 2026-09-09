/**
 * SỔ CÂN ĐỐI VẬT TƯ — LÕI THUẦN.
 *
 * Không React, không db, không đọc đồng hồ. Ở đây để test được, và để MỘT luật
 * duy nhất phục vụ cả ba nơi: màn cân đối, file Excel xuất ra, và cảnh báo trên
 * trang chủ. Ba nơi tự tính thì sớm muộn nói ba con số khác nhau về cùng một mã
 * — bài học đã có ở dự án này (xem `kit-core.ts`).
 *
 * `qty_short` được view `v_supply_balance` tính sẵn ở DB. `shortOf` ở đây LẶP
 * LẠI đúng phép đó có chủ ý: nó là bản đối chứng. Nếu ai sửa công thức một bên
 * mà quên bên kia thì test bắt được ngay, thay vì để hai con số lệch nhau âm
 * thầm trên màn hình.
 */

/** Một dòng sổ cân đối, đúng hình dạng view `v_supply_balance` trả về. */
export type BalanceRow = {
  material_code: string
  material_name: string | null
  unit: string | null
  qty_needed: number
  qty_on_hand: number
  /** Đã đặt trên đơn ĐÃ CAM KẾT (duyệt trở đi). */
  qty_incoming: number
  /** Đã gõ trên đơn NHÁP / chờ duyệt — chưa cam kết. */
  qty_drafted: number
  qty_short: number
  /** ISO date `YYYY-MM-DD`, hoặc null khi lệnh chưa có hạn giao. */
  need_by: string | null
  lsx_count: number
  lsx_codes: string[]
}

/**
 * CÒN THIẾU = CẦN − CÓ − ĐANG VỀ, kẹp sàn 0.
 *
 * `qty_drafted` KHÔNG được trừ. Lý do nghiệp vụ: đơn nháp chưa ai duyệt thì
 * hàng chưa chắc về. Trừ nó đi là bảo người mua "đủ rồi" dựa trên một tờ giấy
 * chưa ai ký — đo 09/09/2026 có 345.210 đơn vị đang nằm ở tình trạng đó.
 */
export function shortOf(needed: number, onHand: number, incoming: number): number {
  return Math.max(needed - onHand - incoming, 0)
}

/** Mức gấp của một dòng. Bốn bậc, không hơn. */
export type Urgency = 'late' | 'soon' | 'later' | 'nodate'

/**
 * Xếp mức gấp theo hạn cần.
 *
 * `today` truyền vào chứ không đọc `new Date()` bên trong: hàm phải thuần để
 * test được, và server với trình duyệt sẽ ra hai kết quả khác nhau quanh nửa
 * đêm nếu mỗi bên tự đọc đồng hồ.
 *
 * KHÔNG CÓ HẠN là bậc RIÊNG, không gộp vào 'later'. Đo được: 37% dòng lệnh
 * chưa có `ship_date`. Gộp chúng vào "sắp tới" là nói dối — hệ thống không biết
 * chúng gấp hay không, và người mua cần thấy đúng điều đó để đi hỏi Kế hoạch.
 */
export function urgencyOf(needBy: string | null, today: string, soonDays = 7): Urgency {
  if (!needBy) return 'nodate'
  const days = daysBetween(today, needBy)
  if (days < 0) return 'late'
  if (days <= soonDays) return 'soon'
  return 'later'
}

/** Số ngày từ `from` đến `to`, cả hai dạng `YYYY-MM-DD`. Âm nghĩa là đã qua. */
export function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`)
  const b = Date.parse(`${to}T00:00:00Z`)
  return Math.round((b - a) / 86_400_000)
}

export type BalanceBuckets = {
  late: BalanceRow[]
  soon: BalanceRow[]
  later: BalanceRow[]
  nodate: BalanceRow[]
}

/**
 * Chia sổ thành bốn rổ theo mức gấp, mỗi rổ xếp theo hạn rồi đến lượng thiếu.
 *
 * CHỈ giữ dòng CÒN THIẾU > 0: mã đã đủ không phải việc của người mua hôm nay.
 * Muốn xem cả mã đã đủ thì gọi thẳng repo, đừng nới hàm này — tab "Đã đủ" là
 * một câu hỏi khác và nó có bộ lọc riêng.
 */
export function bucketBalance(
  rows: BalanceRow[],
  today: string,
  soonDays = 7,
): BalanceBuckets {
  const out: BalanceBuckets = { late: [], soon: [], later: [], nodate: [] }
  for (const r of rows) {
    if (r.qty_short <= 0) continue
    out[urgencyOf(r.need_by, today, soonDays)].push(r)
  }
  for (const k of Object.keys(out) as (keyof BalanceBuckets)[]) {
    out[k].sort(
      (a, b) =>
        (a.need_by ?? '9999').localeCompare(b.need_by ?? '9999') ||
        b.qty_short - a.qty_short,
    )
  }
  return out
}

/**
 * Mã này đã có người gõ vào đơn nháp chưa?
 *
 * Dùng để hiện cảnh báo "đã có nháp rồi, đừng gõ lại" ngay trên dòng. Không có
 * nó thì hai người mua cùng phòng soạn hai đơn cho cùng một mã mà không ai
 * biết — và cả hai đơn đều nằm im vì không ai chắc cái kia đã xử lý chưa.
 */
export function hasDraft(row: BalanceRow): boolean {
  return row.qty_drafted > 0
}

/** Tóm tắt để bày lên đầu màn và lên badge của nav. */
export function summarise(rows: BalanceRow[], today: string, soonDays = 7) {
  const b = bucketBalance(rows, today, soonDays)
  return {
    late: b.late.length,
    soon: b.soon.length,
    later: b.later.length,
    nodate: b.nodate.length,
    /** Tổng số mã cần xử lý — đúng con số badge trên nav phải hiện. */
    total: b.late.length + b.soon.length + b.later.length + b.nodate.length,
    drafted: rows.filter((r) => r.qty_short > 0 && hasDraft(r)).length,
  }
}
