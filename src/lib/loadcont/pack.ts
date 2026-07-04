/**
 * Thuật toán tính load cont — xếp theo CỘT + xếp cột lên sàn kiểu skyline,
 * tuỳ chọn GÁC TẤM (bridging) để lấp khoảng không phía trên các cột thấp.
 *
 * An toàn xếp chồng là ràng buộc cứng, không phải heuristic:
 *  1. Kiện trên phải được đỡ đủ mặt đáy (đỡ ≥ 80% với gác tấm; 100% với chồng
 *     cột đơn) — cấm gác lệch/hẫng.
 *  2. Kiện trên không được nặng hơn (bất kỳ) kiện đỡ dưới.
 *  3. Tổng cân nặng đè lên một kiện ≤ maxLoadKg của kiện đó (nếu khai báo).
 *  4. Kiện hở (stackable=false) và kiện dễ vỡ: KHÔNG gì được đè lên.
 *  5. Không lật nghiêng kiện — chỉ xoay ngang 90° nếu cho phép.
 *  6. Không chồng thành tháp mảnh: cao/cạnh-đáy-ngắn ≤ maxStackAspect (mặc định
 *     MAX_STACK_ASPECT). Nâng tham số này để xếp cao sát trần cont (đầy trần).
 *
 * An toàn VÙNG CỬA (khi mở cửa không còn gì chặn hàng):
 *  7. Trong DOOR_ZONE cuối cont chỉ có cột thấp + vững (aspect ≤ MAX_DOOR_ASPECT),
 *     tuyệt đối không hàng dễ vỡ. Cột không đạt bị dời sâu vào trong / cont sau.
 *  8. Cột cao dồn sát vách trong, thấp dần ra cửa (skyline xếp x nhỏ trước).
 *
 * GÁC TẤM (opt-in): kiện phẳng cứng (tấm mặt/chân bàn…) có thể gác ngang qua nóc
 * nhiều cột đế cùng độ cao (vd cột ghế), lấp phần thể tích trên đầu cột thấp.
 * Phương án gác tấm CHỈ được dùng khi auditPacking() xác nhận 0 vi phạm và tiết
 * kiệm được cont; nếu không, tự động quay lại phương án cột thuần. Nhờ vậy sai
 * sót ở packer gác tấm không bao giờ tạo ra layout mất an toàn.
 */

import { auditPacking } from './audit'
import type {
  ContainerLoad,
  ContainerSpec,
  ItemTypeInput,
  PackOptions,
  PackResult,
  Placement,
  UnplacedGroup,
} from './types'
import { doorZoneFor, MAX_DOOR_ASPECT, MAX_STACK_ASPECT } from './types'

/** Chặn treo trình duyệt khi nhập số lượng quá lớn. */
export const MAX_UNITS = 5000

const EPS = 1e-6

/** Kiện coi là "tấm phẳng cứng" (gác cầu được) nếu mỏng so với cạnh đáy. */
const BRIDGE_FLAT_RATIO = 0.5

// ── Nội bộ ────────────────────────────────────────────────────────────────

type StackedUnit = {
  type: ItemTypeInput
  l: number
  w: number
  rotated: boolean
  z: number
}

type Stack = {
  units: StackedUnit[]
  /** Footprint = mặt đáy kiện gốc (cm). */
  footL: number
  footW: number
  height: number
  weight: number
  /** Còn chịu thêm được bao nhiêu kg đè lên (min trên toàn cột). */
  capacityLeft: number
  /** Nóc cột còn nhận kiện mới không. */
  open: boolean
  /** Cả cột xoay được (mọi kiện trong cột đều allowRotate). */
  rotatable: boolean
  /** Có kiện dễ vỡ trong cột. */
  hasFragile: boolean
}

/** Kiện coi như "không được đè lên" nếu hở hoặc dễ vỡ. */
function acceptsLoad(t: ItemTypeInput): boolean {
  return t.stackable && !t.fragile
}

/** Tấm phẳng cứng gác cầu được: kín, không dễ vỡ, mỏng so với cạnh đáy. */
function isBridgeable(t: ItemTypeInput): boolean {
  return (
    t.stackable &&
    !t.fragile &&
    t.height <= BRIDGE_FLAT_RATIO * Math.min(t.length, t.width) + EPS
  )
}

function footprintArea(t: ItemTypeInput): number {
  return t.length * t.width
}

function stackAspect(s: Stack): number {
  return s.height / Math.min(s.footL, s.footW)
}

/** Cột KHÔNG được nằm trong vùng cửa: có hàng dễ vỡ hoặc cao mảnh. */
function isDoorUnsafe(s: Stack): boolean {
  return s.hasFragile || stackAspect(s) > MAX_DOOR_ASPECT + EPS
}

/**
 * Tìm hướng đặt (l, w) để kiện nằm gọn trong mặt (topL, topW).
 * Trả null nếu không hướng nào vừa.
 */
