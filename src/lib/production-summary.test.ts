import { describe, it, expect } from 'vitest'
import {
  summarizeComponent,
  summarizeOutsource,
  syncedSets,
  overrunWarning,
} from './production-summary'

const STAGES = ['phoi', 'han', 'nguoi', 'son']

describe('summarizeComponent — thiếu/dư, %HT per công đoạn + tổng (FR-PR-04/05)', () => {
  it('kiểu sheet quan li: tổng cần 96 — phôi xong 96, hàn 60, sơn 0', () => {
    const s = summarizeComponent(96, STAGES, [
      { stage: 'phoi', done: 96, defect: 2 },
      { stage: 'han', done: 60, defect: 0 },
    ])
    expect(s.stages[0]).toMatchObject({ stage: 'phoi', missing: 0, pct: 1 })
    expect(s.stages[1]).toMatchObject({ stage: 'han', missing: 36 }) // thiếu 36
    expect(s.stages[3]).toMatchObject({ stage: 'son', done: 0, missing: 96, pct: 0 })
    expect(s.pct_total).toBe(0) // chưa qua công đoạn cuối → chưa hoàn thành
    expect(s.status).toBe('in_progress')
  })

  it('làm DƯ → thiếu/(dư) âm, pct cap 100%', () => {
    const s = summarizeComponent(50, STAGES, [{ stage: 'son', done: 55, defect: 0 }])
    expect(s.stages[3].missing).toBe(-5)
    expect(s.stages[3].pct).toBe(1)
    expect(s.status).toBe('done')
  })

  it('KHÔNG chia 0: tổng cần 0 → pct 0, không NaN (NFR-CC-03)', () => {
    const s = summarizeComponent(0, STAGES, [{ stage: 'phoi', done: 10, defect: 0 }])
    expect(s.stages[0].pct).toBe(0)
    expect(Number.isNaN(s.pct_total)).toBe(false)
  })

  it('tuỳ SP công đoạn khác nhau: final_stage=nguoi → đủ ở NGUỘI là Hoàn thành, không chờ SƠN', () => {
    const s = summarizeComponent(
      50,
      STAGES,
      [
        { stage: 'phoi', done: 50, defect: 0 },
        { stage: 'nguoi', done: 50, defect: 0 },
      ],
      'nguoi',
    )
    expect(s.stages).toHaveLength(3) // phôi, hàn, nguội — không có cột sơn
    expect(s.done_final).toBe(50)
    expect(s.status).toBe('done')
    expect(s.pct_total).toBe(1)
  })

  it('final_stage không khớp danh mục → dùng công đoạn cuối danh mục (an toàn)', () => {
    const s = summarizeComponent(10, STAGES, [], 'khong-ton-tai')
    expect(s.stages).toHaveLength(4)
  })

  it('trạng thái: chưa làm / đang làm / hoàn thành (dựa công đoạn cuối)', () => {
    expect(summarizeComponent(10, STAGES, []).status).toBe('not_started')
    expect(
      summarizeComponent(10, STAGES, [{ stage: 'phoi', done: 3, defect: 0 }]).status,
    ).toBe('in_progress')
    expect(
      summarizeComponent(10, STAGES, [{ stage: 'son', done: 10, defect: 0 }]).status,
    ).toBe('done')
  })
})

describe('syncedSets — đồng bộ bộ SP theo chi tiết chậm nhất (FR-PR-06)', () => {
  it('min theo chi tiết: ghế cần 2 TAY (đã sơn 96) + 4 CHÂN (đã sơn 100) → 25 bộ', () => {
    expect(
      syncedSets([
        { qty_per_unit: 2, done_final: 96 }, // 48 bộ
        { qty_per_unit: 4, done_final: 100 }, // 25 bộ ← chậm nhất
      ]),
    ).toBe(25)
  })

  it('CT/SP = 0 hoặc thiếu → bỏ dòng, không chia 0; không dòng hợp lệ → 0', () => {
    expect(
      syncedSets([
        { qty_per_unit: 0, done_final: 99 },
        { qty_per_unit: 2, done_final: 10 },
      ]),
    ).toBe(5)
    expect(syncedSets([{ qty_per_unit: 0, done_final: 99 }])).toBe(0)
    expect(syncedSets([])).toBe(0)
  })
})

describe('summarizeOutsource — đối chiếu giao/nhận gia công ngoài (FR-OS-02)', () => {
  it('nhiều đợt giao (SL giao 1/2/3) + nhận về từng phần', () => {
    const s = summarizeOutsource([
      { direction: 'send', qty: 50, defect_qty: 0 },
      { direction: 'send', qty: 30, defect_qty: 0 },
      { direction: 'receive', qty: 60, defect_qty: 3 },
    ])
    expect(s).toMatchObject({ sent: 80, received: 60, defect: 3, missing: 20 })
    expect(s.pct).toBe(0.75)
  })

  it('chưa giao gì → pct 0, không chia 0', () => {
    expect(summarizeOutsource([]).pct).toBe(0)
  })
})

describe('overrunWarning — cảnh báo nhập vượt tổng cần (FR-PR-07, không chặn)', () => {
  it('vượt → chuỗi cảnh báo nêu rõ số vượt', () => {
    expect(overrunWarning('TAY+TỰA', 'phôi', 90, 10, 96)).toContain('VƯỢT 4')
  })

  it('chưa vượt / tổng cần 0 → null', () => {
    expect(overrunWarning('x', 'phôi', 90, 6, 96)).toBeNull()
    expect(overrunWarning('x', 'phôi', 5, 5, 0)).toBeNull()
  })
})
