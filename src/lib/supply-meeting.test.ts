import { describe, expect, it } from 'vitest'
import {
  MEETING_STOP_DAYS,
  assessMeetingRisk,
  buildAgenda,
  buildMeeting,
  meetingDue,
  type MeetingRiskInput,
} from './supply-meeting'

const TODAY = '2026-09-05'

type Po = MeetingRiskInput['pos'][number]

function lsx(p: Partial<MeetingRiskInput> = {}): MeetingRiskInput {
  const pos: Po[] = p.pos ?? []
  const alive = pos.filter((x) => x.status !== 'cancelled')
  const unsent = alive.filter(
    (x) => x.status === 'draft' || x.status === 'pending_approval',
  )
  const open = alive.filter(
    (x) => !['draft', 'pending_approval', 'received'].includes(x.status),
  )
  const late = open.filter((x) => x.expected_at != null && x.expected_at < TODAY)
  return {
    materials_received_at: null,
    materials_due_at: null,
    ship_date: null,
    pos,
    posTotal: alive.length,
    posUnsent: unsent.length,
    posOpen: open.length,
    posLate: late.length,
    ...p,
  }
}

const sent = (expected_at: string | null, status = 'confirmed'): Po => ({
  status,
  expected_at,
})

describe('meetingDue — mốc sát theo lệnh', () => {
  it('ưu tiên hạn vật tư của lệnh', () => {
    expect(
      meetingDue({ materials_due_at: '2026-09-10', ship_date: '2026-10-17' }),
    ).toEqual({
      date: '2026-09-10',
      source: 'materials_due_at',
    })
  })
  it('thiếu hạn vật tư thì mượn ngày xuất và nói rõ', () => {
    expect(meetingDue({ materials_due_at: null, ship_date: '2026-10-17' })).toEqual({
      date: '2026-10-17',
      source: 'ship_date',
    })
  })
  it('không có cả hai = không mốc', () => {
    expect(meetingDue({ materials_due_at: null, ship_date: null })).toBeNull()
  })
})

