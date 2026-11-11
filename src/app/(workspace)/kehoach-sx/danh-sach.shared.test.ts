import { describe, expect, it } from 'vitest'
import {
  CHIPS,
  cotDai,
  lenhBatDau,
  oToHan,
  resolveChip,
  sapXep,
  trangThai,
  viecKeTiep,
  type DsRow,
} from './danh-sach.shared'

/**
 * Danh sách Giao tổ & hạn (11/11/2026): bốn trạng thái loại trừ nhau cộng lại
 * bằng "Tất cả"; câu kế tiếp + nút đổi theo trạng thái; ô tổ & hạn bốn kiểu.
 */

const TODAY = '2026-11-11'
const row = (
  id: string,
  code: string,
  ship: string | null,
  over: Partial<DsRow> = {},
): DsRow => ({
  id,
  code,
  customer_name: 'K',
  order_codes: [],
  ship_date: ship,
  late: ship && ship < TODAY ? 'overdue' : null,
  line_count: 1,
  lines_shaped: 1,
  lines_missing_bom: 0,
  cluster_unrouted: 0,
  component_count: 10,
  sets_needed: 100,
  jobs_total: 0,
  jobs_no_end: 0,
  jobs_no_team: 0,
  plan_overdue: 0,
  stages: ['PHOI', 'HAN', 'SON'],
  plan_stages: [],
  ...over,
})
const lab = (c: string) => ({ PHOI: 'Phôi', HAN: 'Hàn', SON: 'Sơn', MAI: 'Mài' })[c] ?? c

const yotrio = row('y', '01/26-27 - YOTRIO', '2026-10-10', {
  line_count: 3,
  lines_shaped: 3,
})
const mx08 = row('m8', '08/26-27 - MX', '2026-11-29', { line_count: 5, lines_shaped: 3 })
const jawoll = row('j', '01/26-27 - JAWOLL', '2026-10-19', { cluster_unrouted: 3 })
const mx13 = row('m13', '13/26-27 - MX', '2027-01-10')
const rosco = row('r', '01/26-27 - ROSCO', '2027-01-11', {
  line_count: 37,
  lines_shaped: 1,
  jobs_total: 4,
  jobs_no_end: 4,
  jobs_no_team: 1,
  plan_stages: [
    { stage: 'PHOI', jobs: 1, no_team: 0, no_end: 1 },
    { stage: 'MAI', jobs: 1, no_team: 1, no_end: 1 },
  ],
})
const mx07 = row('m7', '07/26-27 - MX', '2026-11-29', {
  component_count: 0,
  line_count: 2,
  lines_shaped: 0,
  lines_missing_bom: 2,
  sets_needed: 0,
  stages: [],
})
const blackin = row('b', '01/26-27 - BLACKIN', '2027-10-11', {
  component_count: 0,
  line_count: 2,
  lines_shaped: 0,
  sets_needed: 0,
  stages: [],
})
const du = row('d', '02/26-27 - DU', '2027-02-01', {
  jobs_total: 3,
  plan_stages: [
    { stage: 'PHOI', jobs: 1, no_team: 0, no_end: 0 },
    { stage: 'HAN', jobs: 1, no_team: 0, no_end: 0 },
    { stage: 'SON', jobs: 1, no_team: 0, no_end: 0 },
  ],
})
const ALL = [yotrio, mx08, jawoll, mx13, rosco, mx07, blackin, du]

describe('trạng thái + chip', () => {
  it('bốn trạng thái loại trừ nhau, cộng bằng Tất cả', () => {
    const n = (id: string) => ALL.filter(CHIPS.find((c) => c.id === id)!.test).length
    expect(n('chua_giao')).toBe(4)
    expect(n('do')).toBe(1)
    expect(n('cho_kt')).toBe(2)
    expect(n('du')).toBe(1)
    expect(n('chua_giao') + n('do') + n('cho_kt') + n('du')).toBe(n('all'))
  })
  it('chưa có bảng là Chờ KT dù lệnh đã có việc', () => {
    expect(trangThai({ ...mx07, jobs_total: 2 })).toBe('cho_kt')
  })
  it('resolveChip rơi về Chưa giao tổ', () => {
    expect(resolveChip('do')).toBe('do')
    expect(resolveChip('xyz')).toBe('chua_giao')
    expect(resolveChip(undefined)).toBe('chua_giao')
  })
})

