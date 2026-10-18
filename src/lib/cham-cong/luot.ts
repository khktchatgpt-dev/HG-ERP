/**
 * LƯỢT QUẸT — kiểu và tiện ích dùng chung cho mọi màn đọc lượt thô. Hàm thuần.
 *
 * Luật tính giờ công nằm ở `gio-khung.ts` (khung giờ, 17/10/2026). Luật tạm theo ca
 * của 12/10 (`tinh-cong.ts`) đã gỡ 18/10/2026 — chỉ giữ lại phần gộp lượt lặp ở đây.
 */

export type LuotQuet = {
  /** Nhãn ngắn của máy ('.201'). */
  may: string
  /** 'HH:MM:SS' giờ Việt Nam. */
  gio: string
}

/** Lượt cách nhau dưới chừng này phút coi là bấm lặp cho chắc. */
export const GOP_LAP_PHUT = 2

export function phut(hhmm: string): number {
  return Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5))
}

/** Xếp theo giờ, gộp lượt lặp; `lap` = số lượt lặp đã gộp vào lượt này. */
export function gopLap(luot: LuotQuet[]): (LuotQuet & { lap: number })[] {
  const sorted = [...luot].sort((a, b) => (a.gio < b.gio ? -1 : a.gio > b.gio ? 1 : 0))
  const out: (LuotQuet & { lap: number })[] = []
  for (const l of sorted) {
    const truoc = out.at(-1)
    if (truoc && phut(l.gio) - phut(truoc.gio) < GOP_LAP_PHUT) {
      truoc.lap += 1
      continue
    }
    out.push({ ...l, lap: 0 })
  }
  return out
}
