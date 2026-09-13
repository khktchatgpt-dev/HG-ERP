import { describe, expect, it } from 'vitest'
import { applyPasteAt, parseCell, parseCutPaste, parseNum, pasteMatrix } from './paste'
import { blankLine } from './types'

describe('parseNum — số kiểu Việt', () => {
  it.each([
    ['1.390', 1390],
    ['1390,5', 1390.5],
    ['1,390', 1390],
    ['0.525', 0.525],
    ['2 000', 2000],
    ['1390 mm', 1390],
    ['abc', null],
    ['', null],
  ])('%s → %s', (s, n) => expect(parseNum(s)).toBe(n))
})

describe('parseCell — ô số của lưới', () => {
  it('chiều dài giữ số lẻ, số lượng làm tròn thành số nguyên ≥ 1', () => {
    expect(parseCell('length_mm', '1.390')).toBe(1390)
    expect(parseCell('length_mm', '1390,5')).toBe(1390.5)
    expect(parseCell('qty', '2,5')).toBe(3)
    expect(parseCell('qty', '2.4')).toBe(2)
    expect(parseCell('qty', '0,3')).toBe(1)
    expect(parseCell('qty', '1.000')).toBe(1000)
  })
  it('không đọc được hoặc ≤ 0 → ô trống', () => {
    expect(parseCell('length_mm', 'abc')).toBe('')
    expect(parseCell('length_mm', '0')).toBe('')
    expect(parseCell('qty', '-5')).toBe('')
  })
  it('dán cả bảng và dán tại ô cùng làm tròn SL', () => {
    expect(parseCutPaste('A\t1390\t2,5').rows[0].qty).toBe(3)
    const r = applyPasteAt([blankLine(1)], 0, 'qty', [['2,5']], () => 9)
    expect(r.lines[0].qty).toBe(3)
  })
})

describe('pasteMatrix', () => {
  it('tab thắng, bỏ dòng trống cuối', () => {
    expect(pasteMatrix('a\tb\n1\t2\n\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ])
  })
  it('không tab thì chấm phẩy, rồi 2+ khoảng trắng', () => {
    expect(pasteMatrix('a;b\n1;2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ])
    expect(pasteMatrix('Chân sau   1390  4')).toEqual([['Chân sau', '1390', '4']])
  })
})

describe('parseCutPaste — có dòng tiêu đề', () => {
  it('nhận cột theo tiêu đề tiếng Việt, bỏ STT và tổng dài', () => {
    const r = parseCutPaste(
      [
        'STT\tTên chi tiết\tDài (mm)\tSL\tTổng dài\tGhi chú',
        '1\tChân sau\t1.390\t4\t5560\tuốn',
        '2\tChân trước\t390\t4\t1560\t',
      ].join('\n'),
    )
    expect(r.source).toBe('header')
    expect(r.mapped.map((m) => m.field)).toEqual([
      'part_name',
      'length_mm',
      'qty',
      'note',
    ])
    expect(r.rows).toEqual([
      { part_name: 'Chân sau', length_mm: 1390, qty: 4, spec: '', note: 'uốn' },
      { part_name: 'Chân trước', length_mm: 390, qty: 4, spec: '', note: '' },
    ])
  })

  it('cột "Quy cách" / "Vật liệu" theo tiêu đề → spec của dòng', () => {
    const r = parseCutPaste(
      'Tên\tDài\tSL\tQuy cách\nChân\t1390\t4\tNhôm hộp 20×40\nGiằng\t2950\t2\tSắt hộp 25×25',
    )
    expect(r.mapped.map((m) => m.field)).toEqual([
      'part_name',
      'length_mm',
      'qty',
      'spec',
    ])
    expect(r.rows.map((x) => x.spec)).toEqual(['Nhôm hộp 20×40', 'Sắt hộp 25×25'])
  })

  it('tiêu đề tiếng Anh', () => {
    const r = parseCutPaste('Part\tLength\tQty\nLeg\t600\t8')
    expect(r.rows[0]).toMatchObject({ part_name: 'Leg', length_mm: 600, qty: 8 })
  })

  it('dòng tổng và dòng không có chiều dài được liệt kê, không nuốt', () => {
    const r = parseCutPaste('Tên\tDài\tSL\nChân\t1000\t2\nCộng\t\t2\nTay\tabc\t1')
    expect(r.rows).toHaveLength(1)
    expect(r.skipped).toEqual([
      { line: 3, text: 'Cộng |  | 2', reason: 'Dòng tổng' },
      { line: 4, text: 'Tay | abc | 1', reason: 'Không đọc được chiều dài' },
    ])
  })
})

describe('parseCutPaste — không tiêu đề, đoán theo nội dung', () => {
  it('hai cột số: dài rồi SL', () => {
    const r = parseCutPaste('1390\t4\n390\t15')
    expect(r.source).toBe('guess')
    expect(r.rows.map((x) => [x.length_mm, x.qty])).toEqual([
      [1390, 4],
      [390, 15],
    ])
  })

  it('một cột số thì là dài, SL mặc định 1', () => {
    const r = parseCutPaste('Chân sau\t1390')
    expect(r.rows[0]).toMatchObject({ part_name: 'Chân sau', length_mm: 1390, qty: 1 })
  })

  it('cột chữ đầu là tên, cột chữ sau là ghi chú; cột STT bị bỏ', () => {
    const r = parseCutPaste(
      ['1\tChân sau\t1390\t4\tuốn', '2\tChân trước\t390\t4\t', '3\tGiằng\t500\t2\t'].join(
        '\n',
      ),
    )
    expect(r.rows.map((x) => x.part_name)).toEqual(['Chân sau', 'Chân trước', 'Giằng'])
    expect(r.rows.map((x) => [x.length_mm, x.qty, x.note])).toEqual([
      [1390, 4, 'uốn'],
      [390, 4, ''],
      [500, 2, ''],
    ])
  })

  it('văn bản trống → không dòng', () => {
    expect(parseCutPaste('\n\n').rows).toEqual([])
  })
})

describe('applyPasteAt — dán tại ô đang đứng', () => {
  let seq = 100
  const nextKey = () => seq++

  it('cột chạy sang phải, thiếu dòng thì thêm, ô ngoài vùng giữ nguyên', () => {
    const lines = [
      { ...blankLine(1), part_name: 'Chân' },
      { ...blankLine(2), part_name: 'Tay' },
    ]
    const r = applyPasteAt(
      lines,
      1,
      'length_mm',
      [
        ['1.390', '4'],
        ['390', '15'],
        ['500', ''],
      ],
      nextKey,
    )
    expect(r.added).toBe(2)
    expect(r.cells).toBe(6)
    expect(r.lines[0]).toMatchObject({ part_name: 'Chân', length_mm: '' })
    expect(r.lines[1]).toMatchObject({ part_name: 'Tay', length_mm: 1390, qty: 4 })
    expect(r.lines[2]).toMatchObject({ length_mm: 390, qty: 15, part_name: '' })
    expect(r.lines[3]).toMatchObject({ length_mm: 500, qty: '' })
    expect(r.lines[2].key).toBe(100)
  })

  it('cột vượt quá lưới bị bỏ, không lỗi', () => {
    const r = applyPasteAt(
      [blankLine(1)],
      0,
      'qty',
      [['4', 'Nhôm hộp 20×40', 'ghi chú', 'thừa']],
      nextKey,
    )
    expect(r.lines[0]).toMatchObject({ qty: 4, spec: 'Nhôm hộp 20×40', note: 'ghi chú' })
    expect(r.cells).toBe(3)
  })
})
