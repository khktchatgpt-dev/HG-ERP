import { describe, expect, it } from 'vitest'
import { auditPacking } from './audit'
import { MAX_UNITS, pack } from './pack'
import type { ContainerSpec, ItemTypeInput } from './types'
import { CONTAINER_PRESETS, doorZoneFor, MAX_STACK_ASPECT } from './types'

const CONT_20: ContainerSpec = CONTAINER_PRESETS[0]

/** Cont nhỏ để test biên cho dễ tính tay: 100×100×100 cm, tải 1000 kg. */
const MINI: ContainerSpec = {
  key: 'mini',
  name: 'Mini',
  length: 100,
  width: 100,
  height: 100,
  maxPayloadKg: 1000,
}

let seq = 0
function item(over: Partial<ItemTypeInput>): ItemTypeInput {
  return {
    id: `it-${++seq}`,
    name: over.name ?? `Kiện ${seq}`,
    length: 50,
    width: 50,
    height: 50,
    weight: 10,
    qty: 1,
    allowRotate: true,
    stackable: true,
    fragile: false,
    maxLoadKg: null,
    ...over,
  }
}

function allPlacements(result: ReturnType<typeof pack>) {
  return result.containers.flatMap((c) => c.placements)
}

describe('pack — cơ bản', () => {
  it('xếp 1 kiện vào 1 cont', () => {
    const r = pack([item({})], MINI)
    expect(r.containers).toHaveLength(1)
    expect(r.placedUnits).toBe(1)
    expect(r.unplaced).toHaveLength(0)
    expect(auditPacking(r.containers)).toHaveLength(0)
  })

  it('lấp đầy đúng: 8 kiện 50³ vừa khít cont 100³', () => {
    const r = pack([item({ qty: 8 })], MINI)
    expect(r.containers).toHaveLength(1)
    expect(r.placedUnits).toBe(8)
    expect(r.containers[0].volumeUtilization).toBeCloseTo(100, 1)
    expect(auditPacking(r.containers)).toHaveLength(0)
  })

  it('tràn sang cont thứ 2 khi hết chỗ', () => {
    const r = pack([item({ qty: 9 })], MINI)
    expect(r.containers).toHaveLength(2)
    expect(r.placedUnits).toBe(9)
    expect(auditPacking(r.containers)).toHaveLength(0)
  })

  it('kiện quá khổ → unplaced kèm lý do', () => {
    const r = pack([item({ length: 120, allowRotate: false, qty: 2 })], MINI)
    expect(r.placedUnits).toBe(0)
    expect(r.unplaced).toEqual([
      expect.objectContaining({ qty: 2, reason: 'quá khổ so với lòng cont' }),
    ])
  })

  it('xoay ngang để vừa cont khi allowRotate', () => {
    // 120 dài hơn lòng 100 nhưng xoay thì chiều 120 nằm theo trục nào cũng
    // không vừa → thử case xoay thật: kiện 90×40 vào cont rộng 100: dọc vừa.
    const r = pack([item({ length: 40, width: 90, height: 50 })], MINI)
    expect(r.placedUnits).toBe(1)
    expect(auditPacking(r.containers)).toHaveLength(0)
  })

  it('vượt quá MAX_UNITS thì báo lỗi rõ ràng', () => {
    expect(() => pack([item({ qty: MAX_UNITS + 1 })], MINI)).toThrow(/Tối đa/)
  })
})

