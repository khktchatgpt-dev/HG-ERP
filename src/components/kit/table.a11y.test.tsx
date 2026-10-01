// @vitest-environment happy-dom
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  BarLabel,
  BarSep,
  Cell,
  Chip,
  FilterBar,
  GroupRow,
  Row,
  SearchInput,
  Table,
  TFoot,
  THead,
  useKitTable,
  type KitCol,
} from '@/components/kit'
import { a11yViolations, formatViolations } from '@/test/a11y'

/**
 * B7½ (24/09/2026) — các lỗi truy cập của họ `Table` + `FilterBar` mà lượt viết
 * sách tra B7 đọc ra từ mã (docs/he-thiet-ke-erp-ke-hoach.md §9.9). Mỗi ca ở
 * đây ĐỎ trên mã trước bản vá — đó là bánh cóc: sửa ngược là đỏ lại.
 */

afterEach(cleanup)
beforeEach(() => localStorage.clear())

// Bộ ảo hoá đo vùng cuộn bằng `offsetHeight` — happy-dom không dựng bố cục.
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

async function expectNoViolations(root: Element) {
  const v = await a11yViolations(root)
  expect(v, formatViolations(v)).toEqual([])
}

describe('Chip + SearchInput — nằm trong <form> không nộp form', () => {
  it('Chip và nút ✕ khai type="button"', () => {
    render(
      <form>
        <SearchInput value="thép" onChange={() => {}} />
        <Chip count={3}>Quá hẹn</Chip>
      </form>,
    )
    expect(screen.getByRole('button', { name: /Quá hẹn/ }).getAttribute('type')).toBe('button') // prettier-ignore
    expect(screen.getByRole('button', { name: 'Xoá ô tìm' }).getAttribute('type')).toBe('button') // prettier-ignore
  })
})

describe('SearchInput — ô có tên riêng, không chỉ placeholder', () => {
  it('`label` thành tên ô; ⌕ ẩn khỏi trình đọc; ✕ tên "Xoá ô tìm"', async () => {
    const { container } = render(
      <SearchInput
        label="Tìm nhà cung cấp"
        value="minh"
        onChange={() => {}}
        placeholder="Tên, mã, mã số thuế…"
      />,
    )
    const o = screen.getByRole('textbox', { name: 'Tìm nhà cung cấp' })
    expect(o.getAttribute('aria-label')).toBe('Tìm nhà cung cấp')
    const kyHieu = [...container.querySelectorAll('span')].find((s) => s.textContent === '⌕')! // prettier-ignore
    expect(kyHieu.getAttribute('aria-hidden')).toBe('true')
    expect(screen.getByRole('button', { name: 'Xoá ô tìm' })).toBeTruthy()
    await expectNoViolations(container)
  })

  it('không có `label` thì tên là placeholder; không cả hai thì "Tìm"', () => {
    const { rerender } = render(
      <SearchInput value="" onChange={() => {}} placeholder="Tìm mã đơn…" />,
    )
    expect(screen.getByRole('textbox').getAttribute('aria-label')).toBe('Tìm mã đơn…')
    rerender(<SearchInput value="" onChange={() => {}} placeholder="" />)
    expect(screen.getByRole('textbox').getAttribute('aria-label')).toBe('Tìm')
  })
})

/* ── Bảng ghép JSX ─────────────────────────────────────────────────────── */

const VT = [
  { ma: 'VT-00123', ten: 'Ống thép 25×25', ton: 480 },
  { ma: 'VT-00124', ten: 'Ống thép 30×30', ton: 0 },
]

function BangJsx({ onPick }: { onPick?: (ma: string) => void }) {
  return (
    <Table label="Vật tư theo nhóm">
      <THead>
        <th>Mã</th>
        <th>Tên</th>
        <th style={{ textAlign: 'right' }}>Tồn</th>
      </THead>
      <tbody>
        <GroupRow step={1} name="Khung" cols={3} meta="2 mã" />
        {VT.map((r) => (
          <Row key={r.ma} onClick={onPick ? () => onPick(r.ma) : undefined}>
            <Cell rowHeader>{r.ma}</Cell>
            <Cell grow>{r.ten}</Cell>
            <Cell num>{r.ton}</Cell>
          </Row>
        ))}
      </tbody>
      <TFoot label={<td colSpan={2}>Cộng</td>} cells={<td className="num">480</td>} />
    </Table>
  )
}