describe('assessMeetingRisk', () => {
  it('Kho đã xác nhận đủ = Đủ, bất kể mốc đã qua', () => {
    const r = assessMeetingRisk(
      lsx({ materials_received_at: '2026-09-01', materials_due_at: '2026-08-20' }),
      TODAY,
    )
    expect(r.level).toBe('ready')
    expect(r.action).toBe('')
    expect(r.decision).toBeNull()
  })

  it('hạn vật tư là hôm nay mà còn đơn đang về = Khẩn, kèm câu hỏi cho Sản xuất', () => {
    const r = assessMeetingRisk(
      lsx({ materials_due_at: TODAY, pos: [sent('2026-09-08')] }),
      TODAY,
    )
    expect(r.level).toBe('stop')
    expect(r.daysLeft).toBe(0)
    expect(r.reason).toContain('Hạn vật tư 05/09 (là hôm nay)')
    expect(r.reason).toContain('hẹn gần nhất 08/09')
    expect(r.owner).toBe('Nhà cung cấp')
    expect(r.decision).not.toBeNull()
  })

  it(`còn ≤ ${MEETING_STOP_DAYS} ngày là khẩn, ngày thứ ${MEETING_STOP_DAYS + 1} thì chưa`, () => {
    const at = (due: string) =>
      assessMeetingRisk(lsx({ materials_due_at: due, pos: [sent('2026-09-20')] }), TODAY)
        .level
    expect(at('2026-09-08')).toBe('stop') // còn 3
    expect(at('2026-09-09')).toBe('inflight') // còn 4, NCC đang lo
  })

  it('hạn đã qua nhiều ngày mà chưa lập đơn = Khẩn, việc của Cung ứng', () => {
    const r = assessMeetingRisk(lsx({ materials_due_at: '2026-09-01' }), TODAY)
    expect(r.level).toBe('stop')
    expect(r.reason).toBe('Hạn vật tư 01/09 (đã qua 4 ngày) mà chưa lập đơn mua nào')
    expect(r.owner).toBe('Cung ứng')
    expect(r.action).toBe('Lập đơn mua ngay')
  })

  it('bóng ở Cung ứng mà mốc còn trong 7 ngày = Khẩn (chưa gửi đơn thì 7 ngày không kịp)', () => {
    const r = assessMeetingRisk(
      lsx({
        materials_due_at: '2026-09-11', // còn 6
        pos: [{ status: 'pending_approval', expected_at: null }],
      }),
      TODAY,
    )
    expect(r.level).toBe('stop')
    expect(r.reason).toContain('1 đơn còn nháp hoặc chờ ký')
  })

  it('đơn ĐÃ DUYỆT chưa gửi NCC là việc của Cung ứng, không phải "đang về"', () => {
    // Bậc cũ đếm approved như đơn mở; trong họp thì đơn còn nằm trong nhà.
    const far = assessMeetingRisk(
      lsx({
        materials_due_at: '2026-09-30',
        pos: [{ status: 'approved', expected_at: null }],
      }),
      TODAY,
    )
    expect(far.level).toBe('warn')
    expect(far.owner).toBe('Cung ứng')
    expect(far.reason).toContain('1 đơn đã duyệt nhưng chưa gửi NCC')
    expect(far.posNoEta).toBe(0) // chưa gửi thì chưa đòi hẹn giao

    const near = assessMeetingRisk(
      lsx({
        materials_due_at: '2026-09-11',
        pos: [{ status: 'approved', expected_at: null }],
      }),
      TODAY,
    )
    expect(near.level).toBe('stop')
  })

  it('NCC quá hẹn nhưng mốc lệnh còn xa = Theo dõi, vẫn là việc phải giục', () => {
    const r = assessMeetingRisk(
      lsx({
        materials_due_at: '2026-09-30',
        pos: [sent('2026-09-01'), sent('2026-09-20')],
      }),
      TODAY,
    )
    expect(r.level).toBe('warn')
    expect(r.reason).toBe(
      '1 đơn nhà cung cấp quá hẹn giao; Hạn vật tư 30/09 (còn 25 ngày)',
    )
    expect(r.owner).toBe('Nhà cung cấp')
    expect(r.action).toBe('Giục nhà cung cấp, chốt ngày mới')
    expect(r.nextExpected).toBe('2026-09-01')
  })

  it('không mốc và chưa lập đơn = Theo dõi (việc của mình) chứ không phải Chưa có mốc', () => {
    const r = assessMeetingRisk(lsx(), TODAY)
    expect(r.level).toBe('warn')
    expect(r.reason).toBe('chưa lập đơn mua nào; lệnh chưa đặt hạn vật tư')
    expect(r.missingDue).toBe(true)
    expect(r.due).toBeNull()
  })

  it('đơn đang về mà lệnh không có mốc nào = Chưa có mốc, bắt đặt hạn', () => {
    const r = assessMeetingRisk(lsx({ pos: [sent('2026-09-20')] }), TODAY)
    expect(r.level).toBe('watch')
    expect(r.action).toBe('Đặt hạn vật tư cho lệnh')
  })

  it('có mốc, đơn đã gửi nhưng không hẹn giao = Chưa có mốc, chốt ngày với NCC', () => {
    const r = assessMeetingRisk(
      lsx({ materials_due_at: '2026-09-30', pos: [sent(null), sent('2026-09-20')] }),
      TODAY,
    )
    expect(r.level).toBe('watch')
    expect(r.posNoEta).toBe(1)
    expect(r.reason).toContain('1 đơn đã gửi nhưng chưa có hẹn giao')
  })

  it('mượn ngày xuất thì câu lý do gọi đúng tên mốc', () => {
    const r = assessMeetingRisk(
      lsx({ ship_date: '2026-09-07', pos: [sent('2026-09-06')] }),
      TODAY,
    )
    expect(r.level).toBe('stop')
    expect(r.due?.source).toBe('ship_date')
    expect(r.reason).toContain('Ngày xuất 07/09 (còn 2 ngày)')
  })

  it('đơn nháp không tính vào "chưa hẹn giao" và hẹn của đơn đã nhận không thành ETA', () => {
    const r = assessMeetingRisk(
      lsx({
        materials_due_at: '2026-09-30',
        pos: [
          { status: 'received', expected_at: '2026-08-01' },
          sent('2026-09-25'),
          { status: 'draft', expected_at: null },
        ],
      }),
      TODAY,
    )
    expect(r.posNoEta).toBe(0)
    expect(r.nextExpected).toBe('2026-09-25')
  })
})

