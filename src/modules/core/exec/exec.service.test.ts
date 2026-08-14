import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/modules/dept/supply/pos.service', () => ({ posService: { list: vi.fn() } }))
vi.mock('@/modules/dept/supply/pos.repo', () => ({
  posRepo: { totalsByPoIds: vi.fn() },
}))
vi.mock('@/modules/dept/production/lsx.service', () => ({
  lsxService: { list: vi.fn() },
}))
vi.mock('@/modules/dept/sales/orders.repo', () => ({
  ordersRepo: {
    list: vi.fn(),
    listLinesByOrders: vi.fn(),
    lineSummaryByOrderIds: vi.fn(),
    countLinesWithoutPrice: vi.fn(),
  },
}))
vi.mock('@/modules/dept/sales/quotes.repo', () => ({
  quotesRepo: { list: vi.fn(), lineCountByQuoteIds: vi.fn() },
}))
vi.mock('@/modules/dept/warehouse/stock.repo', () => ({ stockRepo: { list: vi.fn() } }))
vi.mock('@/modules/core/approvals/approvals.repo', () => ({
  approvalEventsRepo: { listRecent: vi.fn() },
}))
vi.mock('@/modules/core/users/users.repo', () => ({
  usersRepo: { displayNamesByIds: vi.fn() },
}))
vi.mock('@/modules/core/rbac/rbac.service', () => ({ assertAction: vi.fn() }))
vi.mock('@/modules/core/settings/settings.service', () => ({
  settingsService: { approvalThresholds: vi.fn() },
}))

import { execService } from './exec.service'
import { quotesRepo } from '@/modules/dept/sales/quotes.repo'
import { posService } from '@/modules/dept/supply/pos.service'
import { posRepo } from '@/modules/dept/supply/pos.repo'
import { lsxService } from '@/modules/dept/production/lsx.service'
import { ordersRepo } from '@/modules/dept/sales/orders.repo'
import { approvalEventsRepo } from '@/modules/core/approvals/approvals.repo'
import { settingsService } from '@/modules/core/settings/settings.service'
import { usersRepo } from '@/modules/core/users/users.repo'
import type { User } from '@/modules/core/users/users.repo'

const gd = { id: 'u-gd', role: 'manager' } as unknown as User

/** Hôm nay theo giờ hệ thống — service tự lấy, test bám theo để khỏi lệch múi giờ. */
const today = new Date().toISOString().slice(0, 10)
function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86_400_000).toISOString()
}

const PO = (over: Record<string, unknown> = {}) => ({
  id: 'po1',
  code: 'PO-01',
  supplier_name: 'Gỗ Tân Phát',
  lsx_code: 'LSX-01',
  currency: 'VND',
  expected_at: null,
  created_at: daysAgo(1),
  created_by: 'u-cu',
  status: 'pending_approval',
  ...over,
})

const LSX = (over: Record<string, unknown> = {}) => ({
  id: 'lsx1',
  code: 'LSX-01',
  customer_name: 'MERXX',
  order_ids: ['o1'],
  order_codes: ['DH-1'],
  created_at: daysAgo(1),
  issued_by: 'u-sale',
  ship_date: null,
  status: 'pending_approval',
  ...over,
})

const OL = (over: Record<string, unknown> = {}) => ({
  id: 'l1',
  order_id: 'o1',
  qty: 10,
  unit_price: 5,
  bom_status: 'done',
  ...over,
})

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(posRepo.totalsByPoIds).mockResolvedValue({})
  // 0149 — signBox nạp thêm báo giá chờ duyệt; test cũ chạy với hộp không báo giá.
  vi.mocked(quotesRepo.list).mockResolvedValue({ rows: [], total: 0 } as never)
  vi.mocked(quotesRepo.lineCountByQuoteIds).mockResolvedValue(new Map() as never)
  vi.mocked(ordersRepo.listLinesByOrders).mockResolvedValue([] as never)
  vi.mocked(ordersRepo.list).mockResolvedValue({
    rows: [{ id: 'o1', currency: 'USD' }],
    total: 1,
  } as never)
  vi.mocked(approvalEventsRepo.listRecent).mockResolvedValue([] as never)
  vi.mocked(settingsService.approvalThresholds).mockResolvedValue({
    VND: 50_000_000,
  })
  vi.mocked(usersRepo.displayNamesByIds).mockResolvedValue(
    new Map([
      ['u-cu', 'Lệ Hằng'],
      ['u-sale', 'Minh Hằng'],
    ]) as never,
  )
})

