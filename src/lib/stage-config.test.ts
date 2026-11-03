import { describe, expect, it } from 'vitest'
import {
  DEFAULT_COUNTING,
  DEFAULT_FINISH_STAGES,
  countLevelOf,
  countingOf,
  defaultStageMeta,
  parseStageMeta,
  resolveStageConfigs,
  splitClusterRoute,
} from './stage-config'

const CAT = [
  'phoi',
  'han',
  'nguoi',
  'mai',
  'son',
  'moc',
  'dan',
  'may',
  'lap_rap',
  'bao_bi',
  'dong_goi',
  'hoan_thien',
].map((code) => ({ code, label: code }))

describe('parseStageMeta — rơi về mặc định theo mã', () => {
  it('meta rỗng / null / sai kiểu → mặc định đúng hành vi cũ', () => {
    expect(parseStageMeta('han', null).count_level).toBe('cluster')
    expect(parseStageMeta('han', {}).count_level).toBe('cluster')
    expect(parseStageMeta('phoi', 'x').count_level).toBe('part')
    expect(parseStageMeta('dong_goi', []).count_level).toBe('unit')
    expect(parseStageMeta('la', undefined).count_level).toBe('part')
  })

  it('từng khoá sai thì chỉ khoá đó rơi về mặc định', () => {
    const m = parseStageMeta('dan', {
      count_level: 'cluster',
      core: { kg: 'off', defect: 'bat_buoc', worker: 'required' },
      input_from: '  ',
    })
    expect(m.count_level).toBe('cluster')
    expect(m.core).toEqual({ defect: 'on', rework: 'on', kg: 'off', worker: 'required' })
    expect(m.input_from).toBeNull()
  })

  it('count_level lạ → mặc định của mã, không nhận bừa', () => {
    expect(parseStageMeta('son', { count_level: 'bo' }).count_level).toBe('cluster')
  })

  it('defaultStageMeta không chia sẻ object core giữa các lần gọi', () => {
    const a = defaultStageMeta('han')
    a.core.kg = 'off'
    expect(defaultStageMeta('han').core.kg).toBe('on')
  })
})

describe('countingOf — suy mốc ghép và chặng thành phẩm', () => {
  it('danh mục đủ 12, meta trống → y hệt hằng số cũ', () => {
    const c = countingOf(CAT)
    expect(c.join).toBe('han')
    expect([...c.finish]).toEqual([...DEFAULT_FINISH_STAGES])
  })

  it('rỗng / undefined → mặc định', () => {
    expect(countingOf([])).toBe(DEFAULT_COUNTING)
    expect(countingOf(undefined)).toBe(DEFAULT_COUNTING)
  })

  it('đổi "đan" sang cụm thì công đoạn ghép vẫn là công đoạn cụm ĐẦU TIÊN theo thứ tự', () => {
    const items = CAT.map((s) =>
      s.code === 'dan' ? { ...s, meta: { count_level: 'cluster' } } : s,
    )
    expect(countingOf(items).join).toBe('han')
  })

  it('khai hàn đếm chi tiết, nguội đếm cụm → ghép ở nguội', () => {
    const items = CAT.map((s) =>
      s.code === 'han' ? { ...s, meta: { count_level: 'part' } } : s,
    )
    expect(countingOf(items).join).toBe('nguoi')
  })

  it('mọi công đoạn đếm chi tiết (có hàn) → không có cụm mặc nhiên', () => {
    const items = CAT.map((s) => ({ ...s, meta: { count_level: 'part' } }))
    const c = countingOf(items)
    expect(c.join).toBeNull()
    expect(c.finish).toEqual([])
  })

  it('thêm "qc" đếm bộ → chặng thành phẩm có thêm qc đúng thứ tự danh mục', () => {
    const items = [...CAT, { code: 'qc', label: 'QC', meta: { count_level: 'unit' } }]
    expect([...countingOf(items).finish]).toEqual([...DEFAULT_FINISH_STAGES, 'qc'])
  })

  it('BẪY danh sách thiếu (test mock chỉ phôi + hàn) → phần thiếu rơi về mặc định', () => {
    const c = countingOf([
      { code: 'phoi', label: 'Phôi' },
      { code: 'han', label: 'Hàn' },
    ])
    expect(c.join).toBe('han')
    expect([...c.finish]).toEqual([...DEFAULT_FINISH_STAGES])
  })

  it('danh sách thiếu KHÔNG có hàn (chỉ sơn) → ghép ở công đoạn cụm đầu tiên có mặt', () => {
    expect(countingOf([{ code: 'son', label: 'Sơn' }]).join).toBe('son')
  })

  it('danh sách thiếu chỉ toàn công đoạn chi tiết (chỉ phôi) → ghép rơi về hàn mặc định', () => {
    expect(countingOf([{ code: 'phoi', label: 'Phôi' }]).join).toBe('han')
  })
})

describe('resolveStageConfigs / countLevelOf', () => {
  it('giữ thứ tự danh mục và parse meta', () => {
    const cfg = resolveStageConfigs([
      { code: 'phoi', label: 'Phôi', meta: { count_level: 'part' } },
      { code: 'han', label: 'Hàn', meta: null },
    ])
    expect(cfg.map((c) => c.code)).toEqual(['phoi', 'han'])
    expect(countLevelOf(cfg, 'han')).toBe('cluster')
    expect(countLevelOf(cfg, 'lap_rap')).toBe('unit')
  })
})

describe('splitClusterRoute — tách lộ trình cụm theo bậc đếm (0288)', () => {
  const cfg = resolveStageConfigs(CAT)
  it('cụm nhôm phôi → nguội → sơn: chi tiết [phôi], cụm [nguội, sơn] — không cần hàn', () => {
    expect(splitClusterRoute(['phoi', 'nguoi', 'son'], cfg)).toEqual({
      part: ['phoi'],
      cluster: ['nguoi', 'son'],
    })
  })
  it('đổi "đan" sang cụm thì đan về phía cụm', () => {
    const cfg2 = resolveStageConfigs(
      CAT.map((s) => (s.code === 'dan' ? { ...s, meta: { count_level: 'cluster' } } : s)),
    )
    expect(splitClusterRoute(['phoi', 'dan'], cfg2)).toEqual({ part: ['phoi'], cluster: ['dan'] })
    expect(splitClusterRoute(['phoi', 'dan'], cfg)).toEqual({ part: ['phoi', 'dan'], cluster: [] })
  })
  it('rỗng → hai mảng rỗng', () => {
    expect(splitClusterRoute([], cfg)).toEqual({ part: [], cluster: [] })
  })
})
