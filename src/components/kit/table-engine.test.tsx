// @vitest-environment happy-dom
import { useMemo } from 'react'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { act, cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  footRuns,
  Grid,
  Table,
  TableSettings,
  useKitTable,
  type KitCol,
} from '@/components/kit'
import { a11yViolations, formatViolations } from '@/test/a11y'

/**
 * MÁY BẢNG (B5, 24/09/2026) — một máy `useKitTable`, hai vỏ `Table` / `Grid`.
 * Canh bốn thứ: sắp xếp đúng tiếng Việt, ẩn cột mà chân bảng KHÔNG lệch cột
 * (lỗi từng dính 7 màn), lựa chọn của người xem được nhớ, và bảng 1.000 dòng
 * chỉ vẽ vài chục dòng thật.
 */

afterEach(cleanup)
beforeEach(() => localStorage.clear())

/*
  happy-dom không dựng bố cục: mọi khung cao 0px, nên bộ ảo hoá (đo vùng cuộn
  bằng `offsetHeight`) tính ra 0 dòng. Cho vùng cuộn của bảng cao 600px như
  trên màn thật; mọi thẻ khác giữ nguyên.
*/
const goc = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight')!
beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
    configurable: true,
    get(this: HTMLElement) {
      return this.classList.contains('k-tscroll') ? 600 : goc.get!.call(this)
    },
  })
})
afterAll(() => Object.defineProperty(HTMLElement.prototype, 'offsetHeight', goc))

type Ncc = { id: string; ten: string; don: number; chi: number | null }
const DATA: Ncc[] = [
  { id: 'a', ten: 'Đại Thắng', don: 3, chi: 120 },
  { id: 'b', ten: 'An Phát', don: 12, chi: null },
  { id: 'c', ten: 'Bình Minh', don: 7, chi: 40 },
]
const COLS: KitCol<Ncc>[] = [
  { id: 'ten', header: 'Nhà cung cấp', cell: (r) => r.ten, sort: (r) => r.ten, pin: true, grow: true },
  { id: 'don', header: 'Đã đặt', cell: (r) => r.don, sort: (r) => r.don, num: true, foot: 22 },
  { id: 'loai', header: 'Mặt hàng', cell: () => 'sắt' },
  { id: 'chi', header: 'Tổng chi', cell: (r) => r.chi ?? '', sort: (r) => r.chi, num: true },
] // prettier-ignore

function Bang({ vo = 'table', rows = DATA }: { vo?: 'table' | 'grid'; rows?: Ncc[] }) {
  const t = useKitTable({
    rows,
    columns: COLS,
    rowKey: (r) => r.id,
    prefsKey: 'test-ncc',
    foot: { label: 'Cộng', note: 'Chưa gồm đơn huỷ' },
  })
  return (
    <>
      <TableSettings engine={t} />
      {vo === 'table' ? <Table engine={t} /> : <Grid engine={t} />}
    </>
  )
}

const thuTu = () =>
  screen
    .getAllByRole('row')
    .slice(1, -1)
    .map((r) => within(r).getAllByRole('cell')[0].textContent)

/** Tổng cột của thead và tfoot — đúng phép đo của `useColSpanGuard`. */
function soCot() {
  const t = document.querySelector('table')!
  const dem = (q: string) =>
    [...t.querySelectorAll(q)].reduce(
      (a, c) => a + ((c as HTMLTableCellElement).colSpan || 1),
      0,
    )
  return { head: dem('thead th'), foot: dem('tfoot td') }
}

describe('footRuns — chân bảng tự chia dải', () => {
  it('nhãn ở dải đầu, lưu ý ở dải cuối, tổng cột luôn khớp', () => {
    const r = footRuns(COLS, { label: 'Cộng', note: 'lưu ý' })
    expect(r.map((x) => [x.span, x.own])).toEqual([
      [1, false], // "ten" — nhãn
      [1, true], // "don" — ô tổng
      [2, false], // "loai" + "chi" — dải lưu ý
    ])
    expect(r[0].node).toBe('Cộng')
    expect(r[2].node).toBe('lưu ý')
    expect(r.reduce((s, x) => s + x.span, 0)).toBe(COLS.length)
  })

  it('không còn dải trống cuối thì lưu ý nối vào nhãn — KHÔNG rơi mất', () => {
    const r = footRuns(COLS.slice(0, 2), { label: 'Cộng', note: 'lưu ý' })
    expect(r).toHaveLength(2)
    render(<table><tfoot><tr><td>{r[0].node}</td></tr></tfoot></table>) // prettier-ignore
    expect(screen.getByRole('cell').textContent).toBe('Cộng · lưu ý')
  })
})

