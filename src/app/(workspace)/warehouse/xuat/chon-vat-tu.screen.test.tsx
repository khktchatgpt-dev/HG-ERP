// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { DEFAULT_DOC_TEMPLATES } from '@/lib/doc-templates'
import type { VatTuTon } from '@/lib/kho-chon-vat-tu'
import { XuatScreen } from './XuatScreen'

/**
 * CHỌN VẬT TƯ Ở MÀN XUẤT HÀNG (27/10/2026 — "chọn loại vật tư quá chậm"). Dữ
 * liệu theo DB thật cùng ngày: gõ "thep hop" ra 225 mã trong danh mục mà chỉ 3
 * mã còn tồn. Màn nạp sẵn mã còn tồn → gõ, chọn, chọn nhiều đều không gọi API;
 * chỉ khi không mã còn tồn nào khớp mới hỏi `stock/tim`, và hỏi một lần mỗi chữ.
 */

const api = vi.fn()
vi.mock('@/lib/api', async (orig) => ({
  ...(await orig<typeof import('@/lib/api')>()),
  api: (...a: unknown[]) => api(...a),
}))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))
afterEach(() => {
  cleanup()
  api.mockReset()
})

const vt = (id: string, code: string, name: string, qty_ok: number, ke: string | null = null): VatTuTon => ({ id, code, name, unit: 'Kg', qty_ok, ke, nhom: 'Sắt' }) // prettier-ignore
const TON: VatTuTon[] = [
  vt('m1', 'SAT0352', 'Thép hộp 20x40 dày 8 dem', 120, 'A1'),
  vt('m2', 'SAT0356', 'Thép hộp kẽm 10x30x0.8', 45.5),
  vt('m3', 'VIT0012', 'Vít đầu dù 4x15', 3000, 'B2'),
]

function dung() {
  render(
    <XuatScreen
      lsx={[]}
      to={['Tổ Hàn']}
      phong={['Kho']}
      tonSan={TON}
      today="2026-10-27"
      nguoiLap="Lê Khắc Hào"
      canEdit
      company={{}}
      tpl={DEFAULT_DOC_TEMPLATES.PXK}
    />,
  )
  return screen.getByRole('combobox', { name: 'Tìm vật tư để thêm dòng' })
}

const go = (o: HTMLElement, v: string) => {
  fireEvent.focus(o)
  fireEvent.change(o, { target: { value: v } })
}

