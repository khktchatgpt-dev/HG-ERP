import { describe, expect, it } from 'vitest'
import { chuan, docDan, docNgay, khopChiTiet, tachBang, type CtLenh } from './dan-so'

const T = '\t'
const dong = (...c: string[]) => c.join(T)

// Hình dạng tờ HÀN NHÔM của sổ thật: tiêu đề một hàng, cột ngày cùng hàng.
const MAU = [
  dong(
    'STT',
    'Lệnh sản xuất',
    'Mã SP',
    'Cụm',
    'Tên chi tiết',
    'ĐM',
    'CT/SP',
    'Tổng cần',
    '26/07',
    '27/07',
    '28/07',
  ),
  dong(
    '',
    '1/26-27',
    'FDA50089N',
    'CỤM CHÂN TRƯỚC',
    'Chân trước',
    '0,54',
    '1',
    '400',
    '',
    '150',
    '150',
  ),
  dong('', '1/26-27', 'FDA50089N', '', 'Giằng chân', '0,12', '1', '400', '', '', '200'),
  dong('', '', '', '', 'PHẦN NHÔM', '', '', '', '', '', ''),
  dong('', '', '', 'CỤM CHÂN SAU', 'Chân sau', '0,64', '1', '400', '', '', '200'),
  dong('', '', '', '', 'TỔNG CỘNG', '', '', '', '', '150', '550'),
].join('\n')

describe('docNgay', () => {
  it('đọc d/m, d-m-yyyy, ISO; năm điền theo tham số', () => {
    expect(docNgay('26/07', 2026)).toBe('2026-07-26')
    expect(docNgay('4/5', 2026)).toBe('2026-05-04')
    expect(docNgay('4-5-2025', 2026)).toBe('2025-05-04')
    expect(docNgay('2026-07-26 00:00:00', 2020)).toBe('2026-07-26')
  })
  it('từ chối thứ không phải ngày thật', () => {
    expect(docNgay('31/02', 2026)).toBeNull()
    expect(docNgay('CT/SP', 2026)).toBeNull()
    expect(docNgay('0,54', 2026)).toBeNull()
    expect(docNgay('', 2026)).toBeNull()
  })
})

describe('tachBang', () => {
  it('gỡ ô bọc nháy có xuống dòng và tab', () => {
    const r = tachBang('a\t"b\nc"\td\n1\t2\t3')
    expect(r).toEqual([
      ['a', 'b\nc', 'd'],
      ['1', '2', '3'],
    ])
  })
})

describe('docDan', () => {
  const r = docDan(MAU, 2026)
  it('nhận cột ngày và bỏ dòng nhóm / dòng tổng', () => {
    expect(r.ok).toBe(true)
    expect(r.cot.map((c) => c.iso)).toEqual(['2026-07-26', '2026-07-27', '2026-07-28'])
    expect(r.dong.map((d) => d.ten)).toEqual(['Chân trước', 'Giằng chân', 'Chân sau'])
    expect(r.bo_qua).toBe(2) // "PHẦN NHÔM" + "TỔNG CỘNG"
  })
  it('điền cụm xuống các dòng bỏ trống, số kiểu Việt Nam', () => {
    expect(r.dong[1].cum).toBe('CỤM CHÂN TRƯỚC')
    expect(r.dong[2].cum).toBe('CỤM CHÂN SAU')
    expect(r.dong[0].dm).toBe(0.54)
    expect(r.dong[0].ct_sp).toBe(1)
    expect(r.dong[0].can).toBe(400)
    expect(r.dong[0].o).toEqual({ '2026-07-27': 150, '2026-07-28': 150 })
    expect(r.dong[0].ma_sp).toBe('FDA50089N')
  })
  it('báo cột hiểu được', () => {
    expect(r.hieu.map((x) => x.la)).toContain('Chi tiết')
    expect(r.hieu.map((x) => x.la)).toContain('Cụm')
  })
  it('ô chữ thành ô sai, không rơi mất', () => {
    const x = docDan(
      [dong('Tên chi tiết', 'CT/SP', '28/07'), dong('Chốt tay', '2', 'abc')].join('\n'),
      2026,
    )
    expect(x.dong[0].sai).toEqual([{ iso: '2026-07-28', raw: 'abc' }])
  })
  it('ngày nằm hàng dưới tiêu đề (sheet data)', () => {
    const x = docDan(
      [
        dong('STT', 'Cụm', 'Tên chi tiết', 'chi tiết/sp', 'NGÀY SX', 'NGÀY SX'),
        dong('', '', '', '', '4/5', '5/5'),
        dong('', '', '', '', '', ''),
        dong('1', 'CỤM MÊ', 'Chân trước', '2', '', '800'),
      ].join('\n'),
      2026,
    )
    expect(x.cot.map((c) => c.iso)).toEqual(['2026-05-04', '2026-05-05'])
    expect(x.dong).toHaveLength(1)
    expect(x.dong[0].ct_sp).toBe(2)
    expect(x.dong[0].o).toEqual({ '2026-05-05': 800 })
  })
  it('nói rõ khi thiếu cột tên hoặc cột ngày', () => {
    expect(docDan('a\tb\n1\t2', 2026).loi[0]).toMatch(/Tên chi tiết/)
    expect(docDan('Tên chi tiết\tCT/SP\nx\t1', 2026).loi[0]).toMatch(/cột ngày/)
    expect(docDan('', 2026).ok).toBe(false)
  })
  it('cột ngày trùng chỉ giữ cột đầu', () => {
    const x = docDan(
      [dong('Tên chi tiết', '26/07', '26/07'), dong('Chân', '1', '9')].join('\n'),
      2026,
    )
    expect(x.cot).toHaveLength(1)
    expect(x.dong[0].o).toEqual({ '2026-07-26': 1 })
    expect(x.loi.join()).toMatch(/hai cột/)
  })
})

