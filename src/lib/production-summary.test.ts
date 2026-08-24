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
  deriveDailyTarget,
  paceForWindow,
  lsxStageProgress,
  stageChainWarning,
  isTeamStageBottleneck,
  paceTone,
  resolveDailyTargets,
  forecastFinishDate,
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

describe('deriveDailyTarget — chỉ tiêu ngày suy từ lộ trình (GĐ2)', () => {
  const base = { needQty: 100, doneQty: 10, plannedStart: null, plannedEnd: null }

  it('chưa lên lộ trình (planned_end null) → null', () => {
    expect(deriveDailyTarget({ ...base, todayIso: '2026-08-24' })).toBeNull()
  })

  it('chia đều phần còn lại cho số ngày làm việc còn lại', () => {
    // T2 24/08 → T4 26/08 = 3 ngày; còn 90 → 30/ngày.
    expect(
      deriveDailyTarget({
        ...base,
        plannedEnd: '2026-08-26',
        todayIso: '2026-08-24',
      }),
    ).toBe(30)
  })

  it('Chủ nhật TÍNH vào mẫu số (WORKING_SUNDAYS=true — user chốt 23/08)', () => {
    // T6 28/08 → T2 31/08 chứa CN 30/08 → đủ 4 ngày làm; còn 90 → 22.5.
    expect(
      deriveDailyTarget({
        ...base,
        plannedEnd: '2026-08-31',
        todayIso: '2026-08-28',
      }),
    ).toBe(22.5)
  })

  it('quá hạn → NỢ DỒN cả phần còn lại', () => {
    expect(
      deriveDailyTarget({
        ...base,
        plannedEnd: '2026-08-20',
        todayIso: '2026-08-24',
      }),
    ).toBe(90)
  })

  it('khoảng chỉ còn 1 ngày → dồn hết hôm nay', () => {
    expect(
      deriveDailyTarget({
        ...base,
        plannedEnd: '2026-08-24',
        todayIso: '2026-08-24',
      }),
    ).toBe(90)
  })

  it('đã đủ số → 0 (không âm)', () => {
    expect(
      deriveDailyTarget({
        needQty: 100,
        doneQty: 120,
        plannedStart: null,
        plannedEnd: '2026-08-30',
        todayIso: '2026-08-24',
      }),
    ).toBe(0)
  })

  it('chưa tới planned_start → 0 (chưa phải lượt)', () => {
    expect(
      deriveDailyTarget({
        ...base,
        plannedStart: '2026-08-27',
        plannedEnd: '2026-08-31',
        todayIso: '2026-08-24',
      }),
    ).toBe(0)
  })

  it('nhận cả timestamptz (cắt về ngày)', () => {
    expect(
      deriveDailyTarget({
        ...base,
        plannedEnd: '2026-08-24T07:00:00+00:00',
        todayIso: '2026-08-24',
      }),
    ).toBe(90)
  })
})

describe('isTeamStageBottleneck — nghẽn tại tổ × công đoạn (GĐ3)', () => {
  it('tồn vượt 3 ngày nhịp → nghẽn; trong ngưỡng → không', () => {
    expect(isTeamStageBottleneck(100, [10, 10], 0)).toBe(true) // 10 ngày nhịp
    expect(isTeamStageBottleneck(20, [10, 10], 0)).toBe(false) // 2 ngày nhịp
  })

  it('không có nhịp (chưa ghi sổ): ôm phôi quá 2 ngày → nghẽn', () => {
    expect(isTeamStageBottleneck(50, [], 3)).toBe(true)
    expect(isTeamStageBottleneck(50, [], 1)).toBe(false)
  })

  it('không tồn → không bao giờ nghẽn', () => {
    expect(isTeamStageBottleneck(0, [], 10)).toBe(false)
    expect(isTeamStageBottleneck(-5, [1], 10)).toBe(false)
  })
})