describe('Table ghép JSX — tên bảng, tiêu đề dòng, dòng khối', () => {
  it('bảng có tên từ `label`', () => {
    render(<BangJsx />)
    expect(screen.getByRole('table', { name: 'Vật tư theo nhóm' })).toBeTruthy()
  })

  it('`Cell rowHeader` là <th scope="row"> — trình đọc nói tên dòng; nét chữ như ô thường', () => {
    render(<BangJsx />)
    const th = screen.getByRole('rowheader', { name: 'VT-00123' })
    expect(th.tagName).toBe('TH')
    expect(th.getAttribute('scope')).toBe('row')
    // Tiêu đề dòng KHÔNG được đổi hình: th mặc định đậm + căn giữa.
    expect(th.className).toContain('font-normal')
    expect(th.className).toContain('text-left')
  })

  it('dòng khối là tiêu đề nhóm dòng (<th scope="rowgroup">), trải đủ số cột', async () => {
    const { container } = render(<BangJsx />)
    const nhom = container.querySelector('tbody th[scope="rowgroup"]') as HTMLTableCellElement // prettier-ignore
    expect(nhom).toBeTruthy()
    expect(nhom.colSpan).toBe(3)
    expect(nhom.textContent).toContain('Khung')
    await expectNoViolations(container)
  })

  it('chuông lệch cột không báo oan khi thân bảng có <th>', () => {
    const loi = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<BangJsx />)
    expect(loi.mock.calls.filter((c) => String(c[0]).includes('LỆCH CỘT'))).toEqual([])
    loi.mockRestore()
  })
})

describe('Row onClick — bấm được bằng phím, không chỉ chuột', () => {
  it('dòng bấm được: Tab tới, Enter và Space đều bấm; có vòng focus', async () => {
    const onPick = vi.fn()
    render(<BangJsx onPick={onPick} />)
    const dong = screen.getByRole('rowheader', { name: 'VT-00123' }).closest('tr')!
    expect(dong.tabIndex).toBe(0)
    expect(dong.className).toContain('focus-visible:')
    await userEvent.tab()
    expect(document.activeElement).toBe(dong)
    await userEvent.keyboard('{Enter}')
    expect(onPick).toHaveBeenLastCalledWith('VT-00123')
    await userEvent.tab()
    await userEvent.keyboard(' ')
    expect(onPick).toHaveBeenLastCalledWith('VT-00124')
    expect(onPick).toHaveBeenCalledTimes(2)
  })

  it('dòng KHÔNG bấm được thì không nhận Tab', () => {
    render(<BangJsx />)
    const dong = screen.getByRole('rowheader', { name: 'VT-00123' }).closest('tr')!
    expect(dong.hasAttribute('tabindex')).toBe(false)
  })

  it('Enter trên link TRONG dòng không bấm thêm dòng (không nổi bọt hai lần)', async () => {
    const onRow = vi.fn()
    render(
      <Table label="t">
        <THead>
          <th>Mã</th>
        </THead>
        <tbody>
          <Row onClick={onRow}>
            <Cell>
              <a href="#x" onClick={(e) => e.preventDefault()}>
                VT-1
              </a>
            </Cell>
          </Row>
        </tbody>
      </Table>,
    )
    screen.getByRole('link').focus()
    await userEvent.keyboard('{Enter}')
    /*
      Enter trên link sinh một cú `click` nổi bọt lên dòng — y như bấm chuột vào
      link, và đó là hành vi cũ có chủ ý. Cái phải canh là trình bắt phím của
      dòng KHÔNG bắn thêm lần thứ hai (nó chỉ nhận phím khi chính dòng có focus).
    */
    expect(onRow).toHaveBeenCalledTimes(1)
  })
})

/* ── Kiểu máy ─────────────────────────────────────────────────────────── */

type Ncc = { id: string; ten: string; don: number }
const COLS: KitCol<Ncc>[] = [
  { id: 'ten', header: 'Nhà cung cấp', pin: true, rowHeader: true, cell: (r) => r.ten },
  { id: 'don', header: 'Đã đặt', num: true, foot: 3, cell: (r) => r.don },
]

