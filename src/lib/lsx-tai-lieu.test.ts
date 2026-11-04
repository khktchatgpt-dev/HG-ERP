import { describe, expect, it } from 'vitest'
import {
  buildTaiLieu,
  pickFiles,
  readmeText,
  safeName,
  zipEntries,
  type TaiLieuFile,
} from './lsx-tai-lieu'

const f = (p: Partial<TaiLieuFile> & { id: string }): TaiLieuFile => ({
  product_id: 'P1',
  doc_type: 'bom',
  filename: `${p.id}.xlsx`,
  size_bytes: 10,
  is_current: false,
  created_at: '2026-10-01T00:00:00Z',
  ...p,
})
const label = (t: string) => ({ label: 'Nhãn', assembly: 'HD lắp ráp' })[t] ?? t

describe('pickFiles', () => {
  it('BOM nhiều bản: lấy bản đang dùng dù cũ hơn', () => {
    const r = pickFiles([
      f({ id: 'a', created_at: '2026-10-05T00:00:00Z' }),
      f({ id: 'b', is_current: true, created_at: '2026-09-01T00:00:00Z' }),
    ])
    expect(r.map((x) => x.id)).toEqual(['b'])
  })
  it('BOM nhiều bản chưa đánh dấu: lấy bản mới nhất', () => {
    const r = pickFiles([
      f({ id: 'cu', created_at: '2026-09-01T00:00:00Z' }),
      f({ id: 'moi', created_at: '2026-10-05T00:00:00Z' }),
    ])
    expect(r.map((x) => x.id)).toEqual(['moi'])
  })
  it('ảnh và loại không phiên bản: lấy hết', () => {
    const r = pickFiles([
      f({ id: 'i1', doc_type: 'image' }),
      f({ id: 'i2', doc_type: 'image' }),
      f({ id: 'n1', doc_type: 'label' }),
      f({ id: 'x', doc_type: null }),
    ])
    expect(r.map((x) => x.id).sort()).toEqual(['i1', 'i2', 'n1', 'x'])
  })
})

describe('buildTaiLieu', () => {
  it('gộp cùng mã SP ở hai nhóm thành một, cộng SL; SP không hồ sơ vẫn có dòng', () => {
    const r = buildTaiLieu(
      [
        { product_id: 'P1', product_code: 'CH1', name: 'Ghế', qty: 100, unit: 'cái' },
        { product_id: 'P1', product_code: 'CH1', name: 'Ghế', qty: 50, unit: 'cái' },
        { product_id: null, product_code: 'X9', name: 'Lạ', qty: 3, unit: 'cái' },
      ],
      [
        f({ id: 'b1' }),
        f({ id: 'b2', created_at: '2026-10-09T00:00:00Z' }),
        f({ id: 'i1', doc_type: 'image' }),
        f({ id: 'h1', doc_type: 'assembly' }),
      ],
      label,
    )
    expect(r).toHaveLength(2)
    expect(r[0]).toMatchObject({
      qty: 150,
      bomVersions: 2,
      bomGuessed: true,
      images: 1,
      others: ['HD lắp ráp'],
    })
    expect(r[0].bom?.id).toBe('b2')
    expect(r[1]).toMatchObject({ bom: null, picked: [] })
  })
})

describe('zipEntries + safeName', () => {
  it('thư mục theo mã + tên, bỏ ký tự cấm, trùng tên thì đánh số', () => {
    const [p] = buildTaiLieu(
      [
        {
          product_id: 'P1',
          product_code: 'TB0182',
          name: 'Bàn 150/200×90',
          qty: 1,
          unit: 'cái',
        },
      ],
      [
        f({ id: 'i1', doc_type: 'image', filename: 'anh.jpg' }),
        f({ id: 'i2', doc_type: 'image', filename: 'ANH.jpg' }),
      ],
      label,
    )
    const e = zipEntries([p]).map((x) => x.path)
    expect(e[0]).toMatch(/^TB0182 Bàn 150-200×90\/Anh\/anh\.jpg$/i)
    expect(e[1]).toMatch(/\(2\)\.jpg$/)
  })
  it('safeName không để chấm / khoảng trắng cuối (Windows cấm)', () => {
    expect(safeName('Ghế a:b. ')).toBe('Ghế a-b')
    expect(safeName('  ')).toBe('_')
  })
})

describe('readmeText', () => {
  it('liệt kê SP thiếu BOM và file không tải được', () => {
    const r = buildTaiLieu(
      [{ product_id: 'P2', product_code: 'CH2', name: 'Ghế 2', qty: 1, unit: 'cái' }],
      [],
      label,
    )
    const t = readmeText('13/26-27 - MX', r, ['CH9/BOM/x.xlsx'], '2026-11-04')
    expect(t).toContain('CHƯA CÓ FILE BOM (1)')
    expect(t).toContain('CH2 Ghế 2')
    expect(t).toContain('KHÔNG TẢI ĐƯỢC')
  })
})