describe('Xuất hàng · chọn vật tư', () => {
  it('gõ là ra ngay mã còn tồn kèm số tồn + kệ, không gọi API', () => {
    const o = dung()
    go(o, 'thep hop')
    const ds = screen.getByRole('listbox')
    const opts = within(ds).getAllByRole('option')
    expect(opts.map((x) => x.textContent)).toEqual([
      expect.stringMatching(/SAT0352.*kệ A1.*tồn 120 Kg/),
      expect.stringMatching(/SAT0356.*tồn 45,5 Kg/),
    ])
    expect(within(ds).getByText(/Chỉ bày mã còn tồn \(3 mã\)/)).toBeTruthy()
    expect(api).not.toHaveBeenCalled()
  })

  it('Enter thêm dòng với tồn có sẵn (không tra tồn), con trỏ sang ô số; Enter ở ô số về ô tìm', async () => {
    const o = dung()
    go(o, 'vit 4x15')
    fireEvent.keyDown(o, { key: 'Enter' })
    await waitFor(() => expect(document.activeElement?.id).toBe('xuat-qty-0'))
    const grid = screen.getByRole('table', { name: 'Dòng hàng xuất' })
    expect(within(grid).getByText('VIT0012')).toBeTruthy()
    expect(within(grid).getByText('3.000')).toBeTruthy()
    const so = document.getElementById('xuat-qty-0') as HTMLInputElement
    fireEvent.change(so, { target: { value: '200' } })
    fireEvent.keyDown(so, { key: 'Enter' })
    expect(document.activeElement?.id).toBe('xuat-tim')
    expect(api).not.toHaveBeenCalled()
  })

  it('không mã còn tồn nào khớp → hỏi server MỘT lần, gõ lại cùng chữ dùng đệm', async () => {
    api.mockResolvedValue({
      rows: [vt('m9', 'SON0101', 'Sơn lót xám', 0)],
    })
    const o = dung()
    go(o, 'son lot')
    expect(await screen.findByText(/kho hết · Kg/)).toBeTruthy()
    expect(api).toHaveBeenCalledTimes(1)
    expect(api).toHaveBeenCalledWith('/api/dept/warehouse/stock/tim?q=son%20lot')
    expect(screen.getByText(/đây là mã trong cả danh mục/)).toBeTruthy()

    go(o, 'thep')
    go(o, 'Sơn  lót')
    expect(await screen.findByText(/kho hết · Kg/)).toBeTruthy()
    await new Promise((r) => setTimeout(r, 300))
    expect(api).toHaveBeenCalledTimes(1)
  })

  it('Shift+Enter tích qua nhiều lần gõ; Enter thêm cả loạt theo thứ tự tích, đi dọc cột số', async () => {
    const o = dung()
    go(o, 'thep hop')
    fireEvent.keyDown(o, { key: 'Enter', shiftKey: true })
    // Danh sách vẫn mở, chưa thêm dòng nào.
    expect(screen.getByRole('listbox')).toBeTruthy()
    expect(screen.getByText(/Đang tích 1 mã · Enter thêm 1 dòng/)).toBeTruthy()
    go(o, 'vit')
    fireEvent.keyDown(o, { key: 'Enter', shiftKey: true })
    expect(screen.getByText('SAT0352, VIT0012')).toBeTruthy()
    expect(document.querySelectorAll('tr.d')).toHaveLength(0)

    fireEvent.keyDown(o, { key: 'Enter' })
    // Con trỏ phải sang ô số NGAY sau lượt vẽ, không chờ hẹn giờ — gõ số liền tay
    // từng rơi vào ô tìm (bắt được khi thử bằng bàn phím 27/10).
    expect(document.activeElement?.id).toBe('xuat-qty-0')
    const ma = [...document.querySelectorAll('tr.d td.kh-ma')].map((x) => x.textContent)
    expect(ma).toEqual(['SAT0352', 'VIT0012'])
    expect(screen.getByText(/Đã thêm 2 dòng — gõ số Lần này/)).toBeTruthy()
    // Gõ số rồi Enter xuống dòng dưới, dòng cuối về ô tìm.
    const so0 = document.getElementById('xuat-qty-0') as HTMLInputElement
    fireEvent.change(so0, { target: { value: '12' } })
    fireEvent.keyDown(so0, { key: 'Enter' })
    expect(document.activeElement?.id).toBe('xuat-qty-1')
    fireEvent.keyDown(document.activeElement!, { key: 'Enter' })
    expect(document.activeElement?.id).toBe('xuat-tim')
    expect(api).not.toHaveBeenCalled()
  })

  it('đang tích: bấm dòng là tích/bỏ (không thêm ngay); mã đã có trong phiếu không tích được', async () => {
    const o = dung()
    go(o, 'VIT0012')
    fireEvent.keyDown(o, { key: 'Enter' })
    await waitFor(() => expect(document.activeElement?.id).toBe('xuat-qty-0'))

    go(o, 'vit')
    fireEvent.keyDown(o, { key: 'Enter', shiftKey: true })
    expect(screen.getByText(/VIT0012 đã có ở dòng 1/)).toBeTruthy()

    go(o, 'thep hop')
    fireEvent.keyDown(o, { key: 'Enter', shiftKey: true })
    const opts = within(screen.getByRole('listbox')).getAllByRole('option')
    fireEvent.mouseDown(opts[1])
    const dangTich = () => document.querySelector('.kh-dang-tich .ds')?.textContent
    expect(dangTich()).toBe('SAT0352, SAT0356')
    fireEvent.mouseDown(opts[0].querySelector('.kh-tich')!)
    expect(dangTich()).toBe('SAT0356')
    expect(document.querySelectorAll('tr.d')).toHaveLength(1)
  })

  it('chọn nhiều: gõ số là tự chọn, đưa cả loạt vào phiếu với đúng số, không gọi API', async () => {
    dung()
    fireEvent.click(screen.getByRole('button', { name: /Chọn nhiều từ tồn kho \(3\)/ }))
    const hop = screen.getByRole('dialog', { name: 'Chọn nhiều từ tồn kho' })
    fireEvent.change(within(hop).getByLabelText('Lấy lần này SAT0352'), {
      target: { value: '12,5' },
    })
    fireEvent.change(within(hop).getByLabelText('Lấy lần này VIT0012'), {
      target: { value: '1.200' },
    })
    expect((within(hop).getByLabelText('Chọn SAT0352') as HTMLInputElement).checked).toBe(
      true,
    )
    fireEvent.click(within(hop).getByRole('button', { name: 'Đưa 2 dòng vào phiếu' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    const grid = screen.getByRole('table', { name: 'Dòng hàng xuất' })
    expect(within(grid).getByText('SAT0352')).toBeTruthy()
    expect(within(grid).getByText('VIT0012')).toBeTruthy()
    expect((document.getElementById('xuat-qty-0') as HTMLInputElement).value).toBe('12,5')
    expect((document.getElementById('xuat-qty-1') as HTMLInputElement).value).toBe(
      '1.200',
    )
    expect(screen.getByText(/Đã đưa 2 dòng vào phiếu/)).toBeTruthy()
    expect(api).not.toHaveBeenCalled()
  })

  it('chọn nhiều: mã đã có trong phiếu không tích lại được, nói đã có ở dòng nào', async () => {
    const o = dung()
    go(o, 'VIT0012')
    fireEvent.keyDown(o, { key: 'Enter' })
    await waitFor(() => expect(document.activeElement?.id).toBe('xuat-qty-0'))
    fireEvent.click(screen.getByRole('button', { name: /Chọn nhiều từ tồn kho/ }))
    const hop = screen.getByRole('dialog', { name: 'Chọn nhiều từ tồn kho' })
    expect(within(hop).queryByLabelText('Chọn VIT0012')).toBeNull()
    expect(within(hop).getByText('đã có ở dòng 1')).toBeTruthy()
  })
})