function BangMay({ rows, onRow }: { rows: Ncc[]; onRow?: (r: Ncc) => void }) {
  const t = useKitTable({
    rows,
    columns: COLS,
    rowKey: (r) => r.id,
    foot: { label: 'Cộng' },
  })
  return <Table engine={t} label="Nhà cung cấp" onRowClick={onRow} />
}

const IT = [
  { id: 'a', ten: 'Đại Thắng', don: 1 },
  { id: 'b', ten: 'An Phát', don: 2 },
]

describe('Table kiểu máy', () => {
  it('bảng có tên; cột `rowHeader` vẽ tiêu đề dòng; chân bảng vẫn khớp cột; qua axe', async () => {
    const { container } = render(<BangMay rows={IT} />)
    expect(screen.getByRole('table', { name: 'Nhà cung cấp' })).toBeTruthy()
    const th = screen.getByRole('rowheader', { name: 'Đại Thắng' })
    expect(th.getAttribute('scope')).toBe('row')
    const t = container.querySelector('table')!
    const dem = (q: string) =>
      [...t.querySelectorAll(q)].reduce((a, c) => a + ((c as HTMLTableCellElement).colSpan || 1), 0) // prettier-ignore
    expect(dem('thead th')).toBe(2)
    expect(dem('tfoot td')).toBe(2)
    await expectNoViolations(container)
  })

  it('onRowClick: dòng nhận Tab, Enter bấm đúng dòng', async () => {
    const onRow = vi.fn()
    render(<BangMay rows={IT} onRow={onRow} />)
    await userEvent.tab()
    expect(document.activeElement?.tagName).toBe('TR')
    await userEvent.keyboard('{Enter}')
    expect(onRow).toHaveBeenCalledWith(IT[0])
  })

  it('ảo hoá (> 200 dòng): dòng thật vẫn nhận Tab và phím, giữ aria-rowindex', async () => {
    const nhieu = Array.from({ length: 500 }, (_, i) => ({ id: `r${i}`, ten: `NCC ${i}`, don: i })) // prettier-ignore
    const onRow = vi.fn()
    render(<BangMay rows={nhieu} onRow={onRow} />)
    const dong = [...document.querySelectorAll('tbody tr:not([aria-hidden])')] as HTMLTableRowElement[] // prettier-ignore
    expect(dong.length).toBeLessThan(80)
    expect(dong.every((d) => d.tabIndex === 0)).toBe(true)
    dong[1].focus()
    await userEvent.keyboard(' ')
    expect(onRow).toHaveBeenCalledWith(nhieu[1])
    expect(dong[1].getAttribute('aria-rowindex')).toBe('3')
    expect(within(dong[1]).getByRole('rowheader').textContent).toBe('NCC 1')
  })
})

describe('FilterBar dense / tone + BarLabel + BarSep + Table minWidth (28/09/2026)', () => {
  it('có label → role toolbar có tên; vạch ngăn ẩn khỏi trình đọc; qua axe', async () => {
    const { container } = render(
      <FilterBar dense tone="selected" label="Lọc đơn mua">
        <BarLabel>Loại đơn</BarLabel>
        <Chip count={3}>Carton</Chip>
        <BarSep />
        <Chip count={4}>Chưa hẹn giao</Chip>
      </FilterBar>,
    )
    const bar = screen.getByRole('toolbar', { name: 'Lọc đơn mua' })
    expect(bar.className).toContain('py-[var(--bar-py-tight)]')
    expect(bar.className).toContain('bg-[var(--act-wash)]')
    expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull()
    await expectNoViolations(container)
  })

  it('không label → không gán role (giữ hành vi cũ); mặc định đệm 8px nền thẻ', () => {
    const { container } = render(
      <FilterBar>
        <Chip count={1}>A</Chip>
      </FilterBar>,
    )
    expect(screen.queryByRole('toolbar')).toBeNull()
    const bar = container.firstElementChild as HTMLElement
    expect(bar.className).toContain('py-[var(--bar-py)]')
    expect(bar.className).toContain('bg-[var(--surface-card)]')
  })

  it('Table minWidth ghi đè --table-min cho ĐÚNG bảng đó', () => {
    const { container } = render(
      <Table minWidth={0}>
        <tbody>
          <Row>
            <Cell>a</Cell>
          </Row>
        </tbody>
      </Table>,
    )
    const wrap = container.querySelector('.k-tscroll') as HTMLElement
    expect(wrap.style.getPropertyValue('--table-min')).toBe('0px')
  })
})
