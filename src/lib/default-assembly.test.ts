import { describe, expect, it } from 'vitest'
import {
  defaultAssemblyId,
  defaultAssemblyOutputs,
  isDefaultAssemblyId,
  resolveCountingPlan,
} from './default-assembly'

/**
 * Cụm mặc nhiên (27/08/2026) — bậc 2 của thang đơn vị đếm: BOM phẳng thì chi
 * tiết dừng trước hàn, từ hàn trở đi đếm theo BỘ. Đây là logic quyết định sổ
 * hàn/nguội/mài/sơn hiển thị gì nên phải test chặt.
 */

const part = (
  id: string,
  group: string | null,
  finalStage: string | null = null,
  kind: 'part' | 'assembly' = 'part',
) => ({ id, kind, group_code: group, final_stage: finalStage })

describe('resolveCountingPlan — thang ưu tiên', () => {
  it('BOM phẳng khung sắt: chi tiết dừng ở phôi, cụm mặc nhiên phủ hàn→sơn', () => {
    const plan = resolveCountingPlan([part('a', 'FRAME'), part('b', 'FRAME')], null)
    expect(plan.own_route.get('a')).toEqual(['phoi'])
    expect(plan.own_route.get('b')).toEqual(['phoi'])
    expect(plan.virtual_stages).toEqual(['han', 'nguoi', 'mai', 'son'])
  })

  it('lệnh có CỤM THẬT (0088) → máy không chen, kế hoạch rỗng', () => {
    const plan = resolveCountingPlan(
      [part('a', 'FRAME'), part('asm', null, null, 'assembly')],
      null,
    )
    expect(plan.own_route.size).toBe(0)
    expect(plan.virtual_stages).toEqual([])
  })

  it('chi tiết người đã khai final_stage → tôn trọng, không gộp', () => {
    const plan = resolveCountingPlan([part('a', 'FRAME', 'son')], null)
    expect(plan.own_route.size).toBe(0)
    expect(plan.virtual_stages).toEqual([])
  })

  it('nhóm không đi qua hàn (gỗ, ngũ kim, chưa phân nhóm) → giữ nguyên', () => {
    const plan = resolveCountingPlan(
      [part('wood', 'WOOD'), part('vit', 'NGU_KIM'), part('unknown', null)],
      null,
    )
    expect(plan.own_route.size).toBe(0)
    expect(plan.virtual_stages).toEqual([])
  })

  it('lệnh hỗn hợp: chỉ chi tiết qua hàn bị gộp, gỗ đi tiếp đường của nó', () => {
    const plan = resolveCountingPlan([part('fe', 'FRAME'), part('go', 'WOOD')], null)
    expect([...plan.own_route.keys()]).toEqual(['fe'])
    expect(plan.virtual_stages).toEqual(['han', 'nguoi', 'mai', 'son'])
  })

  it('kế hoạch SX thắng lộ trình suy theo nhóm', () => {
    const plan = resolveCountingPlan([part('a', 'FRAME')], ['phoi', 'han', 'son'])
    expect(plan.own_route.get('a')).toEqual(['phoi'])
    expect(plan.virtual_stages).toEqual(['han', 'son'])
  })

  it('lộ trình BẮT ĐẦU ngay ở hàn → không cắt (cắt là chi tiết mất khỏi sổ)', () => {
    const plan = resolveCountingPlan([part('a', 'FRAME')], ['han', 'son'])
    expect(plan.own_route.size).toBe(0)
    expect(plan.virtual_stages).toEqual([])
  })
})

describe('defaultAssemblyOutputs — sản lượng suy theo BỘ (MIN chi tiết chậm nhất)', () => {
  const stages = ['han', 'son']

  it('min theo chi tiết chậm nhất, floor về bộ nguyên', () => {
    const out = defaultAssemblyOutputs(stages, 10, [
      // 4 CT/SP → tổng 40; đã hàn 22 → floor(22×10/40) = 5 bộ
      { total_needed: 40, outputs: [{ stage: 'han', done: 22, defect: 1 }] },
      // 2 CT/SP → tổng 20; đã hàn 13 → floor(13×10/20) = 6 bộ
      { total_needed: 20, outputs: [{ stage: 'han', done: 13, defect: 2 }] },
    ])
    expect(out).toEqual([
      { stage: 'han', done: 5, defect: 3 },
      { stage: 'son', done: 0, defect: 0 },
    ])
  })

  it('một chi tiết chưa có số → cả bộ = 0 (thiếu một cái tựa là bộ chưa xong)', () => {
    const out = defaultAssemblyOutputs(['han'], 10, [
      { total_needed: 40, outputs: [{ stage: 'han', done: 40, defect: 0 }] },
      { total_needed: 20, outputs: [] },
    ])
    expect(out[0].done).toBe(0)
  })

  it('kẹp trần SL dòng khi làm dư', () => {
    const out = defaultAssemblyOutputs(['han'], 10, [
      { total_needed: 20, outputs: [{ stage: 'han', done: 30, defect: 0 }] },
    ])
    expect(out[0].done).toBe(10)
  })

  it('tổng cần 0 bị bỏ (không chia 0); không còn chi tiết hợp lệ → 0', () => {
    const out = defaultAssemblyOutputs(['han'], 10, [
      { total_needed: 0, outputs: [{ stage: 'han', done: 5, defect: 0 }] },
    ])
    expect(out[0].done).toBe(0)
  })
})

describe('id ảo của cụm mặc nhiên', () => {
  it('nhận diện được id ảo — nơi ghi sổ phải chặn nó', () => {
    expect(isDefaultAssemblyId(defaultAssemblyId('line-1'))).toBe(true)
    expect(isDefaultAssemblyId('a3f2…uuid-thật')).toBe(false)
  })
})