function fitWithin(
  t: ItemTypeInput,
  topL: number,
  topW: number,
): { l: number; w: number; rotated: boolean } | null {
  if (t.length <= topL + EPS && t.width <= topW + EPS)
    return { l: t.length, w: t.width, rotated: false }
  if (t.allowRotate && t.width <= topL + EPS && t.length <= topW + EPS)
    return { l: t.width, w: t.length, rotated: true }
  return null
}

function canPlaceOn(
  stack: Stack,
  t: ItemTypeInput,
  container: ContainerSpec,
  maxStackAspect: number,
  relaxed = false,
): { l: number; w: number; rotated: boolean } | null {
  if (!stack.open) return null
  if (stack.height + t.height > container.height + EPS) return null
  // Nguyên cột phải nằm trong 1 cont → không vượt tải cont (giữ cả ở chế độ test).
  if (stack.weight + t.weight > container.maxPayloadKg + EPS) return null
  if (!relaxed) {
    // Chống tháp mảnh dễ đổ.
    const aspect = (stack.height + t.height) / Math.min(stack.footL, stack.footW)
    if (aspect > maxStackAspect + EPS) return null
    const top = stack.units[stack.units.length - 1]
    // Nặng dưới, nhẹ trên.
    if (t.weight > top.type.weight + EPS) return null
    // Sức chịu nén của mọi kiện bên dưới.
    if (t.weight > stack.capacityLeft + EPS) return null
  }
  // Nằm gọn trong mặt kiện trên cùng (ràng buộc HÌNH HỌC — giữ cả ở chế độ test
  // để cột không lơ lửng/gác lệch).
  const top = stack.units[stack.units.length - 1]
  return fitWithin(t, top.l, top.w)
}

function pushOnto(
  stack: Stack,
  t: ItemTypeInput,
  o: { l: number; w: number; rotated: boolean },
  relaxed = false,
) {
  stack.units.push({ type: t, l: o.l, w: o.w, rotated: o.rotated, z: stack.height })
  stack.height += t.height
  stack.weight += t.weight
  const ownCap = t.maxLoadKg == null ? Infinity : t.maxLoadKg
  stack.capacityLeft = Math.min(stack.capacityLeft - t.weight, ownCap)
  // Chế độ test: cột luôn "mở" để nhồi tiếp tới trần (chỉ giới hạn chiều cao).
  stack.open = relaxed || (acceptsLoad(t) && stack.capacityLeft > EPS)
  stack.rotatable = stack.rotatable && t.allowRotate
  stack.hasFragile = stack.hasFragile || t.fragile
}

function newStack(t: ItemTypeInput, relaxed = false): Stack {
  return {
    units: [{ type: t, l: t.length, w: t.width, rotated: false, z: 0 }],
    footL: t.length,
    footW: t.width,
    height: t.height,
    weight: t.weight,
    capacityLeft: t.maxLoadKg == null ? Infinity : t.maxLoadKg,
    open: relaxed || acceptsLoad(t),
    rotatable: t.allowRotate,
    hasFragile: t.fragile,
  }
}

/** Cột gồm k kiện cùng loại, cùng hướng gốc. */
function columnOf(t: ItemTypeInput, k: number, relaxed = false): Stack {
  const s = newStack(t, relaxed)
  for (let i = 1; i < k; i++)
    pushOnto(s, t, { l: t.length, w: t.width, rotated: false }, relaxed)
  return s
}

/**
 * Xoay đa chiều (allowFlip): chọn hướng đặt nhét được NHIỀU bản nhất vào 1 cont
 * rỗng — thử cả 6 hoán vị trục, đổi kích thước kiện theo hướng thắng. Tấm phẳng
 * thường được dựng nghiêng (mặt lớn quay đứng) để tile kín hơn.
 */
function orientForPacking(t: ItemTypeInput, c: ContainerSpec): ItemTypeInput {
  if (!t.allowFlip) return t
  const d = [t.length, t.width, t.height]
  const perms: [number, number, number][] = [
    [d[0], d[1], d[2]],
    [d[0], d[2], d[1]],
    [d[1], d[0], d[2]],
    [d[1], d[2], d[0]],
    [d[2], d[0], d[1]],
    [d[2], d[1], d[0]],
  ]
  let best = { l: t.length, w: t.width, h: t.height, count: -1 }
  for (const [l, w, h] of perms) {
    if (h > c.height + EPS || l > c.length + EPS || w > c.width + EPS) continue
    const count =
      Math.floor((c.length + EPS) / l) *
      Math.floor((c.width + EPS) / w) *
      Math.floor((c.height + EPS) / h)
    if (count > best.count) best = { l, w, h, count }
  }
  if (best.count < 0) return t
  return { ...t, length: best.l, width: best.w, height: best.h }
}

