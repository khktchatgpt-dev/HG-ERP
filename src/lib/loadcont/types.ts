/**
 * Kiểu dữ liệu cho tính load container (xếp kiện hàng vào cont).
 *
 * Đơn vị: kích thước cm, cân nặng kg.
 * Hệ trục: x dọc theo chiều dài cont, y theo chiều rộng, z hướng lên.
 *
 * Thuật toán xếp theo CỘT (column stacking): kiện chỉ được đặt chồng khi nằm
 * GỌN trong mặt kiện dưới — không cho gác lệch qua 2 kiện (nguyên nhân đổ vỡ).
 */

export type ItemTypeInput = {
  id: string
  name: string
  /** Kích thước kiện (cm): dài × rộng × cao. */
  length: number
  width: number
  height: number
  /** Cân nặng 1 kiện (kg). */
  weight: number
  qty: number
  /** Cho phép xoay ngang 90° (đổi dài↔rộng, giữ nguyên chiều cao). */
  allowRotate: boolean
  /**
   * Cho phép XOAY ĐA CHIỀU (lật kiện sang mọi mặt — 6 hướng): mặt nào cũng có
   * thể quay xuống sàn. Hữu ích cho tấm phẳng dựng nghiêng để tile kín hơn.
   * Bỏ trống/false = chỉ xoay ngang. Lật nghiêng làm cột cao & mảnh nên ở chế
   * độ AN TOÀN vẫn bị giới hạn bởi độ mảnh + luật vùng cửa.
   */
  allowFlip?: boolean
  /**
   * Cho phép kiện khác đè lên trên. Kiện hở / mở nắp / hàng cồng kềnh
   * không đóng thùng kín → false.
   */
  stackable: boolean
  /** Hàng dễ vỡ: không gì được đè lên + ưu tiên xếp sau cùng, đánh dấu cảnh báo. */
  fragile: boolean
  /**
   * Tải trọng tối đa (kg) mà nóc kiện chịu được (tổng cân nặng đè lên).
   * null/undefined = không giới hạn (vẫn áp quy tắc nặng-dưới-nhẹ-trên).
   */
  maxLoadKg?: number | null
}

export type ContainerSpec = {
  key: string
  name: string
  /** Kích thước LÒNG cont (cm). */
  length: number
  width: number
  height: number
  /** Tải trọng hàng tối đa (kg). */
  maxPayloadKg: number
}

/**
 * Vùng cửa cont (cm tính từ cửa vào): khi mở cửa không còn gì chặn nên chỉ
 * được xếp cột thấp + vững, cấm hàng dễ vỡ. Với cont ngắn lấy 25% chiều dài.
 */
export const DOOR_ZONE_CM = 100

export function doorZoneFor(spec: ContainerSpec): number {
  return Math.min(DOOR_ZONE_CM, spec.length * 0.25)
}

/** Cao/cạnh-đáy-ngắn tối đa khi CHỒNG kiện (chống tháp mảnh dễ đổ). Mặc định. */
export const MAX_STACK_ASPECT = 3
/** Cao/cạnh-đáy-ngắn tối đa cho cột nằm trong vùng cửa. */
export const MAX_DOOR_ASPECT = 2

/**
 * Ước tính SỨC CHỊU NÉN trên nóc kiện (kg) từ chính thông số kiện, để khỏi bắt
 * nhập tay maxLoadKg — khi người dùng chọn "loại thùng", tải nóc = áp suất cho
 * phép của loại đó × diện tích đáy thùng.
 *
 * Áp suất là con số THẬN TRỌNG (đã trừ hệ số an toàn cho ẩm/rung/xếp lâu). Đây
 * là ƯỚC TÍNH, không thay cho kiểm tra thực tế; audit vẫn gác lại độc lập nên
 * chọn nhầm loại thùng chỉ khiến xếp kém đi, không tạo layout mất an toàn.
 */
export type BoxStrength = {
  key: string
  label: string
  /** Áp suất nóc cho phép (kg/cm²). 0 = coi như chỉ chịu bằng cân nặng bản thân. */
  kgPerCm2: number
}

export const BOX_STRENGTHS: readonly BoxStrength[] = [
  { key: 'unknown', label: 'Không rõ / hàng cồng kềnh', kgPerCm2: 0 },
  { key: 'carton', label: 'Thùng carton thường', kgPerCm2: 0.02 },
  { key: 'carton2', label: 'Carton cứng / 2 lớp', kgPerCm2: 0.05 },
  { key: 'wood', label: 'Thùng gỗ / khung cứng', kgPerCm2: 0.12 },
]

/** Ước tính tải nóc (kg) theo diện tích đáy × áp suất loại thùng. */
export function estimateTopLoadKg(
  length: number,
  width: number,
  kgPerCm2: number,
): number {
  return Math.round(length * width * kgPerCm2)
}

