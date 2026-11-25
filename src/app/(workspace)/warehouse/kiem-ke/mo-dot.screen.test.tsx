// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ChuanBiMoDot } from '@/modules/dept/warehouse/stocktakes.service'
import { MoDotHop } from './mo-dot'

/**
 * Hộp mở đợt kiểm kê · gợi ý người đếm (bước 3 phụ trách nhóm vật tư, 24/11/2026):
 * nhóm đã chọn cùng một người giữ → điền sẵn người đó; nhiều người → nói ai giữ gì.
 */
const DATA: ChuanBiMoDot = {
  nhom: [
    { group_name: 'Bao bì', co_ton: 10, se_dem: 12, kiem_cuoi: null, giu: 'ha', giu_ten: 'Hà Nguyễn Nữ' }, // prettier-ignore
    { group_name: 'Mút - xốp', co_ton: 5, se_dem: 6, kiem_cuoi: null, giu: 'ha', giu_ten: 'Hà Nguyễn Nữ' }, // prettier-ignore
    { group_name: 'Sắt thép', co_ton: 8, se_dem: 9, kiem_cuoi: null, giu: 'hao', giu_ten: 'Lê Khắc Hào' }, // prettier-ignore
  ],
  nguoi: [
    { id: 'hao', name: 'Lê Khắc Hào' },
    { id: 'ha', name: 'Hà Nguyễn Nữ' },
  ],
  lenhChuaXuat: { so_lenh: 0, so_ma: 0 },
}
vi.mock('@/lib/api', () => ({
  api: () => Promise.resolve(DATA),
  apiErrorText: (_e: unknown, f: string) => f,
}))
afterEach(cleanup)

const oNguoi = () => screen.getByRole('combobox', { name: 'Người đếm' }) as HTMLSelectElement
const tick = (ten: string) => fireEvent.click(screen.getByRole('checkbox', { name: new RegExp(ten) }))

describe('Mở đợt kiểm kê · gợi ý người đếm', () => {
  it('nhóm cùng một người giữ → điền sẵn; thêm nhóm người khác → bỏ gợi ý, nói hai người', async () => {
    render(<MoDotHop onClose={() => {}} onDone={() => {}} />)
    await screen.findByText(/Bao bì/)
    tick('Bao bì')
    tick('Mút - xốp')
    expect(oNguoi().value).toBe('ha')
    expect(screen.getByText(/Gợi ý theo người giữ nhóm/)).toBeTruthy()
    tick('Sắt thép')
    expect(oNguoi().value).toBe('')
    expect(screen.getByText(/thuộc 2 người: Hà Nguyễn Nữ · Lê Khắc Hào/)).toBeTruthy()
  })

  it('đã tự chọn người đếm thì không tự đổi theo nhóm nữa', async () => {
    render(<MoDotHop onClose={() => {}} onDone={() => {}} />)
    await screen.findByText(/Bao bì/)
    fireEvent.change(oNguoi(), { target: { value: 'hao' } })
    tick('Bao bì')
    expect(oNguoi().value).toBe('hao')
  })
})