describe('khopChiTiet', () => {
  const ds: CtLenh[] = [
    { id: 'a', ten: 'Chân trước', cum: 'Cụm chân trước', kind: 'part' },
    { id: 'b', ten: 'Giằng chân', cum: 'Cụm chân trước', kind: 'part' },
    { id: 'c', ten: 'Giằng chân', cum: 'Cụm chân sau', kind: 'part' },
    { id: 'd', ten: 'Hộp trượt', cum: 'Cụm chân sau', kind: 'part' },
    { id: 'e', ten: 'Cụm chân sau', cum: 'Cụm chân sau', kind: 'assembly' },
  ]
  it('khớp tên không phân biệt hoa thường / dấu / khoảng trắng', () => {
    expect(khopChiTiet({ cum: '', ten: ' CHÂN  TRƯỚC ' }, ds)).toEqual({
      kieu: 'khop',
      id: 'a',
    })
    expect(khopChiTiet({ cum: '', ten: 'chan truoc' }, ds)).toEqual({
      kieu: 'khop',
      id: 'a',
    })
  })
  it('trùng tên: dùng cột cụm để chọn, không có thì báo trùng', () => {
    expect(khopChiTiet({ cum: 'CỤM CHÂN SAU', ten: 'Giằng chân' }, ds)).toEqual({
      kieu: 'khop',
      id: 'c',
    })
    expect(khopChiTiet({ cum: '', ten: 'Giằng chân' }, ds)).toEqual({ kieu: 'trung' })
  })
  it('gợi ý khi gõ sai một vài ký tự, không tự nhận', () => {
    expect(khopChiTiet({ cum: '', ten: 'Hộp trươt' }, ds)).toEqual({
      kieu: 'khop',
      id: 'd',
    }) // khác dấu thôi
    expect(khopChiTiet({ cum: '', ten: 'Hộp trượtt' }, ds)).toEqual({
      kieu: 'gan',
      id: 'd',
      ten: 'Hộp trượt',
    })
  })
  it('không khớp gì thì là mới; dòng cụm không bị coi là chi tiết', () => {
    expect(khopChiTiet({ cum: '', ten: 'Thanh giằng ngang' }, ds)).toEqual({
      kieu: 'moi',
    })
    expect(khopChiTiet({ cum: '', ten: 'Cụm chân sau' }, ds)).toEqual({ kieu: 'moi' })
  })
})

describe('chuan', () => {
  it('bỏ dấu, đ → d', () => {
    expect(chuan('Đầu  Tay-Ghế')).toBe('dau tay ghe')
  })
})
