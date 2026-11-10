import { describe, expect, it } from 'vitest'
import {
  duongDiCuaLenh,
  maGon,
  mocHan,
  viecKeHoach,
  viecQuanDoc,
  type Row,
  type Shaping,
} from './vao-viec-sx'

/**
 * Vào việc Sản xuất (10/11/2026): số ở dải sáu bước = cùng vị từ với chip Lệnh
 * SX / Lộ trình; bảng việc ≤ 5 dòng, lệnh trễ trước, gom lệnh cùng hạn.
 */

const TODAY = '2026-11-10'
const row = (
  id: string,
  code: string,
  ship: string | null,
  over: Partial<Row> = {},
): Row => ({
  lsx: {
    id,
    code,
    order_codes: [],
    customer_name: 'K',
    status: 'approved',
    priority: 0,
    ship_date: ship,
    materials_received_at: null,
    late: ship && ship < TODAY ? 'overdue' : null,
  },
  component_count: 10,
  jobs_total: 0,
  jobs_no_end: 0,
  qty_done: 0,
  holder: { who: 'Cung ứng', what: '', since: null, days: 5, closed: false },
  ...over,
})
const shp = (r: Row, over: Partial<Shaping> = {}): Shaping => ({
  lsx: {
    id: r.lsx.id,
    code: r.lsx.code,
    customer_name: 'K',
    ship_date: r.lsx.ship_date,
    status: 'approved',
  },
  component_count: r.component_count,
  cluster_unrouted: 0,
  lines_missing_bom: 0,
  ...over,
})

const yotrio = row('y', '01/26-27 - YOTRIO', '2026-10-10')
const jawoll = row('j', '01/26-27 - JAWOLL', '2026-10-19')
const mx06 = row('m6', '06/26-27 - MX', '2026-11-29')
const mx08 = row('m8', '08/26-27 - MX', '2026-11-29')
const mx07 = row('m7', '07/26-27 - MX', '2026-11-29', { component_count: 0 })
const rosco = row('r1', '01/26-27 - ROSCO', '2027-01-11', {
  jobs_total: 4,
  jobs_no_end: 4,
})
const laura = row('l1', '01/26-27 - LAURA', '2027-03-24', { component_count: 0 })
const rows = [yotrio, jawoll, mx06, mx08, mx07, rosco, laura]
const shaping = [
  shp(yotrio),
  shp(jawoll, { cluster_unrouted: 3 }),
  shp(mx06),
  shp(mx08),
  shp(mx07, { lines_missing_bom: 1 }),
  shp(rosco),
  shp(laura, { lines_missing_bom: 0 }),
]

describe('mocHan · maGon', () => {
  it('trễ / còn / năm khác', () => {
    expect(mocHan('2026-10-19', TODAY)).toEqual({ text: '19/10 · trễ 22đ', tone: 'stop' })
    expect(mocHan('2026-11-29', TODAY)).toEqual({ text: '29/11 · còn 19đ', tone: 'warn' })
    expect(mocHan('2027-01-11', TODAY)).toEqual({
      text: '11/01/27 · còn 62đ',
      tone: null,
    })
    expect(maGon('01/26-27 - JAWOLL')).toBe('JAWOLL 01')
    expect(maGon('13/26-27 - MX')).toBe('MX 13')
  })
})

describe('duongDiCuaLenh — sáu bước, số = lệnh đang CHỜ', () => {
  it('đếm bằng vị từ của chip Lệnh SX / Lộ trình', () => {
    const b = duongDiCuaLenh(rows, shaping, TODAY, '0')
    expect(b.map((x) => [x.so, x.n])).toEqual([
      [1, 7],
      [2, 2], // mx07 chờ KT + laura chưa nạp bảng
      [3, 1], // jawoll 3 cụm
      [4, 6], // chưa giao tổ (rosco đã có việc)
      [5, 0],
      [6, 2], // yotrio, jawoll trễ
    ])
    expect(b[1].moTa).toBe('1 chưa định mức · 1 chưa nạp bảng')
    expect(b[1].nut2?.href).toBe('/phan-cong-viec?muc=giao')
    expect(b[3].moTa).toBe('ROSCO 01 có tổ, chưa hạn')
    expect(b[5].moTa).toBe('YOTRIO 01 trễ 31đ · JAWOLL 01 trễ 22đ')
    expect(b[5].href).toBe('/thongke/lenh?view=late')
  })
})

describe('viecKeHoach — ≤ 5 dòng, lệnh trễ trước, gom cùng hạn', () => {
  it('thứ tự và nội dung', () => {
    const v = viecKeHoach(rows, shaping, TODAY)
    expect(v.length).toBeLessThanOrEqual(5)
    expect(v[0]).toMatchObject({
      tone: 'stop',
      lenh: 'YOTRIO 01',
      href: '/kehoach-sx/y',
      moc: '10/10 · trễ 31đ',
    })
    expect(v[1]).toMatchObject({
      tone: 'stop',
      lenh: 'JAWOLL 01',
      href: '/thongke/lo-trinh?lsx=j',
      nut: 'Lộ trình công đoạn ›',
    })
    expect(v[1].viec).toContain('Khai lộ trình 3 cụm')
    // Hai lệnh MX cùng hạn 29/11 gom một dòng, trỏ danh sách Giao tổ & hạn.
    const gom = v.find((x) => x.lenh === 'MX 06 · MX 08')
    expect(gom).toMatchObject({
      tone: 'warn',
      href: '/kehoach-sx',
      moc: '29/11 · còn 19đ',
    })
    expect(gom?.viec).toContain('2 lệnh cùng hạn 29/11')
    expect(v.find((x) => x.href === '/phan-cong-viec?muc=giao')?.viec).toBe(
      'Nhắc Kỹ thuật nạp định mức 1 lệnh — 1 lệnh hạn trong 30 ngày',
    )
    // ROSCO có 4 việc không hạn → "Đặt hạn" (warn) nhưng bị cắt khi quá 5 dòng.
    const all = viecKeHoach([rosco], [shp(rosco)], TODAY)
    expect(all[0]).toMatchObject({
      viec: 'Đặt hạn cho 4 việc đã giao tổ',
      href: '/kehoach-sx/r1',
    })
  })
})

describe('viecQuanDoc', () => {
  it('xưởng chưa có sổ → chọn lệnh thí điểm đứng đầu; công đoạn chưa tổ; lệnh trễ', () => {
    const v = viecQuanDoc(rows, {
      today: TODAY,
      congDoanChuaTo: ['Mài', 'Đan'],
      toChuaChot: 0,
      lenhDuKeHoach: 0,
    })
    expect(v[0].viec).toContain('Chọn lệnh thí điểm')
    expect(v.map((x) => x.href)).toEqual([
      '/kehoach-sx',
      '/thongke/lenh?view=late',
      '/production/cau-hinh/cong-doan',
      '/thongke/lenh?view=stale',
    ])
    expect(v[1].moc).toBe('trễ 31đ · trễ 22đ')
  })
})
