import { describe, expect, it } from 'vitest'
import {
  qtyForLsx,
  splitProblem,
  rescaleSplit,
  chiaTheoNhuCau,
  chiaNhieuDong,
  boLenhKhoiChia,
  tienTheoLenh,
  type LsxSplit,
} from './po-lsx-split'

/**
 * Ca thật dựng test: PO-2026-0065 gộp lệnh 08 và 09, dòng 1.350 tấm KIM0161.
 * Trước 0185 cả hai lệnh đều thấy "đã đặt 1.350" — mỗi lệnh tưởng đủ, "còn phải
 * đặt" bị trừ thừa và người mua đặt thiếu.
 */
const L08 = 'lsx-08'
const L09 = 'lsx-09'

describe('qtyForLsx', () => {
  it('không chia → cả dòng thuộc LSX chính, lệnh phụ được 0', () => {
    const line = { qty_ordered: 1350, main_lsx_id: L08, allocations: [] }
    expect(qtyForLsx(L08, line)).toBe(1350)
    // Đây là con số 0185 sinh ra để sửa: trước đây lệnh 09 cũng nhận 1.350.
    expect(qtyForLsx(L09, line)).toBe(0)
  })

  it('có chia → mỗi lệnh đúng phần của mình', () => {
    const line = {
      qty_ordered: 1350,
      main_lsx_id: L08,
      allocations: [
        { production_order_id: L08, qty: 800 },
        { production_order_id: L09, qty: 550 },
      ],
    }
    expect(qtyForLsx(L08, line)).toBe(800)
    expect(qtyForLsx(L09, line)).toBe(550)
    expect(qtyForLsx('lsx-khac', line)).toBe(0)
  })

  it('đơn không gắn lệnh nào thì không lệnh nào nhận', () => {
    expect(qtyForLsx(L08, { qty_ordered: 100, main_lsx_id: null })).toBe(0)
  })
})

describe('splitProblem', () => {
  const ok: LsxSplit[] = [
    { production_order_id: L08, qty: 800 },
    { production_order_id: L09, qty: 550 },
  ]

  it('không chia hoặc chia khớp → hợp lệ', () => {
    expect(splitProblem(1350, [])).toBeNull()
    expect(splitProblem(1350, ok)).toBeNull()
  })

  it('chia thiếu / chia thừa đều nói rõ lệch bao nhiêu', () => {
    expect(splitProblem(1350, [{ production_order_id: L08, qty: 800 }])).toBe(
      'Chia thiếu 550 so với SL đặt 1.350',
    )
    expect(splitProblem(1000, ok)).toBe('Chia thừa 350 so với SL đặt 1.000')
  })

  it('SL lẻ cộng dư số nhị phân vẫn coi là khớp', () => {
    expect(
      splitProblem(0.3, [
        { production_order_id: L08, qty: 0.1 },
        { production_order_id: L09, qty: 0.2 },
      ]),
    ).toBeNull()
  })

  it('bắt số 0, số âm và lệnh trùng', () => {
    expect(splitProblem(100, [{ production_order_id: L08, qty: 0 }])).toMatch(/lớn hơn 0/)
    expect(
      splitProblem(100, [
        { production_order_id: L08, qty: 60 },
        { production_order_id: L08, qty: 40 },
      ]),
    ).toMatch(/hai lần/)
  })
})

describe('rescaleSplit', () => {
  it('SL đặt đổi thì giữ tỉ lệ và tổng khớp tuyệt đối', () => {
    const out = rescaleSplit(
      [
        { production_order_id: L08, qty: 800 },
        { production_order_id: L09, qty: 550 },
      ],
      600,
    )
    expect(out.reduce((s, a) => s + a.qty, 0)).toBe(600)
    expect(splitProblem(600, out)).toBeNull()
  })

  it('phần lẻ do làm tròn dồn vào lệnh lớn nhất, không đẻ ra "chia thiếu 0,0001"', () => {
    const out = rescaleSplit(
      [
        { production_order_id: L08, qty: 1 },
        { production_order_id: L09, qty: 1 },
        { production_order_id: 'lsx-10', qty: 1 },
      ],
      100,
    )
    expect(out.reduce((s, a) => s + a.qty, 0)).toBe(100)
    expect(splitProblem(100, out)).toBeNull()
  })

  it('chưa chia gì thì không đụng vào', () => {
    expect(rescaleSplit([], 600)).toEqual([])
  })
})