/** Kiện (kể cả khi xoay) có đặt vừa vào một cont rỗng không? */
function fitsEmptyContainer(t: ItemTypeInput, c: ContainerSpec): string | null {
  if (t.weight > c.maxPayloadKg + EPS) return 'vượt tải trọng cont'
  if (t.height > c.height + EPS) return 'cao hơn lòng cont'
  const fits =
    (t.length <= c.length + EPS && t.width <= c.width + EPS) ||
    (t.allowRotate && t.width <= c.length + EPS && t.length <= c.width + EPS)
  return fits ? null : 'quá khổ so với lòng cont'
}

// ── Bước 1: gom kiện thành cột ────────────────────────────────────────────

function buildStacks(
  items: ItemTypeInput[],
  container: ContainerSpec,
  unplaced: UnplacedGroup[],
  maxStackAspect: number,
  relaxed = false,
): Stack[] {
  // Kiện vững + nặng + to xử lý trước (làm đế); dễ vỡ để sau cùng.
  const order = [...items].sort((a, b) => {
    if (a.fragile !== b.fragile) return a.fragile ? 1 : -1
    if (acceptsLoad(a) !== acceptsLoad(b)) return acceptsLoad(a) ? -1 : 1
    if (Math.abs(a.weight - b.weight) > EPS) return b.weight - a.weight
    if (Math.abs(footprintArea(a) - footprintArea(b)) > EPS)
      return footprintArea(b) - footprintArea(a)
    return b.height - a.height
  })

  const stacks: Stack[] = []
  for (const t of order) {
    const blocked = fitsEmptyContainer(t, container)
    if (blocked) {
      unplaced.push({ itemId: t.id, name: t.name, qty: t.qty, reason: blocked })
      continue
    }
    for (let i = 0; i < t.qty; i++) {
      // Ưu tiên chồng lên cột có nóc cùng loại (thành cột đều), sau đó cột
      // có mặt nóc sát kích thước nhất để đỡ phí diện tích.
      let best: {
        stack: Stack
        o: { l: number; w: number; rotated: boolean }
        score: number
      } | null = null
      for (const s of stacks) {
        const o = canPlaceOn(s, t, container, maxStackAspect, relaxed)
        if (!o) continue
        const top = s.units[s.units.length - 1]
        const sameType = top.type.id === t.id
        const waste = top.l * top.w - o.l * o.w
        const score = (sameType ? 0 : 1_000_000) + waste
        if (!best || score < best.score) best = { stack: s, o, score }
      }
      if (best) {
        pushOnto(best.stack, t, best.o, relaxed)
      } else {
        stacks.push(newStack(t, relaxed))
      }
    }
  }
  return stacks
}

// ── Bước 2: xếp cột xuống sàn cont theo skyline (bottom-left theo trục x) ───

/** Đoạn skyline: dải rộng [y, y+w) theo trục y, đã lấp tới chiều sâu x. */
type SkylineSeg = { y: number; w: number; x: number }

type Placed = {
  stack: Stack
  x: number
  y: number
  z: number
  rotated: boolean
}

/** Chọn hướng đặt cột: (depth theo trục x, w theo trục y). */
function stackOrientations(s: Stack): { depth: number; w: number; rotated: boolean }[] {
  const o = [{ depth: s.footL, w: s.footW, rotated: false }]
  if (s.rotatable && Math.abs(s.footL - s.footW) > EPS)
    o.push({ depth: s.footW, w: s.footL, rotated: true })
  return o
}

/** Chiều sâu nhỏ nhất mà cột có thể chiếm dọc cont. */
function minDepth(s: Stack): number {
  return Math.min(...stackOrientations(s).map((o) => o.depth))
}

/**
 * Vị trí đặt một kiện rộng `w` trên skyline rộng `width`: căn mép trái vào từng
 * biên đoạn, lấy x = max chiều sâu các đoạn bị phủ. Trả chỗ x nhỏ nhất (rồi y).
 */
function skylineFit(
  segs: SkylineSeg[],
  w: number,
  width: number,
): { x: number; y: number } | null {
  let best: { x: number; y: number } | null = null
  for (let i = 0; i < segs.length; i++) {
    const y = segs[i].y
    if (y + w > width + EPS) break // các đoạn sau còn xa hơn → hết chiều rộng
    let remaining = w
    let x = 0
    let j = i
    let ok = true
    while (remaining > EPS) {
      if (j >= segs.length) {
        ok = false
        break
      }
      x = Math.max(x, segs[j].x)
      remaining -= segs[j].w
      j++
    }
    if (!ok) continue
    if (!best || x < best.x - EPS || (Math.abs(x - best.x) < EPS && y < best.y - EPS))
      best = { x, y }
  }
  return best
}

