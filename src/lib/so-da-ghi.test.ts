import { describe, expect, it } from 'vitest'
import {
  chuCuaDong,
  draftProblem,
  flagsOf,
  khoaVi,
  parseSo,
  scaleKg,
  type SdgLine,
} from './so-da-ghi'

const line = (p: Partial<SdgLine>): SdgLine => ({
  id: 'e1',
  doc_id: 'd1',
  lsx_id: 'l1',
  entry_date: '2026-11-13',
  team_id: 't-phoi',
  stage: 'phoi',
  component_id: 'c1',
  product_code: 'TB0299HG-AL',
  product_name: 'Bàn tròn GIGA',
  name: 'Chân',
  cluster: null,
  qty_per_unit: 4,
  dm_kg: 0.3758,
  sort: 0,
  needed: 108,
  done: 0,
  available: null,
  qty: 0,
  defect: 0,
  kg: null,
  worker: '',
  note: '',
  defect_code: null,
  defect_reason: '',
  created_by: 'u1',
  created_at: '2026-11-13T07:05:00Z',
  ...p,
})

const docs = new Map([
  ['d1', { doc_no: 'PBS-2026-0016', status: 'da_xac_nhan' as const }],
  ['d0', { doc_no: 'PBS-2026-0015', status: 'nhap' as const }],
])

describe('flagsOf — bốn loại cần soát', () => {
  it('(a) luỹ kế chính thức vượt phải làm', () => {
    const f = flagsOf([line({ qty: 1080, done: 1080 })], docs)
    expect(f.get('e1')?.map((x) => x.kind)).toEqual(['vuot_phai_lam'])
    expect(f.get('e1')?.[0].text).toContain('1.080 > phải làm 108')
  })

  it('(a) dòng nháp tính cả số của chính nó', () => {
    const f = flagsOf([line({ doc_id: 'd0', qty: 20, done: 100 })], docs)
    expect(f.get('e1')?.[0].text).toContain('ghi chính thức sẽ thành 120')
  })

  it('(a) không tô khi vừa đủ', () => {
    expect(flagsOf([line({ qty: 108, done: 108 })], docs).size).toBe(0)
  })

  it('(b) cùng chi tiết · công đoạn · tổ · ngày ở hai phiếu — tô cả hai', () => {
    const f = flagsOf(
      [
        line({ id: 'a', doc_id: 'd0', qty: 12, needed: 24, done: 12 }),
        line({ id: 'b', doc_id: 'd1', qty: 12, needed: 24, done: 12 }),
      ],
      docs,
    )
    expect(f.get('a')?.[0]).toMatchObject({ kind: 'trung' })
    expect(f.get('a')?.[0].text).toContain('PBS-2026-0016')
    expect(f.get('b')?.[0].text).toContain('PBS-2026-0015')
  })

  it('(b) hai dòng cùng MỘT phiếu không phải trùng (chia đợt)', () => {
    const f = flagsOf(
      [line({ id: 'a', qty: 6, done: 12 }), line({ id: 'b', qty: 6, done: 12 })],
      docs,
    )
    expect(f.size).toBe(0)
  })

  it('(b) khác tổ hoặc khác ngày thì không tính', () => {
    const f = flagsOf(
      [
        line({ id: 'a', doc_id: 'd0', qty: 12 }),
        line({ id: 'b', doc_id: 'd1', qty: 12, team_id: 't-han' }),
        line({ id: 'c', doc_id: 'd1', qty: 12, entry_date: '2026-11-12' }),
      ],
      docs,
    )
    expect(f.size).toBe(0)
  })

  it('(c) lỗi chưa lý do; có mã thì thôi', () => {
    expect(flagsOf([line({ qty: 70, defect: 4 })], docs).get('e1')?.[0].kind).toBe(
      'loi_chua_ly_do',
    )
    expect(flagsOf([line({ qty: 70, defect: 4, defect_code: 'cong' })], docs).size).toBe(0)
  })

  it('(d) vượt khả dụng; Phôi (null) không xét', () => {
    expect(
      flagsOf([line({ stage: 'han', qty: 40, available: -12 })], docs).get('e1')?.[0].text,
    ).toContain('vượt khả dụng 12')
    expect(flagsOf([line({ qty: 40, available: null })], docs).size).toBe(0)
  })
})

