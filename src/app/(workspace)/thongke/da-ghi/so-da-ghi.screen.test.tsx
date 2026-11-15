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
  product_name: 'Bàn tròn GIGA',
  name: 'Chân',
  cluster: null,
  qty_per_unit: 4,
  dm_kg: 0.3758,
  sort: 0,
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
  created_by: ME,
  created_at: '2026-11-13T07:05:00Z',
  ...p,
})

const UUID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`

function payload(over: Partial<SoDaGhiPayload> = {}): SoDaGhiPayload {
  return {
    today: '2026-11-13',
    date: '2026-11-13',
    team_id: T,
    teams: [{ id: T, name: 'Tổ Phôi', stage_label: 'Phôi' }],
    stages: [
      { code: 'phoi', label: 'Phôi' },
      { code: 'han', label: 'Hàn' },
      { code: 'son', label: 'Sơn' },
    ],
    cd: null,
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
    // Cả hai phiếu có dòng cần soát nên mở sẵn (Q1 bản vẽ 14/11).
    expect(screen.getByRole('button', { name: 'Gập PBS-2026-0015' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Gập PBS-2026-0016' })).toBeTruthy()
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

  it('biết ghi cho lệnh nào, SP nào: đầu phiếu nói công đoạn · lệnh · tổ, mã hàng kèm tên SP', () => {
    render(<SoDaGhiScreen p={payload()} />)
    const phieu = screen.getByRole('button', { name: 'Gập PBS-2026-0016' }).closest('tr')!
    expect(phieu.textContent).toMatch(/^▾Phôi · Lệnh 01\/26-27 - GIGA · Tổ Phôi/)
    expect(screen.getAllByText('Bàn tròn GIGA').length).toBeGreaterThan(0)
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

  it('dòng trong phiếu xếp theo Bảng chi tiết, không theo thứ tự DB trả (thử lệnh TEST 14/11)', () => {
    const p = payload({
      lines: [
        line({ id: UUID(21), name: 'Khung bàn', component_id: 'kb', sort: 2, qty: 8 }),
        line({ id: UUID(22), name: 'Giằng chân', component_id: 'gc', sort: 1, qty: 18 }),
        line({ id: UUID(23), name: 'Chân', component_id: 'ch', sort: 0, qty: 30 }),
      ],
    })
    render(<SoDaGhiScreen p={p} />)
    const ten = screen
      .getAllByRole('row')
      .map((r) => within(r).queryAllByRole('cell')[0]?.textContent ?? '')
      .filter((x) => /Chân|Giằng|Khung/.test(x))
    expect(ten.map((x) => x.replace(/\s*×.*/, ''))).toEqual([
      'Chân',
      'Giằng chân',
      'Khung bàn',
    ])
  })

  // ── Bản vẽ 14/11 CUUfVcZx… bước 1 (Q1·Q2·Q4·Q5): một ngày nhiều công đoạn ──
  /** Phôi 08:05 có dòng vượt phải làm; Hàn 07:00 (ghi TRƯỚC) hai mã, không dòng nào cần soát. */
  const haiCongDoan = () =>
    payload({
      team_id: null,
      docs: [
        doc({}),
        doc({
          id: 'd20',
          doc_no: 'PBS-2026-0020',
          stage: 'han',
          stage_label: 'Hàn',
          team_name: 'Tổ Hàn',
          created_at: '2026-11-13T00:00:00Z',
        }),
      ],
      lines: [
        line({ id: UUID(31), component_id: 'chan', qty: 1080, done: 1080 }),
        line({
          id: UUID(32),
          component_id: 'giang',
          name: 'Giằng chân',
          needed: 54,
          done: 20,
          qty: 20,
        }),
        ...[
          ['khung', 'Cụm khung', 'TB0299HG-AL', 'Bàn tròn GIGA'],
          ['tua', 'Cụm tựa', 'BN0230HG-AL', 'Ghế JAWOLL'],
          ['tay', 'Cụm tay', 'BN0230HG-AL', 'Ghế JAWOLL'],
        ].map(([c, name, code, sp], i) =>
          line({
            id: UUID(40 + i),
            doc_id: 'd20',
            stage: 'han',
            component_id: c,
            name,
            product_code: code,
            product_name: sp,
            needed: 20,
            done: 5,
            qty: 5,
          }),
        ),
      ],
    })

  it('Q5: phiếu xếp theo lộ trình công đoạn, không theo giờ ghi; đầu phiếu hai dòng', () => {
    render(<SoDaGhiScreen p={haiCongDoan()} />)
    const dau = screen.getAllByRole('button', { name: /^(Mở|Gập) PBS/ })
    expect(dau.map((b) => b.getAttribute('aria-label'))).toEqual([
      'Gập PBS-2026-0016',
      'Mở PBS-2026-0020',
    ])
    const han = dau[1].closest('tr')!
    expect(han.textContent).toContain('Hàn · Lệnh 01/26-27 - GIGA · Tổ Hàn')
    expect(han.textContent).toContain('2 mã hàng: BN0230HG-AL · TB0299HG-AL · 3 dòng')
    expect(han.textContent).toContain('PBS-2026-0020 · ca 1 · 6 CN × 6 giờ')
  })

  it('Q1: phiếu gập sẵn, trừ phiếu có dòng cần soát; "Mở hết" mở cả', () => {
    render(<SoDaGhiScreen p={haiCongDoan()} />)
    expect(screen.getByLabelText('Đạt · Chân')).toBeTruthy()
    expect(screen.queryByLabelText('Đạt · Cụm khung')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Mở hết' }))
    expect(screen.getByLabelText('Đạt · Cụm khung')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Gập hết' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Gập PBS-2026-0016' }))
    expect(screen.queryByLabelText('Đạt · Chân')).toBeNull()
  })

  it('Q2: chip công đoạn đếm đúng số dòng bảng bày; bấm Hàn chỉ còn phiếu Hàn', () => {
    render(<SoDaGhiScreen p={haiCongDoan()} />)
    const nhom = screen.getByRole('group', { name: 'Lọc theo công đoạn' })
    expect(
      within(nhom)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['Tất cả 5', 'Phôi 2', 'Hàn 3'])
    fireEvent.click(within(nhom).getByRole('button', { name: 'Hàn 3' }))
    expect(screen.queryByRole('button', { name: /PBS-2026-0016/ })).toBeNull()
    // Còn một phiếu thì mở sẵn — 3 dòng đúng số chip.
    expect(screen.getAllByLabelText(/^Đạt · /)).toHaveLength(3)
    expect(screen.getByText('3 dòng · chính thức 3')).toBeTruthy()
  })

  it('Q4: dòng gom dưới hàng mã hàng (mã + tên + số dòng), không còn cột Mã hàng', () => {
    render(<SoDaGhiScreen p={haiCongDoan()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Mở PBS-2026-0020' }))
    expect(screen.queryByRole('columnheader', { name: 'Mã hàng' })).toBeNull()
    const ma = screen.getAllByRole('row').filter((r) => r.className === 'mh')
    expect(ma.map((r) => (r as HTMLTableRowElement).cells[0].textContent)).toEqual([
      'TB0299HG-AL Bàn tròn GIGA · 2 dòng',
      'BN0230HG-AL Ghế JAWOLL · 2 dòng',
      'TB0299HG-AL Bàn tròn GIGA · 1 dòng',
    ])
  })

  // ── Bước 2 bản vẽ 14/11 (Q3 Tổng ngày · Q6 bảng 7 ngày) ──
  it('Q3: Tổng ngày lệnh → mã hàng × công đoạn; bấm ô lọc đúng công đoạn, mở đúng phiếu, tô hàng mã', () => {
    render(<SoDaGhiScreen p={haiCongDoan()} />)
    const tong = screen.getByRole('region', { name: 'Tổng ngày' })
    expect(
      within(tong)
        .getAllByRole('columnheader')
        .map((h) => h.textContent),
    ).toEqual(['Lệnh · mã hàng', 'Phôi', 'Hàn', 'Dòng'])
    expect(within(tong).getByText('01/26-27 - GIGA')).toBeTruthy()
    // TB0299: Phôi 1.080 + 20 (2 dòng), Hàn 5 (1 dòng); BN0230: Hàn 10 (2 dòng).
    expect(
      within(tong).getByRole('button', { name: 'Phôi · TB0299HG-AL: đạt 1.100, 2 dòng' }),
    ).toBeTruthy()
    const o = within(tong).getByRole('button', {
      name: 'Hàn · BN0230HG-AL: đạt 10, 2 dòng',
    })
    fireEvent.click(o)
    expect(o.getAttribute('aria-pressed')).toBe('true')
    expect(
      within(screen.getByRole('group', { name: 'Lọc theo công đoạn' }))
        .getByRole('button', { name: 'Hàn 3' })
        .getAttribute('aria-pressed'),
    ).toBe('true')
    expect(screen.getByRole('button', { name: 'Gập PBS-2026-0020' })).toBeTruthy()
    const chon = screen.getAllByRole('row').filter((r) => r.className === 'mh chon')
    expect(chon.map((r) => (r as HTMLTableRowElement).cells[0].textContent)).toEqual([
      'BN0230HG-AL Ghế JAWOLL · 2 dòng',
    ])
    // Bấm lại = bỏ chọn, bỏ lọc.
    fireEvent.click(o)
    expect(o.getAttribute('aria-pressed')).toBe('false')
    // Chip về Tất cả: phiếu Phôi (có dòng cần soát) hiện lại.
    expect(screen.getByRole('button', { name: 'Gập PBS-2026-0016' })).toBeTruthy()
  })

  it('Q3: một mã × một công đoạn thì không bày Tổng ngày (đầu phiếu đã nói hết)', () => {
    const p = payload({ lines: [line({ id: UUID(60), qty: 5, done: 5 })] })
    render(<SoDaGhiScreen p={p} />)
    expect(screen.queryByRole('region', { name: 'Tổng ngày' })).toBeNull()
  })

  it('rỗng: nói lý do và việc tiếp', () => {
    render(<SoDaGhiScreen p={payload({ docs: [], lines: [] })} />)
    expect(screen.getByText(/Tổ Phôi chưa ghi dòng nào ngày 13\/11\/2026/)).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Xem cả tháng' }).getAttribute('href')).toBe(
      '/thongke/so-cong-doan?thang=2026-11',
    )
  })

  it('không lỗi a11y', async () => {
    const { container } = render(<SoDaGhiScreen p={payload()} />)
    expect(await a11yViolations(container)).toEqual([])
  })
})
