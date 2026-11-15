// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { gomSoCongDoan, ngayTrongThang } from '@/lib/so-cong-doan'
import type { SoCongDoanPayload } from '@/modules/dept/production/so-cong-doan.service'
import { a11yViolations } from '@/test/a11y'
import { SoCongDoanScreen } from './SoCongDoanScreen'

/**
 * SỔ CÔNG ĐOẠN (bản vẽ 14/11/2026 CpB5jKcS…). Hình dữ liệu chép tờ Hàn tháng 9 của
 * sổ năng suất wicker: lệnh → mã hàng → chi tiết, một cột mỗi ngày.
 */
const push = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/thongke/so-cong-doan',
}))
afterEach(() => {
  cleanup()
  push.mockReset()
})

const nguon = (
  row_id: string,
  ten: string,
  can: number,
  da_lam: number,
  cum = 'Cụm tay',
) => ({
  lsx_id: 'L12',
  lsx_code: '12/26-27 - OVAL',
  ma: '992852',
  ten_sp: 'Giường Oval 185cm',
  row_id,
  cum,
  ten,
  thu_tu: Number(row_id.slice(1)),
  can,
  da_lam,
})
const ghi = (
  component_id: string,
  ten: string,
  ngay: string,
  qty: number,
  team_id = 'to-han',
) => ({
  lsx_id: 'L12',
  lsx_code: '12/26-27 - OVAL',
  component_id,
  ten,
  cum: 'Cụm tay',
  thu_tu: 0,
  ngay,
  qty,
  team_id,
})

function payload(over: Partial<SoCongDoanPayload> = {}, ca = false): SoCongDoanPayload {
  const ns = [
    nguon('r1', 'Vòng giữa', 2304, 2304),
    nguon('r2', 'Chống tay phải', 833, 400),
  ]
  const gs = [
    ghi('r1', 'Vòng giữa', '2026-09-08', 458),
    ghi('r1', 'Vòng giữa', '2026-09-09', 222, 'to-han-2'),
    ghi('r1', 'Vòng giữa', '2026-09-09', 10),
  ]
  return {
    today: '2026-09-30',
    thang: '2026-09',
    ngay: ngayTrongThang('2026-09'),
    to_cong_doan: [
      { code: 'phoi', label: 'Phôi', n: 33 },
      { code: 'han', label: 'Hàn', n: 117 },
    ],
    cd: 'han',
    cd_label: 'Hàn',
    ca,
    lenh: gomSoCongDoan(ns, gs, { ca }),
    teams: { 'to-han': 'Tổ Hàn', 'to-han-2': 'Tổ Hàn nhôm' },
    ...over,
  }
}

describe('Sổ công đoạn', () => {
  it('dải tờ công đoạn có số chi tiết; bấm tờ khác đổi tờ', () => {
    render(<SoCongDoanScreen p={payload()} />)
    const to = screen.getByRole('tablist', { name: 'Tờ công đoạn' })
    expect(
      within(to)
        .getAllByRole('tab')
        .map((t) => t.textContent),
    ).toEqual(['Phôi33', 'Hàn117'])
    fireEvent.click(within(to).getByRole('tab', { name: /Phôi/ }))
    expect(push).toHaveBeenCalledWith('/thongke/so-cong-doan?cd=phoi')
  })

  it('cả tháng: 30 cột ngày; hàng chi tiết có Cần · Đã làm · Còn và số từng ngày', () => {
    render(<SoCongDoanScreen p={payload()} />)
    const dau = screen.getAllByRole('columnheader')
    expect(dau).toHaveLength(4 + 30 + 1)
    const hang = screen
      .getAllByRole('row')
      .find((r) => within(r).queryByText('Vòng giữa'))!
    const o = within(hang).getAllByRole('cell')
    expect(o.slice(0, 4).map((c) => c.textContent)).toEqual([
      'Cụm tay · Vòng giữa',
      '2.304',
      '2.304',
      'đủ',
    ])
    // 08/09: 458 của Tổ Hàn → mở Sổ theo ngày đúng tổ; 09/09: hai tổ → mọi tổ.
    expect(within(hang).getByRole('link', { name: '458' }).getAttribute('href')).toBe(
      '/thongke/da-ghi?date=2026-09-08&to=to-han&cd=han',
    )
    expect(within(hang).getByRole('link', { name: '232' }).getAttribute('href')).toBe(
      '/thongke/da-ghi?date=2026-09-09&to=all&cd=han',
    )
    expect(o[o.length - 1].textContent).toBe('690')
  })

  it('mặc định chỉ chi tiết có ghi; hàng mã nói "xong x/y"', () => {
    render(<SoCongDoanScreen p={payload()} />)
    expect(screen.queryByText('Chống tay phải')).toBeNull()
    expect(screen.getByText('1/1 xong')).toBeTruthy()
    fireEvent.click(
      screen.getByRole('button', { name: 'Cả chi tiết của lệnh đang chạy' }),
    )
    expect(push).toHaveBeenCalledWith('/thongke/so-cong-doan?cd=han&ca=1')
    cleanup()
    render(<SoCongDoanScreen p={payload({}, true)} />)
    expect(screen.getByText('Chống tay phải')).toBeTruthy()
    expect(screen.getByText('1/2 xong')).toBeTruthy()
  })

  it('gập mã hàng; tìm chữ lọc chi tiết', () => {
    render(<SoCongDoanScreen p={payload({}, true)} />)
    fireEvent.click(screen.getByRole('button', { name: 'Gập 992852' }))
    expect(screen.queryByText('Vòng giữa')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Mở 992852' }))
    fireEvent.change(screen.getByLabelText('Tìm lệnh, mã hàng, chi tiết'), {
      target: { value: 'chống' },
    })
    expect(screen.queryByText('Vòng giữa')).toBeNull()
    expect(screen.getByText('Chống tay phải')).toBeTruthy()
  })

  it('tờ chưa có dòng chính thức: nói lý do + mở cả chi tiết / tháng trước', () => {
    render(<SoCongDoanScreen p={payload({ lenh: [] })} />)
    expect(screen.getByText('Tờ Hàn tháng 9/2026 chưa có dòng chính thức')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Tháng trước' }).getAttribute('href')).toBe(
      '/thongke/so-cong-doan?thang=2026-08&cd=han',
    )
  })

  it('không lỗi a11y', async () => {
    const { container } = render(<SoCongDoanScreen p={payload()} />)
    expect(await a11yViolations(container)).toEqual([])
  })
})
