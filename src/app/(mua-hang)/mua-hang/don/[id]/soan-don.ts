import type { PoHeader } from '@/app/(workspace)/planning/pos/new/po-draft'
import type { Line } from '@/app/(workspace)/planning/pos/new/po-line'

/**
 * LOGIC THUẦN CỦA PHẦN SOẠN ĐƠN trên màn chứng từ hợp nhất — không React, có
 * test. Chuyển từ `PoCreateForm.tsx` (bản cũ, 1.562 dòng trộn UI và logic)
 * những gì màn mới cần: tự lưu nháp, cột đợt giao, nhu cầu còn thiếu.
 */

/* ── ĐỢT GIAO KHAI LÚC SOẠN — mỗi đợt một CỘT, khoá theo chỉ số dòng ───── */
export type PlanColumn = { date: string; qty: Record<number, number | ''> }

/** Cột → bộ đợt gửi server. Cột chưa có ngày hoặc chưa có số nào thì bỏ. */
export function columnsToShipments(
  cols: PlanColumn[],
): { expected_date: string; lines: { line_index: number; qty: number }[] }[] {
  const out: { expected_date: string; lines: { line_index: number; qty: number }[] }[] =
    []
  for (const c of cols) {
    if (!c.date) continue
    const lines = Object.entries(c.qty)
      .map(([idx, q]) => ({
        line_index: Number(idx),
        qty: typeof q === 'number' ? q : 0,
      }))
      .filter((l) => l.qty > 0)
    if (lines.length > 0) out.push({ expected_date: c.date, lines })
  }
  return out.sort((a, b) => a.expected_date.localeCompare(b.expected_date))
}

/**
 * Đợt đã lưu của đơn → cột để chỉnh tiếp (mở SỬA). Đợt huỷ bỏ; dòng đợt trỏ
 * tới line id không còn trên đơn thì bỏ mảnh đó. Nhân bản đơn thì KHÔNG gọi:
 * lịch giao của lần mua trước gần như chắc chắn sai cho lần này.
 */
export function planColumnsFromShipments(
  shipments: {
    status: string
    expected_date: string
    lines: { po_line_id: string; qty: number }[]
  }[],
  lineIds: (string | undefined)[],
): PlanColumn[] {
  const idx = new Map<string, number>()
  lineIds.forEach((id, i) => id && idx.set(id, i))
  const out: PlanColumn[] = []
  for (const s of shipments) {
    if (s.status === 'cancelled') continue
    const qty: Record<number, number | ''> = {}
    for (const l of s.lines) {
      const i = idx.get(l.po_line_id)
      if (i != null) qty[i] = l.qty
    }
    out.push({ date: s.expected_date, qty })
  }
  return out
}

/** Phần của dòng chưa xếp vào đợt nào — số để gọi NCC chốt nốt. */
export function planLeft(cols: PlanColumn[], lineIndex: number, ordered: number): number {
  return (
    ordered -
    cols.reduce((t, c) => {
      const q = c.qty[lineIndex]
      return t + (typeof q === 'number' ? q : 0)
    }, 0)
  )
}

/* ── TỰ LƯU NHÁP VÀO TRÌNH DUYỆT ──────────────────────────────────────────
   Đơn 20 dòng gõ dở mà F5 / mất mạng / bấm nhầm link là mất sạch. Ghi sau
   mỗi nhịp gõ, mở lại thì đề nghị khôi phục. Khoá riêng theo đơn khi sửa. */
export type SavedDraft = {
  at: string
  header: PoHeader
  lines: Line[]
  shipCols: PlanColumn[]
}

export const draftKeyFor = (poId: string | null) =>
  `hg.mua-hang.don.nhap:${poId ?? 'moi'}`

export function readDraft(key: string): SavedDraft | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const d = JSON.parse(raw) as SavedDraft
    // Nháp rỗng (chưa có dòng nào) không đáng một cái banner.
    return d && Array.isArray(d.lines) && d.lines.length > 0 && d.header ? d : null
  } catch {
    return null
  }
}
export function writeDraft(key: string, d: Omit<SavedDraft, 'at'>): void {
  try {
    localStorage.setItem(key, JSON.stringify({ ...d, at: new Date().toISOString() }))
  } catch {
    /* hết chỗ / chế độ riêng tư — bỏ qua, không chặn soạn */
  }
}
export function clearDraft(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {}
}

