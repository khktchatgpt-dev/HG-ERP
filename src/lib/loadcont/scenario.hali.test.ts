import { describe, expect, it } from 'vitest'
import { auditPacking } from './audit'
import { pack } from './pack'
import type { ContainerSpec, ItemTypeInput } from './types'
import { BOX_STRENGTHS, estimateTopLoadKg } from './types'

// Cont tự khai từ ảnh người dùng: 2.34 × 2.68 × 11.9 m, tải 30 tấn (~40HC).
const CONT: ContainerSpec = {
  key: 'custom',
  name: 'Custom 40HC',
  length: 1190,
  width: 234,
  height: 268,
  maxPayloadKg: 30000,
}

// Bộ bàn ghế Hali (kg ước lượng vì ảnh không cho — payload không bind).
const ITEMS: ItemTypeInput[] = [
  {
    id: 'ghe',
    name: 'Ghế Hali',
    length: 58,
    width: 58,
    height: 46,
    weight: 15,
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
    weight: 20,
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
    weight: 22,
    qty: 185,
    allowRotate: true,
    stackable: true,
    fragile: false,
    maxLoadKg: null,
  },
]

function report(label: string, r: ReturnType<typeof pack>) {
  const lines = [
    `\n=== ${label} ===`,
    `cont: ${r.containers.length} · xếp ${r.placedUnits}/${r.totalUnits}`,
  ]
  for (const c of r.containers) {
    lines.push(
      `  Cont ${c.index + 1}: ${c.placements.length} kiện · V ${c.volumeUtilization.toFixed(1)}% · W ${c.usedWeightKg}kg (${c.weightUtilization.toFixed(1)}%)`,
    )
    const byType = new Map<string, number>()
    for (const p of c.placements) byType.set(p.name, (byType.get(p.name) ?? 0) + 1)
    for (const [n, q] of byType) lines.push(`      ${n}: ${q}`)
  }
  if (r.unplaced.length) {
    lines.push('  UNPLACED:')
    for (const u of r.unplaced) lines.push(`      ${u.name} × ${u.qty} — ${u.reason}`)
  }
  const v = auditPacking(r.containers)
  lines.push(`  audit: ${v.length === 0 ? 'SẠCH' : v.length + ' vi phạm'}`)
  for (const x of v.slice(0, 8)) lines.push(`      [${x.rule}] ${x.message}`)
  if (process.env.LOADCONT_DEBUG) console.log(lines.join('\n'))
}