describe('buildMeeting', () => {
  const rows = [
    { code: 'LSX-A', ...lsx({ materials_received_at: '2026-09-01' }) },
    {
      code: 'LSX-B',
      ...lsx({ materials_due_at: '2026-09-20', pos: [sent('2026-09-15')] }),
    },
    {
      code: 'LSX-C',
      ...lsx({ materials_due_at: '2026-09-06', pos: [sent('2026-09-15')] }),
    },
    {
      code: 'LSX-D',
      ...lsx({ materials_due_at: '2026-09-04', pos: [sent('2026-09-15')] }),
    },
    { code: 'LSX-E', ...lsx({ materials_due_at: '2026-10-01' }) },
    { code: 'LSX-F', ...lsx({ pos: [sent('2026-09-15')] }) },
  ]

  it('xếp khẩn trước, cùng mức thì mốc gần trước, không mốc xếp cuối mức', () => {
    const m = buildMeeting(rows, TODAY)
    expect(m.rows.map((x) => x.row.code)).toEqual([
      'LSX-D', // stop, đã qua
      'LSX-C', // stop, còn 1
      'LSX-E', // warn
      'LSX-F', // watch
      'LSX-B', // inflight
      'LSX-A', // ready
    ])
  })

  it('đếm theo mức, vấn đề = trừ Đang về và Đủ, quyết định = chỉ lệnh khẩn', () => {
    const m = buildMeeting(rows, TODAY)
    expect(m.counts).toEqual({ stop: 2, warn: 1, watch: 1, inflight: 1, ready: 1 })
    expect(m.issues.map((x) => x.row.code)).toEqual(['LSX-D', 'LSX-C', 'LSX-E', 'LSX-F'])
    expect(m.decisions.map((x) => x.row.code)).toEqual(['LSX-D', 'LSX-C'])
  })
})

describe('buildAgenda', () => {
  it('gom theo (bộ phận, việc); lệnh khẩn thêm dòng Sản xuất; đơn chờ ký thêm dòng Giám đốc', () => {
    const rows = [
      { code: 'LSX-1', ...lsx({ materials_due_at: '2026-09-06', pos: [sent('2026-09-15')] }) },
      { code: 'LSX-2', ...lsx({ materials_due_at: '2026-10-01' }) },
      { code: 'LSX-3', ...lsx({ materials_due_at: '2026-10-05' }) },
      {
        code: 'LSX-4',
        ...lsx({
          materials_due_at: '2026-10-20',
          pos: [{ status: 'pending_approval', expected_at: null }],
        }),
      },
    ]
    const m = buildMeeting(rows, TODAY)
    const agenda = buildAgenda(m.rows)
    const key = (a: { dept: string; action: string }) => `${a.dept} · ${a.action}`
    expect(agenda.map(key)).toEqual([
      'Sản xuất · Chờ vật tư hay đổi lịch / chuyển lệnh khác?',
      'Nhà cung cấp · Giục nhà cung cấp giao sớm',
      'Cung ứng · Lập đơn mua ngay',
      'Giám đốc · Duyệt đơn mua đang chờ ký',
      'Cung ứng · Gửi đơn cho nhà cung cấp',
    ])
    const lap = agenda.find((a) => a.action === 'Lập đơn mua ngay')!
    expect(lap.rows.map((r) => r.row.code)).toEqual(['LSX-2', 'LSX-3'])
    expect(lap.due).toBe('2026-10-01') // mốc gần nhất trong nhóm
  })
})
