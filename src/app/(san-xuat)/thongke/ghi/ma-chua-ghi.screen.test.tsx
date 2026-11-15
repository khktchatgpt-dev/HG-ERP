// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { gomMaCuaLenh, lenhOptions, type DongDinhMuc } from '@/lib/ma-chua-ghi'
import { a11yViolations } from '@/test/a11y'
import { ChonLenh, DaiLenhKhongChay, DaiMaChuaGhi } from './ma-chua-ghi'
import { ChuaGhiScreen } from './ChuaGhiScreen'

/**
 * Ghi sản lượng khi sản phẩm chưa có định mức (bản vẽ 15/11/2026 MRFoxWgh…,
 * Q1–Q5). Hình dữ liệu chép ba lệnh thật hôm đó: 01 ROSCO (1/20 mã có bảng),
 * 01 LAURA (0 định mức), 02 ROSCO (5 mã có định mức chưa nạp).
 */
const push = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/thongke/ghi',
}))
afterEach(() => {
  cleanup()
  push.mockReset()
})

const d = (p: Partial<DongDinhMuc>): DongDinhMuc => ({
  lsx_id: 'rosco1',
  ma: 'CH0219HG-AL',
  ten: 'Ghế bành lưng cao New Chelsea',
  sl: 536,
  co_bang: false,
  n_dm: 0,
  ...p,
})
const tinhTrang = gomMaCuaLenh(
  [
    { id: 'giga', code: '01/26-27 - GIGA' },
    { id: 'rosco1', code: '01/26-27 - ROSCO' },
    { id: 'laura', code: '01/26-27 - LAURA' },
    { id: 'rosco2', code: '02/26-27 - ROSCO' },
  ],
  [
    d({ lsx_id: 'giga', ma: 'TB0298HG-AL', co_bang: true }),
    d({
      ma: 'TB0096HG-AL',
      ten: 'Mặt bàn Bistro New Chelsea 70cm',
      sl: 72,
      co_bang: true,
      n_dm: 3,
    }),
    d({}),
    d({ ma: 'CH0220HG-AL', sl: 794 }),
    d({
      lsx_id: 'laura',
      ma: 'CH0212HG-IR',
      ten: 'Ghế Hali khung sắt, dây dù',
      sl: 2220,
    }),
    d({ lsx_id: 'rosco2', ma: '2722875', ten: 'IBIZA Ghế xoay', sl: 8816, n_dm: 19 }),
  ],
)
const tt = (id: string) => tinhTrang.find((t) => t.lsx_id === id)!
const options = lenhOptions(tinhTrang, [
  { lsx_id: 'giga', lsx_code: '01/26-27 - GIGA', open_count: 280 },
  { lsx_id: 'rosco1', lsx_code: '01/26-27 - ROSCO', open_count: 8 },
])

