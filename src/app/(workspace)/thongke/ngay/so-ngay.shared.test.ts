import { describe, expect, it } from 'vitest'
import {
  buildRows,
  cauChot,
  cauSo,
  CHIPS,
  dauO,
  moSan,
  nutHang,
  thu,
  trangThaiSo,
  type DocRow,
} from './so-ngay.shared'
import type { DayTeam } from '@/modules/dept/production/entries.service'

/**
 * Sổ ngày (11/11/2026): một hàng mỗi tổ kỳ vọng kể cả chưa ghi; tổ của người
 * xem lên đầu; chip đếm = lọc; câu chốt cảnh báo nháp / sổ trống; dấu ma trận.
 */

const team = (
  id: string,
  name: string,
  stage: string,
  unit: string,
  has_jobs = false,
): DayTeam => ({
  id,
  name,
  stage,
  stage_label: stage,
  unit,
  has_jobs,
})
const TEAMS = [
  team('tp', 'Tổ Phôi', 'Phôi', 'chi tiết', true),
  team('th', 'Tổ Hàn', 'Hàn', 'cụm'),
  team('tn', 'Tổ Nguội', 'Nguội', 'cụm'),
]
const doc = (
  id: string,
  team_id: string,
  status: DocRow['status'],
  qty: number,
  over: Partial<DocRow> = {},
): DocRow => ({
  id,
  doc_no: `PBS-${id}`,
  lsx_id: 'l',
  lsx_code: 'YOTRIO',
  stage: 'phoi',
  status,
  team_id,
  created_by_name: 'Thử',
  created_at: `2026-11-10T0${id.length}:00:00Z`,
  total_qty: qty,
  total_defect: 0,
  total_rework: 0,
  line_count: 1,
  ...over,
})
const DOCS = [
  doc('1', 'tp', 'da_xac_nhan', 100, { total_defect: 2, total_rework: 3 }),
  doc('22', 'tp', 'nhap', 60),
  doc('333', 'th', 'da_xac_nhan', 40),
  doc('4444', 'tx', 'da_xac_nhan', 5),
]
const LOCKS = [
  {
    team_id: 'th',
    team_name: 'Tổ Hàn',
    locked_by_name: 'Kê',
    locked_at: '2026-11-10T09:58:00Z',
  },
]

describe('hàng tổ', () => {
  const rows = buildRows(TEAMS, DOCS, LOCKS, [], null)
  it('mọi tổ kỳ vọng có hàng + tổ lạ có phiếu được thêm', () => {
    expect(rows.map((r) => r.id)).toEqual(['tp', 'th', 'tn', 'tx'])
  })
  it('Σ chỉ cộng phiếu chính thức; nháp đếm riêng', () => {
    const tp = rows[0]
    expect(tp).toMatchObject({ qty: 100, defect: 2, rework: 3, drafts: 1, officials: 1 })
    expect(trangThaiSo(tp)).toBe('dang_mo')
    expect(trangThaiSo(rows[1])).toBe('da_chot')
    expect(trangThaiSo(rows[2])).toBe('chua_so')
  })
  it('tổ của người xem lên đầu', () => {
    expect(buildRows(TEAMS, DOCS, LOCKS, [], 'tn')[0].id).toBe('tn')
  })
  it('chip đếm = lọc; Chưa chốt gồm cả chưa có sổ', () => {
    const n = (id: string) => rows.filter(CHIPS.find((c) => c.id === id)!.test).length
    expect(n('chua_chot')).toBe(3)
    expect(n('nhap')).toBe(1)
    expect(n('da_chot')).toBe(1)
    expect(n('all')).toBe(4)
  })
  it('mở sẵn tổ có nháp / phế; nút theo trạng thái + quyền', () => {
    expect(moSan(rows[0])).toBe(true)
    expect(moSan(rows[1])).toBe(false)
    const p = { canLock: true, canUnlock: false }
    expect(nutHang(rows[0], p)).toBe('chot')
    expect(nutHang(rows[1], p)).toBeNull()
    expect(nutHang(rows[1], { canLock: true, canUnlock: true })).toBe('mo_khoa')
    expect(nutHang(rows[2], p)).toBe('ghi')
  })
  it('câu sổ: đã chốt kèm người · giờ; chưa có sổ nói có việc', () => {
    expect(cauSo(rows[1])).toMatchObject({ tone: 'g', text: 'đã chốt' })
    expect(cauSo(rows[1]).sub).toMatch(/^Kê · \d{2}:\d{2}$/)
    expect(cauSo(rows[2])).toEqual({ tone: 'z', text: 'chưa có sổ', sub: undefined })
    expect(cauSo(rows[0]).sub).toBe('1 phiếu nháp chưa vào số chính thức')
  })
})

describe('câu chốt + ma trận', () => {
  const rows = buildRows(TEAMS, DOCS, LOCKS, [], null)
  it('chốt có nháp → cảnh báo nêu số phiếu; sổ trống → câu riêng', () => {
    const c = cauChot(rows[0], '2026-11-10')
    expect(c.text).toBe(
      'Chốt sổ Tổ Phôi · 10/11: 1 phiếu chính thức · 100 chi tiết · phế 2 · sửa 3.',
    )
    expect(c.warn).toContain('PBS-22 còn NHÁP (60 chi tiết)')
    expect(cauChot(rows[2], '2026-11-10')).toMatchObject({ empty: true })
  })
  it('dấu ô: ✓ > ● > ! (ngày qua, có sổ, chưa chốt)', () => {
    expect(dauO({ qty: 10, drafts: 1, locked: true }, '2026-11-09', '2026-11-11')).toBe(
      '✓',
    )
    expect(dauO({ qty: 10, drafts: 1, locked: false }, '2026-11-09', '2026-11-11')).toBe(
      '●',
    )
    expect(dauO({ qty: 10, drafts: 0, locked: false }, '2026-11-09', '2026-11-11')).toBe(
      '!',
    )
    expect(
      dauO({ qty: 10, drafts: 0, locked: false }, '2026-11-11', '2026-11-11'),
    ).toBeNull()
    expect(dauO(undefined, '2026-11-09', '2026-11-11')).toBeNull()
  })
  it('thứ trong tuần', () => {
    expect(thu('2026-11-11')).toBe('T4')
    expect(thu('2026-11-15')).toBe('CN')
  })
})
