/**
 * CẤU HÌNH CÔNG ĐOẠN (0287, B1 của docs/san-xuat-cau-hinh-thiet-ke.md).
 *
 * Thuần, không chạm DB — client import được. Nguồn dữ liệu là
 * `catalog_items.meta` của type `production_stage`; file này parse meta đó và
 * rơi về MẶC ĐỊNH THEO MÃ khi thiếu, để hành vi trước migration giữ nguyên:
 * phôi · gỗ · đan · may đếm chi tiết; hàn · nguội · mài · sơn đếm cụm; lắp ráp
 * → hoàn thiện đếm bộ.
 *
 * Hai hằng số từng ghi cứng trong mã nay SUY từ cấu hình (`countingOf`):
 *   - công đoạn GHÉP (JOIN_STAGE cũ) = công đoạn đầu tiên đếm 'cluster';
 *   - CHẶNG THÀNH PHẨM (FINISH_STAGES cũ) = các công đoạn đếm 'unit', theo
 *     thứ tự danh mục.
 *
 * BẪY: nhiều test và vài màn mock danh mục bằng DANH SÁCH THIẾU (chỉ phôi +
 * hàn). Không có công đoạn 'unit' nào trong danh sách thì `countingOf` rơi về
 * bốn mã thành phẩm mặc định — chỉ khi danh sách KHÔNG chứa mã nào trong bốn
 * mã đó. Danh sách có chứa nhưng khai 'part' thì tôn trọng người khai.
 */

export const COUNT_LEVELS = ['part', 'cluster', 'unit'] as const
export type CountLevel = (typeof COUNT_LEVELS)[number]

export const COUNT_LEVEL_LABEL: Record<CountLevel, string> = {
  part: 'chi tiết',
  cluster: 'cụm',
  unit: 'bộ (cái)',
}

/** Ô lõi của phiếu ghi sổ khai được. `qty` (SL đạt) luôn hiện + bắt buộc. */
export const CORE_FIELDS = ['defect', 'rework', 'kg', 'worker'] as const
export type CoreField = (typeof CORE_FIELDS)[number]

export const CORE_FIELD_LABEL: Record<CoreField, string> = {
  defect: 'Phế (bỏ hẳn)',
  rework: 'Sửa lại (cứu được)',
  kg: 'Kg',
  worker: 'Người làm',
}

export const CORE_MODES = ['off', 'on', 'required'] as const
export type CoreMode = (typeof CORE_MODES)[number]

export type StageMeta = {
  count_level: CountLevel
  core: Record<CoreField, CoreMode>
  /** Mã công đoạn cấp đầu vào; null = đầu chuỗi hoặc để máy suy theo lộ trình. */
  input_from: string | null
}

export type StageConfig = {
  code: string
  label: string
  meta: StageMeta
}

/** Bậc đếm mặc định theo mã — đúng hành vi trước 0287. Mã lạ → chi tiết. */
const DEFAULT_LEVEL_BY_CODE: Record<string, CountLevel> = {
  phoi: 'part',
  moc: 'part',
  dan: 'part',
  may: 'part',
  han: 'cluster',
  nguoi: 'cluster',
  mai: 'cluster',
  son: 'cluster',
  lap_rap: 'unit',
  bao_bi: 'unit',
  dong_goi: 'unit',
  hoan_thien: 'unit',
}

const DEFAULT_CORE: Record<CoreField, CoreMode> = {
  defect: 'on',
  rework: 'on',
  kg: 'on',
  worker: 'on',
}

export function defaultStageMeta(code: string): StageMeta {
  return {
    count_level: DEFAULT_LEVEL_BY_CODE[code] ?? 'part',
    core: { ...DEFAULT_CORE },
    input_from: null,
  }
}

const isLevel = (v: unknown): v is CountLevel =>
  typeof v === 'string' && (COUNT_LEVELS as readonly string[]).includes(v)
const isMode = (v: unknown): v is CoreMode =>
  typeof v === 'string' && (CORE_MODES as readonly string[]).includes(v)

/**
 * Parse meta jsonb của một mục danh mục. Từng khoá sai kiểu thì rơi về mặc
 * định của khoá đó (không vứt cả meta): một ô gõ sai không được làm cả công
 * đoạn đổi cách đếm.
 */