/** posService.list bị gọi 2 lần: lô chờ duyệt, rồi lô đếm tổng (page_size 1). */
function mockLists(opts: {
  pos?: unknown[]
  lsx?: unknown[]
  posTotal?: number
  lsxTotal?: number
}) {
  vi.mocked(posService.list)
    .mockResolvedValueOnce({
      rows: opts.pos ?? [],
      total: opts.pos?.length ?? 0,
    } as never)
    .mockResolvedValueOnce({ rows: [], total: opts.posTotal ?? 0 } as never)
  vi.mocked(lsxService.list)
    .mockResolvedValueOnce({
      rows: opts.lsx ?? [],
      total: opts.lsx?.length ?? 0,
    } as never)
    .mockResolvedValueOnce({ rows: [], total: opts.lsxTotal ?? 0 } as never)
}

describe('execService.signBox — xếp phiếu', () => {
  it('CHỜ LÂU NHẤT đứng trước, không phải phiếu to nhất', async () => {
    mockLists({
      pos: [
        PO({ id: 'po-to', code: 'PO-TO', created_at: daysAgo(0) }),
        PO({ id: 'po-cu', code: 'PO-CU', created_at: daysAgo(5) }),
      ],
    })
    vi.mocked(posRepo.totalsByPoIds).mockResolvedValue({
      'po-to': 900_000_000,
      'po-cu': 1_000,
    })

    const box = await execService.signBox(gd)

    expect(box.items.map((i) => i.code)).toEqual(['PO-CU', 'PO-TO'])
    expect(box.stats.oldest_days).toBe(5)
  })

  it('cùng số ngày chờ thì phiếu to đứng trước', async () => {
    mockLists({
      pos: [
        PO({ id: 'a', code: 'PO-A', created_at: daysAgo(2) }),
        PO({ id: 'b', code: 'PO-B', created_at: daysAgo(2) }),
      ],
    })
    vi.mocked(posRepo.totalsByPoIds).mockResolvedValue({ a: 10, b: 99 })

    const box = await execService.signBox(gd)
    expect(box.items.map((i) => i.code)).toEqual(['PO-B', 'PO-A'])
  })

  it('tiền gom theo TỪNG tiền tệ, không cộng USD với VND', async () => {
    mockLists({
      pos: [
        PO({ id: 'a', code: 'PO-A', currency: 'VND' }),
        PO({ id: 'b', code: 'PO-B', currency: 'USD' }),
      ],
    })
    vi.mocked(posRepo.totalsByPoIds).mockResolvedValue({ a: 1_000_000, b: 50 })

    const box = await execService.signBox(gd)
    expect(box.stats.value).toEqual([
      { currency: 'VND', value: 1_000_000 },
      { currency: 'USD', value: 50 },
    ])
  })
})