/** Nâng dải [y0, y0+w) của skyline lên chiều sâu newX, gộp đoạn cùng x. */
function skylinePlace(
  segs: SkylineSeg[],
  y0: number,
  w: number,
  newX: number,
): SkylineSeg[] {
  const out: SkylineSeg[] = []
  const y1 = y0 + w
  for (const seg of segs) {
    const segEnd = seg.y + seg.w
    if (segEnd <= y0 + EPS || seg.y >= y1 - EPS) {
      out.push(seg) // ngoài dải bị phủ
      continue
    }
    if (seg.y < y0 - EPS) out.push({ y: seg.y, w: y0 - seg.y, x: seg.x }) // phần trái dư
    if (segEnd > y1 + EPS) out.push({ y: y1, w: segEnd - y1, x: seg.x }) // phần phải dư
  }
  out.push({ y: y0, w, x: newX })
  out.sort((a, b) => a.y - b.y)
  const merged: SkylineSeg[] = [out[0]]
  for (let k = 1; k < out.length; k++) {
    const last = merged[merged.length - 1]
    if (Math.abs(last.x - out[k].x) < EPS && Math.abs(last.y + last.w - out[k].y) < EPS)
      last.w += out[k].w
    else merged.push(out[k])
  }
  return merged
}

/**
 * Xếp cột vào một VÙNG chữ nhật [x0, xLimit) × [y0, y0+width) ở cao độ đáy z0.
 * doorZoneStart: cột không an toàn vùng cửa không được chạm mốc này (toạ độ x
 * tuyệt đối). z0>0 (cột trên sàn cao) luôn coi là cột cao → chặn khỏi vùng cửa.
 */
function skylineRegion(
  stacks: Stack[],
  x0: number,
  xLimit: number,
  y0: number,
  width: number,
  z0: number,
  doorZoneStart: number,
  weightBudget: number,
): { placed: Placed[]; leftover: Stack[]; weightUsed: number } {
  let segs: SkylineSeg[] = [{ y: 0, w: width, x: 0 }]
  const placed: Placed[] = []
  const leftover: Stack[] = []
  let weight = 0
  for (const s of stacks) {
    if (weight + s.weight > weightBudget + EPS) {
      leftover.push(s)
      continue
    }
    const barred = z0 > EPS ? true : isDoorUnsafe(s)
    let choice: {
      relx: number
      x: number
      y: number
      depth: number
      w: number
      rotated: boolean
    } | null = null
    for (const o of stackOrientations(s)) {
      const pos = skylineFit(segs, o.w, width)
      if (!pos) continue
      const ax = x0 + pos.x
      if (ax + o.depth > xLimit + EPS) continue
      if (barred && ax + o.depth > doorZoneStart + EPS) continue
      const cand = {
        relx: pos.x,
        x: ax,
        y: y0 + pos.y,
        depth: o.depth,
        w: o.w,
        rotated: o.rotated,
      }
      if (
        !choice ||
        cand.x < choice.x - EPS ||
        (Math.abs(cand.x - choice.x) < EPS && cand.y < choice.y - EPS)
      )
        choice = cand
    }
    if (!choice) {
      leftover.push(s)
      continue
    }
    segs = skylinePlace(segs, choice.y - y0, choice.w, choice.relx + choice.depth)
    placed.push({ stack: s, x: choice.x, y: choice.y, z: z0, rotated: choice.rotated })
    weight += s.weight
  }
  return { placed, leftover, weightUsed: weight }
}

/** Phương án cột thuần: xếp toàn bộ cột vào 1 cont (skyline toàn sàn). */
function packOneContainer(
  stacks: Stack[],
  spec: ContainerSpec,
  relaxed = false,
): { placed: Placed[]; leftover: Stack[] } {
  // Chế độ test: không chừa vùng cửa → lấp kín tới cửa (như bản xếp 1 cont thực tế).
  const zoneStart = relaxed ? spec.length + 1 : spec.length - doorZoneFor(spec)
  const { placed, leftover } = skylineRegion(
    stacks,
    0,
    spec.length,
    0,
    spec.width,
    0,
    zoneStart,
    spec.maxPayloadKg,
  )
  return { placed, leftover }
}

// ── Ghép kết quả ──────────────────────────────────────────────────────────

