import {
  DEFAULT_CUT_PARAMS,
  specKey,
  stockFor,
  type CutGroupPlan,
  type CutGroupResult,
  type CutItem,
  type CutParams,
  type CutPattern,
  type CutPlanDoc,
  type CutPlanResult,
} from './types'

/**
 * THUẬT TOÁN QUY CẮT MỘT CHIỀU (1D cutting stock).
 *
 * Mô hình mạch cắt (engine hỗ trợ, màn hình hiện để 0 như bản gốc): cắt n khúc
 * trên một cây tốn (n − 1) mạch — mạch cuối cùng ăn vào đoạn dư. Một sơ đồ VỪA
 * cây khi Σ dài + (n − 1)·kerf ≤ usable, tương đương Σ (dài + kerf) ≤ usable +
 * kerf. Đặt w = dài + kerf, C = usable + kerf thì đây là bài toán ba lô bị chặn:
 * chọn số khúc mỗi loại (≤ còn cần) sao cho Σ w ≤ C và Σ w lớn nhất — tức là ít
 * dư nhất trên cây đó.
 *
 * Ba chiến lược chạy song song, lấy phương án tốt nhất (ít cây → ít phế → ít sơ
 * đồ):
 *  · SHP  — lặp: tìm sơ đồ đầy nhất bằng quy hoạch động, áp cho tối đa số cây
 *           có thể, trừ nhu cầu, lặp tới hết. Thường tối ưu hoặc lệch 1 cây.
 *  · FFD  — xếp khúc dài trước vào cây đầu tiên còn chỗ. Nhanh, làm mốc so sánh.
 *  · BFD  — như FFD nhưng chọn cây vừa khít nhất.
 *
 * Đơn vị tính bên trong là SỐ NGUYÊN: số liệu mm nguyên thì tính bằng mm; có
 * số lẻ thì tính bằng 0,1 mm khi cây không quá dài; quá dài thì làm tròn LÊN
 * chiều dài chi tiết và làm tròn XUỐNG cây — sai về phía an toàn (không bao giờ
 * đẻ ra sơ đồ không cắt nổi ngoài xưởng).
 */

const round1 = (v: number) => Math.round(v * 10) / 10
const pct = (num: number, den: number) =>
  den > 0 ? Math.round((num / den) * 1000) / 10 : 0

function gcd(a: number, b: number): number {
  while (b) [a, b] = [b, a % b]
  return a
}

type Scaled = {
  /** 1 đơn vị nội bộ = bao nhiêu mm. */
  unit: number
  /** Trọng số w_i (đã cộng kerf), theo đơn vị nội bộ. */
  w: number[]
  kerf: number
  cap: number
}

/** Đưa mọi chiều dài về số nguyên cùng đơn vị (xem chú thích đầu file). */
function scale(items: CutItem[], usable: number, kerf: number): Scaled {
  const allInt = [usable, kerf, ...items.map((i) => i.length_mm)].every(Number.isInteger)
  let lens: number[]
  let k: number
  let u: number
  let unit: number
  if (allInt) {
    lens = items.map((i) => i.length_mm)
    k = kerf
    u = usable
    unit = 1
  } else {
    // Tới cây 6,5 m vẫn tính đúng 0,1 mm; ước chung (thường 5 hoặc 10) rút
    // bảng DP xuống thêm.
    const tenthsCap = Math.round((usable + kerf) * 10)
    if (tenthsCap <= 65_000) {
      lens = items.map((i) => Math.round(i.length_mm * 10))
      k = Math.round(kerf * 10)
      u = Math.round(usable * 10)
      unit = 0.1
    } else {
      // Cây dài mà số lẻ: làm tròn về phía an toàn ở mức mm.
      lens = items.map((i) => Math.ceil(i.length_mm))
      k = Math.ceil(kerf)
      u = Math.floor(usable)
      unit = 1
    }
  }
  // Rút gọn theo ước chung để bảng DP ngắn lại (6000/3/1500/390 → chia 3).
  let g = 0
  for (const v of [u + k, k, ...lens]) g = gcd(g, v)
  if (g > 1) {
    lens = lens.map((v) => v / g)
    k /= g
    u /= g
    unit *= g
  }
  return { unit, w: lens.map((v) => v + k), kerf: k, cap: u + k }
}

/* ────────────────────────────────────────────────────────────────────────────
 * SHP — quy hoạch động tìm sơ đồ đầy nhất theo nhu cầu còn lại.
 * ──────────────────────────────────────────────────────────────────────────── */

type Chunk = { item: number; count: number; weight: number }