describe('paceTone — nhịp so kế hoạch của ô sổ tổng (GĐ3)', () => {
  it('quá planned_end mà chưa đủ → late', () => {
    expect(
      paceTone({
        done: 50,
        needed: 100,
        plannedStart: '2026-08-01',
        plannedEnd: '2026-08-20',
        todayIso: '2026-08-24',
      }),
    ).toBe('late')
  })

  it('qua nửa thời gian mà chưa nửa số → behind; đủ nhịp → null', () => {
    const w = {
      needed: 100,
      plannedStart: '2026-08-01',
      plannedEnd: '2026-08-21',
      todayIso: '2026-08-15',
    }
    expect(paceTone({ ...w, done: 10 })).toBe('behind')
    expect(paceTone({ ...w, done: 60 })).toBeNull()
  })

  it('xong / không kế hoạch / khoảng 0 ngày → null', () => {
    expect(
      paceTone({
        done: 100,
        needed: 100,
        plannedStart: '2026-08-01',
        plannedEnd: '2026-08-10',
        todayIso: '2026-08-24',
      }),
    ).toBeNull()
    expect(
      paceTone({
        done: 0,
        needed: 100,
        plannedStart: null,
        plannedEnd: null,
        todayIso: '2026-08-24',
      }),
    ).toBeNull()
    expect(
      paceTone({
        done: 0,
        needed: 100,
        plannedStart: '2026-08-24',
        plannedEnd: '2026-08-24',
        todayIso: '2026-08-24',
      }),
    ).toBeNull()
  })
})

describe('resolveDailyTargets — chỉ tiêu thật thắng số suy (GĐ 2.2)', () => {
  it('cặp (tổ×công đoạn) có chỉ tiêu thật → dùng thật, kể cả 0; thiếu → số suy', () => {
    const r = resolveDailyTargets(
      [
        { team_department_id: 't1', stage: 'han', qty: 200 }, // suy — bị thật đè
        { team_department_id: 't1', stage: 'son', qty: 80 }, // suy — giữ
        { team_department_id: 't2', stage: 'nguoi', qty: 150 }, // suy — thật = 0 đè
      ],
      [
        { team_department_id: 't1', stage: 'han', qty: 250 },
        { team_department_id: 't2', stage: 'nguoi', qty: 0 },
      ],
    )
    expect(r.total).toBe(330) // 250 thật + 80 suy + 0 thật
    expect(r.by_team.get('t1')).toBe(330 - 0)
    expect(r.by_team.get('t2')).toBe(0)
  })

  it('chỉ tiêu thật cho cặp KHÔNG có việc suy vẫn tính (KH giao trước)', () => {
    const r = resolveDailyTargets(
      [],
      [{ team_department_id: 't3', stage: 'phoi', qty: 500 }],
    )
    expect(r.total).toBe(500)
    expect(r.by_team.get('t3')).toBe(500)
  })

  it('việc chưa giao tổ chỉ có vế suy, cộng vào tổng', () => {
    const r = resolveDailyTargets(
      [
        { team_department_id: null, stage: 'han', qty: 60 },
        { team_department_id: 't1', stage: 'han', qty: 40 },
      ],
      [],
    )
    expect(r.total).toBe(100)
    expect(r.by_team.get('t1')).toBe(40)
  })

  it('nhiều job cùng (tổ×công đoạn) cộng dồn vế suy trước khi so', () => {
    const r = resolveDailyTargets(
      [
        { team_department_id: 't1', stage: 'han', qty: 30 },
        { team_department_id: 't1', stage: 'han', qty: 20 },
      ],
      [],
    )
    expect(r.by_team.get('t1')).toBe(50)
  })
})

describe('forecastFinishDate — dự kiến xong theo nhịp (plan-hoan-thien #4)', () => {
  it('còn 300, nhịp TB 100/ngày → +3 ngày lịch (xưởng làm CN)', () => {
    expect(forecastFinishDate(300, [120, 80, 100], '2026-08-23')).toBe('2026-08-26')
  })

  it('chia có dư → làm tròn LÊN (250/100 → 3 ngày)', () => {
    expect(forecastFinishDate(250, [100], '2026-08-23')).toBe('2026-08-26')
  })

  it('đã đủ số / chưa có nhịp → null (không đoán)', () => {
    expect(forecastFinishDate(0, [100], '2026-08-23')).toBeNull()
    expect(forecastFinishDate(-5, [100], '2026-08-23')).toBeNull()
    expect(forecastFinishDate(300, [], '2026-08-23')).toBeNull()
  })
})

describe('stageChainWarning — công đoạn sau vượt công đoạn trước (WIP âm)', () => {
  it('sơn sẽ thành 50 mà nguội mới 30 → cảnh báo, không chặn', () => {
    expect(stageChainWarning('KHUNG', 'son', 'nguoi', 30, 20, 30)).toBe(
      'KHUNG: son sẽ thành 50 mà nguoi mới xong 30 — kiểm tra lại số hoặc sổ công đoạn trước',
    )
  })

  it('đủ nguồn (sau ≤ trước) → null', () => {
    expect(stageChainWarning('KHUNG', 'son', 'nguoi', 50, 20, 30)).toBeNull()
    expect(stageChainWarning('KHUNG', 'son', 'nguoi', 50, 0, 50)).toBeNull()
  })
})