describe('khoaVi', () => {
  const ctx = { locked: () => false, meId: 'u1', canAll: false }
  it('lệnh đóng khoá trước mọi thứ', () => {
    expect(khoaVi(line({}), { lsx_closed: true }, ctx)).toContain('Lệnh đã đóng')
  })
  it('sổ ngày đã chốt', () => {
    expect(khoaVi(line({}), { lsx_closed: false }, { ...ctx, locked: () => true })).toContain(
      'mở khoá ở Sổ ngày',
    )
  })
  it('chỉ người ghi, trừ quản lý', () => {
    expect(khoaVi(line({ created_by: 'u2' }), null, ctx)).toContain('Chỉ người ghi')
    expect(khoaVi(line({ created_by: 'u2' }), null, { ...ctx, canAll: true })).toBeNull()
    expect(khoaVi(line({}), null, ctx)).toBeNull()
  })
})

describe('parseSo', () => {
  it('dấu chấm ngăn nghìn, dấu phẩy thập phân', () => {
    expect(parseSo('1.080')).toBe(1080)
    expect(parseSo('12.500,5')).toBe(12500.5)
    expect(parseSo('2,5')).toBe(2.5)
    expect(parseSo(' 74 ')).toBe(74)
    expect(parseSo('')).toBe(0)
    expect(parseSo('abc')).toBeNull()
  })
})

describe('draftProblem — cùng luật entryLineSchema', () => {
  const l = line({ qty: 84, defect: 0 })
  it('sửa số bình thường', () => {
    expect(draftProblem(l, { qty: '74' })).toBeNull()
  })
  it('không còn số nào thì bảo Xoá', () => {
    expect(draftProblem(l, { qty: '0' })?.msg).toContain('Xoá')
  })
  it('số âm / chữ bị chặn', () => {
    expect(draftProblem(l, { qty: '-1' })?.field).toBe('qty')
    expect(draftProblem(l, { defect: 'x' })?.field).toBe('defect')
  })
  it('thêm lỗi thì phải có lý do', () => {
    expect(draftProblem(l, { defect: '4' })).toMatchObject({ field: 'text' })
    expect(draftProblem(l, { defect: '4', text: 'cong vênh' })).toBeNull()
  })
  it('dòng có sẵn mã lý do, chỉ đổi số lỗi — vẫn lưu được', () => {
    expect(
      draftProblem(line({ qty: 70, defect: 4, defect_code: 'cong' }), { defect: '5' }),
    ).toBeNull()
  })
})

describe('scaleKg', () => {
  it('giữ tỉ lệ kg/cái', () => {
    expect(scaleKg(104.4, 84, 74, 1.2429)).toBe(91.97)
  })
  it('dòng chưa có kg thì tính từ ĐM', () => {
    expect(scaleKg(null, 0, 12, 1.4366)).toBe(17.24)
  })
  it('không có ĐM thì để trống', () => {
    expect(scaleKg(null, 10, 12, null)).toBeNull()
  })
})

describe('chuCuaDong', () => {
  it('có lỗi → lý do (nhãn mã), không lỗi → ghi chú', () => {
    const lb = (c: string) => (c === 'cong' ? 'Cong vênh' : undefined)
    expect(chuCuaDong(line({ defect: 2, defect_code: 'cong' }), lb)).toEqual({
      mode: 'ly_do',
      value: 'Cong vênh',
    })
    expect(chuCuaDong(line({ note: 'thiếu phôi' }), lb)).toEqual({
      mode: 'ghi_chu',
      value: 'thiếu phôi',
    })
  })
})