/**
 * Chia số lượng còn cần của mỗi loại thành các "gói" 1, 2, 4, … (binary
 * splitting) để bài toán bị chặn chạy như bài toán 0/1. Gói không vượt quá số
 * khúc tối đa nhét vừa một cây, nên bảng nhỏ dù nhu cầu hàng nghìn.
 */
function chunks(remaining: number[], s: Scaled): Chunk[] {
  const out: Chunk[] = []
  // Loại DÀI xếp trước: khi hai cách xếp cùng đầy một cây, cách dùng khúc dài
  // được ghi nhận trước → nhu cầu khúc dài (khó xếp) vơi sớm, cuối bài ít
  // cây "một khúc dài trơ trọi".
  const order = remaining
    .map((_, i) => i)
    .filter((i) => remaining[i] > 0 && s.w[i] <= s.cap)
    .sort((a, b) => s.w[b] - s.w[a])
  for (const i of order) {
    let left = Math.min(remaining[i], Math.floor(s.cap / s.w[i]))
    let size = 1
    while (left > 0) {
      const c = Math.min(size, left)
      out.push({ item: i, count: c, weight: c * s.w[i] })
      left -= c
      size *= 2
    }
  }
  return out
}

/** Sơ đồ đầy nhất có thể cắt từ nhu cầu còn lại. Trả null khi không còn gì. */
function bestPattern(remaining: number[], s: Scaled): number[] | null {
  const cs = chunks(remaining, s)
  if (cs.length === 0) return null
  const cap = s.cap
  // reach[c] = có tổ hợp gói đúng trọng lượng c; parent[c] = gói cuối cùng
  // dùng để đạt c (chỉ số + 1; 0 = chưa đạt).
  const parent = new Int32Array(cap + 1)
  const reach = new Uint8Array(cap + 1)
  reach[0] = 1
  let best = 0
  for (let ci = 0; ci < cs.length; ci++) {
    const w = cs[ci].weight
    for (let c = cap; c >= w; c--) {
      if (!reach[c] && reach[c - w]) {
        reach[c] = 1
        parent[c] = ci + 1
        if (c > best) best = c
      }
    }
    if (best === cap) break
  }
  if (best === 0) return null
  const counts = new Array<number>(remaining.length).fill(0)
  for (let c = best; c > 0;) {
    const ch = cs[parent[c] - 1]
    counts[ch.item] += ch.count
    c -= ch.weight
  }
  return counts
}

/**
 * Ngân sách thời gian cho SHP. Bảng DP tốn công theo số CHIỀU DÀI KHÁC NHAU
 * (không phải theo số lượng): 500 chiều dài mất ~1,3 s, 5000 chiều dài mất
 * 21 s — treo cả tab (đo 09/09/2026). Hết giờ thì phần nhu cầu còn lại giao
 * cho FFD (xếp xong trong vài chục ms); kết quả vẫn hợp lệ, chỉ kém tối ưu ở
 * phần đuôi, và FFD/BFD nguyên bản vẫn chạy song song để so.
 */
const SHP_BUDGET_MS = 1500

function shp(items: CutItem[], s: Scaled, budgetMs: number): number[][] {
  const remaining = items.map((i) => i.qty)
  const bars: number[][] = []
  const t0 = Date.now()
  for (let guard = 0; guard < 100_000; guard++) {
    if (Date.now() - t0 > budgetMs) {
      for (const b of fitDecreasing(remaining, s, false)) bars.push(b)
      return bars
    }
    const p = bestPattern(remaining, s)
    if (!p) break
    // Áp sơ đồ cho tối đa số cây mà nhu cầu còn cho phép.
    let times = Infinity
    for (let i = 0; i < p.length; i++) {
      if (p[i] > 0) times = Math.min(times, Math.floor(remaining[i] / p[i]))
    }
    if (!Number.isFinite(times) || times < 1) break
    for (let t = 0; t < times; t++) bars.push(p)
    for (let i = 0; i < p.length; i++) remaining[i] -= p[i] * times
  }
  return bars
}

/* ────────────────────────────────────────────────────────────────────────────
 * FFD / BFD — xếp từng khúc, dài trước. Nhận vec-tơ số lượng còn cần để SHP
 * hết giờ có thể giao nốt phần đuôi.
 * ──────────────────────────────────────────────────────────────────────────── */

