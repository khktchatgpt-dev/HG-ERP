import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/modules/core/rbac/rbac.service', () => ({ canAction: vi.fn() }))
vi.mock('./sales-analysis.repo', () => ({ salesAnalysisRepo: { lines: vi.fn() } }))

import { canAction } from '@/modules/core/rbac/rbac.service'
import { salesAnalysisRepo } from './sales-analysis.repo'
import { salesAnalysisService } from './sales-analysis.service'

const RAW = {
  order_id: 'O1',
  order_code: 'DH-1',
  customer: 'LAURA',
  created_at: '2026-08-20T03:00:00Z',
  product_id: 'P1',
  product_code: 'TB0001HG-AL',
  product_name: 'Bàn',
  product_type: 'TB',
  qty: 10,
  unit_price: 50,
  plan_direct_cost: 40,
  plan_profit: 6,
}
const user = { id: 'u' } as never

beforeEach(() => vi.clearAllMocks())

describe('salesAnalysisService.board — giá thành là bí mật của Bán hàng', () => {
  it('KHÔNG quyền: không đọc cột giá thành từ DB, lãi luôn null', async () => {
    vi.mocked(canAction).mockResolvedValue(false)
    // Dù repo có trả số (giả sử lỗi), service vẫn không được đẩy lãi xuống.
    vi.mocked(salesAnalysisRepo.lines).mockResolvedValue([RAW])
    const r = await salesAnalysisService.board(user)
    expect(salesAnalysisRepo.lines).toHaveBeenCalledWith(false)
    expect(r.canSeeCost).toBe(false)
    expect(r.dongs[0].lai).toBeNull()
  })
  it('CÓ quyền: lãi = SL × lãi/SP; trị giá = SL × đơn giá; tháng nhận đơn', async () => {
    vi.mocked(canAction).mockResolvedValue(true)
    vi.mocked(salesAnalysisRepo.lines).mockResolvedValue([RAW])
    const r = await salesAnalysisService.board(user)
    expect(salesAnalysisRepo.lines).toHaveBeenCalledWith(true)
    expect(r.dongs[0]).toMatchObject({ value: 500, lai: 60, thang_nhan: '2026-08' })
  })
  it('SP chỉ có FOB (thiếu chi phí trực tiếp) không tính lãi', async () => {
    vi.mocked(canAction).mockResolvedValue(true)
    vi.mocked(salesAnalysisRepo.lines).mockResolvedValue([
      { ...RAW, plan_direct_cost: null },
    ])
    expect((await salesAnalysisService.board(user)).dongs[0].lai).toBeNull()
  })
})