function emitContainer(
  placed: Placed[],
  spec: ContainerSpec,
  index: number,
): ContainerLoad {
  const placements: Placement[] = []
  // Thứ tự xếp thực tế: từ vách trong ra cửa (x), trái→phải (y), dưới→trên (z).
  const flat = [...placed].sort((a, b) => a.x - b.x || a.y - b.y || a.z - b.z)
  for (const p of flat) {
    const baseL = p.rotated ? p.stack.footW : p.stack.footL
    const baseW = p.rotated ? p.stack.footL : p.stack.footW
    let level = 0
    for (const u of p.stack.units) {
      // Xoay cả cột thì từng kiện trong cột cũng xoay theo.
      const l = p.rotated ? u.w : u.l
      const w = p.rotated ? u.l : u.w
      placements.push({
        itemId: u.type.id,
        name: u.type.name,
        // Đặt kiện vào GIỮA mặt kiện dưới — trọng tâm cân, cột vững.
        x: p.x + (baseL - l) / 2,
        y: p.y + (baseW - w) / 2,
        z: p.z + u.z,
        l,
        w,
        h: u.type.height,
        rotated: u.rotated !== p.rotated,
        weight: u.type.weight,
        fragile: u.type.fragile,
        stackable: u.type.stackable,
        maxLoadKg: u.type.maxLoadKg ?? null,
        level: level++,
        order: 0, // đánh số sau khi gom đủ mọi cont
      })
    }
  }
  const usedWeightKg = flat.reduce((s, p) => s + p.stack.weight, 0)
  const usedVolumeM3 = placements.reduce((s, p) => s + (p.l * p.w * p.h) / 1e6, 0)
  const containerVolumeM3 = (spec.length * spec.width * spec.height) / 1e6
  return {
    index,
    spec,
    placements,
    usedWeightKg,
    usedVolumeM3,
    volumeUtilization:
      containerVolumeM3 > 0 ? (usedVolumeM3 / containerVolumeM3) * 100 : 0,
    weightUtilization:
      spec.maxPayloadKg > 0 ? (usedWeightKg / spec.maxPayloadKg) * 100 : 0,
  }
}

// ── Phương án CỘT THUẦN ─────────────────────────────────────────────────────

function packColumns(
  valid: ItemTypeInput[],
  container: ContainerSpec,
  maxStackAspect: number,
  relaxed = false,
): { containers: ContainerLoad[]; unplaced: UnplacedGroup[] } {
  const unplaced: UnplacedGroup[] = []
  let remaining = buildStacks(valid, container, unplaced, maxStackAspect, relaxed)

  // Cột dễ vỡ/cao mảnh phải nằm ngoài vùng cửa → cần lọt vào phần sát vách.
  // Chế độ test: không chừa vùng cửa nên không loại cột nào vì lý do này.
  const wallDepth = container.length - doorZoneFor(container)
  if (!relaxed) {
    remaining = remaining.filter((s) => {
      if (isDoorUnsafe(s) && minDepth(s) > wallDepth + EPS) {
        for (const u of s.units) {
          unplaced.push({
            itemId: u.type.id,
            name: u.type.name,
            qty: 1,
            reason: 'kiện dễ vỡ/cao mảnh không có chỗ an toàn xa cửa cont',
          })
        }
        return false
      }
      return true
    })
  }

  // Cột không an toàn vùng cửa xếp trước (giành chỗ sát vách), rồi cao → thấp,
  // to → nhỏ. Skyline đặt x nhỏ trước nên cột cao/unsafe dồn về vách, thấp ra cửa.
  remaining.sort((a, b) => {
    const ua = isDoorUnsafe(a)
    const ub = isDoorUnsafe(b)
    if (ua !== ub) return ua ? -1 : 1
    if (Math.abs(a.height - b.height) > EPS) return b.height - a.height
    return b.footL * b.footW - a.footL * a.footW || b.weight - a.weight
  })

  const containers: ContainerLoad[] = []
  while (remaining.length > 0) {
    const { placed, leftover } = packOneContainer(remaining, container, relaxed)
    if (placed.length === 0) {
      for (const s of leftover) {
        for (const u of s.units) {
          unplaced.push({
            itemId: u.type.id,
            name: u.type.name,
            qty: 1,
            reason: 'không xếp được',
          })
        }
      }
      break
    }
    containers.push(emitContainer(placed, container, containers.length))
    remaining = leftover
  }
  return { containers, unplaced }
}

// ── Phương án GÁC TẤM (bridging) ────────────────────────────────────────────

type Pool = { t: ItemTypeInput; n: number }

/** Hướng lát nền tối ưu cho type trong vùng X×Y (nhiều ô nhất). */
function bestTiling(
  t: ItemTypeInput,
  X: number,
  Y: number,
): { dl: number; dw: number; rotated: boolean; cols: number } {
  const cellCount = (dl: number, dw: number) =>
    Math.floor((X + EPS) / dl) * Math.floor((Y + EPS) / dw)
  let best = {
    dl: t.length,
    dw: t.width,
    rotated: false,
    cols: cellCount(t.length, t.width),
  }
  if (t.allowRotate) {
    const b = {
      dl: t.width,
      dw: t.length,
      rotated: true,
      cols: cellCount(t.width, t.length),
    }
    if (b.cols > best.cols) best = b
  }
  return best
}

/** Giảm pool theo các cột đã đặt. */
function consume(pools: Map<string, Pool>, placed: Placed[]): void {
  for (const p of placed) {
    const pool = pools.get(p.stack.units[0].type.id)
    if (pool) pool.n -= p.stack.units.length
  }
}

