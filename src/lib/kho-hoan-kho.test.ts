import { describe, expect, it } from 'vitest'
import {
  dungLuoiHoan,
  kiemTruocGhiSoHoan,
  tinhTongHoan,
  vuotDaLinh,
  type DauPhieuHoan,
  type DongHoan,
} from './kho-hoan-kho'

const daLinh = (n: number, issued: number) => ({
  material_id: `m${n}`,
  code: `VT-000${n}`,
  name: `Vật tư ${n}`,
  unit: 'cây',
  issued,
})

const dong = (n: number, issued: number, p: Partial<DongHoan> = {}): DongHoan => ({
  ...daLinh(n, issued),
  qty: 0,
  note: '',
  ...p,
})

const head: DauPhieuHoan = {
  lsx_id: 'lsx-1',
  to: 'Tổ Hàn',
  doc_date: '2026-09-16',
  note: '',
}

describe('dungLuoiHoan', () => {
  it('điền sẵn mọi mã lệnh đang giữ, số hoàn để 0', () => {
    const rows = dungLuoiHoan([daLinh(1, 380), daLinh(2, 500)])
    expect(rows).toHaveLength(2)
    expect(rows.every((r) => r.qty === 0 && r.note === '')).toBe(true)
    expect(rows[0].issued).toBe(380)
  })

  it('lệnh chưa lĩnh gì ra lưới rỗng — KHÔNG đẻ dòng trống', () => {
    expect(dungLuoiHoan([])).toEqual([])
  })
})

describe('vuotDaLinh', () => {
  it('hoàn trong phần đã lĩnh thì null', () => {
    expect(vuotDaLinh({ qty: 42, issued: 380 })).toBeNull()
    expect(vuotDaLinh({ qty: 380, issued: 380 })).toBeNull()
  })

  it('hoàn quá phần đã lĩnh thì trả phần vượt', () => {
    expect(vuotDaLinh({ qty: 620, issued: 500 })).toBe(120)
  })

  it('sai số dấu phẩy động không thành lỗi vượt', () => {
    expect(vuotDaLinh({ qty: 0.1 + 0.2, issued: 0.3 })).toBeNull()
  })
})

describe('tinhTongHoan', () => {
  it('cộng số hoàn và tổng đã lĩnh riêng', () => {
    expect(
      tinhTongHoan([dong(1, 380, { qty: 42 }), dong(2, 500), dong(3, 62, { qty: 8 })]),
    ).toEqual({ so_dong: 2, tong: 50, tong_da_linh: 942 })
  })

  it('lưới rỗng ra 0 chứ không NaN', () => {
    expect(tinhTongHoan([])).toEqual({ so_dong: 0, tong: 0, tong_da_linh: 0 })
  })
})

describe('kiemTruocGhiSoHoan', () => {
  it('đủ thì cho ghi sổ', () => {
    expect(kiemTruocGhiSoHoan(head, [dong(1, 380, { qty: 42 })])).toEqual({ ok: true })
  })

  it('chưa chọn lệnh chặn trước tiên', () => {
    const r = kiemTruocGhiSoHoan({ ...head, lsx_id: '' }, [dong(1, 380, { qty: 42 })])
    expect(r).toMatchObject({ ok: false, reason: 'thieu_lenh', focus: 'lenh' })
  })

  it('lệnh chưa lĩnh gì là lý do RIÊNG, không gộp vào "chưa có dòng"', () => {
    const r = kiemTruocGhiSoHoan(head, [])
    expect(r).toMatchObject({ ok: false, reason: 'chua_linh_gi', focus: 'lenh' })
    if (!r.ok) expect(r.message).toMatch(/chưa lĩnh vật tư nào/)
  })

  it('lệnh chưa lĩnh gì chặn TRƯỚC cả việc thiếu tổ — chọn tổ cũng vô ích', () => {
    const r = kiemTruocGhiSoHoan({ ...head, to: '' }, [])
    expect(r).toMatchObject({ ok: false, reason: 'chua_linh_gi' })
  })

  it('thiếu tổ trả thì chặn', () => {
    const r = kiemTruocGhiSoHoan({ ...head, to: '  ' }, [dong(1, 380, { qty: 42 })])
    expect(r).toMatchObject({ ok: false, reason: 'thieu_to', focus: 'to' })
  })

  it('số âm hoặc NaN chặn và chỉ đúng dòng', () => {
    const r = kiemTruocGhiSoHoan(head, [
      dong(1, 380, { qty: 42 }),
      dong(2, 500, { qty: Number.NaN }),
    ])
    expect(r).toMatchObject({ ok: false, reason: 'so_khong_hop_le', focus: 1 })
  })

  it('hoàn vượt phần đã lĩnh chặn, nói cả hai con số', () => {
    const r = kiemTruocGhiSoHoan(head, [dong(1, 500, { qty: 620 })])
    expect(r).toMatchObject({ ok: false, reason: 'vuot_da_linh', focus: 0 })
    if (!r.ok) {
      expect(r.message).toContain('620')
      expect(r.message).toContain('500')
    }
  })

  it('vượt trần chặn TRƯỚC "chưa dòng nào có số" — số sai nặng hơn số thiếu', () => {
    const r = kiemTruocGhiSoHoan(head, [dong(1, 100, { qty: 200 })])
    expect(r).toMatchObject({ ok: false, reason: 'vuot_da_linh' })
  })

  it('có dòng nhưng chưa dòng nào có số', () => {
    const r = kiemTruocGhiSoHoan(head, [dong(1, 380), dong(2, 500)])
    expect(r).toMatchObject({ ok: false, reason: 'khong_dong', focus: 0 })
  })

  it('hoàn đúng bằng phần đã lĩnh là hợp lệ', () => {
    expect(kiemTruocGhiSoHoan(head, [dong(1, 380, { qty: 380 })])).toEqual({ ok: true })
  })
})
