/**
 * LỘ TRÌNH CÔNG ĐOẠN MẶC ĐỊNH theo NHÓM VẬT TƯ.
 *
 * Vì sao cần: kế hoạch công đoạn (`production_jobs`) mới có ở 2/12 lệnh đang
 * chạy (đo 26/08/2026). Không có lộ trình thì hệ phải đoán, và cách đoán cũ là
 * "chi tiết đi qua TẤT CẢ 12 công đoạn" — khiến mở tab nào cũng thấy đủ 996
 * dòng, kể cả chân ghế sắt nằm trong tab May. Bảng dưới đây thay chỗ đoán mù đó
 * bằng suy luận theo nhóm vật tư (`production_components.group_code`, 0174).
 *
 * THỨ TỰ ƯU TIÊN khi hệ hỏi "chi tiết này đi qua công đoạn nào" (xem
 * `resolveComponentRoute` bên dưới):
 *   1. Lộ trình KHAI trên chi tiết / cụm        → dùng (người thắng máy)
 *   2. Nhóm vật tư đã biết                      → dùng bảng này
 *   3. Chưa phân nhóm, dòng SP có kế hoạch      → đường lùi: lộ trình kế hoạch
 *   4. Chưa phân nhóm, không kế hoạch           → không suy, trả rỗng
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
const SON = 'son'
const DAN = 'dan'
const MAY = 'may'
const BAO_BI = 'bao_bi'
const DONG_GOI = 'dong_goi'

/**
 * Nhóm → chuỗi công đoạn, ĐÚNG THỨ TỰ chạy. Nguồn nhóm là hồ sơ SP bên Kỹ
 * thuật (technical_product_parts.group_code).
 */
const ROUTE_BY_GROUP: Record<string, string[]> = {
  // Khung sắt/nhôm: cắt phôi → hàn thành khung → làm nguội → sơn.
  //
  // KHÔNG CÓ "MÀI" (chủ dự án chốt 18/09/2026): xưởng không tách mài ra đếm
  // riêng, nó nằm trong công việc của tổ nguội. Để nó trong lộ trình thì màn
  // ghi sổ mở một tab vĩnh viễn 0 và không tổ nào nhận — đúng thứ làm người
  // dùng hết tin vào con số. Mã `mai` VẪN CÒN trong danh mục công đoạn, nên
  // lệnh nào thật sự cần thì KHAI ở màn Lộ trình công đoạn ("mở từng dòng") —
  // kế hoạch tổ & hạn không còn đè được lộ trình nhóm (10/11/2026).
  FRAME: [PHOI, HAN, NGUOI, SON],
  // Gỗ / tấm / polywood: chỉ còn SƠN.
  //
  // Cũng theo quyết định trên — xưởng không tách "mộc" ra đếm riêng. Hệ quả
  // phải biết: 117 dòng gỗ nay chỉ có MỘT công đoạn trên sổ. Nếu thật ra
  // xưởng có làm mộc và muốn đếm, cách đúng là gán `stage_code` cho tổ làm
  // việc đó rồi trả `moc` về đây, KHÔNG phải nhét tạm vào công đoạn khác.
  WOOD: [SON],
  // KHÔNG để rỗng: rỗng ≡ "hàng mua" (xem `isPurchasedGroup`), và tấm/polywood
  // bị coi là hàng mua thì chúng biến mất khỏi sổ mà không ai biết.
  PANEL: [SON],
  POLYWOOD: [SON],
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
 * Chọn lộ trình cho MỘT chi tiết — gom một chỗ để mọi nơi hỏi cùng một câu
 * trả lời. Thứ tự ưu tiên (đổi 04/11/2026, chủ dự án chốt "kế hoạch tổ & hạn
 * không phải lộ trình"; siết lần hai 10/11/2026):
 *   1. `ownStages` — lộ trình KHAI theo cụm: bản chụp trên lệnh (kế hoạch sửa
 *      ở màn Định hình) / cụm / dòng định mức ở hồ sơ SP;
 *   2. suy theo NHÓM VẬT TƯ khi nhóm đã biết — kể cả nhóm cố ý RỖNG (ngũ kim
 *      là hàng mua, không qua công đoạn nào);
 *   3. kế hoạch của dòng SP (production_jobs) — CHỈ là đường lùi khi chi tiết
 *      chưa phân nhóm (nhóm trống / lạ). Kế hoạch là "tổ nào, hạn nào" gắn lên
 *      công đoạn có mặt, không phải lộ trình: để nó đè nhóm thì lệnh TEST
 *      10/11/2026 vừa Lưu kế hoạch xong là tổ Phôi thấy 23 dòng vít · bulon
 *      phải "cắt", gỗ chỉ qua sơn bỗng đi phôi → hàn → nguội, Phôi 600 thành
 *      1.840 chi tiết — và cụm mặc nhiên ở hàn không bao giờ đạt vì con vít
 *      không ai ghi. Muốn thêm công đoạn cho một chi tiết (vd Mài cho khung)
 *      thì KHAI ở Lộ trình công đoạn ("mở từng dòng"), không đi đường kế hoạch.
 */
export function resolveComponentRoute(
  plannedRoute: string[] | null | undefined,
  groupCode: string | null | undefined,
  ownStages?: readonly string[] | null,
): string[] {
  if (ownStages && ownStages.length > 0) return [...ownStages]
  if (isKnownGroup(groupCode)) return routeForGroup(groupCode)
  if (plannedRoute && plannedRoute.length > 0) return plannedRoute
  return []
}

/** Nhóm có trong bảng lộ trình (kể cả nhóm hàng mua, lộ trình rỗng cố ý). */
export function isKnownGroup(groupCode: string | null | undefined): boolean {
  if (!groupCode) return false
  return groupCode.trim().toUpperCase() in ROUTE_BY_GROUP
}

/** Những gì một component cần mang để tự trả lời "tôi đi qua công đoạn nào". */
export type RoutedComponent = {
  group_code: string | null
  /** Lộ trình khai (0288). null/rỗng = suy. */
  stages?: readonly string[] | null
  first_stage?: string | null
  final_stage?: string | null
}

/**
 * Lộ trình HIỆU LỰC của một component = chọn (kế hoạch → khai → nhóm) rồi cắt
 * về khoảng [first..final] (0088). MỌI service dùng hàm này, không tự ghép
 * `clipRoute(resolveComponentRoute(...))` — hai nơi ghép khác nhau là hai số.
 */
export function componentRoute(
  plannedRoute: string[] | null | undefined,
  c: RoutedComponent,
): string[] {
  return clipRoute(
    resolveComponentRoute(plannedRoute, c.group_code, c.stages),
    c.first_stage,
    c.final_stage,
  )
}