describe('pack — an toàn xếp chồng', () => {
  it('không bao giờ đặt kiện nặng lên kiện nhẹ hơn', () => {
    const r = pack(
      [
        item({ name: 'Nhẹ', weight: 5, qty: 4, length: 50, width: 50, height: 30 }),
        item({ name: 'Nặng', weight: 50, qty: 4, length: 50, width: 50, height: 30 }),
      ],
      MINI,
    )
    expect(r.placedUnits).toBe(8)
    expect(auditPacking(r.containers)).toHaveLength(0)
    // Kiện nặng phải nằm tầng dưới kiện nhẹ ở mọi cột.
    for (const c of r.containers) {
      for (const p of c.placements) {
        if (p.name === 'Nặng') {
          const lighterBelow = c.placements.find(
            (q) => q.name === 'Nhẹ' && q.x === p.x && q.y === p.y && q.z < p.z,
          )
          expect(lighterBelow).toBeUndefined()
        }
      }
    }
  })

  it('kiện hở (stackable=false) không bị đè lên', () => {
    const r = pack(
      [
        item({ name: 'Hở', stackable: false, qty: 2, height: 30 }),
        item({ name: 'Kín', qty: 6, height: 30, weight: 5 }),
      ],
      MINI,
    )
    expect(r.placedUnits).toBe(8)
    expect(auditPacking(r.containers)).toHaveLength(0)
  })

  it('kiện dễ vỡ không bị đè lên, kể cả bởi kiện dễ vỡ khác', () => {
    const r = pack(
      [
        item({ name: 'Dễ vỡ', fragile: true, qty: 3, height: 30, weight: 1 }),
        item({ name: 'Thường', qty: 5, height: 30, weight: 20 }),
      ],
      MINI,
    )
    expect(auditPacking(r.containers)).toHaveLength(0)
    for (const c of r.containers) {
      for (const p of c.placements.filter((p) => p.fragile)) {
        const onTop = c.placements.find(
          (q) =>
            q !== p &&
            Math.abs(q.z - (p.z + p.h)) < 0.01 &&
            q.x < p.x + p.l &&
            q.x + q.l > p.x &&
            q.y < p.y + p.w &&
            q.y + q.w > p.y,
        )
        expect(onTop).toBeUndefined()
      }
    }
  })

  it('tôn trọng maxLoadKg — không chồng quá sức chịu', () => {
    // Mỗi kiện 20kg chỉ chịu được 20kg trên nóc → cột tối đa 2 tầng.
    const r = pack([item({ qty: 8, weight: 20, maxLoadKg: 20, height: 20 })], MINI)
    expect(r.placedUnits).toBe(8)
    expect(auditPacking(r.containers)).toHaveLength(0)
    for (const p of allPlacements(r)) expect(p.level).toBeLessThanOrEqual(1)
  })

  it('maxLoadKg cộng dồn qua nhiều tầng', () => {
    // Đế chịu tối đa 30kg; 2 kiện 15kg chồng lên là chạm trần → không tầng 4.
    const r = pack(
      [
        item({ name: 'Đế', weight: 40, maxLoadKg: 30, height: 20, qty: 1 }),
        item({
          name: 'Trên',
          weight: 15,
          maxLoadKg: null,
          height: 20,
          qty: 3,
          length: 40,
          width: 40,
        }),
      ],
      MINI,
    )
    expect(auditPacking(r.containers)).toHaveLength(0)
  })

  it('kiện trên phải nằm gọn trong mặt kiện dưới (không gác lệch)', () => {
    const r = pack(
      [
        item({ name: 'To', length: 60, width: 60, height: 30, weight: 30, qty: 2 }),
        item({ name: 'Nhỏ', length: 30, width: 30, height: 30, weight: 5, qty: 6 }),
      ],
      MINI,
    )
    expect(auditPacking(r.containers)).toHaveLength(0)
  })

  it('không vượt tải trọng cont — tràn cont theo cân nặng', () => {
    // 30 kiện × 100kg = 3000kg > tải 1000kg dù thể tích dư sức.
    const r = pack(
      [item({ qty: 30, weight: 100, length: 20, width: 20, height: 20 })],
      MINI,
    )
    expect(r.placedUnits).toBe(30)
    expect(r.containers.length).toBeGreaterThanOrEqual(3)
    expect(auditPacking(r.containers)).toHaveLength(0)
  })

  it('kiện nặng hơn tải cont → unplaced', () => {
    const r = pack([item({ weight: 2000 })], MINI)
    expect(r.placedUnits).toBe(0)
    expect(r.unplaced[0].reason).toBe('vượt tải trọng cont')
  })
})

