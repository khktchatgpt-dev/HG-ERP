/**
 * Kiểm tra an toàn ĐỘC LẬP với thuật toán xếp: đọc lại toàn bộ toạ độ kiện
 * và xác minh từng quy tắc vật lý. Dùng trong test và chạy lại trên UI sau
 * mỗi lần tính — kỳ vọng luôn trả về mảng rỗng.
 *
 * Hỗ trợ cả GÁC TẤM (bridging): một kiện có thể tựa trên NHIỀU kiện đỡ cùng
 * độ cao, miễn đáy nó được đỡ gần như kín (≥ COVER_MIN) — kiện phẳng cứng gác
 * ngang qua các cột. Tải trọng phía trên phân bổ xuống các kiện đỡ theo tỉ lệ
 * diện tích tiếp xúc để kiểm sức chịu nén.
 */

import type { AuditOptions, AuditViolation, ContainerLoad, Placement } from './types'
import { doorZoneFor, MAX_DOOR_ASPECT } from './types'

const EPS = 0.01 // cm / kg — dung sai số thực
const SUP_TOL = 0.5 // cm — dung sai cao độ coi là "tựa lên"
const COVER_MIN = 0.8 // đáy phải được đỡ ≥ 80% diện tích (còn lại là khe nhỏ)

function overlapLen(a0: number, a1: number, b0: number, b1: number): number {
  return Math.max(0, Math.min(a1, b1) - Math.max(a0, b0))
}

function overlap1D(a0: number, a1: number, b0: number, b1: number): boolean {
  return a0 < b1 - EPS && b0 < a1 - EPS
}

function boxesOverlap(a: Placement, b: Placement): boolean {
  return (
    overlap1D(a.x, a.x + a.l, b.x, b.x + b.l) &&
    overlap1D(a.y, a.y + a.w, b.y, b.y + b.w) &&
    overlap1D(a.z, a.z + a.h, b.z, b.z + b.h)
  )
}

/** Diện tích mặt đáy `above` chồng lên mặt nóc `below` (cm²). */
function contactArea(below: Placement, above: Placement): number {
  return (
    overlapLen(below.x, below.x + below.l, above.x, above.x + above.l) *
    overlapLen(below.y, below.y + below.w, above.y, above.y + above.w)
  )
}

/** Các kiện đỡ trực tiếp dưới `p` (nóc chạm đáy p, có phủ diện tích). */
function supportsOf(p: Placement, all: Placement[]): Placement[] {
  if (p.z <= SUP_TOL) return [] // nằm sàn
  return all.filter(
    (q) => q !== p && Math.abs(q.z + q.h - p.z) <= SUP_TOL && contactArea(q, p) > EPS,
  )
}

/** Các kiện tựa trực tiếp lên nóc `b`. */
function restersOn(b: Placement, all: Placement[]): Placement[] {
  return all.filter(
    (q) => q !== b && Math.abs(b.z + b.h - q.z) <= SUP_TOL && contactArea(b, q) > EPS,
  )
}

