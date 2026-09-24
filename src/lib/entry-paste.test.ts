import { describe, expect, it } from 'vitest'
import {
  PASTE_MAX_ROWS,
  isSingleCell,
  parsePasteGrid,
  pasteFootprint,
} from './entry-paste'

describe('parsePasteGrid', () => {
  it('tách TSV thành lưới ô', () => {
    expect(parsePasteGrid('40\t2\tmóp\n35\t0\t')).toEqual([
      ['40', '2', 'móp'],
      ['35', '0', ''],
    ])
  })

  it('một cột số — ca hay gặp nhất: bôi đen cột SL trong sổ Excel', () => {
    expect(parsePasteGrid('40\n35\n12')).toEqual([['40'], ['35'], ['12']])
  })

  it('nhận xuống dòng kiểu Windows và Mac cũ', () => {
    expect(parsePasteGrid('1\r\n2')).toEqual([['1'], ['2']])
    expect(parsePasteGrid('1\r2')).toEqual([['1'], ['2']])
  })

  it('bỏ dòng trắng ở CUỐI (Excel luôn kèm một dòng thừa)', () => {
    expect(parsePasteGrid('40\n35\n\n')).toEqual([['40'], ['35']])
  })

  it('GIỮ dòng trắng ở GIỮA — bỏ đi là mọi dòng sau bị dịch lên một ô', () => {
    // Đây là lỗi im lặng nguy hiểm nhất của dán: số vẫn vào đủ, chỉ sai dòng.
    expect(parsePasteGrid('40\n\n12')).toEqual([['40'], [''], ['12']])
  })

  it('cắt khoảng trắng quanh ô', () => {
    expect(parsePasteGrid('  40  \t  móp ')).toEqual([['40', 'móp']])
  })

  it('bóc nháy kép Excel bọc ngoài ô', () => {
    expect(parsePasteGrid('"1.390"\t"móp cạnh"')).toEqual([['1.390', 'móp cạnh']])
  })

  it('chuỗi rỗng → lưới rỗng, không phải một dòng trắng', () => {
    expect(parsePasteGrid('')).toEqual([])
  })

  it('chặn trần dòng — dán nhầm cả sheet thì treo tab', () => {
    const huge = Array.from({ length: PASTE_MAX_ROWS + 50 }, (_, i) => String(i)).join(
      '\n',
    )
    expect(parsePasteGrid(huge)).toHaveLength(PASTE_MAX_ROWS)
    expect(parsePasteGrid(huge, 3)).toHaveLength(3)
  })

  it('KHÔNG tự đổi số — "1.390" giữ nguyên để tầng số đọc theo luật VN', () => {
    // Tách chuỗi và đọc số là hai việc; gộp vào đây thì "1.390" thành 1,39.
    expect(parsePasteGrid('1.390')[0][0]).toBe('1.390')
  })
})

describe('isSingleCell', () => {
  it('một ô → true; nhiều dòng hoặc nhiều cột → false', () => {
    expect(isSingleCell([['40']])).toBe(true)
    expect(isSingleCell([['40', '2']])).toBe(false)
    expect(isSingleCell([['40'], ['35']])).toBe(false)
    expect(isSingleCell([])).toBe(false)
  })
})

describe('pasteFootprint', () => {
  const size = { rows: 5, cols: 3 }

  it('đếm ô sẽ điền khi vùng dán nằm trọn trong lưới', () => {
    const grid = [
      ['1', '2'],
      ['3', '4'],
    ]
    expect(pasteFootprint(grid, { row: 0, col: 0 }, size)).toEqual({
      fills: 4,
      dropped: 0,
    })
  })

  it('đếm ô bị BỎ khi vùng dán tràn ra ngoài lưới', () => {
    // Dán 3 dòng vào dòng cuối cùng → 1 ô vào được, 2 ô rơi ra ngoài.
    const grid = [['1'], ['2'], ['3']]
    expect(pasteFootprint(grid, { row: 4, col: 0 }, size)).toEqual({
      fills: 1,
      dropped: 2,
    })
  })

  it('tràn theo chiều NGANG cũng đếm — lưới hẹp hơn vùng dán', () => {
    const grid = [['1', '2', '3', '4', '5']]
    expect(pasteFootprint(grid, { row: 0, col: 1 }, size)).toEqual({
      fills: 2,
      dropped: 3,
    })
  })
})