/** Xếp gác tấm cho MỘT cont; giảm pools; trả cột đã đặt (rỗng nếu bó tay). */
function packBridgedContainer(
  pools: Map<string, Pool>,
  spec: ContainerSpec,
  maxStackAspect: number,
  forceBaseK?: number,
  relaxed = false,
): Placed[] {
  // Chế độ test: không chừa vùng cửa → deck + phần còn lại lấp kín tới cửa.
  const zoneStart = relaxed ? spec.length + 1 : spec.length - doorZoneFor(spec)
  const placed: Placed[] = []
  let weight = 0

  // Đế = kiện KHÔNG phẳng, kín, không dễ vỡ, còn nhiều nhất (vd cột ghế).
  const base = [...pools.values()]
    .filter((p) => p.n > 0 && !isBridgeable(p.t) && p.t.stackable && !p.t.fragile)
    .sort((a, b) => b.n - a.n || footprintArea(b.t) - footprintArea(a.t))[0]

  let deckRect: { x1: number; y1: number } | null = null
  let deckZ = 0

  if (base) {
    const t = base.t
    const tile = bestTiling(t, zoneStart, spec.width)
    const nx = Math.floor((zoneStart + EPS) / tile.dl)
    const ny = Math.floor((spec.width + EPS) / tile.dw)
    if (nx >= 1 && ny >= 1) {
      const kAsp = Math.floor(
        (maxStackAspect * Math.min(t.length, t.width)) / t.height + EPS,
      )
      const kH = Math.floor((spec.height + EPS) / t.height)
      const kMax = relaxed ? Math.max(1, kH) : Math.max(1, Math.min(kAsp, kH))
      const cols = nx * ny
      let k =
        forceBaseK != null
          ? Math.max(1, Math.min(kMax, forceBaseK))
          : Math.max(1, Math.min(kMax, Math.ceil(base.n / cols)))
      // Chừa chỗ cho ít nhất 1 lớp tấm gác phía trên.
      const bridges = [...pools.values()].filter((p) => p.n > 0 && isBridgeable(p.t))
      const minBridgeH = bridges.length
        ? Math.min(...bridges.map((p) => p.t.height))
        : Infinity
      while (k > 1 && spec.height - k * t.height < minBridgeH) k--
      deckZ = k * t.height

      // Lát nền một HÌNH CHỮ NHẬT đầy đủ cột đế (gx × gy) để nóc liền, đỡ được tấm.
      const fullCols = Math.floor(base.n / k)
      if (fullCols >= 1) {
        let gx: number
        let gy: number
        if (fullCols >= ny) {
          gy = ny
          gx = Math.min(nx, Math.floor(fullCols / ny))
        } else {
          gy = fullCols
          gx = 1
        }
        for (let i = 0; i < gx; i++) {
          for (let j = 0; j < gy; j++) {
            if (base.n < k) break
            const col = columnOf(t, k, relaxed)
            if (weight + col.weight > spec.maxPayloadKg + EPS) break
            placed.push({
              stack: col,
              x: i * tile.dl,
              y: j * tile.dw,
              z: 0,
              rotated: tile.rotated,
            })
            weight += col.weight
            base.n -= k
          }
        }
        if (placed.length > 0) deckRect = { x1: gx * tile.dl, y1: gy * tile.dw }
      }
    }
  }

  // Sàn deck: gác tấm phẳng lên nóc khối đế, xếp cột tấm tới trần — nhưng chỉ
  // tới mức TỪNG cột đế còn chịu nổi. Sức chịu 1 cột đế = maxLoadKg (nếu khai)
  // hoặc chính cân nặng nó (proxy thận trọng khi chưa biết độ cứng), khớp đúng
  // luật audit. Nhờ vậy deck sinh ra luôn an toàn: khai maxLoadKg cao → deck dày,
  // không khai → deck mỏng / không có (rơi về cột thuần).
  if (base && deckRect && deckZ > 0) {
    const bt = base.t
    const baseTopArea = bt.length * bt.width
    // Chế độ test: cột đế coi như chịu vô hạn → deck nhồi tới trần.
    const baseCap = relaxed ? Infinity : (bt.maxLoadKg ?? bt.weight)
    const nBaseCols = placed.length
    const availH = spec.height - deckZ
    const deckStacks: Stack[] = []
    for (const p of pools.values()) {
      if (p.n <= 0 || !isBridgeable(p.t)) continue
      const t = p.t
      const kAsp = relaxed
        ? Infinity
        : Math.floor((maxStackAspect * Math.min(t.length, t.width)) / t.height + EPS)
      const kH = Math.floor((availH + EPS) / t.height)
      // Giới hạn chồng tấm để tải dồn xuống 1 cột đế (phần đáy tấm phủ 1 nóc đế)
      // không vượt sức chịu cột đế: k·w·(nócĐế/diệnTấm) ≤ baseCap.
      const panelArea = t.length * t.width
      const share = Math.min(baseTopArea, panelArea) / panelArea
      const kCap =
        t.weight * share > EPS
          ? Math.floor((baseCap + EPS) / (t.weight * share))
          : Infinity
      const k = Math.max(0, Math.min(kAsp, kH, kCap))
      if (k < 1) continue
      const full = Math.floor(p.n / k)
      const rem = p.n - full * k
      for (let i = 0; i < full; i++) deckStacks.push(columnOf(t, k, relaxed))
      if (rem > 0) deckStacks.push(columnOf(t, rem, relaxed))
    }
    deckStacks.sort((a, b) => b.footL * b.footW - a.footL * a.footW)
    // Tổng tải deck ≤ (số cột đế) × (sức chịu mỗi cột) — chặn quá tải bình quân.
    const deckBudget = Math.min(spec.maxPayloadKg - weight, nBaseCols * baseCap)
    const res = skylineRegion(
      deckStacks,
      0,
      deckRect.x1,
      0,
      deckRect.y1,
      deckZ,
      zoneStart,
      deckBudget,
    )
    consume(pools, res.placed)
    placed.push(...res.placed)
    weight += res.weightUsed
  }

  // Sàn còn lại (dải sau khối đế → cửa): xếp cột thường cho phần còn tồn.
  const restStacks: Stack[] = []
  for (const p of pools.values()) {
    if (p.n <= 0) continue
    const t = p.t
    const kAsp = relaxed
      ? Infinity
      : Math.floor((maxStackAspect * Math.min(t.length, t.width)) / t.height + EPS)
    const kH = Math.floor((spec.height + EPS) / t.height)
    const k = Math.max(1, Math.min(kAsp, kH))
    const full = Math.floor(p.n / k)
    const rem = p.n - full * k
    for (let i = 0; i < full; i++) restStacks.push(columnOf(t, k, relaxed))
    if (rem > 0) restStacks.push(columnOf(t, rem, relaxed))
  }
  restStacks.sort((a, b) => {
    const ua = isDoorUnsafe(a)
    const ub = isDoorUnsafe(b)
    if (ua !== ub) return ua ? -1 : 1
    return b.footL * b.footW - a.footL * a.footW
  })
  const restX0 = deckRect ? deckRect.x1 : 0
  const rest = skylineRegion(
    restStacks,
    restX0,
    spec.length,
    0,
    spec.width,
    0,
    zoneStart,
    spec.maxPayloadKg - weight,
  )
  consume(pools, rest.placed)
  placed.push(...rest.placed)
  weight += rest.weightUsed

  return placed
}