describe('Ghi sản lượng — mã hàng chưa ghi được', () => {
  it('Q1: ô chọn lệnh hai nhóm, lệnh chưa có bảng chi tiết vẫn chọn được', () => {
    const onChange = vi.fn()
    render(<ChonLenh options={options} value="giga" onChange={onChange} />)
    const nhom = screen.getAllByRole('group')
    expect(nhom.map((g) => g.getAttribute('label'))).toEqual([
      'Ghi được',
      'Chưa ghi được — chưa có bảng chi tiết',
    ])
    expect(
      within(nhom[0])
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual([
      '01/26-27 - GIGA · còn 280 việc',
      '01/26-27 - ROSCO · còn 8 việc · 2/3 mã chưa ghi được',
    ])
    expect(
      within(nhom[1])
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual([
      '01/26-27 - LAURA · 1 mã chưa có định mức',
      '02/26-27 - ROSCO · 1 mã chưa nạp',
    ])
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'laura' } })
    expect(onChange).toHaveBeenCalledWith('laura')
  })

  it('Q3: lệnh ghi được một phần — dải nói số mã, số cái; bấm bung bảng mã', () => {
    render(<DaiMaChuaGhi lenh={tt('rosco1')} />)
    expect(screen.getByRole('status').textContent).toContain('2/3 mã hàng chưa ghi được')
    expect(screen.getByRole('status').textContent).toContain('1.330 cái')
    expect(screen.queryByRole('table')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Xem 2 mã ▾' }))
    const hang = within(screen.getByRole('table')).getAllByRole('row').slice(1)
    expect(hang.map((r) => (r as HTMLTableRowElement).cells[0].textContent)).toEqual([
      'CH0219HG-AL',
      'CH0220HG-AL',
    ])
    expect(
      screen.getByRole('link', { name: 'Nhắc Kỹ thuật ›' }).getAttribute('href'),
    ).toBe('/phan-cong-viec?muc=giao')
  })

  it('Q2: lệnh chưa có định mức nào — câu lý do, bảng mã, Ghi sổ khoá', () => {
    render(<ChuaGhiScreen lenh={tt('laura')} options={options} />)
    expect(
      screen.getByRole('heading', {
        name: 'Lệnh 01/26-27 - LAURA chưa ghi được: 1/1 mã hàng chưa có định mức',
      }),
    ).toBeTruthy()
    expect(screen.getByText(/2\.220 cái đang chờ/)).toBeTruthy()
    expect(screen.getByText('Ghi sổ chính thức').getAttribute('aria-disabled')).toBe(
      'true',
    )
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'giga' } })
    expect(push).toHaveBeenCalledWith('/thongke/ghi?lsx=giga')
  })

  it('Q4: có định mức nhưng chưa nạp — lối chính là Nạp ở Bảng chi tiết', () => {
    render(<ChuaGhiScreen lenh={tt('rosco2')} options={options} />)
    expect(screen.getByText('Có định mức (19 dòng), chưa nạp vào lệnh')).toBeTruthy()
    const nap = screen.getByRole('link', { name: 'Nạp ở Bảng chi tiết' })
    expect(nap.getAttribute('href')).toBe('/thongke/lsx/rosco2/dinh-hinh')
    expect(nap.className).toContain('p')
    // Mã chờ Kỹ thuật vẫn có lối, nhưng là nút phụ (1 mã so với 0 mã chưa nạp ở đây).
  })

  it('Tự khai (bản vẽ SNZSog1E Q1): thống kê sửa được bảng → lối chính là Tự khai', () => {
    render(<ChuaGhiScreen lenh={tt('laura')} options={options} canKhai />)
    const khai = screen.getByRole('link', { name: 'Tự khai bảng chi tiết' })
    expect(khai.getAttribute('href')).toBe('/thongke/lsx/laura/dinh-hinh')
    expect(khai.className).toBe('sx-btn p')
    expect(screen.getByRole('link', { name: 'Nhắc Kỹ thuật' }).className).toBe('sx-btn')
    expect(screen.getByText(/Khai phần khung ở Bảng chi tiết/)).toBeTruthy()
    // Từng mã trong bảng mở thẳng nhóm của mã đó.
    expect(screen.getByRole('link', { name: 'Tự khai ›' }).getAttribute('href')).toBe(
      '/thongke/lsx/laura/dinh-hinh?sp=CH0212HG-IR',
    )
  })

  it('Tự khai: người không sửa được bảng thì không thấy lối đó, Nhắc Kỹ thuật là chính', () => {
    render(<ChuaGhiScreen lenh={tt('laura')} options={options} />)
    expect(screen.queryByRole('link', { name: /Tự khai/ })).toBeNull()
    expect(screen.getByRole('link', { name: 'Nhắc Kỹ thuật' }).className).toBe('sx-btn p')
  })

  it('Tự khai: dải lệnh ghi được một phần có link Tự khai khi sửa được bảng', () => {
    render(<DaiMaChuaGhi lenh={tt('rosco1')} canKhai />)
    expect(
      screen
        .getByRole('link', { name: 'Tự khai ở Bảng chi tiết ›' })
        .getAttribute('href'),
    ).toBe('/thongke/lsx/rosco1/dinh-hinh')
  })

  it('Q5: đường dẫn trỏ lệnh đã hoàn thành — nói thẳng, đóng được', () => {
    render(<DaiLenhKhongChay code="05/26-27 - MX" status="completed" />)
    expect(screen.getByRole('alert').textContent).toContain(
      'Lệnh trong đường dẫn (05/26-27 - MX) đã hoàn thành',
    )
    fireEvent.click(screen.getByRole('button', { name: 'Đóng' }))
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('không lỗi a11y', async () => {
    const { container } = render(<ChuaGhiScreen lenh={tt('rosco2')} options={options} />)
    expect(await a11yViolations(container)).toEqual([])
  })
})
