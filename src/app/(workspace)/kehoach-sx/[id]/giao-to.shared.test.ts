import { describe, expect, it } from 'vitest'
import type { PlanView } from '@/modules/dept/production/plan.service'
import {
  blockers,
  columnsOf,
  diffDraft,
  effectiveCell,
  initialDraft,
  needCellText,
  spanText,
  stageDraftSummary,
  type Draft,
} from './giao-to.shared'

/**
 * Giao tổ & hạn (khuôn F, 10/11/2026) — nháp lưới: hàng Cả lệnh áp xuống dòng
 * chưa có KH, dòng sửa riêng thắng, payload đúng hai API cũ, câu chặn.
 */

const stages = [
  { code: 'phoi', label: 'Phôi' },
  { code: 'han', label: 'Hàn' },
  { code: 'son', label: 'Sơn' },
  { code: 'lap_rap', label: 'Lắp ráp' },
]
const teams = [
  { id: 't-phoi', name: 'Tổ Phôi', stage_code: 'phoi' },
  { id: 't-han', name: 'Tổ Hàn', stage_code: 'han' },
  { id: 't-son-nhom', name: 'Tổ Sơn Nhôm', stage_code: 'son' },
  { id: 't-son-sat', name: 'Tổ Sơn Sắt', stage_code: 'son' },
]
const job = (
  line: string,
  stage: string,
  status: 'todo' | 'doing' = 'todo',
  team = 't-han',
) =>
  ({
    id: `j-${line}-${stage}`,
    production_order_id: 'lsx',
    production_order_line_id: line,
    stage,
    seq: 0,
    status,
    team_department_id: team,
    team_name: teams.find((t) => t.id === team)?.name ?? null,
    planned_start: null,
    planned_end: null,
  }) as unknown as PlanView['lines'][number]['jobs'][number]

const view = {
  lsx: {
    id: 'lsx',
    code: 'L',
    status: 'approved',
    priority: 0,
    ship_date: null,
    order_codes: [],
    customer_name: 'K',
  },
  stages,
  teams,
  history: [],
  today: '2026-11-10',
  khoi_luong: {
    stages: [],
    lines: [],
    not_traversed: [],
    unshaped: 0,
    unassigned: { parts: 0, qty: 0 },
  },
  lines: [
    {
      order_line_id: 'A',
      group_title: '',
      product_id: null,
      product_code: 'CH0119',
      product_name: 'Ghế',
      qty: 300,
      default_route: ['phoi', 'han', 'son'],
      jobs: [],
      needs: {
        phoi: [{ level: 'part', unit: 'chi tiết', needed: 9000, done: 0 }],
        han: [{ level: 'cluster', unit: 'cái', needed: 300, done: 0 }],
        son: [
          { level: 'cluster', unit: 'cái', needed: 300, done: 0 },
          { level: 'part', unit: 'chi tiết', needed: 900, done: 0 },
        ],
      },
    },
    {
      // Đã có kế hoạch hàn (đang làm) — Cả lệnh không đè, trừ khi ghi đè.
      order_line_id: 'B',
      group_title: '',
      product_id: null,
      product_code: 'TB0227',
      product_name: 'Bàn',
      qty: 80,
      default_route: ['phoi', 'han'],
      jobs: [job('B', 'han', 'doing')],
      needs: {
        phoi: [{ level: 'part', unit: 'chi tiết', needed: 400, done: 0 }],
        han: [{ level: 'cluster', unit: 'cái', needed: 80, done: 0 }],
      },
    },
  ],
} as unknown as PlanView