describe('scenario Hali — bộ bàn ghế thực tế', () => {
  it('cột thuần: xếp hết, an toàn tuyệt đối', () => {
    const r = pack(ITEMS, CONT)
    report('CỘT THUẦN', r)
    expect(auditPacking(r.containers)).toHaveLength(0)
    expect(r.placedUnits).toBe(r.totalUnits)
  })

  it('gác tấm không tự ý đè bàn nặng lên ghế khi chưa khai sức chịu', () => {
    // Ghế 15kg không khai maxLoadKg → không được gác bàn 20-22kg lên (nguy cơ đổ
    // vỡ). Kết quả phải luôn AN TOÀN, không kém phương án cột thuần.
    const col = pack(ITEMS, CONT)
    const r = pack(ITEMS, CONT, { allowBridging: true, maxStackAspect: 4 })
    report('GÁC TẤM (chưa khai sức chịu)', r)
    expect(auditPacking(r.containers)).toHaveLength(0)
    expect(r.placedUnits).toBe(r.totalUnits)
    expect(r.containers.length).toBeLessThanOrEqual(col.containers.length)
  })

  it('khai sức chịu ghế 120kg → gác tấm ăn khớp, cont đầu đầy hơn', () => {
    // Thùng ghế gỗ chịu ~120kg trên nóc → gác được bàn, lấp khoảng trống trên
    // đầu cột ghế mà VẪN an toàn (audit sạch, phân bổ tải ≤ 120kg/cột).
    const items = ITEMS.map((t) => (t.id === 'ghe' ? { ...t, maxLoadKg: 120 } : t))
    const col = pack(items, CONT, { maxStackAspect: 4 })
    const r = pack(items, CONT, { allowBridging: true, maxStackAspect: 4 })
    report('GÁC TẤM + GHẾ CHỊU 120KG', r)
    expect(auditPacking(r.containers)).toHaveLength(0)
    expect(r.placedUnits).toBe(r.totalUnits)
    // Gác tấm phải làm cont đầu đầy hơn phương án cột thuần cùng thông số.
    expect(r.containers[0].volumeUtilization).toBeGreaterThan(
      col.containers[0].volumeUtilization + 1,
    )
  })

  it('sức chịu nén TỰ ƯỚC TÍNH theo loại thùng → gác tấm ăn khớp', () => {
    // Không nhập tay maxLoadKg: suy ra từ "loại thùng × diện tích đáy" như UI.
    // Ghế đóng carton cứng (2 lớp) → chịu ≈ 0.05 × 58×58 = 168 kg.
    const estGhe = estimateTopLoadKg(58, 58, 0.05)
    expect(estGhe).toBe(168)
    const items = ITEMS.map((t) =>
      t.id === 'ghe' ? { ...t, maxLoadKg: estGhe } : { ...t, maxLoadKg: null },
    )
    const col = pack(items, CONT, { maxStackAspect: 4 })
    const r = pack(items, CONT, { allowBridging: true, maxStackAspect: 4 })
    report('GÁC TẤM + SỨC CHỊU TỰ ƯỚC TÍNH', r)
    expect(auditPacking(r.containers)).toHaveLength(0)
    expect(r.placedUnits).toBe(r.totalUnits)
    expect(r.containers[0].volumeUtilization).toBeGreaterThan(
      col.containers[0].volumeUtilization + 1,
    )
  })

  it('chế độ test (nhồi tối đa) lấp kín tới cửa, cont đầu ≥ 83%', () => {
    const safe = pack(ITEMS, CONT, { allowBridging: true, maxStackAspect: 4 })
    const r = pack(ITEMS, CONT, {
      allowBridging: true,
      maxStackAspect: 6,
      ignoreStackSafety: true,
    })
    report('CHẾ ĐỘ TEST', r)
    // Audit hình học phải sạch (không lơ lửng/chèn/tràn, không quá tải cont).
    expect(auditPacking(r.containers, { geometryOnly: true })).toHaveLength(0)
    expect(r.placedUnits).toBe(r.totalUnits)
    // Lấp vùng cửa (bỏ chừa 1m) phải làm cont đầu đầy hơn hẳn phương án an toàn.
    expect(r.containers[0].volumeUtilization).toBeGreaterThan(83)
    expect(r.containers[0].volumeUtilization).toBeGreaterThan(
      safe.containers[0].volumeUtilization + 3,
    )
  })

  it('xoay đa chiều (allowFlip) không làm hỏng kết quả, vẫn xếp hết', () => {
    const flipped = ITEMS.map((t) => ({ ...t, allowFlip: true }))
    const r = pack(flipped, CONT, { allowBridging: true, maxStackAspect: 6 })
    report('XOAY ĐA CHIỀU', r)
    expect(auditPacking(r.containers)).toHaveLength(0)
    expect(r.placedUnits).toBe(r.totalUnits)
  })
})

describe('estimateTopLoadKg — ước tính sức chịu theo loại thùng', () => {
  it('tỉ lệ thuận diện tích đáy × áp suất loại thùng', () => {
    expect(estimateTopLoadKg(100, 100, 0.02)).toBe(200)
    expect(estimateTopLoadKg(58, 58, 0.05)).toBe(168)
    expect(estimateTopLoadKg(50, 40, 0)).toBe(0)
  })

  it('preset thùng gỗ chịu tải cao hơn carton thường', () => {
    const carton = BOX_STRENGTHS.find((s) => s.key === 'carton')!.kgPerCm2
    const wood = BOX_STRENGTHS.find((s) => s.key === 'wood')!.kgPerCm2
    expect(wood).toBeGreaterThan(carton)
    expect(estimateTopLoadKg(80, 60, wood)).toBeGreaterThan(
      estimateTopLoadKg(80, 60, carton),
    )
  })
})