/** Chữ ký để so "đã khác bản gốc chưa" — chỉ ghi nháp khi khác. */
export function draftSignature(d: Omit<SavedDraft, 'at'>): string {
  return JSON.stringify([d.header, d.lines, d.shipCols])
}

/* ── NHU CẦU THEO LỆNH — payload của /api/dept/supply/needs ─────────────── */
export type Need = {
  material_id: string
  material_code: string
  material_name: string
  unit: string
  qty_needed: number
  available: number
  suggest: number
  on_hand?: number
  ordered?: number
  max_stock?: number | null
  breakdown?: { product: string; qty: number; per_unit: number | null }[]
}

/** Nhu cầu còn thiếu VÀ chưa có trên dòng nào — thứ đáng bấm "thêm". */
export function pendingNeeds(needs: Need[], lines: { material_id: string }[]): Need[] {
  const used = new Set(lines.map((l) => l.material_id))
  return needs.filter((n) => n.suggest > 0 && !used.has(n.material_id))
}

/* ── NHÃN GỘP LỆNH — "LSX-04 + LSX-02" như sổ thật ───────────────────────── */
export function lsxJoinedLabel(
  primary: string,
  extras: string[],
  lsxs: { id: string; code: string }[],
): string | null {
  const code = (id: string) => lsxs.find((l) => l.id === id)?.code ?? '?'
  if (!primary) return null
  return [code(primary), ...extras.map(code)].join(' + ')
}

/* ── CHIA Ô NHẬP: LƯỚI vs KHAY CHI TIẾT DÒNG ─────────────────────────────────
   Mẫu đơn khai tới 5 ô đặc thù (nhôm: mã khuôn, kg/m, dài cây, SL đơn hàng,
   tổng kg). Nhét hết vào lưới thì bảng rộng 12 cột và cột tiền — thứ luôn phải
   thấy — bị đẩy ra ngoài màn. Nên lưới giữ TỐI ĐA 3 ô, phần còn lại xuống khay
   "Chi tiết dòng" mở kèm dòng đang chọn.

   HÀM NÀY TÁCH RA KHỎI MÀN để có thể test. Trước 14/09/2026 nó là hai dòng
   `useMemo` với hai hằng private trong file 2.600 dòng: đổi `kind` của một ô,
   hoặc đổi danh sách `GRID_KINDS`, là ô đó BIẾN MẤT KHỎI FORM trong im lặng —
   test bộ cột phiếu in không bắt được, vì thứ tự in là danh sách khác. */

/** Ô có kiểu nằm ngoài tập này luôn xuống khay, dù đứng đầu danh sách. */
export const GRID_KINDS: ReadonlySet<string> = new Set(['text', 'number', 'calc'])
export const GRID_MAX = 3

export function splitLineFields<T extends { kind: string }>(
  all: T[],
): { grid: T[]; detail: T[] } {
  const grid = all.filter((f) => GRID_KINDS.has(f.kind)).slice(0, GRID_MAX)
  const inGrid = new Set(grid)
  return { grid, detail: all.filter((f) => !inGrid.has(f)) }
}

/* ── TÓM TẮT KHAY CHI TIẾT DÒNG lúc gấp ──────────────────────────────────────
   "2/4 thông số đã điền" — đủ để biết có cần mở ra không. Không có nó thì khay
   gấp là hộp kín và người dùng mở ở mọi dòng để kiểm, tệ hơn lúc chưa gấp. */
export function lineDetailSummary(
  line: Record<string, unknown> | null,
  fields: { field?: string }[],
): string {
  if (fields.length === 0) return 'mẫu này không có thông số riêng'
  if (!line) return ''
  const filled = fields.filter((f) => {
    if (!f.field) return false
    const v = line[f.field]
    return v !== null && v !== undefined && v !== ''
  }).length
  return `${filled}/${fields.length} thông số đã điền`
}
