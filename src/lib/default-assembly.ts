/**
 * CỤM MẶC NHIÊN — bậc 2 của thang đơn vị đếm theo công đoạn (chốt 27/08/2026).
 *
 * Bài toán: từ công đoạn HÀN trở đi, xưởng không còn đếm CHI TIẾT (chân, mê,
 * nan…) mà đếm CỤM đã hàn lại — đúng như sổ "Tổng TĐ SX": khối PHÔI có số per
 * chi tiết, khối HÀN/NGUỘI/SƠN đếm theo cụm/bộ. Nhưng phần lớn BOM đang là BOM
 * PHẲNG (chỉ chi tiết, không có dòng cụm), nên nếu chờ hồ sơ SP chuẩn hoá thì
 * sổ hàn trở đi không có gì để đếm — và bắt Kỹ thuật cập nhật lại toàn bộ là
 * không khả thi trước go-live.
 *
 * THANG ƯU TIÊN (đối xứng với resolveComponentRoute của lộ trình):
 *   1. Lệnh CÓ dòng cụm thật (kind='assembly', 0088) → dùng cụm thật, khoảng
 *      [first_stage..final_stage] người khai quyết định. Module này ĐỨNG NGOÀI.
 *   2. BOM phẳng → chi tiết dừng TRƯỚC hàn; từ hàn trở đi sinh MỘT "cụm mặc
 *      nhiên" per dòng SP, đếm theo BỘ (1 cụm/SP) — sổ không bao giờ trắng,
 *      tổng không bao giờ sai (đồng bộ SP = MIN, đúng quy ước Excel).
 *   3. Cần mịn hơn (SP nhiều cụm hàn rời) → khai cụm mềm tại lệnh / lưu về hồ
 *      sơ SP — các bước sau, không nằm ở file này.
 *
 * Cụm mặc nhiên là ĐƠN VỊ HIỂN THỊ/TÍNH, KHÔNG phải bản ghi DB: id mang tiền tố
 * riêng để mọi nơi nhận diện; sản lượng của nó SUY từ sổ chi tiết (min theo chi
 * tiết chậm nhất) chứ không có sổ riêng. Khi màn ghi sổ mới cho ghi thẳng vào
 * cụm mặc nhiên thì service ghi sẽ vật chất hoá nó thành dòng
 * production_components thật (bước sau).
 */

import { resolveComponentRoute } from './stage-route'

/**
 * Công đoạn GHÉP: từ đây trở đi chi tiết đã hàn thành cụm, đơn vị đếm đổi.
 * Khớp catalog `production_stage` ('han') và ROUTE_BY_GROUP.FRAME.
 */
export const JOIN_STAGE = 'han'

/** id ảo của cụm mặc nhiên — KHÔNG trỏ vào bảng nào, đừng đem đi ghi sổ. */
const DEFAULT_ASSEMBLY_ID_PREFIX = 'default-asm:'

export const DEFAULT_ASSEMBLY_NAME = 'Cụm khung (mặc nhiên)'

export function defaultAssemblyId(orderLineId: string): string {
  return `${DEFAULT_ASSEMBLY_ID_PREFIX}${orderLineId}`
}

export function isDefaultAssemblyId(id: string): boolean {
  return id.startsWith(DEFAULT_ASSEMBLY_ID_PREFIX)
}

/** id dòng SP nằm trong id ảo; null nếu không phải id cụm mặc nhiên. */
export function defaultAssemblyLineId(id: string): string | null {
  return isDefaultAssemblyId(id) ? id.slice(DEFAULT_ASSEMBLY_ID_PREFIX.length) : null
}

export type CountingComponent = {
  id: string
  kind: 'part' | 'assembly'
  group_code: string | null
  /** Người đã khai công đoạn cuối thì tôn trọng — không gộp vào cụm mặc nhiên. */
  final_stage: string | null
}

export type CountingPlan = {
  /**
   * Lộ trình BỊ CẮT của các chi tiết bị gộp: id → các công đoạn TRƯỚC hàn.
   * Chi tiết không có trong map giữ nguyên lộ trình đầy đủ của nó.
   */
  own_route: Map<string, string[]>
  /** Công đoạn cụm mặc nhiên đảm nhận (từ hàn trở đi). Rỗng = không sinh cụm. */
  virtual_stages: string[]
}

const EMPTY_PLAN: CountingPlan = { own_route: new Map(), virtual_stages: [] }

/**
 * Kế hoạch ĐẾM của MỘT dòng SP: chi tiết nào dừng ở đâu, cụm mặc nhiên phủ
 * công đoạn nào.
 *
 *  - Lệnh có cụm thật → trả kế hoạch RỖNG (đường 0088 tự lo, máy không chen).
 *  - Chi tiết có final_stage do người khai → giữ nguyên (người thắng máy).
 *  - Lộ trình không đi qua hàn (gỗ, may, đan…) hoặc BẮT ĐẦU ngay ở hàn → giữ
 *    nguyên: không có đoạn "trước hàn" nào để tách, cắt nữa là chi tiết biến
 *    mất khỏi sổ.
 */
export function resolveCountingPlan(
  comps: CountingComponent[],
  plannedRoute: string[] | null | undefined,
): CountingPlan {
  if (comps.some((c) => c.kind === 'assembly')) return EMPTY_PLAN
  const own = new Map<string, string[]>()
  const virtual: string[] = []
  for (const c of comps) {
    if (c.final_stage != null) continue
    const route = resolveComponentRoute(plannedRoute, c.group_code)
    const idx = route.indexOf(JOIN_STAGE)
    if (idx <= 0) continue
    own.set(c.id, route.slice(0, idx))
    for (const s of route.slice(idx)) if (!virtual.includes(s)) virtual.push(s)
  }
  return { own_route: own, virtual_stages: virtual }
}

export type AbsorbedTally = {
  /** Tổng cần của chi tiết (đơn vị chi tiết) — calcComponent().total_needed. */
  total_needed: number
  /** Sản lượng đã gộp theo công đoạn của chi tiết (gồm cả gia công nhận về). */
  outputs: { stage: string; done: number; defect: number }[]
}

/**
 * Sản lượng SUY của cụm mặc nhiên per công đoạn, đơn vị BỘ:
 * min theo chi tiết bị gộp của floor(đã làm × SL dòng / tổng cần) — chi tiết
 * chậm nhất quyết định, kẹp trần SL dòng (cùng công thức đồng bộ SP = MIN).
 * Phế trả Σ phế các chi tiết (đơn vị CHI TIẾT — quy về bộ là bịa số).
 * Chi tiết tổng cần 0 bị bỏ (không chia 0); không còn chi tiết hợp lệ → 0.
 */
export function defaultAssemblyOutputs(
  virtualStages: string[],
  lineQty: number,
  absorbed: AbsorbedTally[],
): { stage: string; done: number; defect: number }[] {
  return virtualStages.map((stage) => {
    let done: number | null = null
    let defect = 0
    for (const a of absorbed) {
      const o = a.outputs.find((x) => x.stage === stage)
      defect += o?.defect ?? 0
      if (a.total_needed <= 0) continue
      const sets = Math.floor(((o?.done ?? 0) * lineQty) / a.total_needed)
      done = done == null ? sets : Math.min(done, sets)
    }
    return {
      stage,
      done: Math.min(done ?? 0, lineQty),
      defect: Math.round(defect * 100) / 100,
    }
  })
}