/*
 * TỰ CHIA THEO NHU CẦU (10/10/2026) — "gộp lệnh khi mua thì làm sao biết lệnh nào
 * bao nhiêu". Lệnh 08 là lệnh CHÍNH, 09 và 10 là lệnh phụ.
 */
describe('chiaTheoNhuCau', () => {
  const can = (a: number, b: number, c = 0) => [
    { production_order_id: '08', need: a },
    { production_order_id: '09', need: b },
    { production_order_id: '10', need: c },
  ]

  it('đặt đúng bằng nhu cầu: mỗi lệnh đúng phần cần (1.350 = 800 + 550)', () => {
    expect(chiaTheoNhuCau(1350, can(800, 550), '08')).toEqual([
      { production_order_id: '08', qty: 800 },
      { production_order_id: '09', qty: 550 },
    ])
  })

  it('đặt DƯ (mua tròn bó): lệnh phụ đúng phần cần, phần dư ghi cho lệnh chính', () => {
    expect(chiaTheoNhuCau(1500, can(800, 550), '08')).toEqual([
      { production_order_id: '08', qty: 950 },
      { production_order_id: '09', qty: 550 },
    ])
  })

  it('đặt dư mà lệnh chính KHÔNG cần mã này: phần dư về lệnh cần nhiều nhất, không đẻ dòng lệnh chính', () => {
    // NHO0090 (soi thật 10/10): chỉ lệnh 09 cần 62,18 kg, gợi ý làm tròn 63.
    expect(chiaTheoNhuCau(63, can(0, 62.18), '08')).toEqual([
      { production_order_id: '09', qty: 63 },
    ])
    expect(chiaTheoNhuCau(100, can(0, 50, 30), '08')).toEqual([
      { production_order_id: '09', qty: 70 },
      { production_order_id: '10', qty: 30 },
    ])
  })

  it('đặt THIẾU (tồn kho bù): chia theo tỉ lệ, số nguyên, tổng khớp tuyệt đối', () => {
    const r = chiaTheoNhuCau(1000, can(800, 550, 150), '08')
    expect(r.reduce((s, a) => s + a.qty, 0)).toBe(1000)
    expect(r.every((a) => Number.isInteger(a.qty))).toBe(true)
    expect(r.map((a) => a.qty)).toEqual([533, 367, 100])
  })

  it('SL lẻ (kg): chia theo tỉ lệ 4 lẻ, tổng khớp', () => {
    const r = chiaTheoNhuCau(100.5, can(60, 90), '08')
    expect(r.reduce((s, a) => s + a.qty, 0)).toBeCloseTo(100.5, 9)
    expect(r[0].qty).toBeCloseTo(40.2, 4)
  })

  it('chỉ lệnh PHỤ cần: ghi trọn cho lệnh phụ, không rơi về lệnh chính', () => {
    expect(chiaTheoNhuCau(300, can(0, 300), '08')).toEqual([
      { production_order_id: '09', qty: 300 },
    ])
  })

  it('không lệnh nào cần / SL đặt 0: không chia', () => {
    expect(chiaTheoNhuCau(100, can(0, 0), '08')).toEqual([])
    expect(chiaTheoNhuCau(0, can(5, 5), '08')).toEqual([])
  })
})