describe('sắp xếp', () => {
  it('trễ hạn xuất trước, rồi hạn gần; chưa có hạn cuối', () => {
    const s = sapXep([mx13, row('n', 'N', null), yotrio, mx08])
    expect(s.map((r) => r.id)).toEqual(['y', 'm8', 'm13', 'n'])
  })
  it('lệnh bắt đầu = trễ nhất trong Chưa giao tổ', () => {
    expect(lenhBatDau(ALL)?.id).toBe('y')
    expect(lenhBatDau([mx07, du])).toBeNull()
  })
})

describe('ô Tổ & hạn', () => {
  it('na / empty / half / ok', () => {
    expect(oToHan(rosco, 'HAN')).toBe('empty')
    expect(oToHan(rosco, 'PHOI')).toBe('half')
    expect(oToHan(rosco, 'MAI')).toBe('half')
    expect(oToHan(du, 'SON')).toBe('ok')
    expect(oToHan(du, 'MAI')).toBe('na')
  })
  it('cột dải = hợp công đoạn đi qua + có việc, thứ tự danh mục', () => {
    const cat = ['PHOI', 'HAN', 'MAI', 'SON', 'LAP'].map((code) => ({ code }))
    expect(cotDai([du, rosco], cat)).toEqual(['PHOI', 'HAN', 'MAI', 'SON'])
    expect(cotDai([mx07], cat)).toEqual([])
  })
})

describe('việc kế tiếp', () => {
  it('chờ Kỹ thuật: nhắc KT kèm hạn xuất gần; đã có định mức thì nạp từ BOM', () => {
    const a = viecKeTiep(mx07, TODAY, lab)
    expect(a.text).toBe('Chờ Kỹ thuật nạp định mức 2 SP')
    expect(a.nut.label).toBe('Nhắc KT ›')
    const b = viecKeTiep(blackin, TODAY, lab)
    expect(b.link?.label).toBe('nạp từ BOM ›')
    expect(b.nut.href).toBe('/thongke/lsx/b/dinh-hinh')
  })
  it('chưa giao: cụm chưa khai > dòng chờ KT > trễ hạn > thường', () => {
    expect(viecKeTiep(jawoll, TODAY, lab)).toMatchObject({
      tone: 'stop',
      text: '3 cụm chưa khai lộ trình',
      link: { href: '/thongke/lo-trinh?lsx=j' },
      nut: { label: 'Giao tổ ›', href: '/kehoach-sx/j' },
    })
    expect(viecKeTiep(mx08, TODAY, lab).text).toBe(
      'Giao được 3 dòng; 2 dòng chờ Kỹ thuật',
    )
    expect(viecKeTiep(yotrio, TODAY, lab)).toMatchObject({
      tone: 'stop',
      text: 'Trễ hạn xuất — giao 3 công đoạn từ Phôi',
    })
    expect(viecKeTiep(mx13, TODAY, lab)).toMatchObject({
      tone: 'none',
      text: 'Giao 3 công đoạn',
    })
  })
  it('dở: kể thiếu hạn, thiếu tổ theo công đoạn, dòng chờ KT; nút Đặt hạn', () => {
    const v = viecKeTiep(rosco, TODAY, lab)
    expect(v.text).toBe('4 việc chưa có hạn · 1 việc Mài chưa tổ · 36 dòng chờ Kỹ thuật')
    expect(v.nut.label).toBe('Đặt hạn ›')
    expect(viecKeTiep({ ...rosco, jobs_no_end: 0 }, TODAY, lab).nut.label).toBe(
      'Chọn tổ ›',
    )
  })
  it('đủ: quá hạn kế hoạch nói số việc, không thì tin mừng', () => {
    expect(viecKeTiep({ ...du, plan_overdue: 2 }, TODAY, lab).text).toBe(
      '2 việc quá hạn kế hoạch',
    )
    expect(viecKeTiep(du, TODAY, lab)).toMatchObject({
      tone: 'done',
      text: 'Đủ tổ & hạn · 3 việc',
    })
  })
})
