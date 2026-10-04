// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { ToastProvider } from '@/components/kit'
import daVe from '@/app/design-lab/chup/_du-lieu/da-ve.json'
import type { DaVeRow } from '@/modules/dept/supply/da-ve.repo'
import { DaVeScreen } from './DaVeScreen'

/**
 * ĐÃ VỀ — "Phiếu tôi lập" + "Mọi ngày" + bấm số phiếu ra chi tiết (04/10/2026,
 * bản vẽ J2/J5). Dựng nguyên màn từ 45 phiếu đóng băng; gán người lập giả cho
 * vài phiếu để lọc có cái mà lọc.
 */

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/mua-hang/theo-doi/da-ve',
}))
afterEach(() => {
  cleanup()
  localStorage.clear()
})

const TOI = 'toi-la-nguoi-lap'

function dung(soToiLap: number) {
  const rows = structuredClone(daVe.rows) as unknown as DaVeRow[]
  rows.forEach((r, i) => {
    r.nguoi_lap_id = i < soToiLap ? TOI : 'nguoi-khac'
    r.lsx_them = []
  })
  render(
    <ToastProvider>
      <DaVeScreen
        rows={rows}
        today={daVe.today}
        truncatedAt={null}
        canWrite
        meId={TOI}
        defaultScope="phong"
        urlScope="phong"
        giaoNhan={null}
      />
    </ToastProvider>,
  )
  return rows
}
const chon = (label: string, value: string) =>
  fireEvent.change(screen.getByRole('combobox', { name: label }), { target: { value } })
const dongPhieu = () =>
  screen.queryAllByRole('link').filter((a) => /^PNK-/.test(a.textContent ?? ''))

describe('Đã về — phiếu tôi lập', () => {
  it('số phiếu mở trang chi tiết, không mở bản in', () => {
    const rows = dung(0)
    chon('Ngày nhận', 'tat')
    const a = dongPhieu()[0]
    expect(a.getAttribute('href')).toBe(
      `/mua-hang/theo-doi/da-ve/${rows.find((r) => r.code === a.textContent)!.doc_id}`,
    )
  })

  it('"Phiếu tôi lập" + "Mọi ngày" chỉ còn phiếu người đang xem lập', () => {
    const rows = dung(3)
    chon('Người', 'lap')
    chon('Ngày nhận', 'tat')
    const ma = dongPhieu().map((a) => a.textContent)
    expect(ma.sort()).toEqual(
      rows
        .slice(0, 3)
        .map((r) => r.code)
        .sort(),
    )
  })

  it('chưa lập phiếu nào → nói vì sao + mời xem cả phòng', () => {
    dung(0)
    chon('Người', 'lap')
    expect(screen.getByText('Bạn chưa lập phiếu nhập nào')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Xem cả phòng · 45 phiếu/ }))
    chon('Ngày nhận', 'tat')
    // Màn chia trang vừa một màn — đếm trang đầu không ra 45; soi ô lọc + hết rỗng.
    expect(screen.getByRole('combobox', { name: 'Người' })).toHaveProperty(
      'value',
      'phong',
    )
    expect(screen.queryByText('Bạn chưa lập phiếu nhập nào')).toBeNull()
    expect(dongPhieu().length).toBeGreaterThan(0)
  })

  it('cột Số phiếu NCC nói "chưa ghi" khi trống', () => {
    dung(0)
    chon('Ngày nhận', 'tat')
    const bang = screen.getByRole('table')
    expect(within(bang).getByText('Số phiếu NCC')).toBeTruthy()
    expect(within(bang).getAllByText('— chưa ghi').length).toBeGreaterThan(0)
  })
})