describe('chiaNhieuDong — cùng vật tư nằm nhiều dòng', () => {
  it('chia trên TỔNG của mã rồi rót lần lượt, không dòng nào ăn trọn nhu cầu', () => {
    const r = chiaNhieuDong(
      [
        { key: 'a', qty: 300 },
        { key: 'b', qty: 200 },
      ],
      [
        { production_order_id: '08', need: 350 },
        { production_order_id: '09', need: 150 },
      ],
      '08',
    )
    expect(r.get('a')).toEqual([{ production_order_id: '08', qty: 300 }])
    expect(r.get('b')).toEqual([
      { production_order_id: '08', qty: 50 },
      { production_order_id: '09', qty: 150 },
    ])
  })

  it('mỗi dòng luôn chia đủ SL của chính nó', () => {
    const r = chiaNhieuDong(
      [
        { key: 'a', qty: 7 },
        { key: 'b', qty: 5 },
      ],
      [
        { production_order_id: '08', need: 4 },
        { production_order_id: '09', need: 4 },
      ],
      '08',
    )
    for (const [k, q] of [
      ['a', 7],
      ['b', 5],
    ] as const) {
      expect(r.get(k)!.reduce((s, x) => s + x.qty, 0)).toBe(q)
    }
  })
})

describe('boLenhKhoiChia', () => {
  it('gỡ lệnh 10 khỏi đơn: phần còn lại chia lại theo tỉ lệ cho đủ SL', () => {
    const r = boLenhKhoiChia(
      [
        { production_order_id: '08', qty: 600 },
        { production_order_id: '09', qty: 300 },
        { production_order_id: '10', qty: 100 },
      ],
      ['08', '09'],
      1000,
    )
    expect(r.reduce((s, a) => s + a.qty, 0)).toBeCloseTo(1000, 6)
    expect(r.map((a) => a.production_order_id)).toEqual(['08', '09'])
  })

  it('gỡ hết lệnh đã chia → về lệnh chính', () => {
    expect(boLenhKhoiChia([{ production_order_id: '10', qty: 5 }], ['08'], 5)).toEqual([])
  })
})

/*
 * TIỀN THEO LỆNH (bản vẽ Chia lệnh, 10/10/2026): đơn thử 08 MX + 09 MX — dòng
 * NH-0063 288 cây chia 200/88, NHO0090 chỉ 09, NH-0571 chưa chia.
 */
describe('tienTheoLenh', () => {
  const SET = [
    { id: '08', code: '08/26-27 - MX' },
    { id: '09', code: '09/26-27 - MX' },
  ]
  it('chia tiền theo tỉ lệ SL; dòng nhiều lệnh đếm ở mọi lệnh; chưa chia tách riêng; tổng khớp', () => {
    const r = tienTheoLenh(
      [
        {
          qty_ordered: 7,
          amount: 1_582_000,
          lsx_split: [{ production_order_id: '08', qty: 7 }],
        },
        { qty_ordered: 288, amount: 81_216_000, lsx_split: [{ production_order_id: '08', qty: 200 }, { production_order_id: '09', qty: 88 }] }, // prettier-ignore
        {
          qty_ordered: 63,
          amount: 7_119_000,
          lsx_split: [{ production_order_id: '09', qty: 63 }],
        },
        { qty_ordered: 20, amount: 3_840_000, lsx_split: null },
      ],
      SET,
    )
    expect(r.lenh.map((x) => [x.dong, x.tien])).toEqual([
      [2, 1_582_000 + 56_400_000],
      [2, 24_816_000 + 7_119_000],
    ])
    expect(r.chuaChia).toEqual({ dong: 1, tien: 3_840_000 })
    const tong = r.lenh.reduce((s, x) => s + x.tien, 0) + r.chuaChia.tien
    expect(tong).toBe(1_582_000 + 81_216_000 + 7_119_000 + 3_840_000)
  })

  it('dòng chưa có giá: đếm dòng, tiền 0; dòng SL 0 không tính là chưa chia', () => {
    const r = tienTheoLenh(
      [
        {
          qty_ordered: 5,
          amount: null,
          lsx_split: [{ production_order_id: '09', qty: 5 }],
        },
        { qty_ordered: 0, amount: null, lsx_split: null },
      ],
      SET,
    )
    expect(r.lenh[1]).toMatchObject({ dong: 1, tien: 0 })
    expect(r.chuaChia.dong).toBe(0)
  })
})