export function auditPacking(
  containers: ContainerLoad[],
  opts: AuditOptions = {},
): AuditViolation[] {
  // Chế độ nhồi tối đa (geometryOnly): chỉ giữ hình học + tải cont; bỏ mọi luật
  // an toàn chồng VÀ an toàn vùng cửa. Các rule sau bị tắt khi geometryOnly.
  const SOFT_RULES: ReadonlySet<AuditViolation['rule']> = new Set([
    'heavier_above',
    'max_load_exceeded',
    'stacked_on_unstackable',
    'stacked_on_fragile',
    'fragile_at_door',
    'unstable_at_door',
  ])
  const violations: AuditViolation[] = []
  const add = (containerIndex: number, rule: AuditViolation['rule'], message: string) => {
    if (opts.geometryOnly && SOFT_RULES.has(rule)) return
    violations.push({ containerIndex, rule, message })
  }

  for (const c of containers) {
    const { spec, placements } = c
    const label = (p: Placement) => `"${p.name}" (kiện #${p.order})`

    // Tải trọng cont.
    const totalWeight = placements.reduce((s, p) => s + p.weight, 0)
    if (totalWeight > spec.maxPayloadKg + EPS) {
      add(
        c.index,
        'payload_exceeded',
        `Cont ${c.index + 1} chở ${totalWeight} kg > tải ${spec.maxPayloadKg} kg`,
      )
    }

    // Tải phía trên mỗi kiện (phân bổ theo tỉ lệ diện tích tiếp xúc), tính từ
    // trên xuống để cộng dồn qua nhiều tầng — dùng cho kiểm sức chịu nén.
    const borne = new Map<Placement, number>()
    const byZDesc = [...placements].sort((a, b) => b.z - a.z)
    for (const p of byZDesc) {
      const passDown = p.weight + (borne.get(p) ?? 0)
      const sups = supportsOf(p, placements)
      const totalContact = sups.reduce((s, q) => s + contactArea(q, p), 0)
      if (totalContact <= EPS) continue
      for (const q of sups) {
        const share = contactArea(q, p) / totalContact
        borne.set(q, (borne.get(q) ?? 0) + passDown * share)
      }
    }

    for (const p of placements) {
      // Trong lòng cont.
      if (
        p.x < -EPS ||
        p.y < -EPS ||
        p.z < -EPS ||
        p.x + p.l > spec.length + EPS ||
        p.y + p.w > spec.width + EPS ||
        p.z + p.h > spec.height + EPS
      ) {
        add(c.index, 'out_of_bounds', `${label(p)} vượt ra ngoài lòng cont`)
      }

      // Không lơ lửng: trên sàn hoặc được đỡ (đủ diện tích) bởi kiện bên dưới.
      if (p.z > SUP_TOL) {
        const sups = supportsOf(p, placements)
        const cover = sups.reduce((s, q) => s + contactArea(q, p), 0) / (p.l * p.w)
        if (sups.length === 0 || cover < COVER_MIN - EPS) {
          add(c.index, 'floating', `${label(p)} không được đỡ đủ dưới đáy`)
        } else {
          // Phân loại kiểu đỡ:
          //  • CHỒNG CỘT: một kiện đỡ ôm gần kín đáy p (≥ COVER_MIN) → áp luật
          //    nặng-dưới-nhẹ-trên trực tiếp (kiện trên không nặng hơn kiện đỡ).
          //  • GÁC TẤM: p tựa trên nhiều cột, không cột nào ôm kín → tải phân bổ,
          //    an toàn nén do kiểm borne ≤ sức chịu của TỪNG cột đỡ (khối bên dưới).
          const carrier = sups.find(
            (q) => contactArea(q, p) >= COVER_MIN * p.l * p.w - EPS,
          )
          if (carrier) {
            if (p.weight > carrier.weight + EPS) {
              add(
                c.index,
                'heavier_above',
                `${label(p)} (${p.weight} kg) nặng hơn kiện đỡ "${carrier.name}" (${carrier.weight} kg)`,
              )
            }
          }
          for (const q of sups) {
            if (!q.stackable) {
              add(
                c.index,
                'stacked_on_unstackable',
                `${label(p)} đè lên kiện hở "${q.name}"`,
              )
              break
            }
          }
          for (const q of sups) {
            if (q.fragile) {
              add(
                c.index,
                'stacked_on_fragile',
                `${label(p)} đè lên kiện dễ vỡ "${q.name}"`,
              )
              break
            }
          }
        }
      }

      // Sức chịu nén: tổng tải phân bổ lên nóc p ≤ sức chịu của p.
      //  • Có khai maxLoadKg → dùng đúng con số đó.
      //  • Không khai nhưng p đang ĐỠ MỘT TẤM GÁC (kiện trên phủ chưa kín đáy nó,
      //    tức tải tới từ tấm gác phân bổ) → lấy chính cân nặng p làm hạn thận
      //    trọng (cột chỉ nhận thêm tải gác ≤ khối lượng bản thân khi chưa biết
      //    độ cứng). Cột chồng cùng loại (phủ kín) không bị hạn này — vẫn chồng cao.
      const bearsBridge = restersOn(p, placements).some(
        (r) => contactArea(p, r) < COVER_MIN * r.l * r.w - EPS,
      )
      const cap = p.maxLoadKg ?? (bearsBridge ? p.weight : Infinity)
      if (Number.isFinite(cap)) {
        const above = borne.get(p) ?? 0
        if (above > cap + EPS) {
          add(
            c.index,
            'max_load_exceeded',
            `${label(p)} chịu ${above.toFixed(1)} kg > sức chịu ${cap.toFixed(1)} kg`,
          )
        }
      }
    }

    // ── Vùng cửa: khi mở cửa không còn gì chặn hàng ──
    const zoneStart = spec.length - doorZoneFor(spec)
    const inDoorZone = (p: Placement) => p.x + p.l > zoneStart + EPS
    for (const p of placements) {
      if (p.fragile && inDoorZone(p)) {
        add(
          c.index,
          'fragile_at_door',
          `${label(p)} là hàng dễ vỡ nhưng nằm trong vùng cửa cont`,
        )
      }
    }
    // Cột (kiện sàn + mọi kiện chồng/gác lên) trong vùng cửa phải thấp và vững.
    for (const base of placements.filter((p) => p.z <= SUP_TOL)) {
      let colTop = base.z + base.h
      let layer = [base]
      const seen = new Set<Placement>([base])
      while (layer.length > 0) {
        const next: Placement[] = []
        for (const b of layer) {
          for (const q of restersOn(b, placements)) {
            if (seen.has(q)) continue
            seen.add(q)
            colTop = Math.max(colTop, q.z + q.h)
            next.push(q)
          }
        }
        layer = next
      }
      const aspect = colTop / Math.min(base.l, base.w)
      if (inDoorZone(base) && aspect > MAX_DOOR_ASPECT + 0.01) {
        add(
          c.index,
          'unstable_at_door',
          `Cột tại ${label(base)} cao ${colTop} cm trên đáy ${Math.min(base.l, base.w)} cm — quá mảnh để nằm trong vùng cửa`,
        )
      }
    }

    // Không kiện nào chèn vào nhau.
    for (let i = 0; i < placements.length; i++) {
      for (let j = i + 1; j < placements.length; j++) {
        if (boxesOverlap(placements[i], placements[j])) {
          add(
            c.index,
            'overlap',
            `${label(placements[i])} chèn vào ${label(placements[j])}`,
          )
        }
      }
    }
  }
  return violations
}
