// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { gomNangSuat, type NsDong, type NsPhieu } from '@/lib/nang-suat'
import type {
  NangSuatHang,
  NangSuatPayload,
} from '@/modules/dept/production/nang-suat.service'
import { a11yViolations } from '@/test/a11y'
import { NangSuatScreen } from './NangSuatScreen'

/**
 * MÀN NĂNG SUẤT (bản vẽ 11/11/2026 tab 3) — DB chưa có phiếu nào (12/11: 0 phiếu
 * ghi sổ), nên bảng có số chỉ kiểm được bằng dữ liệu dựng ở đây, đi qua CHÍNH
 * `gomNangSuat` mà service dùng.
 */

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/thongke/nang-suat',
}))

afterEach(cleanup)

const days = ['2026-11-10', '2026-11-11', '2026-11-12']
const phieu: NsPhieu[] = [
  { id: 'a', entry_date: '2026-11-10', stage: 'phoi', team_id: 't1', labor_hours: 48 },
  { id: 'b', entry_date: '2026-11-11', stage: 'phoi', team_id: 't1', labor_hours: 32 },
  { id: 'c', entry_date: '2026-11-11', stage: 'han', team_id: 't2', labor_hours: 16 },
]
const dong: NsDong[] = [
  { doc_id: 'a', qty: 100, kg: 40 },
  { doc_id: 'b', qty: 60, kg: 24 },
  { doc_id: 'c', qty: 10, kg: 30 },
]

function payload(dmPhoi: number | null): NangSuatPayload {
  const cd = gomNangSuat(phieu, dong, days, (p) => p.stage)
  const tx = gomNangSuat(phieu, dong, days, (p) => p.team_id ?? '')
  const hang = (r: (typeof cd.rows)[number], x: Partial<NangSuatHang>): NangSuatHang => ({
    ...r,
    label: r.key,
    sub: null,
    count_level: null,
    dm_ns: null,
    last_date: null,
    ...x,
  })
  const empty = { ...cd.rows[0], key: 'son', docs: 0 }
  return {
    ky: 14,
    from: days[0],
    to: days[2],
    today: days[2],
    days,
    cong_doan: [
      hang(
        cd.rows.find((r) => r.key === 'phoi')!,
        {
          label: 'Phôi',
          sub: 'Tổ Phôi',
          count_level: 'part',
          dm_ns: dmPhoi,
        },
      ),
      hang(
        cd.rows.find((r) => r.key === 'han')!,
        {
          label: 'Hàn',
          sub: 'Tổ Hàn Nhôm',
          count_level: 'cluster',
        },
      ),
      hang(empty, { label: 'Sơn', last_date: '2026-09-25' }),
    ],
    to_xuong: tx.rows.map((r) =>
      hang(r, { label: r.key === 't1' ? 'Tổ Phôi' : 'Tổ Hàn Nhôm' }),
    ),
    total: cd.total,
    chua_tinh: 2,
    co_so: true,
    co_dm: dmPhoi != null,
  }
}

describe('NangSuatScreen', () => {
  it('bảng tóm: Σ kg ÷ Σ giờ, đơn vị đếm, dòng trống kỳ nói lần ghi cuối', () => {
    render(<NangSuatScreen data={payload(null)} theo="cong_doan" />)
    const bang = screen.getAllByRole('table')[0]
    const phoi = within(bang).getByText('Phôi').closest('tr')!
    // (40 + 24) kg ÷ (48 + 32) giờ = 0,8
    expect(phoi.textContent).toContain('64')
    expect(phoi.textContent).toContain('0,8')
    expect(phoi.textContent).toContain('chi tiết')
    const son = within(bang).getByText('Sơn').closest('tr')!
    expect(son.textContent).toContain('lần ghi cuối 25/09/2026')
    // Toàn xưởng: 94 kg ÷ 96 giờ = 1 — không cộng dọc số lượng.
    const chan = bang.querySelector('tfoot tr')!
    expect(chan.textContent).toContain('94')
    expect(chan.textContent).toContain('không cộng')
    expect(screen.getByText(/phiếu trong kỳ chưa xác nhận/)).toBeTruthy()
  })

  it('chưa đặt ĐM: không cột % ĐM, nhắc chỗ đặt', () => {
    render(<NangSuatScreen data={payload(null)} theo="cong_doan" />)
    expect(screen.queryByText('% ĐM')).toBeNull()
    expect(screen.getByText('Đặt ở Cấu hình công đoạn')).toBeTruthy()
  })

  it('có ĐM: % ĐM, dưới 80% tô cam', () => {
    render(<NangSuatScreen data={payload(1.2)} theo="cong_doan" />)
    expect(screen.getByText('% ĐM')).toBeTruthy()
    const phoi = within(screen.getAllByRole('table')[0]).getByText('Phôi').closest('tr')!
    // 0,8 ÷ 1,2 = 67% → dưới 80%
    const o = within(phoi).getByText('67%')
    expect(o.className).toContain('warn')
  })

  it('đổi tab Theo tổ; Theo người khoá có lý do', () => {
    render(<NangSuatScreen data={payload(null)} theo="cong_doan" />)
    fireEvent.click(screen.getByRole('tab', { name: /Theo tổ/ }))
    expect(within(screen.getAllByRole('table')[0]).getByText('Tổ Hàn Nhôm')).toBeTruthy()
    const nguoi = screen.getByRole('tab', { name: /Theo người/ })
    expect(nguoi.getAttribute('aria-disabled')).toBe('true')
    expect(nguoi.getAttribute('title')).toMatch(/giờ theo từng người/)
  })

  it('chưa có phiếu nào: rỗng nói lý do + việc tiếp', () => {
    render(
      <NangSuatScreen
        data={{
          ...payload(null),
          co_so: false,
          cong_doan: [],
          to_xuong: [],
          chua_tinh: 0,
        }}
        theo="cong_doan"
      />,
    )
    expect(screen.getByText('Chưa có phiếu ghi sổ nào được xác nhận')).toBeTruthy()
    expect(screen.getByText('Mở Ghi sản lượng').getAttribute('href')).toBe('/thongke/ghi')
  })

  it('không lỗi a11y', async () => {
    const { container } = render(<NangSuatScreen data={payload(1.2)} theo="cong_doan" />)
    expect(await a11yViolations(container)).toEqual([])
  })
})