function fitDecreasing(qtys: number[], s: Scaled, best: boolean): number[][] {
  const order = qtys
    .map((_, i) => i)
    .filter((i) => qtys[i] > 0 && s.w[i] <= s.cap)
    .sort((a, b) => s.w[b] - s.w[a])
  const bars: { free: number; counts: number[] }[] = []
  for (const i of order) {
    for (let n = 0; n < qtys[i]; n++) {
      let pick = -1
      for (let b = 0; b < bars.length; b++) {
        if (bars[b].free < s.w[i]) continue
        if (!best) {
          pick = b
          break
        }
        if (pick === -1 || bars[b].free < bars[pick].free) pick = b
      }
      if (pick === -1) {
        bars.push({ free: s.cap, counts: new Array<number>(qtys.length).fill(0) })
        pick = bars.length - 1
      }
      bars[pick].free -= s.w[i]
      bars[pick].counts[i] += 1
    }
  }
  return bars.map((b) => b.counts)
}

/* ────────────────────────────────────────────────────────────────────────────
 * Gom cây giống nhau thành sơ đồ, chấm điểm, chọn phương án.
 * ──────────────────────────────────────────────────────────────────────────── */

type Scored = { patterns: CutPattern[]; bars: number; scrap: number }

/**
 * Gom cây giống nhau thành sơ đồ. Số liệu ghi ra (dùng / mạch / dư) tính bằng
 * chiều dài THẬT và kerf THẬT, không phải số đã làm tròn cho bảng DP — bảng DP
 * làm tròn về phía an toàn nên sơ đồ nào nó chấp nhận thì số thật cũng vừa cây.
 */
function toPatterns(
  bars: number[][],
  items: CutItem[],
  kerf: number,
  usable: number,
  minRemnant: number,
): Scored {
  const byKey = new Map<string, { counts: number[]; bars: number }>()
  for (const counts of bars) {
    const key = counts.join(',')
    const cur = byKey.get(key)
    if (cur) cur.bars += 1
    else byKey.set(key, { counts, bars: 1 })
  }
  const patterns: CutPattern[] = []
  let scrap = 0
  for (const { counts, bars: n } of byKey.values()) {
    const pieces = counts
      .map((count, id) => ({ id, count }))
      .filter((p) => p.count > 0)
      .sort((a, b) => items[b.id].length_mm - items[a.id].length_mm)
      .map((p) => ({ id: items[p.id].id, count: p.count }))
    const nPieces = counts.reduce((a, b) => a + b, 0)
    let usedRaw = 0
    for (let i = 0; i < counts.length; i++) usedRaw += counts[i] * items[i].length_mm
    const used = round1(usedRaw)
    const kerfTotal = round1(Math.max(0, nPieces - 1) * kerf)
    const remnant = round1(usable - used - kerfTotal)
    const reusable = remnant >= minRemnant && minRemnant > 0
    if (!reusable) scrap += remnant * n
    patterns.push({
      pieces,
      used_mm: used,
      kerf_mm: kerfTotal,
      remnant_mm: remnant,
      reusable,
      bars: n,
    })
  }
  // Sơ đồ đầy nhất lên đầu; sơ đồ lẻ (cây cuối) xuống cuối — đúng thứ tự cắt.
  patterns.sort((a, b) => b.used_mm - a.used_mm || b.bars - a.bars)
  return { patterns, bars: bars.length, scrap }
}

const better = (a: Scored, b: Scored) =>
  a.bars !== b.bars
    ? a.bars < b.bars
    : a.scrap !== b.scrap
      ? a.scrap < b.scrap
      : a.patterns.length < b.patterns.length

/**
 * Tối ưu một bộ chi tiết trên một loại cây. Chi tiết dài hơn phần cây dùng
 * được được báo lỗi và bỏ ra khỏi sơ đồ (phải nối hoặc đổi cây dài hơn — máy
 * không tự quyết).
 */
export type OptimizeOptions = {
  /** Ngân sách ms cho SHP trước khi giao phần đuôi cho FFD. Mặc định 1500. */
  shp_budget_ms?: number
}

