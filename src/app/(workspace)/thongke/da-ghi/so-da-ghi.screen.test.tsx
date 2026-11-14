// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import type { SdgDoc, SdgLine } from '@/lib/so-da-ghi'
import type { SoDaGhiPayload } from '@/modules/dept/production/so-da-ghi.service'
import { a11yViolations } from '@/test/a11y'
import { SoDaGhiScreen } from './SoDaGhiScreen'

/**
 * SỔ ĐÃ GHI (bản vẽ 13/11/2026, Q1–Q7). DB chưa có dòng sổ nào (13/11: 0), nên
 * lưới chỉ kiểm được bằng dữ liệu dựng ở đây — đúng tình huống của bản vẽ: sáng
 * Lưu nháp "Tay vịn", chiều ghi lại; gõ "Chân" 1.080 thay 108.
 */

const api = vi.fn()
vi.mock('@/lib/api', async (orig) => ({
  ...(await orig<typeof import('@/lib/api')>()),
  api: (...a: unknown[]) => api(...a),
}))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/thongke/da-ghi',
}))

beforeEach(() =>
  api.mockReset().mockResolvedValue({ updated: 1, deleted: 0, docs_removed: 0 }),
)
afterEach(cleanup)

const T = 'team-phoi'
const ME = 'u-tk-phoi'
const doc = (p: Partial<SdgDoc>): SdgDoc => ({
  id: 'd16',
  doc_no: 'PBS-2026-0016',
  lsx_id: 'giga',
  lsx_code: '01/26-27 - GIGA',
  lsx_closed: false,
  stage: 'phoi',
  stage_label: 'Phôi',
  team_id: T,
  team_name: 'Tổ Phôi',
  entry_date: '2026-11-13',
  status: 'da_xac_nhan',
  shift: 1,
  worker_count: 6,
  hours_per_worker: 6,
  labor_hours: 36,
  kind: 'ngay',
  created_by: ME,
  created_at: '2026-11-13T07:05:00Z',
  ...p,
})
const line = (p: Partial<SdgLine>): SdgLine => ({
  id: 'x',
  doc_id: 'd16',
  lsx_id: 'giga',
  entry_date: '2026-11-13',
  team_id: T,
  stage: 'phoi',
  component_id: 'c',
  product_code: 'TB0299HG-AL',
  name: 'Chân',
  cluster: null,
  qty_per_unit: 4,
  dm_kg: 0.3758,
  needed: 108,
  done: 0,
  available: null,
  qty: 0,
  defect: 0,
  kg: null,
  worker: '',
  note: '',
  defect_code: null,
  defect_reason: '',
  dau_ky: false,
  created_by: ME,
  created_at: '2026-11-13T07:05:00Z',
  ...p,
})

