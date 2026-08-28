/**
 * LỘ TRÌNH CÔNG ĐOẠN MẶC ĐỊNH theo NHÓM VẬT TƯ.
 *
 * Vì sao cần: kế hoạch công đoạn (`production_jobs`) mới có ở 2/12 lệnh đang
 * chạy (đo 26/08/2026). Không có lộ trình thì hệ phải đoán, và cách đoán cũ là
 * "chi tiết đi qua TẤT CẢ 12 công đoạn" — khiến mở tab nào cũng thấy đủ 996
 * dòng, kể cả chân ghế sắt nằm trong tab May. Bảng dưới đây thay chỗ đoán mù đó
 * bằng suy luận theo nhóm vật tư (`production_components.group_code`, 0174).
 *
 * THỨ TỰ ƯU TIÊN khi hệ hỏi "chi tiết này đi qua công đoạn nào":
 *   1. Kế hoạch SX đã lên lộ trình cho dòng SP  → dùng kế hoạch (người thắng máy)
 *   2. Chưa lên kế hoạch                        → dùng bảng này
 *   3. Chi tiết chưa phân nhóm                  → không suy, trả rỗng
 *
 * Trả RỖNG cố ý cho hàng mua (ngũ kim: vít, bulong, ốc) — tổ không gia công
 * chúng, nên chúng không bao giờ được xuất hiện trên sổ sản lượng.
 *
 * Chưa phân nhóm KHÔNG suy là hàng mua: một dòng gõ tay quên nhóm mà bị coi là
 * vít thì sẽ âm thầm biến mất khỏi sổ — mất số liệu không ai biết. Trả rỗng để
 * nó lộ ra ở màn "chưa phân nhóm" thay vì lặng lẽ mất.
 */

/** Mã công đoạn — khớp catalog `production_stage`. */
const PHOI = 'phoi'
const HAN = 'han'
const NGUOI = 'nguoi'
const MAI = 'mai'
const SON = 'son'
const MOC = 'moc'
const DAN = 'dan'
const MAY = 'may'
const BAO_BI = 'bao_bi'
const DONG_GOI = 'dong_goi'

/**
 * Nhóm → chuỗi công đoạn, ĐÚNG THỨ TỰ chạy. Nguồn nhóm là hồ sơ SP bên Kỹ
 * thuật (technical_product_parts.group_code).
 */
const ROUTE_BY_GROUP: Record<string, string[]> = {
  // Khung sắt/nhôm: cắt phôi → hàn thành khung → làm nguội/mài → sơn.
  FRAME: [PHOI, HAN, NGUOI, MAI, SON],
  // Gỗ: gia công mộc rồi sơn hoàn thiện.
  WOOD: [MOC, SON],
  // Tấm / polywood: chỉ qua xưởng mộc.
  PANEL: [MOC],
  POLYWOOD: [MOC],
  // Nệm và vải: cắt vải rồi may.
  CUSHION: [MAY],
  FABRIC: [MAY],
  // Mây/nhựa đan.
  RATTAN: [DAN],
  // Bao bì và tem nhãn chỉ xuất hiện ở khâu đóng gói.
  PACKAGING: [BAO_BI, DONG_GOI],
  LABEL: [BAO_BI],
  // Ngũ kim = hàng MUA. Tổ phôi không cắt con vít.
  NGU_KIM: [],
}

/**
 * Lộ trình mặc định của một chi tiết theo nhóm.
 * `null`/nhóm lạ → rỗng (chưa biết, đừng đoán).
 */
export function routeForGroup(groupCode: string | null | undefined): string[] {
  if (!groupCode) return []
  return ROUTE_BY_GROUP[groupCode.trim().toUpperCase()] ?? []
}

/** Chi tiết này có phải hàng gia công không (có đi qua công đoạn nào không). */
export function isMadeInHouse(groupCode: string | null | undefined): boolean {
  return routeForGroup(groupCode).length > 0
}

/** Nhóm đã biết nhưng cố ý KHÔNG gia công (hàng mua) — khác với chưa phân nhóm. */
export function isPurchasedGroup(groupCode: string | null | undefined): boolean {
  if (!groupCode) return false
  const key = groupCode.trim().toUpperCase()
  return key in ROUTE_BY_GROUP && ROUTE_BY_GROUP[key].length === 0
}

/**
 * Cắt lộ trình về khoảng [first_stage..final_stage] của component (0088) —
 * CÙNG quy ước với summarizeComponent: mốc null/không thuộc lộ trình thì lấy
 * đầu/cuối lộ trình; khoảng ngược (first sau final) → trả nguyên lộ trình.
 * Tách ra đây để worklist/ghi sổ dùng chung một phép cắt với sổ tổng hợp.
 */
export function clipRoute(
  route: string[],
  firstStage?: string | null,
  finalStage?: string | null,
): string[] {
  const fi = firstStage ? route.indexOf(firstStage) : -1
  const li = finalStage ? route.indexOf(finalStage) : -1
  const start = fi >= 0 ? fi : 0
  const end = li >= 0 ? li : route.length - 1
  return end >= start ? route.slice(start, end + 1) : route
}

/**
 * Chọn lộ trình cho MỘT chi tiết: kế hoạch của dòng SP thắng, không có thì suy
 * theo nhóm. Gom một chỗ để mọi nơi hỏi cùng một câu trả lời.
 */
export function resolveComponentRoute(
  plannedRoute: string[] | null | undefined,
  groupCode: string | null | undefined,
): string[] {
  if (plannedRoute && plannedRoute.length > 0) return plannedRoute
  return routeForGroup(groupCode)
}
