import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./dies.repo', () => ({
  dieCatalogRepo: { getById: vi.fn() },
  dieWriteRepo: { update: vi.fn(), insertEvent: vi.fn(), findByCode: vi.fn() },
}))
vi.mock('@/modules/core/rbac/rbac.service', () => ({
  assertAction: vi.fn(),
  canAction: vi.fn(),
}))

import { assertAction } from '@/modules/core/rbac/rbac.service'
import { vnTodayIso } from '@/lib/local-date'
import type { User } from '@/modules/core/users/users.repo'
import { dieCatalogRepo, dieWriteRepo } from './dies.repo'
import { dieEventSchema } from './dies.schema'
import { diesService } from './dies.service'

/**
 * Ghi nhật ký khuôn bằng tay (29/09/2026). Hai điều user chốt phải giữ:
 * ghi việc cập nhật luôn hồ sơ (Q1) mà chỉ ra MỘT dòng nhật ký, và nhật ký ghi
 * chuyện đã xảy ra — ngày không được sau hôm nay.
 */

const truyen = { id: 'u-cu', role: 'employee' } as unknown as User
const A592 = {
  id: 'die-1',
  code: 'TD-A592',
  status: 'active',
  holder_name: 'Tiến Đạt',
  weight_per_m: 0.289,
}

const parse = (o: Record<string, unknown>) => dieEventSchema.parse(o)

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(dieCatalogRepo.getById).mockResolvedValue(A592 as never)
})

describe('dieEventSchema', () => {
  it('ngày bắt buộc, ghi lùi được, không được sau hôm nay (giờ VN)', () => {
    expect(() => parse({ event_type: 'note', content: 'x' })).toThrow()
    expect(
      parse({ event_type: 'note', content: 'x', event_date: '2024-12-14' }).event_date,
    ).toBe('2024-12-14')
    expect(() =>
      parse({ event_type: 'note', content: 'x', event_date: '2999-01-01' }),
    ).toThrow(/chưa tới/)
    expect(
      parse({ event_type: 'note', content: 'x', event_date: vnTodayIso() }),
    ).toBeTruthy()
  })

  it('Báo hư / Ghi chú bắt nội dung; Chuyển nơi giữ bắt "sang đâu"', () => {
    const d = vnTodayIso()
    expect(() => parse({ event_type: 'broken', event_date: d, content: '' })).toThrow(
      /nội dung/,
    )
    expect(() => parse({ event_type: 'transferred', event_date: d })).toThrow(/sang đâu/)
    expect(parse({ event_type: 'reopened', event_date: d }).apply).toBe(true)
  })
})

describe('body hộp "Ghi nhật ký" gửi lên — qua zod nguyên vẹn', () => {
  it('ô trống là chuỗi rỗng → null; số đã chuẩn hoá → number; apply giữ nguyên', () => {
    // Đúng hình body Playwright bắt được khi thử hộp thoại (29/09/2026).
    const v = parse({
      event_type: 'transferred',
      event_date: '2026-09-25',
      content: '',
      weight_after: '',
      cost: '',
      to_holder: 'Việt Eco',
      related_die_id: '',
      apply: false,
    })
    expect(v).toMatchObject({
      content: null,
      weight_after: null,
      cost: null,
      related_die_id: null,
      to_holder: 'Việt Eco',
      apply: false,
    })
    const m = parse({
      event_type: 'modified',
      event_date: '2026-09-20',
      content: 'Bỏ 1 gân',
      weight_after: '0.275',
      cost: '4323000',
      to_holder: '',
      related_die_id: '',
      apply: true,
    })
    expect(m).toMatchObject({ weight_after: 0.275, cost: 4323000, to_holder: null })
  })
})