describe('Giao tổ & hạn — nháp lưới', () => {
  it('nháp ban đầu = jobs; cột = công đoạn có cần hoặc có việc, theo danh mục', () => {
    const d = initialDraft(view)
    expect(d.lines.B.han).toEqual({ on: true, team: 't-han', start: '', end: '' })
    expect(columnsOf(view, d).map((s) => s.code)).toEqual(['phoi', 'han', 'son'])
    expect(columnsOf(view, d, ['lap_rap']).map((s) => s.code)).toEqual([
      'phoi',
      'han',
      'son',
      'lap_rap',
    ])
  })

  it('hàng Cả lệnh áp xuống dòng CHƯA có KH; dòng có KH giữ nguyên, ghi đè mới nhận', () => {
    const d: Draft = {
      ...initialDraft(view),
      all: { han: { on: true, team: 't-han', start: '2026-11-17', end: '2026-12-05' } },
    }
    expect(effectiveCell(view, d, 'A', 'han', false)).toMatchObject({ source: 'all' })
    expect(effectiveCell(view, d, 'B', 'han', false)).toMatchObject({ source: 'job' })
    expect(effectiveCell(view, d, 'B', 'han', true)).toMatchObject({ source: 'all' })
    // Dòng không đi qua công đoạn → Cả lệnh không sinh việc.
    const d2: Draft = {
      ...d,
      all: { son: { on: true, team: 't-son-nhom', start: '', end: '' } },
    }
    expect(effectiveCell(view, d2, 'B', 'son', false)).toMatchObject({ source: 'none' })
    const diff = diffDraft(view, d, false)
    expect(diff.lsx?.stages).toEqual([
      {
        stage: 'han',
        team_department_id: 't-han',
        planned_start: '2026-11-17',
        planned_end: '2026-12-05',
      },
    ])
    expect(diff.receiving).toBe(1)
    expect(diff.lines).toEqual([])
  })

  it('ô sửa riêng → payload linePlanSchema TRỌN dòng (gồm ô nhận từ Cả lệnh); việc đang làm bị đổi → cần lý do', () => {
    const d: Draft = {
      all: { phoi: { on: true, team: 't-phoi', start: '', end: '' } },
      lines: {
        A: {
          son: { on: true, team: 't-son-sat', start: '2026-12-01', end: '2026-12-17' },
        },
        B: { han: { on: true, team: 't-han', start: '2026-11-20', end: '2026-11-30' } },
      },
    }
    const diff = diffDraft(view, d, false)
    expect(diff.lines.map((l) => l.order_line_id)).toEqual(['A', 'B'])
    expect(diff.lines[0].stages.map((s) => s.stage)).toEqual(['phoi', 'son'])
    expect(diff.activeTouched).toBe(1)
    const chan = blockers(view, d, false, '', diff)
    expect(chan.map((b) => b.text)).toContain(
      '1 việc đã chạy bị đổi — ghi lý do điều chỉnh (nhật ký 0169)',
    )
    expect(blockers(view, d, false, 'dời vì thiếu nhôm', diff)).toEqual([])
  })

  it('chặn: hạn ngược (trỏ đúng ô) · 2 tổ sơn chưa chọn · chưa đổi gì', () => {
    const d0 = initialDraft(view)
    expect(
      blockers(view, d0, false, '', diffDraft(view, d0, false)).map((b) => b.text),
    ).toEqual(['Chưa đổi gì để lưu'])
    const d: Draft = {
      all: { son: { on: true, team: '', start: '2026-12-10', end: '2026-12-05' } },
      lines: d0.lines,
    }
    const chan = blockers(view, d, false, '', diffDraft(view, d, false))
    expect(chan[0]).toMatchObject({ kind: 'stop', cell: { line: null, stage: 'son' } })
    expect(chan[0].text).toBe(
      'Cả lệnh · Sơn: kết thúc 05/12/2026 trước bắt đầu 10/12/2026',
    )
    expect(chan[1].text).toBe('Cả lệnh · Sơn: 2 tổ cùng công đoạn — chọn một')
  })

  it('khối trên theo nháp: "Tổ Hàn · 17/11→05/12 · nháp"; chữ ô cần bỏ đơn vị, hai đơn vị ghi "300·900ct"', () => {
    const d: Draft = {
      ...initialDraft(view),
      all: { han: { on: true, team: 't-han', start: '2026-11-17', end: '2026-12-05' } },
    }
    expect(stageDraftSummary(view, d, 'han', false)).toEqual({
      text: 'Tổ Hàn · 17/11→05/12 · nháp',
      tone: 'draft',
    })
    expect(stageDraftSummary(view, d, 'son', false)).toEqual({
      text: 'chưa giao tổ & hạn',
      tone: 'warn',
    })
    expect(needCellText(view.lines[0].needs.son)).toBe('300·900')
    expect(spanText('2026-11-12', '')).toBe('12/11→')
  })
})
