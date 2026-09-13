/**
 * PHỄU DÒNG TIỀN RA — năm mốc của một đồng tiền mua hàng.
 *
 * Đọc từ trên xuống là đọc được đồng tiền đang đi tới đâu:
 *
 *   1. Đã cam kết      mọi đơn mua chưa huỷ, KỂ CẢ nháp — ý định mua
 *   2. NCC đã xác nhận đơn từ 'confirmed' trở đi — cam kết hai chiều
 *   3. Đã về kho       phiếu nhập có giá — lúc này nợ MỚI phát sinh thật
 *   4. NCC đã đòi      Σ DÒNG hoá đơn đã vào sổ — tiền hàng, CHƯA gồm VAT
 *   5. Đã trả          phiếu chi cho NCC
 *
 * Mốc 1–2 là ƯỚC TÍNH để lập kế hoạch; chỉ từ mốc 3 trở đi mới là số ghi sổ.
 *
 * Cả năm mốc đều là TIỀN HÀNG, không gồm VAT — để so được với nhau. Số thực
 * trả NCC là tổng trên tờ hoá đơn (đã gồm VAT), lớn hơn mốc 4; xem sổ hoá đơn.
 * Màn hình phải phân biệt hai vùng đó, nếu không kế toán chép mốc 2 vào sổ.
 *
 * ⭐ TÁCH THEO TIỀN TỆ, không quy đổi. Đo 11/09/2026: 42 đơn VND + 24 đơn USD.
 * Quy đổi cần tỷ giá, mà tỷ giá nào thì là quyết định kế toán — không phải thứ
 * một hàm gộp số tự chọn thay.
 */

export type FunnelStage = 'committed' | 'confirmed' | 'received' | 'invoiced' | 'paid'

export type FunnelEntry = { currency: string; stage: FunnelStage; amount: number }

export type FunnelRow = Record<FunnelStage, number> & {
  currency: string
  /** Cam kết chưa được NCC xác nhận — phần còn có thể đổi ý. */
  unconfirmed: number
  /** Đã xác nhận mà hàng chưa về. */
  in_flight: number
  /** Đã về mà chưa có hoá đơn — khoản GR/IR. */
  awaiting_invoice: number
  /** Đã có hoá đơn mà chưa trả. */
  unpaid: number
}

const r2 = (n: number) => Math.round(n * 100) / 100
const ZERO = (): Record<FunnelStage, number> => ({ committed: 0, confirmed: 0, received: 0, invoiced: 0, paid: 0 }) // prettier-ignore

/**
 * Gộp các khoản đã gắn nhãn thành phễu, theo từng tiền tệ.
 *
 * Các hiệu số đều KHÔNG cho âm: hàng về nhiều hơn đặt, hay NCC xuất hoá đơn
 * trước khi giao, đều là chuyện có thật — nhưng "còn phải về −2 triệu" thì
 * không đọc ra nghĩa gì. Phần lệch ngược chiều đó thuộc về màn đối chiếu, nơi
 * nó được gọi đúng tên ("NCC đòi trước"), chứ không phải một số âm trong phễu.
 */
export function buildFunnel(entries: FunnelEntry[]): FunnelRow[] {
  const by = new Map<string, Record<FunnelStage, number>>()
  for (const e of entries) {
    const cur = by.get(e.currency) ?? ZERO()
    cur[e.stage] += e.amount
    by.set(e.currency, cur)
  }
  return [...by]
    .map(([currency, v]) => ({
      currency,
      committed: r2(v.committed),
      confirmed: r2(v.confirmed),
      received: r2(v.received),
      invoiced: r2(v.invoiced),
      paid: r2(v.paid),
      unconfirmed: r2(Math.max(v.committed - v.confirmed, 0)),
      in_flight: r2(Math.max(v.confirmed - v.received, 0)),
      awaiting_invoice: r2(Math.max(v.received - v.invoiced, 0)),
      unpaid: r2(Math.max(v.invoiced - v.paid, 0)),
    }))
    .sort((a, b) => b.committed - a.committed)
}

/** Nhãn + vùng của từng mốc — màn dùng để tô và để nói "số nào ghi sổ được". */
export const STAGE_META: Record<
  FunnelStage,
  { label: string; kind: 'uoc_tinh' | 'ghi_so'; hint: string }
> = {
  committed: { label: 'Đã cam kết mua', kind: 'uoc_tinh', hint: 'mọi đơn chưa huỷ, kể cả nháp' }, // prettier-ignore
  confirmed: { label: 'NCC đã xác nhận', kind: 'uoc_tinh', hint: 'cam kết hai chiều — ƯỚC TÍNH sẽ phải trả' }, // prettier-ignore
  received: { label: 'Đã về kho', kind: 'ghi_so', hint: 'phiếu nhập có giá — nợ phát sinh từ đây' }, // prettier-ignore
  invoiced: { label: 'NCC đã xuất hoá đơn', kind: 'ghi_so', hint: 'Σ dòng hoá đơn đã vào sổ — TIỀN HÀNG, chưa gồm VAT' }, // prettier-ignore
  paid: { label: 'Đã trả', kind: 'ghi_so', hint: 'phiếu chi cho nhà cung cấp' },
}