/** Tuỳ chọn cho pack(). */
export type PackOptions = {
  /**
   * Cao/cạnh-đáy-ngắn tối đa khi chồng cột (chống tháp mảnh). Nâng cao hơn để
   * xếp cột cao sát trần cont (đầy trần), đánh đổi bằng cột mảnh hơn. Vùng cửa
   * luôn giữ chặt ở MAX_DOOR_ASPECT bất kể giá trị này. Mặc định MAX_STACK_ASPECT.
   */
  maxStackAspect?: number
  /**
   * Cho phép GÁC TẤM: kiện phẳng cứng gác ngang qua nóc nhiều cột đế cùng độ cao
   * để lấp khoảng không trên đầu cột thấp. Chỉ được dùng khi auditPacking() xác
   * nhận an toàn và tiết kiệm cont; nếu không tự động quay lại phương án cột.
   */
  allowBridging?: boolean
  /**
   * CHẾ ĐỘ TEST — bỏ mọi ràng buộc an toàn khi CHỒNG (nặng-trên-nhẹ, sức chịu
   * nén, phải kín thùng mới đè, độ mảnh cột) để nhồi tối đa; CHỈ giữ:
   *  • ràng buộc hình học (không đè lơ lửng, không chèn nhau, không tràn lòng cont),
   *  • giới hạn tải trọng cont,
   *  • AN TOÀN VÙNG CỬA (cột cao/mảnh & hàng dễ vỡ vẫn bị cấm ở dải sát cửa).
   * Dùng để ước lượng số cont tối thiểu; KHÔNG phải phương án xếp an toàn thật.
   */
  ignoreStackSafety?: boolean
}

/** Tuỳ chọn cho auditPacking(). */
export type AuditOptions = {
  /**
   * CHỈ kiểm HÌNH HỌC + tải cont (không lơ lửng, không chèn nhau, không tràn
   * lòng cont, không quá tải). Bỏ mọi luật an toàn chồng VÀ an toàn vùng cửa.
   * Khớp với PackOptions.ignoreStackSafety để chấm điểm phương án nhồi tối đa
   * (ước lượng số cont tối thiểu).
   */
  geometryOnly?: boolean
}

/** Thông số lòng cont tiêu chuẩn (cm / kg). */
export const CONTAINER_PRESETS: readonly ContainerSpec[] = [
  {
    key: '20dc',
    name: "Cont 20' thường (20DC)",
    length: 589.8,
    width: 235.2,
    height: 239.3,
    maxPayloadKg: 28200,
  },
  {
    key: '40dc',
    name: "Cont 40' thường (40DC)",
    length: 1203.2,
    width: 235.2,
    height: 239.3,
    maxPayloadKg: 26700,
  },
  {
    key: '40hc',
    name: "Cont 40' cao (40HC)",
    length: 1203.2,
    width: 235.2,
    height: 269.8,
    maxPayloadKg: 26500,
  },
]

/** Một kiện đã được đặt chỗ trong cont. */
export type Placement = {
  /** id của ItemTypeInput. */
  itemId: string
  name: string
  /** Góc gần cửa-trái-sàn của kiện (cm). */
  x: number
  y: number
  z: number
  /** Kích thước sau khi xoay (cm): l theo trục x, w theo trục y. */
  l: number
  w: number
  h: number
  rotated: boolean
  weight: number
  fragile: boolean
  stackable: boolean
  maxLoadKg: number | null
  /** Tầng trong cột (0 = sàn). */
  level: number
  /** Thứ tự xếp (1-based, xuyên suốt mọi cont). */
  order: number
}

export type ContainerLoad = {
  index: number
  spec: ContainerSpec
  placements: Placement[]
  usedWeightKg: number
  /** Thể tích hàng đã xếp (m³). */
  usedVolumeM3: number
  /** % thể tích lòng cont đã dùng. */
  volumeUtilization: number
  /** % tải trọng đã dùng. */
  weightUtilization: number
}

export type UnplacedGroup = {
  itemId: string
  name: string
  qty: number
  reason: string
}

export type PackResult = {
  containers: ContainerLoad[]
  unplaced: UnplacedGroup[]
  totalUnits: number
  placedUnits: number
}

/** Một vi phạm an toàn phát hiện bởi auditPacking (kỳ vọng luôn rỗng). */
export type AuditViolation = {
  containerIndex: number
  rule:
    | 'out_of_bounds'
    | 'overlap'
    | 'floating'
    | 'heavier_above'
    | 'max_load_exceeded'
    | 'stacked_on_unstackable'
    | 'stacked_on_fragile'
    | 'payload_exceeded'
    | 'fragile_at_door'
    | 'unstable_at_door'
  message: string
}