const UUID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`

function payload(over: Partial<SoDaGhiPayload> = {}): SoDaGhiPayload {
  return {
    today: '2026-11-13',
    xem: 'ngay',
    date: '2026-11-13',
    from: '2026-11-13',
    to: '2026-11-13',
    team_id: T,
    teams: [{ id: T, name: 'Tổ Phôi', stage_label: 'Phôi' }],
    phieu: null,
    docs: [
      doc({
        id: 'd15',
        doc_no: 'PBS-2026-0015',
        status: 'nhap',
        worker_count: null,
        hours_per_worker: null,
        labor_hours: null,
        created_at: '2026-11-13T03:20:00Z',
      }),
      doc({}),
    ],
    lines: [
      line({
        id: UUID(1),
        doc_id: 'd15',
        component_id: 'tay-vin',
        product_code: 'BN0230HG-AL',
        name: 'Tay vịn',
        qty_per_unit: 2,
        needed: 24,
        done: 12,
        qty: 12,
        kg: 17.24,
      }),
      line({ id: UUID(2), component_id: 'chan', qty: 1080, done: 1080, kg: 405.86 }),
      line({
        id: UUID(3),
        component_id: 'giang',
        name: 'Giằng chân',
        qty_per_unit: 2,
        needed: 54,
        done: 54,
        qty: 54,
        kg: 31.78,
      }),
      line({
        id: UUID(4),
        component_id: 'tay-vin',
        product_code: 'BN0230HG-AL',
        name: 'Tay vịn',
        qty_per_unit: 2,
        needed: 24,
        done: 12,
        qty: 12,
        kg: 17.24,
      }),
    ],
    locks: [],
    defect_labels: { cong: 'Cong vênh' },
    me_id: ME,
    can_all: false,
    ...over,
  }
}

const dongCua = (name: string, i = 0) =>
  screen.getAllByRole('row').filter((r) => within(r).queryByText(name))[i]

describe('Sổ đã ghi', () => {
  it('bày phiếu + dòng; tab Cần soát đếm đúng số dòng bị tô (vượt phải làm + trùng hai phiếu)', () => {
    render(<SoDaGhiScreen p={payload()} />)
    expect(screen.getByText('PBS-2026-0015')).toBeTruthy()
    expect(screen.getByText('PBS-2026-0016')).toBeTruthy()
    const soat = screen.getByRole('tab', { name: /Cần soát/ })
    expect(soat.textContent).toContain('3')
    expect(screen.getByText(/Cần soát 3 dòng/)).toBeTruthy()
    // Dòng "Chân" 1.080 > 108 tô đỏ; hai dòng "Tay vịn" tô vàng (trùng phiếu).
    expect(dongCua('Chân').className).toContain('soat')
    expect(dongCua('Tay vịn', 0).className).toContain('soatw')
    expect(dongCua('Tay vịn', 1).className).toContain('soatw')
    // Nháp không cộng vào chân bảng: 1.080 + 54 + 12 chính thức.
    expect(screen.getByText(/nháp 1 không tính/)).toBeTruthy()
  })

  it('sửa Đạt 1.080 → 108 rồi Lưu: gửi đúng một thay đổi', async () => {
    render(<SoDaGhiScreen p={payload()} />)
    const o = screen.getByLabelText('Đạt · Chân') as HTMLInputElement
    expect(o.value).toBe('1.080')
    fireEvent.change(o, { target: { value: '108' } })
    expect(
      screen.getByRole('region', { name: 'Thay đổi chưa lưu' }).textContent,
    ).toContain('1 dòng đã sửa')
    fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }))
    await waitFor(() => expect(api).toHaveBeenCalledTimes(1))
    expect(api.mock.calls[0][0]).toBe('/api/dept/production/so-da-ghi')
    expect(api.mock.calls[0][1].body).toEqual({
      edits: [{ id: UUID(2), qty: 108 }],
      deletes: [],
    })
  })

  it('thêm lỗi mà chưa ghi lý do: bị chặn tại chỗ, không gọi máy chủ', () => {
    render(<SoDaGhiScreen p={payload()} />)
    fireEvent.change(screen.getByLabelText('Lỗi · Giằng chân'), {
      target: { value: '4' },
    })
    // Ô chữ của dòng đổi sang "lý do lỗi".
    expect(screen.getByLabelText('Lý do lỗi · Giằng chân')).toBeTruthy()
    const bar = screen.getByRole('region', { name: 'Thay đổi chưa lưu' })
    expect(bar.textContent).toContain('Có lỗi thì phải ghi lý do')
    fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }))
    expect(api).not.toHaveBeenCalled()
    fireEvent.change(screen.getByLabelText('Lý do lỗi · Giằng chân'), {
      target: { value: 'Cong vênh' },
    })
    expect(bar.textContent).not.toContain('Có lỗi thì phải ghi lý do')
  })

  it('xoá hai nhịp, lưu cùng lượt', async () => {
    render(<SoDaGhiScreen p={payload()} />)
    const nut = () => within(dongCua('Tay vịn', 0)).getByRole('button')
    fireEvent.click(nut())
    expect(nut().textContent).toBe('Xoá?')
    expect(screen.queryByRole('region', { name: 'Thay đổi chưa lưu' })).toBeNull()
    fireEvent.click(nut())
    expect(nut().textContent).toBe('Bỏ xoá')
    expect(
      screen.getByRole('region', { name: 'Thay đổi chưa lưu' }).textContent,
    ).toContain('1 dòng sẽ xoá')
    fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }))
    await waitFor(() => expect(api).toHaveBeenCalledTimes(1))
    expect(api.mock.calls[0][1].body).toEqual({ edits: [], deletes: [UUID(1)] })
  })

  it('sổ ngày đã chốt: không ô gõ, không nút Xoá, nói vì sao', () => {
    render(
      <SoDaGhiScreen
        p={payload({
          locks: [
            {
              team_id: T,
              date: '2026-11-13',
              by: 'Thống kê Tổ Phôi',
              at: '2026-11-13T10:32:00Z',
            },
          ],
        })}
      />,
    )
    expect(screen.queryByLabelText('Đạt · Chân')).toBeNull()
    expect(within(dongCua('Chân')).queryByRole('button')).toBeNull()
    expect(dongCua('Chân').getAttribute('title')).toContain('mở khoá ở Sổ ngày')
    expect(screen.getByText(/sổ ngày đã chốt/)).toBeTruthy()
  })

  it('dòng người khác ghi: chỉ xem (thống kê không phải quản đốc)', () => {
    const p = payload()
    p.lines = p.lines.map((l) => (l.id === UUID(2) ? { ...l, created_by: 'u-khac' } : l))
    render(<SoDaGhiScreen p={p} />)
    expect(screen.queryByLabelText('Đạt · Chân')).toBeNull()
    expect(screen.getByLabelText('Đạt · Giằng chân')).toBeTruthy()
  })

  it('"Ghi thêm" mở Ghi sản lượng đúng lệnh · công đoạn · ngày · tổ; ngày đã chốt thì không có', () => {
    render(<SoDaGhiScreen p={payload()} />)
    const links = screen.getAllByRole('link', { name: 'Ghi thêm ›' })
    expect(links).toHaveLength(2)
    expect(links[0].getAttribute('href')).toBe(
      `/thongke/ghi?lsx=giga&stage=phoi&date=2026-11-13&team=${T}`,
    )
    cleanup()
    render(
      <SoDaGhiScreen
        p={payload({
          locks: [
            { team_id: T, date: '2026-11-13', by: null, at: '2026-11-13T10:32:00Z' },
          ],
        })}
      />,
    )
    expect(screen.queryByRole('link', { name: 'Ghi thêm ›' })).toBeNull()
  })

  it('phiếu ĐẦU KỲ: có nhãn, chốt sổ ngày không khoá, không "Ghi thêm", không tính năng suất', () => {
    const p = payload({
      docs: [
        doc({
          id: 'd20',
          doc_no: 'PBS-2026-0020',
          kind: 'dau_ky',
          shift: null,
          worker_count: null,
          hours_per_worker: null,
          labor_hours: null,
        }),
      ],
      lines: [line({ id: UUID(9), doc_id: 'd20', qty: 600, done: 600, kg: 225.6, dau_ky: true })],
      locks: [{ team_id: T, date: '2026-11-13', by: null, at: '2026-11-13T10:32:00Z' }],
    })
    render(<SoDaGhiScreen p={p} />)
    expect(screen.getByText('ĐẦU KỲ')).toBeTruthy()
    expect(screen.getByText(/tới hết 13\/11 · không giờ công/)).toBeTruthy()
    // Sổ ngày 13/11 đã chốt nhưng dòng đầu kỳ vẫn sửa được (Q3).
    expect(screen.getByLabelText('Đạt · Chân')).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'Ghi thêm ›' })).toBeNull()
    expect(screen.getByText(/đầu kỳ 1 không tính năng suất/)).toBeTruthy()
    expect(screen.getByText('chưa có giờ công')).toBeTruthy()
  })

  it('rỗng: nói lý do và việc tiếp', () => {
    render(<SoDaGhiScreen p={payload({ docs: [], lines: [] })} />)
    expect(screen.getByText(/Tổ Phôi chưa ghi dòng nào ngày 13\/11\/2026/)).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Xem 7 ngày' })).toBeTruthy()
  })

  it('không lỗi a11y', async () => {
    const { container } = render(<SoDaGhiScreen p={payload()} />)
    expect(await a11yViolations(container)).toEqual([])
  })
})
