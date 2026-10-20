import { describe, expect, it } from 'vitest'
import {
  FINISH_ROW_NAME,
  lineUnit,
  FINISH_STAGES,
  finishRouteOverride,
  finishRowId,
  finishRowLineId,
  isFinishRow,
  isFinishRowId,
  isFinishStage,
} from './finish-stages'

describe('finish-stages — chặng thành phẩm', () => {
  it('bốn bước sau sơn, đúng thứ tự catalog', () => {
    expect([...FINISH_STAGES]).toEqual(['lap_rap', 'bao_bi', 'dong_goi', 'hoan_thien'])
  })

  it('isFinishStage nhận đúng bốn mã, từ chối công đoạn gia công', () => {
    for (const s of FINISH_STAGES) expect(isFinishStage(s)).toBe(true)
    for (const s of ['phoi', 'han', 'nguoi', 'mai', 'son', 'moc', 'may', 'dan']) {
      expect(isFinishStage(s)).toBe(false)
    }
    expect(isFinishStage(null)).toBe(false)
    expect(isFinishStage(undefined)).toBe(false)
    expect(isFinishStage('')).toBe(false)
  })

  it('id ảo đi và về nguyên vẹn', () => {
    const id = finishRowId('line-42')
    expect(isFinishRowId(id)).toBe(true)
    expect(finishRowLineId(id)).toBe('line-42')
    expect(finishRowLineId('line-42')).toBeNull()
    expect(isFinishRowId('line-42')).toBe(false)
  })

  it('id ảo của thành phẩm KHÁC id ảo của cụm mặc nhiên', () => {
    // Hai dòng ảo cùng nằm trên một dòng SP; trùng tiền tố là sổ hàn rơi vào
    // dòng đóng gói.
    expect(isFinishRowId('default-asm:line1')).toBe(false)
    expect(finishRowId('line1').startsWith('default-asm:')).toBe(false)
  })

  describe('isFinishRow — nhận diện dòng ĐÃ vật chất hoá', () => {
    it('assembly bắt đầu ở lắp ráp là dòng thành phẩm', () => {
      expect(isFinishRow({ kind: 'assembly', first_stage: 'lap_rap' })).toBe(true)
    })

    it('cụm khung (assembly bắt đầu ở hàn) KHÔNG phải dòng thành phẩm', () => {
      // Đây là ca nguy hiểm nhất: cụm mặc nhiên vật chất hoá cũng là
      // kind='assembly' + cluster=null, chỉ khác mốc bắt đầu.
      expect(isFinishRow({ kind: 'assembly', first_stage: 'han' })).toBe(false)
    })

    it('chi tiết thường không bao giờ là dòng thành phẩm', () => {
      expect(isFinishRow({ kind: 'part', first_stage: 'lap_rap' })).toBe(false)
      expect(isFinishRow({ kind: 'part', first_stage: null })).toBe(false)
    })

    it('assembly chưa khai mốc bắt đầu thì không đoán bừa', () => {
      expect(isFinishRow({ kind: 'assembly', first_stage: null })).toBe(false)
      expect(isFinishRow({ kind: 'assembly' })).toBe(false)
    })
  })

  describe('finishRouteOverride', () => {
    it('ép đủ bốn bước cho dòng thành phẩm', () => {
      expect(finishRouteOverride({ kind: 'assembly', first_stage: 'lap_rap' })).toEqual([
        'lap_rap',
        'bao_bi',
        'dong_goi',
        'hoan_thien',
      ])
    })

    it('trả null cho mọi dòng khác — để đường suy-theo-nhóm chạy như cũ', () => {
      expect(finishRouteOverride({ kind: 'part', first_stage: null })).toBeNull()
      expect(finishRouteOverride({ kind: 'assembly', first_stage: 'han' })).toBeNull()
    })

    it('trả bản SAO, sửa được mà không đụng hằng số dùng chung', () => {
      const r = finishRouteOverride({ kind: 'assembly', first_stage: 'dong_goi' })!
      r.pop()
      expect([...FINISH_STAGES]).toHaveLength(4)
    })
  })

  it('tên dòng cố định — màn ghi sổ và sổ tổng gọi cùng một tên', () => {
    expect(FINISH_ROW_NAME).toBe('Thành phẩm')
  })

  /**
   * Chủ dự án chốt 19/09: mọi SP tính theo CÁI trong sản xuất, đóng gói mới
   * tuỳ khách. Đơn vị dòng thành phẩm vì thế phải theo DÒNG LỆNH, không phải
   * hằng số "bộ" — 88% dòng lệnh thật mang đơn vị "cái".
   */
  describe('lineUnit', () => {
    it('lấy đúng đơn vị của dòng lệnh', () => {
      expect(lineUnit('cái')).toBe('cái')
      expect(lineUnit('bộ')).toBe('bộ')
    })

    it('trống / chỉ khoảng trắng → "cái", không đoán "bộ"', () => {
      expect(lineUnit(null)).toBe('cái')
      expect(lineUnit(undefined)).toBe('cái')
      expect(lineUnit('   ')).toBe('cái')
    })
  })
})
