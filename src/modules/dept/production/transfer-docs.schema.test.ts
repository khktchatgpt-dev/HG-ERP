import { describe, it, expect } from 'vitest'
import { transferDocCreateSchema } from './transfer-docs.schema'
import { defaultAssemblyId } from '@/lib/default-assembly'

const base = {
  production_order_id: '11111111-1111-4111-8111-111111111111',
  from_stage: 'han',
  from_team_id: '55555555-5555-4555-8555-555555555555',
  to_stage: 'nguoi',
  to_team_id: '66666666-6666-4666-8666-666666666666',
  entry_date: '2026-11-06',
}
const LINE = '22222222-2222-4222-8222-222222222222'

describe('transferDocCreateSchema — id dòng giao (06/11/2026)', () => {
  it('nhận uuid dòng thật và id ảo cụm mặc nhiên', () => {
    const r = transferDocCreateSchema.safeParse({
      ...base,
      lines: [
        { component_id: LINE, qty: 1 },
        { component_id: defaultAssemblyId(LINE), qty: 2 },
      ],
    })
    expect(r.success).toBe(true)
  })

  it('từ chối id không phải uuid, kể cả sau tiền tố cụm mặc nhiên', () => {
    for (const bad of ['abc', 'default-asm:abc', 'finish:' + LINE]) {
      const r = transferDocCreateSchema.safeParse({
        ...base,
        lines: [{ component_id: bad, qty: 1 }],
      })
      expect(r.success, bad).toBe(false)
    }
  })
})