describe('useKitTable + Table', () => {
  it('bấm tiêu đề: tăng → giảm → bỏ; aria-sort đi theo; so chữ tiếng Việt', async () => {
    render(<Bang />)
    const th = screen.getByRole('columnheader', { name: /Nhà cung cấp/ })
    expect(th.getAttribute('aria-sort')).toBe('none')
    await userEvent.click(within(th).getByRole('button'))
    expect(th.getAttribute('aria-sort')).toBe('ascending')
    // "Đ" đứng SAU "B" theo tiếng Việt (so mã ký tự thô thì Đ nhảy lên cuối bảng
    // sau cả chữ thường, và "An" với "Ân" không đứng cạnh nhau).
    expect(thuTu()).toEqual(['An Phát', 'Bình Minh', 'Đại Thắng'])
    await userEvent.click(within(th).getByRole('button'))
    expect(th.getAttribute('aria-sort')).toBe('descending')
    expect(thuTu()).toEqual(['Đại Thắng', 'Bình Minh', 'An Phát'])
    await userEvent.click(within(th).getByRole('button'))
    expect(th.getAttribute('aria-sort')).toBe('none')
    expect(thuTu()).toEqual(['Đại Thắng', 'An Phát', 'Bình Minh'])
  })

  it('cột số sắp theo SỐ (7 < 12), ô trống luôn nằm CUỐI dù tăng hay giảm', async () => {
    render(<Bang />)
    const chi = within(screen.getByRole('columnheader', { name: /Tổng chi/ })).getByRole('button') // prettier-ignore
    await userEvent.click(chi)
    expect(thuTu()).toEqual(['Bình Minh', 'Đại Thắng', 'An Phát'])
    await userEvent.click(chi)
    expect(thuTu()).toEqual(['Đại Thắng', 'Bình Minh', 'An Phát'])
  })

  it('cột không có `sort` thì tiêu đề là chữ thường — không phải nút giả', () => {
    render(<Bang />)
    const th = screen.getByRole('columnheader', { name: 'Mặt hàng' })
    expect(within(th).queryByRole('button')).toBeNull()
    expect(th.hasAttribute('aria-sort')).toBe(false)
  })

  it('ẩn cột qua menu: cột biến mất, chân bảng TỰ khớp cột, lựa chọn được nhớ', async () => {
    render(<Bang />)
    expect(soCot()).toEqual({ head: 4, foot: 4 })
    await userEvent.click(screen.getByRole('button', { name: /Cột và mật độ/ }))
    const menu = await screen.findByRole('menu')
    // Cột định danh (ghim) khoá — mất nó thì mọi dòng thành vô danh.
    expect(
      within(menu).getByRole('menuitemcheckbox', { name: /Nhà cung cấp/ }).getAttribute('aria-disabled'),
    ).toBe('true') // prettier-ignore
    await userEvent.click(within(menu).getByRole('menuitemcheckbox', { name: 'Đã đặt' }))
    // Menu VẪN MỞ sau khi tick — chọn năm cột không phải mở menu năm lần.
    expect(screen.getByRole('menu')).toBeTruthy()
    expect(screen.queryByRole('columnheader', { name: /Đã đặt/ })).toBeNull()
    expect(soCot()).toEqual({ head: 3, foot: 3 })
    expect(JSON.parse(localStorage.getItem('kit-table:test-ncc')!).hidden).toEqual([
      'don',
    ])

    // Mở lại màn: cột vẫn ẩn.
    cleanup()
    render(<Bang />)
    expect(screen.queryByRole('columnheader', { name: /Đã đặt/ })).toBeNull()
  })

  it('mật độ "Dày" gắn đúng cặp lớp token lên vùng cuộn; menu qua axe', async () => {
    const { container } = render(<Bang />)
    await userEvent.click(screen.getByRole('button', { name: /Cột và mật độ/ }))
    const menu = await screen.findByRole('menu')
    await expectNoViolations(menu)
    await userEvent.click(within(menu).getByRole('menuitemradio', { name: /Dày/ }))
    const cuon = container.querySelector('.k-tscroll')!
    expect(cuon.classList.contains('kit')).toBe(true)
    expect(cuon.classList.contains('kit-dense')).toBe(true)
  })

  it('1.000 dòng: chỉ vẽ vài chục dòng thật, báo tổng cho trình đọc màn hình', () => {
    const nhieu = Array.from({ length: 1000 }, (_, i) => ({
      id: `r${i}`,
      ten: `NCC ${i}`,
      don: i,
      chi: i * 10,
    }))
    render(<Bang rows={nhieu} />)
    const dongThat = document.querySelectorAll('tbody tr:not([aria-hidden])').length
    expect(dongThat).toBeGreaterThan(0)
    expect(dongThat).toBeLessThan(80)
    expect(document.querySelector('table')!.getAttribute('aria-rowcount')).toBe('1001')
    expect(soCot()).toEqual({ head: 4, foot: 4 })
  })

  /*
    Lỗi thật bắt được 24/09/2026: React gắn `ref` của thẻ cha SAU layout effect
    của con, nên bộ ảo hoá khởi động khi vùng cuộn còn null và không bao giờ
    nghe sự kiện cuộn — cuộn tới giữa bảng thì thân bảng TRẮNG.
  */
  it('cuộn tới giữa thì dòng ở giữa hiện ra — thân bảng không trắng', async () => {
    const nhieu = Array.from({ length: 1000 }, (_, i) => ({
      id: `r${i}`,
      ten: `NCC ${String(i).padStart(4, '0')}`,
      don: i,
      chi: null,
    }))
    const { container } = render(<Bang rows={nhieu} />)
    const cuon = container.querySelector('.k-tscroll') as HTMLDivElement
    await act(async () => {
      cuon.scrollTop = 15000
      cuon.dispatchEvent(new Event('scroll'))
      await new Promise((r) => setTimeout(r, 30))
    })
    const dau = container.querySelector('tbody tr:not([aria-hidden]) td')!.textContent!
    // ~15000px / 31px mỗi dòng ≈ dòng 480; trừ phần vẽ dư phía trên.
    expect(Number(dau.slice(4))).toBeGreaterThan(400)
  })
})