export function optimizeCut(
  itemsIn: CutItem[],
  params: CutParams,
  opts: OptimizeOptions = {},
): CutGroupResult {
  const stock = Number(params.stock_length_mm) || 0
  const kerf = Math.max(0, Number(params.kerf_mm) || 0)
  const trim =
    Math.max(0, Number(params.trim_start_mm) || 0) +
    Math.max(0, Number(params.trim_end_mm) || 0)
  const minRemnant = Math.max(0, Number(params.min_remnant_mm) || 0)
  const usable = round1(stock - trim)
  const errors: string[] = []

  const empty = (): CutGroupResult => ({
    stock_length_mm: stock,
    usable_mm: Math.max(0, usable),
    bars: 0,
    patterns: [],
    pieces_total: 0,
    material_mm: 0,
    used_mm: 0,
    reusable_mm: 0,
    scrap_mm: 0,
    waste_pct: 0,
    items: itemsIn.map((i) => ({ id: i.id, required: i.qty, planned: 0 })),
    errors,
  })

  if (stock <= 0 || usable <= 0) {
    errors.push('Chưa nhập chiều dài cây tiêu chuẩn')
    return empty()
  }

  const items: CutItem[] = []
  for (const it of itemsIn) {
    const qty = Math.ceil(it.qty)
    if (!(it.length_mm > 0) || qty < 1) continue
    if (it.length_mm > usable) {
      errors.push(
        `Chi tiết dài ${it.length_mm} mm vượt chiều dài cây (${usable} mm) — kiểm tra lại số liệu`,
      )
      continue
    }
    items.push({ id: it.id, length_mm: it.length_mm, qty })
  }
  if (items.length === 0) return empty()

  const s = scale(items, usable, kerf)
  const qtys = items.map((i) => i.qty)
  const candidates = [
    shp(items, s, opts.shp_budget_ms ?? SHP_BUDGET_MS),
    fitDecreasing(qtys, s, false),
    fitDecreasing(qtys, s, true),
  ].map((bars) => toPatterns(bars, items, kerf, usable, minRemnant))
  let best = candidates[0]
  for (const c of candidates.slice(1)) if (better(c, best)) best = c

  const planned = new Map<number, number>()
  let used = 0
  let reusable = 0
  let pieces = 0
  for (const p of best.patterns) {
    used += p.used_mm * p.bars
    if (p.reusable) reusable += p.remnant_mm * p.bars
    for (const pc of p.pieces) {
      planned.set(pc.id, (planned.get(pc.id) ?? 0) + pc.count * p.bars)
      pieces += pc.count * p.bars
    }
  }
  const material = best.bars * stock
  used = round1(used)
  reusable = round1(reusable)
  const scrap = round1(material - used - reusable)

  return {
    stock_length_mm: stock,
    usable_mm: usable,
    bars: best.bars,
    patterns: best.patterns,
    pieces_total: pieces,
    material_mm: material,
    used_mm: used,
    reusable_mm: reusable,
    scrap_mm: scrap,
    waste_pct: pct(scrap, material),
    items: itemsIn.map((i) => ({
      id: i.id,
      required: Math.ceil(i.qty),
      planned: planned.get(i.id) ?? 0,
    })),
    errors,
  }
}

/**
 * Chạy quy cắt cho cả đợt: dòng của lưới → chi tiết, một loại cây. Dòng thiếu
 * dài / SL bị bỏ và liệt kê ở `skipped`; dòng trống hoàn toàn lặng lẽ bỏ qua.
 */
export function planCut(
  doc: Pick<CutPlanDoc, 'stock_length_mm' | 'stock_by_spec' | 'lines'>,
  opts: OptimizeOptions = {},
): CutPlanResult {
  // Gom dòng theo quy cách, giữ thứ tự xuất hiện — mỗi nhóm là một bài toán
  // cắt độc lập trên loại cây của nó.
  const groups = new Map<string, { spec: string; items: CutItem[]; lines: number }>()
  const skipped: CutPlanResult['skipped'] = []
  for (const line of doc.lines) {
    const length = typeof line.length_mm === 'number' ? line.length_mm : NaN
    const qty = typeof line.qty === 'number' ? line.qty : NaN
    if (!line.part_name.trim() && !(length > 0) && !(qty > 0)) continue
    if (!(length > 0)) {
      skipped.push({ key: line.key, reason: 'Thiếu chiều dài cắt' })
      continue
    }
    if (!(qty > 0)) {
      skipped.push({ key: line.key, reason: 'Thiếu số lượng' })
      continue
    }
    const key = specKey(line.spec ?? '')
    let g = groups.get(key)
    if (!g) {
      g = { spec: line.spec.trim().replace(/\s+/g, ' '), items: [], lines: 0 }
      groups.set(key, g)
    }
    g.items.push({ id: line.key, length_mm: length, qty })
    g.lines += 1
  }
  // Ngân sách SHP chia đều cho các nhóm để cả đợt vẫn trả lời trong ~1,5 s.
  const budget =
    groups.size > 1 && opts.shp_budget_ms == null
      ? { ...opts, shp_budget_ms: Math.max(200, Math.floor(SHP_BUDGET_MS / groups.size)) }
      : opts
  const out: CutGroupPlan[] = []
  for (const [key, g] of groups) {
    const stock = stockFor(doc, key)
    const result = optimizeCut(
      g.items,
      { ...DEFAULT_CUT_PARAMS, stock_length_mm: stock },
      budget,
    )
    out.push({ key, spec: g.spec, stock_length_mm: stock, lines: g.lines, result })
  }
  return { groups: out, skipped }
}
