import { describe, expect, it } from 'vitest'
import { auditPacking } from './audit'
import { pack } from './pack'
import type { ContainerSpec, ItemTypeInput } from './types'

/**
 * Kịch bản thực tế đồ gỗ: Ghế Hali + Mặt bàn + Chân bàn vào cont 40HC tự khai.
 * Nhiều tấm phẳng (mặt/chân bàn) + ghế cỡ hộp — bài toán bị chặn bởi thể tích.
 * Khoá lại: audit luôn sạch, xếp hết; nới độ cao xếp (đầy trần) và gác tấm phải
 * dồn hàng chặt hơn (không bao giờ tệ hơn phương án cột).
 */
const CONT: ContainerSpec = {
  key: 'custom',
  name: 'Custom 40HC',
  length: 1190,
  width: 234,
  height: 268,
  maxPayloadKg: 30000,
}

// Qui cách (mm→cm). Ghế Hali 2 chiếc/thùng → nặng hơn tấm bàn.
const ITEMS: ItemTypeInput[] = [
  {
    id: 'ghe',
    name: 'Ghế Hali',
    length: 58,
    width: 58,
    height: 46,
    weight: 20,
    qty: 200,
    allowRotate: true,
    stackable: true,
    fragile: false,
    maxLoadKg: null,
  },
  {
    id: 'matban',
    name: 'Mặt bàn 235',
    length: 81,
    width: 80,
    height: 10,
    weight: 14,
    qty: 185,
    allowRotate: true,
    stackable: true,
    fragile: false,
    maxLoadKg: null,
  },
  {
    id: 'chanban',
    name: 'Chân bàn',
    length: 122.5,
    width: 95,
    height: 11,
    weight: 10,
    qty: 185,
    allowRotate: true,
    stackable: true,
    fragile: false,
    maxLoadKg: null,
  },
]

describe('load-cont — kịch bản đồ gỗ', () => {
  it('xếp hết 570 kiện, audit sạch ở mọi cấu hình', () => {
    for (const maxStackAspect of [3, 4, 5]) {
      for (const allowBridging of [false, true]) {
        const tag = `aspect=${maxStackAspect} bridging=${allowBridging}`
        const r = pack(ITEMS, CONT, { maxStackAspect, allowBridging })
        expect(r.placedUnits, tag).toBe(570)
        expect(r.unplaced, tag).toHaveLength(0)
        expect(auditPacking(r.containers), tag).toHaveLength(0)
      }
    }
  })

  it('cont đầu tiên lấp ≥ 75% thể tích khi cho xếp đầy trần', () => {
    const r = pack(ITEMS, CONT, { maxStackAspect: 4 })
    expect(r.containers[0].volumeUtilization).toBeGreaterThan(75)
  })

  it('gác tấm không bao giờ dùng nhiều cont hơn phương án cột', () => {
    const column = pack(ITEMS, CONT, { maxStackAspect: 4, allowBridging: false })
    const bridged = pack(ITEMS, CONT, { maxStackAspect: 4, allowBridging: true })
    expect(bridged.containers.length).toBeLessThanOrEqual(column.containers.length)
    expect(bridged.containers[0].volumeUtilization).toBeGreaterThanOrEqual(
      column.containers[0].volumeUtilization - 0.01,
    )
  })
})