describe('lsxStageProgress — tiến độ cả lệnh per công đoạn quy về bộ SP', () => {
  const ORDER = ['phoi', 'han', 'son']

  it('đồng bộ SP=MIN per công đoạn: chi tiết chậm nhất quyết định', () => {
    // Dòng 10 SP: mặt bàn ×1 (cần 10), chân ×4 (cần 40).
    const r = lsxStageProgress(
      ORDER,
      [{ id: 'l1', qty: 10 }],
      [
        {
          order_line_id: 'l1',
          total_needed: 10,
          stages: [
            { stage: 'phoi', done: 10, defect: 0 },
            { stage: 'han', done: 8, defect: 1 },
          ],
        },
        {
          order_line_id: 'l1',
          total_needed: 40,
          stages: [
            { stage: 'phoi', done: 40, defect: 0 },
            { stage: 'han', done: 20, defect: 0 },
          ],
        },
      ],
    )
    expect(r).toEqual([
      { stage: 'phoi', need_sets: 10, done_sets: 10, defect: 0, pct: 1 },
      // han: mặt bàn 8 bộ, chân floor(20×10/40)=5 bộ → min 5.
      { stage: 'han', need_sets: 10, done_sets: 5, defect: 1, pct: 0.5 },
    ])
  })

  it('dòng không có công đoạn thì không vào mẫu số của công đoạn đó', () => {
    const r = lsxStageProgress(
      ORDER,
      [
        { id: 'l1', qty: 10 },
        { id: 'l2', qty: 20 },
      ],
      [
        {
          order_line_id: 'l1',
          total_needed: 10,
          stages: [
            { stage: 'phoi', done: 10, defect: 0 },
            { stage: 'son', done: 0, defect: 0 },
          ],
        },
        {
          order_line_id: 'l2',
          total_needed: 20,
          stages: [{ stage: 'phoi', done: 5, defect: 0 }],
        },
      ],
    )
    expect(r.find((s) => s.stage === 'son')).toEqual({
      stage: 'son',
      need_sets: 10, // chỉ dòng l1
      done_sets: 0,
      defect: 0,
      pct: 0,
    })
    expect(r.find((s) => s.stage === 'phoi')).toMatchObject({
      need_sets: 30,
      done_sets: 15,
    })
  })

  it('đạt cap theo SL dòng (làm dư không đếm quá) + tổng cần 0 bị bỏ khỏi min', () => {
    const r = lsxStageProgress(
      ORDER,
      [{ id: 'l1', qty: 10 }],
      [
        {
          order_line_id: 'l1',
          total_needed: 10,
          stages: [{ stage: 'phoi', done: 15, defect: 0 }],
        },
        {
          order_line_id: 'l1',
          total_needed: 0, // định mức hỏng — bỏ khỏi min, không chia 0
          stages: [{ stage: 'phoi', done: 0, defect: 0 }],
        },
      ],
    )
    expect(r[0]).toMatchObject({ need_sets: 10, done_sets: 10, pct: 1 })
  })

  it('lệnh chưa định hình (không chi tiết) → mảng rỗng', () => {
    expect(lsxStageProgress(ORDER, [{ id: 'l1', qty: 10 }], [])).toEqual([])
  })
})

describe('paceForWindow — nhịp suy cho cả khung lúc đặt hạn (editor)', () => {
  it('50 SP trong 24→26/08 (3 ngày, xưởng làm CN) → 17/ngày (tròn LÊN)', () => {
    expect(paceForWindow(50, '2026-08-24', '2026-08-26')).toBe(17)
  })

  it('cùng ngày hai đầu → cả SL trong 1 ngày', () => {
    expect(paceForWindow(50, '2026-08-24', '2026-08-24')).toBe(50)
  })

  it('thiếu một đầu / khoảng ngược / SL 0 → null (không đoán)', () => {
    expect(paceForWindow(50, null, '2026-08-26')).toBeNull()
    expect(paceForWindow(50, '2026-08-24', null)).toBeNull()
    expect(paceForWindow(50, '2026-08-26', '2026-08-24')).toBeNull()
    expect(paceForWindow(0, '2026-08-24', '2026-08-26')).toBeNull()
  })

  it('nhận cả timestamp đầy đủ — cắt về ngày', () => {
    expect(paceForWindow(30, '2026-08-24T07:00:00Z', '2026-08-26T21:00:00Z')).toBe(10)
  })
})
