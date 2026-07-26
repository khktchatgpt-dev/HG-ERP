import { describe, it, expect } from 'vitest'
import {
  summarizeComponent,
  summarizeOutsource,
  summarizeTeamWip,
  syncedSets,
  overrunWarning,
  assemblyWipWarning,
  backflushKg,
  teamWipShortageWarning,
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

  it('CỤM (0088): first_stage=han → chỉ tính từ HÀN trở đi, không có cột phôi', () => {
    const s = summarizeComponent(
      2400,
      STAGES,
      [
        { stage: 'han', done: 2400, defect: 0 },
        { stage: 'son', done: 2400, defect: 0 },
      ],
      null,
      'han',
    )
    expect(s.stages.map((x) => x.stage)).toEqual(['han', 'nguoi', 'son'])
    expect(s.done_final).toBe(2400)
    expect(s.status).toBe('done')
  })

  it('first_stage + final_stage → khoảng [first..final] (cụm chỉ hàn→nguội)', () => {
    const s = summarizeComponent(
      100,
      STAGES,
      [{ stage: 'han', done: 100, defect: 0 }],
      'nguoi',
      'han',
    )
    expect(s.stages.map((x) => x.stage)).toEqual(['han', 'nguoi'])
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

describe('summarizeTeamWip — bàn giao nội bộ: giao − trả − đã dùng (0090)', () => {
  it('kiểu sheet tổ Excel: giao 300 (2 đợt) − trả 2 phôi móp − đã dùng 250 → còn 48', () => {
    const s = summarizeTeamWip(
      [
        { direction: 'issue', qty: 200 },
        { direction: 'issue', qty: 100 },
        { direction: 'return', qty: 2 },
      ],
      250,
    )
    expect(s).toEqual({ issued: 300, returned: 2, used: 250, available: 48 })
  })

  it('chưa giao gì → issued 0 (caller bỏ qua cảnh báo)', () => {
    expect(summarizeTeamWip([], 50)).toEqual({
      issued: 0,
      returned: 0,
      used: 50,
      available: -50,
    })
  })
})

describe('teamWipShortageWarning — ghi sản lượng vượt số được giao (0090)', () => {
  it('tổ được giao 300, đã dùng 250 → ghi thêm 60 là vượt 10', () => {
    const w = teamWipShortageWarning(
      'TAY+TỰA',
      'han',
      { issued: 300, returned: 0, used: 250, available: 50 },
      60,
    )
    expect(w).toContain('VƯỢT 10')
  })

  it('trong hạn mức / tổ không đi qua sổ bàn giao (issued 0) → null', () => {
    expect(
      teamWipShortageWarning(
        'x',
        'han',
        { issued: 300, returned: 0, used: 250, available: 50 },
        50,
      ),
    ).toBeNull()
    expect(
      teamWipShortageWarning(
        'x',
        'han',
        { issued: 0, returned: 0, used: 0, available: 0 },
        999,
      ),
    ).toBeNull()
  })
})

describe('backflushKg — kg bỏ trống tự tính ĐM × SL (0090)', () => {
  it('kg trống + có ĐM → ĐM × SL (làm tròn 2 chữ số như Excel)', () => {
    expect(backflushKg(null, 0.6, 2400)).toBe(1440)
    expect(backflushKg(undefined, 0.165, 396)).toBe(65.34)
  })

  it('người nhập ghi đè → giữ nguyên; không ĐM / SL 0 → null (không đoán)', () => {
    expect(backflushKg(1500, 0.6, 2400)).toBe(1500)
    expect(backflushKg(0, 0.6, 2400)).toBe(0) // 0 là giá trị chủ ý, không backflush
    expect(backflushKg(null, null, 100)).toBeNull()
    expect(backflushKg(null, 0.6, 0)).toBeNull()
  })
})

describe('assemblyWipWarning — cảnh báo WIP liên cấp cụm/chi tiết (0088)', () => {
  it('hàn 100 cụm nhưng chi tiết chân (2/cụm) mới xong 150 → cảnh báo', () => {
    const w = assemblyWipWarning('CỤM TỰA', 100, [
      { name: 'CHÂN', qtyPerAssembly: 2, partDone: 150 }, // cần 200, mới 150 → thiếu
      { name: 'MẶT', qtyPerAssembly: 1, partDone: 120 }, // cần 100, đủ
    ])
    expect(w).toContain('VƯỢT')
    expect(w).toContain('CHÂN cần 200 nhưng mới xong 150')
    expect(w).not.toContain('MẶT')
  })

  it('đủ chi tiết cho số cụm → null', () => {
    expect(
      assemblyWipWarning('CỤM MÊ', 50, [
        { name: 'KHUNG', qtyPerAssembly: 1, partDone: 60 },
      ]),
    ).toBeNull()
    expect(assemblyWipWarning('x', 10, [])).toBeNull()
  })
})
