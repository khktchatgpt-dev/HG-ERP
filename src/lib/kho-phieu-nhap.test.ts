import { describe, expect, it } from 'vitest'
import {
  danhGiaVuot,
  dungLuoi,
  kiemTruocGhiSo,
  tinhTong,
  type DongDon,
  type DongNhan,
} from './kho-phieu-nhap'

const dong = (p: Partial<DongDon> & { id: string }): DongDon => ({
  material_id: 'm-' + p.id,
  material_code: 'VT-' + p.id,
  material_name: 'Vật tư ' + p.id,
  material_unit: 'cây',
  qty_ordered: 100,
  qty_received: 0,
  qty_open: 100,
  closed_short_at: null,
  over_tolerance_pct: 5,
  ...p,
})

describe('dungLuoi — điền sẵn phần còn mở', () => {
  it('không có đợt: Lần này = qty_open; đã đủ thì không nhập được và = 0', () => {
    const { rows, bo_qua_tu_do } = dungLuoi([
      dong({ id: '1', qty_received: 20, qty_open: 80 }),
      dong({ id: '2', qty_received: 100, qty_open: 0 }),
    ])
    expect(rows.map((r) => [r.qty, r.editable])).toEqual([
      [80, true],
      [0, false],
    ])
    expect(bo_qua_tu_do).toBe(0)
  })
  it('có đợt: lấy SL của đợt, chặn trên bằng phần còn mở; dòng ngoài đợt = 0', () => {
    const { rows } = dungLuoi(
      [dong({ id: '1', qty_open: 30 }), dong({ id: '2' }), dong({ id: '3' })],
      [
        { po_line_id: '1', qty: 50 },
        { po_line_id: '2', qty: 40 },
      ],
    )
    expect(rows.map((r) => r.qty)).toEqual([30, 40, 0])
  })
  it('dòng tự do (không mã vật tư) bị bỏ, có đếm để màn nói ra', () => {
    const { rows, bo_qua_tu_do } = dungLuoi([
      dong({ id: '1' }),
      dong({ id: 'g', material_id: null }),
    ])
    expect(rows).toHaveLength(1)
    expect(bo_qua_tu_do).toBe(1)
  })
  it('dòng đã chốt thiếu: qty_open = 0 nên không nhập, cờ closed_short bật', () => {
    const { rows } = dungLuoi([
      dong({ id: '1', qty_open: 0, closed_short_at: '2026-09-10' }),
    ])
    expect(rows[0].editable).toBe(false)
    expect(rows[0].closed_short).toBe(true)
  })
})

const row = (p: Partial<DongNhan> & { code: string }): DongNhan => ({
  po_line_id: 'l-' + p.code,
  material_id: 'm-' + p.code,
  name: p.code,
  unit: 'cây',
  qty_ordered: 100,
  qty_received: 0,
  qty_open: 100,
  over_tolerance_pct: 5,
  closed_short: false,
  editable: true,
  qty: 0,
  status: 'ok',
  note: '',
  ...p,
})

describe('tinhTong', () => {
  it('cộng đúng và tách phần vào khoá', () => {
    const t = tinhTong([
      row({ code: 'A', qty: 380, qty_ordered: 500, qty_received: 120 }),
      row({ code: 'B', qty: 200, status: 'blocked', qty_ordered: 200 }),
      row({ code: 'C', qty: 0, qty_ordered: 5000, qty_received: 5000, editable: false }),
    ])
    expect(t).toEqual({
      so_dong_nhan: 2,
      lan_nay: 580,
      vao_khoa: 200,
      dung_duoc: 380,
      tong_dat: 5700,
      tong_da_ve: 5120,
    })
  })
})

describe('danhGiaVuot — cùng công thức server (ngưỡng trên SL đặt)', () => {
  it('không vượt → null', () =>
    expect(danhGiaVuot(row({ code: 'A', qty: 100 }))).toBeNull())
  it('vượt 3% với dung sai 5% → trong dung sai', () => {
    expect(danhGiaVuot(row({ code: 'A', qty: 103 }))).toEqual({
      vuot: 3,
      pct: 3,
      trong_dung_sai: true,
    })
  })
  it('vượt 12% với dung sai 5% → ngoài dung sai', () => {
    const v = danhGiaVuot(row({ code: 'A', qty_ordered: 300, qty_open: 300, qty: 336 }))
    expect(v).toEqual({ vuot: 36, pct: 12, trong_dung_sai: false })
  })
  it('đúng biên 5% thì vẫn trong dung sai', () => {
    expect(danhGiaVuot(row({ code: 'A', qty: 105 }))!.trong_dung_sai).toBe(true)
  })
})

describe('kiemTruocGhiSo — câu chặn phải chỉ được tới dòng', () => {
  it('không dòng nào có số → khong_dong, trỏ dòng nhập được đầu tiên', () => {
    const k = kiemTruocGhiSo([row({ code: 'A', editable: false }), row({ code: 'B' })])
    expect(k).toMatchObject({ ok: false, reason: 'khong_dong', line: 1 })
  })
  it('số âm → so_khong_hop_le, đứng trước mọi kiểm khác', () => {
    const k = kiemTruocGhiSo([row({ code: 'A', qty: -1 })])
    expect(k).toMatchObject({ ok: false, reason: 'so_khong_hop_le', line: 0 })
  })
  it('sai quy cách thiếu ghi chú → thieu_ghi_chu', () => {
    const k = kiemTruocGhiSo([
      row({ code: 'A', qty: 10 }),
      row({ code: 'B', qty: 5, status: 'blocked', note: '  ' }),
    ])
    expect(k).toMatchObject({ ok: false, reason: 'thieu_ghi_chu', line: 1 })
    expect((k as { message: string }).message).toContain('VT-B'.replace('VT-', ''))
  })
  it('vượt dung sai chặn khi chưa có lý do, thả khi có', () => {
    const rows = [row({ code: 'A', qty_ordered: 300, qty_open: 300, qty: 336 })]
    expect(kiemTruocGhiSo(rows)).toMatchObject({
      ok: false,
      reason: 'vuot_dung_sai',
      line: 0,
    })
    expect(kiemTruocGhiSo(rows, true)).toEqual({ ok: true })
  })
  it('vượt trong dung sai không chặn', () => {
    expect(kiemTruocGhiSo([row({ code: 'A', qty: 103 })])).toEqual({ ok: true })
  })
})
