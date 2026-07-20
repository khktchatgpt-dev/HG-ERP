import { describe, expect, it } from 'vitest'
import { resolveTeamStage, stageForDept } from './stage-for-dept'

const STAGES = [
  { code: 'phoi', label: 'Phôi' },
  { code: 'han', label: 'Hàn' },
  { code: 'son', label: 'Sơn' },
  { code: 'son_tinh_dien', label: 'Sơn tĩnh điện' },
]

describe('stageForDept — đoán công đoạn theo tên tổ (fallback cũ)', () => {
  it('khớp label trong tên tổ', () => {
    expect(stageForDept('Tổ Hàn', STAGES)).toBe('han')
  })

  it('ưu tiên label dài — "Sơn tĩnh điện" không bị "Sơn" cướp match', () => {
    expect(stageForDept('Tổ Sơn tĩnh điện', STAGES)).toBe('son_tinh_dien')
  })

  it('không khớp / null → null', () => {
    expect(stageForDept('Kế Hoạch Sản Xuất', STAGES)).toBe(null)
    expect(stageForDept(null, STAGES)).toBe(null)
  })
})

describe('resolveTeamStage — ưu tiên stage_code chính thức (0064, OI-14)', () => {
  it('stage_code hợp lệ thắng cả khi tên tổ gợi công đoạn khác', () => {
    expect(resolveTeamStage({ stage_code: 'son', name: 'Tổ Hàn' }, STAGES)).toBe('son')
  })

  it('stage_code lạ (đã xoá khỏi danh mục) → fallback đoán theo tên', () => {
    expect(resolveTeamStage({ stage_code: 'da_xoa', name: 'Tổ Hàn' }, STAGES)).toBe('han')
  })

  it('chưa gán stage_code → fallback đoán theo tên', () => {
    expect(resolveTeamStage({ stage_code: null, name: 'Tổ Phôi' }, STAGES)).toBe('phoi')
  })

  it('dept null → null', () => {
    expect(resolveTeamStage(null, STAGES)).toBe(null)
  })
})
