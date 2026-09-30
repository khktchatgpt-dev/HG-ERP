import { describe, expect, it } from 'vitest'
import { dieChangesPatch, dieEventChanges, type DieBefore } from './die-event-effect'

const die: DieBefore = { status: 'active', holder_name: 'Tiến Đạt', weight_per_m: 0.289 }

describe('dieEventChanges — ghi việc thì hồ sơ đổi gì', () => {
  it('Báo hư → tình trạng Khuôn hư', () => {
    expect(dieEventChanges(die, { event_type: 'broken' })).toEqual([
      { field: 'status', from: 'active', to: 'broken' },
    ])
  })

  it('khuôn đã hư mà báo hư lần nữa → không đổi gì (không bày "hư → hư")', () => {
    expect(
      dieEventChanges({ ...die, status: 'broken' }, { event_type: 'broken' }),
    ).toEqual([])
  })

  it('Mở lại / Mở khuôn → Đang dùng; Thay mã → Khuôn cũ; Bỏ hẳn → Đã bỏ', () => {
    const broken = { ...die, status: 'broken' as const }
    expect(dieEventChanges(broken, { event_type: 'reopened' })[0]).toMatchObject({
      to: 'active',
    })
    expect(
      dieEventChanges({ ...die, status: 'pending' }, { event_type: 'opened' })[0],
    ).toMatchObject({ to: 'active' })
    expect(dieEventChanges(die, { event_type: 'replaced' })[0]).toMatchObject({
      to: 'replaced',
    })
    expect(dieEventChanges(die, { event_type: 'retired' })[0]).toMatchObject({
      to: 'retired',
    })
  })

  it('Chuyển nơi giữ → nơi giữ mới (bỏ khoảng trắng), trùng nơi cũ thì thôi', () => {
    expect(
      dieEventChanges(die, { event_type: 'transferred', to_holder: '  Việt Eco ' }),
    ).toEqual([{ field: 'holder_name', from: 'Tiến Đạt', to: 'Việt Eco' }])
    expect(
      dieEventChanges(die, { event_type: 'transferred', to_holder: 'Tiến Đạt' }),
    ).toEqual([])
    expect(dieEventChanges(die, { event_type: 'transferred', to_holder: '' })).toEqual([])
  })

  it('Sửa / bỏ gân có kg/m sau → kg/m mới; không ghi kg/m sau thì giữ nguyên', () => {
    expect(dieEventChanges(die, { event_type: 'modified', weight_after: 0.275 })).toEqual(
      [{ field: 'weight_per_m', from: 0.289, to: 0.275 }],
    )
    expect(dieEventChanges(die, { event_type: 'modified', weight_after: null })).toEqual(
      [],
    )
  })

  it('Ghi chú không đổi hồ sơ', () => {
    expect(
      dieEventChanges(die, { event_type: 'note', to_holder: 'X', weight_after: 1 }),
    ).toEqual([])
  })

  it('dieChangesPatch gom đúng cột', () => {
    const ch = dieEventChanges(
      { ...die, status: 'pending' },
      { event_type: 'opened', to_holder: 'Ynghua' },
    )
    expect(dieChangesPatch(ch)).toEqual({ status: 'active', holder_name: 'Ynghua' })
  })
})