function packBridged(
  valid: ItemTypeInput[],
  container: ContainerSpec,
  maxStackAspect: number,
  relaxed = false,
): ContainerLoad[] | null {
  // Gác tấm chỉ có ý nghĩa khi có CẢ tấm phẳng lẫn kiện đế.
  const hasBridge = valid.some(
    (t) => isBridgeable(t) && fitsEmptyContainer(t, container) === null,
  )
  const hasBase = valid.some(
    (t) =>
      !isBridgeable(t) &&
      t.stackable &&
      !t.fragile &&
      fitsEmptyContainer(t, container) === null,
  )
  if (!hasBridge || !hasBase) return null
  // Kiện quá khổ đưa hết vào pool sẽ không đặt được → để phương án cột lo.
  if (valid.some((t) => fitsEmptyContainer(t, container) !== null)) return null

  // Chiều cao đế k đánh đổi diện tích deck (k thấp → deck rộng hơn) với số cột đế
  // trên sàn. Quét mọi k khả dĩ, chọn phương án ít cont nhất (rồi cont đầu đầy nhất).
  const baseType = valid
    .filter((t) => !isBridgeable(t) && t.stackable && !t.fragile)
    .sort((a, b) => b.qty - a.qty || footprintArea(b) - footprintArea(a))[0]
  const kAsp = Math.floor(
    (maxStackAspect * Math.min(baseType.length, baseType.width)) / baseType.height + EPS,
  )
  const kH = Math.floor((container.height + EPS) / baseType.height)
  const kMax = relaxed ? Math.max(1, kH) : Math.max(1, Math.min(kAsp, kH))

  // Chạy 1 chiến lược xếp-1-cont lặp lại cho tới khi hết hàng.
  const runStrategy = (
    fill: (pools: Map<string, Pool>) => Placed[],
  ): ContainerLoad[] | null => {
    const pools = new Map<string, Pool>(valid.map((t) => [t.id, { t, n: t.qty }]))
    const containers: ContainerLoad[] = []
    let guard = 0
    while ([...pools.values()].some((p) => p.n > 0)) {
      if (++guard > 500) return null
      const placed = fill(pools)
      if (placed.length === 0) return null
      containers.push(emitContainer(placed, container, containers.length))
    }
    return containers
  }

  // Ứng viên: quét chiều cao đế (k thấp → deck rộng). Chọn phương án audit sạch,
  // ít cont nhất, rồi cont đầu đầy nhất.
  const candidates: (ContainerLoad[] | null)[] = []
  for (let k = 1; k <= kMax; k++)
    candidates.push(
      runStrategy((pools) =>
        packBridgedContainer(pools, container, maxStackAspect, k, relaxed),
      ),
    )

  let best: ContainerLoad[] | null = null
  for (const cand of candidates) {
    if (!cand || auditPacking(cand, { geometryOnly: relaxed }).length > 0) continue
    if (
      !best ||
      cand.length < best.length ||
      (cand.length === best.length &&
        (cand[0]?.volumeUtilization ?? 0) > (best[0]?.volumeUtilization ?? 0))
    )
      best = cand
  }
  return best
}