describe('pack — an toàn vùng cửa cont', () => {
  it('hàng dễ vỡ không bao giờ nằm trong vùng cửa', () => {
    const r = pack(
      [
        item({ name: 'Thường', length: 50, width: 50, height: 50, weight: 40, qty: 80 }),
        item({
          name: 'Dễ vỡ',
          length: 50,
          width: 50,
          height: 50,
          weight: 10,
          qty: 12,
          fragile: true,
        }),
      ],
      CONT_20,
    )
    expect(r.unplaced).toHaveLength(0)
    expect(auditPacking(r.containers)).toHaveLength(0)
    for (const c of r.containers) {
      const zoneStart = c.spec.length - doorZoneFor(c.spec)
      for (const p of c.placements.filter((p) => p.fragile)) {
        expect(p.x + p.l).toBeLessThanOrEqual(zoneStart + 0.01)
      }
    }
  })

  it('cột cao mảnh (vd kính dựng đứng) không nằm trong vùng cửa', () => {
    const r = pack(
      [
        item({
          name: 'Kính',
          length: 100,
          width: 20,
          height: 120,
          weight: 80,
          qty: 6,
          fragile: true,
        }),
        item({ name: 'Thùng', length: 60, width: 60, height: 60, weight: 50, qty: 30 }),
      ],
      CONT_20,
    )
    expect(r.unplaced).toHaveLength(0)
    expect(auditPacking(r.containers)).toHaveLength(0)
  })

  it('không chồng thành tháp mảnh dễ đổ (aspect ≤ MAX_STACK_ASPECT)', () => {
    // 20×20 đáy, cao 20 → tối đa 3 tầng (60/20 = 3), dù chịu tải thoải mái.
    const r = pack(
      [item({ length: 20, width: 20, height: 20, weight: 5, qty: 50 })],
      CONT_20,
    )
    expect(auditPacking(r.containers)).toHaveLength(0)
    for (const c of r.containers) {
      for (const p of c.placements) {
        expect((p.z + p.h) / 20).toBeLessThanOrEqual(MAX_STACK_ASPECT + 0.01)
      }
    }
  })

  it('dãy xếp bậc thang: cột sát cửa không cao hơn hẳn cột phía trong', () => {
    const r = pack(
      [
        item({
          name: 'Cao',
          length: 100,
          width: 100,
          height: 200,
          weight: 300,
          qty: 3,
          allowRotate: false,
        }),
        item({
          name: 'Thấp',
          length: 100,
          width: 100,
          height: 50,
          weight: 100,
          qty: 3,
          allowRotate: false,
        }),
      ],
      CONT_20,
    )
    expect(auditPacking(r.containers)).toHaveLength(0)
    // Kiện cao nhất phải bắt đầu từ phía vách (x nhỏ), kiện thấp ra cửa.
    const c = r.containers[0]
    const maxXofTall = Math.max(
      ...c.placements.filter((p) => p.name === 'Cao').map((p) => p.x),
    )
    const minXofShort = Math.min(
      ...c.placements.filter((p) => p.name === 'Thấp').map((p) => p.x),
    )
    expect(maxXofTall).toBeLessThanOrEqual(minXofShort)
  })

  it('kiện dễ vỡ sâu hơn phần vách (không thể xa cửa) → unplaced có lý do', () => {
    // Cont mini: vùng cửa 25 cm → phần vách 75 cm. Kiện dễ vỡ sâu 90 cm
    // kiểu gì cũng thò vào vùng cửa → phải từ chối thay vì xếp liều.
    const r = pack(
      [item({ length: 90, width: 90, height: 30, weight: 10, fragile: true, qty: 1 })],
      MINI,
    )
    expect(r.placedUnits).toBe(0)
    expect(r.unplaced[0].reason).toContain('xa cửa')
  })
})

describe('pack — kịch bản thực tế cont 20 feet', () => {
  it('lô hàng hỗn hợp: kín + hở + dễ vỡ, audit sạch', () => {
    const r = pack(
      [
        item({
          name: 'Thùng máy',
          length: 80,
          width: 60,
          height: 70,
          weight: 95,
          qty: 40,
          maxLoadKg: 200,
        }),
        item({
          name: 'Thùng phụ kiện',
          length: 60,
          width: 40,
          height: 40,
          weight: 30,
          qty: 60,
        }),
        item({
          name: 'Khung hở',
          length: 120,
          width: 80,
          height: 90,
          weight: 60,
          qty: 10,
          stackable: false,
        }),
        item({
          name: 'Kính cường lực',
          length: 100,
          width: 20,
          height: 120,
          weight: 80,
          qty: 8,
          fragile: true,
          allowRotate: true,
        }),
      ],
      CONT_20,
    )
    expect(r.placedUnits).toBe(118)
    expect(r.unplaced).toHaveLength(0)
    expect(auditPacking(r.containers)).toHaveLength(0)
    // Thứ tự xếp phải liên tục 1..n
    const orders = r.containers
      .flatMap((c) => c.placements.map((p) => p.order))
      .sort((a, b) => a - b)
    expect(orders).toEqual(Array.from({ length: 118 }, (_, i) => i + 1))
  })
})
