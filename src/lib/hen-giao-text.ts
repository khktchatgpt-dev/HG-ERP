/**
 * HẸN GIAO ĐỌC ĐƯỢC NGAY (05/10/2026, bản vẽ M1 Bàn làm việc): "30/09 · trễ 5
 * ngày", "05/10 · hôm nay", "07/10 · còn 2 ngày". Trước đây chỉ in ngày trần —
 * người đọc phải tự nhẩm hôm nay là ngày nào.
 *
 * So bằng NGÀY LỊCH (chuỗi yyyy-mm-dd), không bằng mili-giây.
 */
export type HenGiao = { text: string; tone: 'stop' | 'warn' | null; tre: number | null }

const ngay = (s: string) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10))

export function henGiaoText(expected: string | null | undefined, today: string): HenGiao {
  if (!expected) return { text: '— chưa hẹn', tone: null, tre: null }
  const d = Math.round((ngay(today) - ngay(expected)) / 86_400_000)
  const dm = `${expected.slice(8, 10)}/${expected.slice(5, 7)}`
  if (d > 0) return { text: `${dm} · trễ ${d} ngày`, tone: 'stop', tre: d }
  if (d === 0) return { text: `${dm} · hôm nay`, tone: 'warn', tre: 0 }
  return { text: `${dm} · còn ${-d} ngày`, tone: null, tre: d }
}