export function parseStageMeta(code: string, raw: unknown): StageMeta {
  const d = defaultStageMeta(code)
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return d
  const r = raw as Record<string, unknown>
  const core = { ...d.core }
  const rc = r.core
  if (rc && typeof rc === 'object' && !Array.isArray(rc)) {
    for (const f of CORE_FIELDS) {
      const v = (rc as Record<string, unknown>)[f]
      if (isMode(v)) core[f] = v
    }
  }
  return {
    count_level: isLevel(r.count_level) ? r.count_level : d.count_level,
    core,
    input_from:
      typeof r.input_from === 'string' && r.input_from.trim()
        ? r.input_from.trim()
        : null,
  }
}

export type StageCatalogLike = { code: string; label: string; meta?: unknown }

/** Danh mục (đúng thứ tự) → cấu hình đã parse. */
export function resolveStageConfigs(items: StageCatalogLike[]): StageConfig[] {
  return items.map((s) => ({
    code: s.code,
    label: s.label,
    meta: parseStageMeta(s.code, s.meta),
  }))
}

/**
 * Hai mốc đếm mọi phép tính sản lượng cần:
 *   join   — công đoạn ghép: từ đây chi tiết đã thành cụm (null = lệnh không
 *            có cụm mặc nhiên, mọi thứ đếm chi tiết tới cùng).
 *   finish — chặng thành phẩm, đếm theo bộ, có mặt trên mọi dòng SP.
 */
export type Counting = {
  join: string | null
  finish: readonly string[]
}

export const DEFAULT_FINISH_STAGES: readonly string[] = [
  'lap_rap',
  'bao_bi',
  'dong_goi',
  'hoan_thien',
]

export const DEFAULT_COUNTING: Counting = { join: 'han', finish: DEFAULT_FINISH_STAGES }

/**
 * Suy mốc đếm từ danh mục. Danh sách rỗng → mặc định (đúng hành vi cũ).
 * Danh sách THIẾU (xem BẪY đầu file) cũng rơi về mặc định cho phần thiếu.
 */
export function countingOf(items: StageCatalogLike[] | null | undefined): Counting {
  if (!items || items.length === 0) return DEFAULT_COUNTING
  const cfg = resolveStageConfigs(items)
  const codes = new Set(cfg.map((c) => c.code))

  const firstCluster = cfg.find((c) => c.meta.count_level === 'cluster')
  let join: string | null
  if (firstCluster) join = firstCluster.code
  else if (codes.has(DEFAULT_COUNTING.join!))
    join = null // có hàn nhưng khai 'part'
  else join = DEFAULT_COUNTING.join

  const units = cfg.filter((c) => c.meta.count_level === 'unit').map((c) => c.code)
  const hasAnyDefaultFinish = DEFAULT_FINISH_STAGES.some((s) => codes.has(s))
  const finish = units.length > 0 || hasAnyDefaultFinish ? units : DEFAULT_FINISH_STAGES

  return { join, finish }
}

/**
 * TÁCH lộ trình của một CỤM theo bậc đếm (0288, B2): bước đếm 'part' thuộc các
 * CHI TIẾT trong cụm, bước đếm 'cluster'/'unit' thuộc DÒNG CỤM. Nhờ vậy khai
 * "phôi → nguội → sơn" cho cụm nhôm là chi tiết dừng ở phôi, cụm chạy nguội →
 * sơn, không cần hàn ở giữa. Giữ nguyên thứ tự đã khai.
 */
export function splitClusterRoute(
  stages: readonly string[],
  cfg: StageConfig[],
): { part: string[]; cluster: string[] } {
  const part: string[] = []
  const cluster: string[] = []
  for (const s of stages) (countLevelOf(cfg, s) === 'part' ? part : cluster).push(s)
  return { part, cluster }
}

/** Bậc đếm của một công đoạn trong danh mục đã parse; mã lạ → mặc định theo mã. */
export function countLevelOf(cfg: StageConfig[], stage: string): CountLevel {
  return (
    cfg.find((c) => c.code === stage)?.meta.count_level ??
    defaultStageMeta(stage).count_level
  )
}