/**
 * Tính phương án xếp toàn bộ kiện vào (nhiều) cont cùng loại.
 * Ném Error nếu tổng số kiện vượt MAX_UNITS.
 */
export function pack(
  items: ItemTypeInput[],
  container: ContainerSpec,
  opts: PackOptions = {},
): PackResult {
  const maxStackAspect = opts.maxStackAspect ?? MAX_STACK_ASPECT
  const relaxed = opts.ignoreStackSafety ?? false
  const valid = items.filter(
    (t) => t.qty > 0 && t.length > 0 && t.width > 0 && t.height > 0,
  )
  const totalUnits = valid.reduce((s, t) => s + t.qty, 0)
  if (totalUnits > MAX_UNITS) {
    throw new Error(`Tối đa ${MAX_UNITS} kiện mỗi lần tính (đang có ${totalUnits}).`)
  }

  // Dựng phương án từ 1 bộ kiện: cột thuần, rồi thử gác tấm nếu bật.
  const buildPlan = (vs: ItemTypeInput[]) => {
    const column = packColumns(vs, container, maxStackAspect, relaxed)
    let containers = column.containers
    const unplaced = column.unplaced
    if (opts.allowBridging) {
      const bridged = packBridged(vs, container, maxStackAspect, relaxed)
      if (bridged && auditPacking(bridged, { geometryOnly: relaxed }).length === 0) {
        const bridgedPlaced = bridged.reduce((s, c) => s + c.placements.length, 0)
        if (bridgedPlaced === totalUnits && bridged.length <= containers.length) {
          const better =
            bridged.length < containers.length ||
            (bridged[0]?.volumeUtilization ?? 0) > (containers[0]?.volumeUtilization ?? 0)
          if (better) {
            containers = bridged.map((c, i) => ({ ...c, index: i }))
            unplaced.length = 0
          }
        }
      }
    }
    return { containers, unplaced }
  }

  // Phương án A: giữ nguyên hướng kiện.
  let plan = buildPlan(valid)
  // Phương án B (xoay đa chiều): nếu có kiện allowFlip, thử đưa chúng về hướng
  // đặt được nhiều bản nhất rồi xếp lại — CHỈ dùng nếu tốt hơn (ít cont hơn, rồi
  // cont đầu đầy hơn). Nhờ vậy bật "Lật" không bao giờ làm kết quả tệ đi.
  if (valid.some((t) => t.allowFlip)) {
    const oriented = valid.map((t) => orientForPacking(t, container))
    const alt = buildPlan(oriented)
    const placed = (p: { containers: ContainerLoad[] }) =>
      p.containers.reduce((s, c) => s + c.placements.length, 0)
    const betterAlt =
      placed(alt) > placed(plan) ||
      (placed(alt) === placed(plan) &&
        (alt.containers.length < plan.containers.length ||
          (alt.containers.length === plan.containers.length &&
            (alt.containers[0]?.volumeUtilization ?? 0) >
              (plan.containers[0]?.volumeUtilization ?? 0))))
    if (betterAlt) plan = alt
  }

  const { containers, unplaced } = plan
  // Đánh số thứ tự xếp xuyên suốt.
  let order = 1
  for (const c of containers) {
    for (const p of c.placements) p.order = order++
  }

  const placedUnits = containers.reduce((s, c) => s + c.placements.length, 0)
  return { containers, unplaced: mergeUnplaced(unplaced), totalUnits, placedUnits }
}

function mergeUnplaced(groups: UnplacedGroup[]): UnplacedGroup[] {
  const map = new Map<string, UnplacedGroup>()
  for (const g of groups) {
    const key = `${g.itemId}|${g.reason}`
    const cur = map.get(key)
    if (cur) cur.qty += g.qty
    else map.set(key, { ...g })
  }
  return [...map.values()]
}