describe('diesService.addEvent', () => {
  it('Báo hư: đổi tình trạng + đúng MỘT dòng nhật ký, câu đổi nối vào nội dung', async () => {
    await diesService.addEvent(
      truyen,
      'die-1',
      parse({
        event_type: 'broken',
        event_date: '2026-09-27',
        content: 'Tiến Đạt báo nứt gân',
      }),
    )
    expect(assertAction).toHaveBeenCalledWith(truyen, 'technical.die.update')
    expect(dieWriteRepo.update).toHaveBeenCalledWith('die-1', { status: 'broken' })
    expect(dieWriteRepo.insertEvent).toHaveBeenCalledTimes(1)
    expect(dieWriteRepo.insertEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        die_id: 'die-1',
        event_type: 'broken',
        event_date: '2026-09-27',
        content: 'Tiến Đạt báo nứt gân · Tình trạng: Đang dùng → Khuôn hư',
        created_by: 'u-cu',
      }),
    )
    // `apply` là cờ của form, không phải cột DB.
    expect(vi.mocked(dieWriteRepo.insertEvent).mock.calls[0][0]).not.toHaveProperty(
      'apply',
    )
  })

  it('bỏ tick "cập nhật hồ sơ" → chỉ ghi nhật ký, hồ sơ giữ nguyên', async () => {
    await diesService.addEvent(
      truyen,
      'die-1',
      parse({
        event_type: 'broken',
        event_date: '2022-02-23',
        content: 'Chuyện cũ',
        apply: false,
      }),
    )
    expect(dieWriteRepo.update).not.toHaveBeenCalled()
    expect(dieWriteRepo.insertEvent).toHaveBeenCalledWith(
      expect.objectContaining({ content: 'Chuyện cũ' }),
    )
  })

  it('Chuyển nơi giữ: "Từ" lấy từ hồ sơ, nơi giữ đổi', async () => {
    await diesService.addEvent(
      truyen,
      'die-1',
      parse({
        event_type: 'transferred',
        event_date: '2026-09-25',
        to_holder: 'Việt Eco',
      }),
    )
    expect(dieWriteRepo.update).toHaveBeenCalledWith('die-1', { holder_name: 'Việt Eco' })
    expect(dieWriteRepo.insertEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        from_holder: 'Tiến Đạt',
        to_holder: 'Việt Eco',
        content: null,
      }),
    )
  })

  it('Sửa / bỏ gân: kg/m trước lấy từ hồ sơ, kg/m hồ sơ nhận số sau', async () => {
    await diesService.addEvent(
      truyen,
      'die-1',
      parse({
        event_type: 'modified',
        event_date: '2026-09-20',
        weight_after: '0.275',
        cost: '4323000',
      }),
    )
    expect(dieWriteRepo.update).toHaveBeenCalledWith('die-1', { weight_per_m: 0.275 })
    expect(dieWriteRepo.insertEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        weight_before: 0.289,
        weight_after: 0.275,
        cost: 4323000,
      }),
    )
  })

  it('không cho thay khuôn bằng chính nó', async () => {
    await expect(
      diesService.addEvent(
        truyen,
        'die-1',
        parse({
          event_type: 'replaced',
          event_date: '2026-09-20',
          related_die_id: '00000000-0000-4000-8000-000000000001',
        }),
      ),
    ).resolves.toBeUndefined()
    vi.mocked(dieCatalogRepo.getById).mockResolvedValue({
      ...A592,
      id: '00000000-0000-4000-8000-000000000001',
    } as never)
    await expect(
      diesService.addEvent(
        truyen,
        '00000000-0000-4000-8000-000000000001',
        parse({
          event_type: 'replaced',
          event_date: '2026-09-20',
          related_die_id: '00000000-0000-4000-8000-000000000001',
        }),
      ),
    ).rejects.toThrow(/chính nó/)
  })
})

describe('diesService.update — dòng tự đẻ mang ngày hôm đó', () => {
  it('đổi nơi giữ qua "Sửa hồ sơ" → dòng Chuyển nơi giữ có ngày', async () => {
    await diesService.update(truyen, 'die-1', { holder_name: 'Việt Eco' })
    expect(dieWriteRepo.insertEvent).toHaveBeenCalledWith(
      expect.objectContaining({ event_type: 'transferred', event_date: vnTodayIso() }),
    )
  })
})