describe('Cùng máy trong vỏ Grid', () => {
  it('sắp xếp, ẩn cột, chân bảng tự khớp — y như Table', async () => {
    render(<Bang vo="grid" />)
    expect(document.querySelector('table.k-grid')).toBeTruthy()
    await userEvent.click(
      within(screen.getByRole('columnheader', { name: /Nhà cung cấp/ })).getByRole(
        'button',
      ),
    )
    expect(thuTu()).toEqual(['An Phát', 'Bình Minh', 'Đại Thắng'])
    await userEvent.click(screen.getByRole('button', { name: /Cột và mật độ/ }))
    await userEvent.click(
      await screen.findByRole('menuitemcheckbox', { name: 'Tổng chi' }),
    )
    expect(soCot()).toEqual({ head: 3, foot: 3 })
  })
})

describe('useMemo cột — bảng không tính lại khi cha vẽ lại', () => {
  it('khai cột trong useMemo vẫn chạy (mẫu dùng khuyến nghị)', () => {
    function MemoBang() {
      const cols = useMemo(() => COLS, [])
      const t = useKitTable({ rows: DATA, columns: cols, rowKey: (r) => r.id })
      return <Table engine={t} />
    }
    render(<MemoBang />)
    expect(screen.getAllByRole('row')).toHaveLength(1 + DATA.length)
  })
})

async function expectNoViolations(root: Element) {
  const v = await a11yViolations(root)
  expect(v, formatViolations(v)).toEqual([])
}