describe('execService.signBox — cảnh báo trước khi ký', () => {
  it('đơn mua không ra tiền → cảnh báo thiếu đơn giá vật tư', async () => {
    mockLists({ pos: [PO()] })
    const box = await execService.signBox(gd)
    expect(box.items[0].warnings).toContain(
      'Đơn chưa có tiền — dòng vật tư thiếu đơn giá',
    )
  })

  it('ngày hàng về đã qua → nói rõ quá bao nhiêu ngày', async () => {
    mockLists({ pos: [PO({ expected_at: daysAgo(3).slice(0, 10) })] })
    vi.mocked(posRepo.totalsByPoIds).mockResolvedValue({ po1: 5 })
    const box = await execService.signBox(gd)
    expect(box.items[0].warnings).toContain('Ngày hàng về đã qua 3 ngày')
  })

  it('lệnh SX còn sản phẩm chưa chốt BOM → cảnh báo kèm số lượng', async () => {
    mockLists({ lsx: [LSX()] })
    vi.mocked(ordersRepo.listLinesByOrders).mockResolvedValue([
      OL({ id: 'l1', bom_status: 'done' }),
      OL({ id: 'l2', bom_status: 'drawing' }),
      OL({ id: 'l3', bom_status: 'none' }),
    ] as never)

    const box = await execService.signBox(gd)
    expect(box.items[0].warnings).toContain('2 sản phẩm chưa chốt BOM')
    expect(box.items[0].value).toBe(150) // 3 dòng × 10 × 5
    expect(box.items[0].currency).toBe('USD') // lấy từ ĐƠN, không phải dòng đơn
  })

  it('cờ "giá trị lớn" bám đúng ngưỡng của TIỀN TỆ đó', async () => {
    vi.mocked(settingsService.approvalThresholds).mockResolvedValue({
      VND: 50_000_000,
      USD: 2_000,
    })
    mockLists({
      pos: [
        PO({ id: 'a', code: 'PO-A', created_at: daysAgo(4) }),
        PO({ id: 'b', code: 'PO-B', created_at: daysAgo(3) }),
        PO({ id: 'c', code: 'PO-USD', currency: 'USD', created_at: daysAgo(2) }),
        PO({ id: 'd', code: 'PO-EUR', currency: 'EUR', created_at: daysAgo(1) }),
      ],
    })
    vi.mocked(posRepo.totalsByPoIds).mockResolvedValue({
      a: 50_000_000,
      b: 49_999_999,
      c: 1_999,
      d: 1,
    })

    const box = await execService.signBox(gd)
    const big = (code: string) => box.items.find((i) => i.code === code)?.big
    expect(big('PO-A')).toBe(true)
    expect(big('PO-B')).toBe(false)
    expect(big('PO-USD')).toBe(false) // dưới ngưỡng USD riêng
    // EUR chưa đặt ngưỡng → luôn lớn, dù chỉ 1 EUR. Không có tỉ giá thì không đoán.
    expect(big('PO-EUR')).toBe(true)
  })

  it('lệnh SX KHÔNG bao giờ mang cờ giá trị lớn — ký lệnh không tiêu tiền', async () => {
    mockLists({ lsx: [LSX()] })
    vi.mocked(ordersRepo.listLinesByOrders).mockResolvedValue([
      OL({ qty: 1000, unit_price: 9_999 }),
    ] as never)

    const box = await execService.signBox(gd)
    expect(box.items[0].value).toBe(9_999_000)
    expect(box.items[0].big).toBe(false)
  })
})

describe('execService.signBox — màn rỗng phải nói thật vì sao rỗng', () => {
  it('chưa từng có phiếu nào ≠ đã ký hết', async () => {
    mockLists({ posTotal: 0, lsxTotal: 0 })
    const box = await execService.signBox(gd)
    expect(box.items).toEqual([])
    expect(box.emptiness).toEqual({ pos_total: 0, lsx_total: 0 })
  })

  it('có lệnh nhưng chưa có đơn mua nào → phân biệt được hai vế', async () => {
    mockLists({ posTotal: 0, lsxTotal: 8 })
    const box = await execService.signBox(gd)
    expect(box.emptiness).toEqual({ pos_total: 0, lsx_total: 8 })
  })
})

describe('execService.signBox — đã quyết hôm nay', () => {
  it('chỉ đếm việc của CHÍNH người đang xem, trong NGÀY hôm nay', async () => {
    mockLists({})
    vi.mocked(approvalEventsRepo.listRecent).mockResolvedValue([
      { actor_id: 'u-gd', action: 'approved', created_at: `${today}T02:00:00Z` },
      { actor_id: 'u-gd', action: 'rejected', created_at: `${today}T03:00:00Z` },
      { actor_id: 'u-gd', action: 'approved', created_at: daysAgo(2) }, // hôm kia
      { actor_id: 'u-khac', action: 'approved', created_at: `${today}T04:00:00Z` },
    ] as never)

    const box = await execService.signBox(gd)
    expect(box.decided_today).toEqual({ approved: 1, rejected: 1 })
  })
})
