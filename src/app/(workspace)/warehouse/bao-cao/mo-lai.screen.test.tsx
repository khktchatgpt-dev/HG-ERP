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
import type { NhatKyKy } from '@/modules/dept/warehouse/nxt.repo'
import { ApiError } from '@/lib/api'
import { MoLaiHop, NhatKyHop } from './mo-lai'

/**
 * MỞ LẠI THÁNG ĐÃ CHỐT (B3, bản vẽ chốt kỳ khung 6). Ví dụ: tháng 09 và 10 đã chốt
 * cùng lượt, mở lại tháng 10 → khoá lùi về 30/09, Kho ghi được phiếu từ 01/10.
 */
afterEach(cleanup)

const NHAT_KY: NhatKyKy[] = [
  { id: 'a', thang: '2026-10', action: 'close', reason: null, ai: 'Vũ Phương Thảo', gt_ton_cuoi: 4_118_042_091, created_at: '2026-12-02T07:05:00Z' }, // prettier-ignore
  { id: 'b', thang: '2026-09', action: 'close', reason: null, ai: 'Vũ Phương Thảo', gt_ton_cuoi: 77_223_916, created_at: '2026-12-02T07:05:00Z' }, // prettier-ignore
]

const dung = (
  onMoLai = vi.fn().mockResolvedValue(undefined),
  daChot = ['2026-09', '2026-10'],
) =>
  render(
    <MoLaiHop
      thang="2026-10"
      den="2026-10-31"
      chot={{ closed_at: '2026-12-02T07:05:00Z', closed_by: 'Vũ Phương Thảo' }}
      thangDaChot={daChot}
      nhatKy={NHAT_KY}
      onClose={() => {}}
      onMoLai={onMoLai}
    />,
  )

describe('MoLaiHop', () => {
  it('nói trước hệ quả: khoá 31/10 → 30/09, Kho ghi được phiếu từ 01/10; bày nhật ký', () => {
    dung()
    const ds = screen.getByRole('list', { name: 'Sau khi mở lại' })
    expect(ds.textContent).toContain('31/10/2026 → 30/09/2026')
    expect(ds.textContent).toContain('Ghi được phiếu ngày từ 01/10/2026')
    const nk = screen.getByRole('table', { name: 'Nhật ký chốt kỳ' })
    expect(within(nk).getAllByRole('row')).toHaveLength(3)
    expect(nk.textContent).toContain('Chốt 10/2026')
  })

  it('tháng chốt đầu tiên: mở lại là hết khoá', () => {
    dung(undefined, ['2026-10'])
    const ds = screen.getByRole('list', { name: 'Sau khi mở lại' })
    expect(ds.textContent).toContain('hết khoá')
    expect(ds.textContent).toContain('Ghi được phiếu mọi ngày')
  })

  it('lý do < 10 ký tự: nút khoá, câu chặn bấm được đưa con trỏ về ô lý do; đủ thì gửi lý do đã cắt khoảng trắng', async () => {
    const onMoLai = vi.fn().mockResolvedValue(undefined)
    dung(onMoLai)
    const nut = screen.getByRole('button', { name: 'Mở lại tháng 10/2026' })
    expect(nut.getAttribute('aria-disabled')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: /Chưa mở được: ghi lý do/ }))
    const o = screen.getByLabelText('Lý do mở lại *')
    expect(document.activeElement).toBe(o)
    fireEvent.click(nut)
    expect(onMoLai).not.toHaveBeenCalled()

    fireEvent.change(o, { target: { value: '  ghi bù phiếu xuất 09-MX  ' } })
    expect(nut.getAttribute('aria-disabled')).toBe('false')
    expect(screen.queryByRole('button', { name: /Chưa mở được/ })).toBeNull()
    fireEvent.click(nut)
    await waitFor(() => expect(onMoLai).toHaveBeenCalledWith('ghi bù phiếu xuất 09-MX'))
  })

  it('máy chủ từ chối → câu lỗi hiện tại chỗ ở chân hộp, sửa lý do thì câu tắt', async () => {
    const onMoLai = vi
      .fn()
      .mockRejectedValue(
        new ApiError(409, 'Chỉ mở lại được tháng chốt mới nhất (11/2026)'),
      )
    dung(onMoLai)
    const o = screen.getByLabelText('Lý do mở lại *')
    fireEvent.change(o, { target: { value: 'ghi bù phiếu xuất 09-MX' } })
    fireEvent.click(screen.getByRole('button', { name: 'Mở lại tháng 10/2026' }))
    expect((await screen.findByRole('alert')).textContent).toContain(
      'tháng chốt mới nhất (11/2026)',
    )
    fireEvent.change(o, { target: { value: 'ghi bù phiếu xuất 09-MX tổ May' } })
    expect(screen.queryByRole('alert')).toBeNull()
  })
})

describe('NhatKyHop', () => {
  it('rỗng nói rõ chưa có lần chốt nào; dòng mở lại bày lý do', () => {
    const { unmount } = render(<NhatKyHop ds={[]} onClose={() => {}} />)
    expect(screen.getByText('Chưa có lần chốt hay mở lại nào trên ERP.')).toBeTruthy()
    unmount()
    render(
      <NhatKyHop
        ds={[{ id: 'r', thang: '2026-10', action: 'reopen', reason: 'ghi bù phiếu xuất 09-MX', ai: 'Vũ Phương Thảo', gt_ton_cuoi: null, created_at: '2026-12-03T02:00:00Z' }]} // prettier-ignore
        onClose={() => {}}
      />,
    )
    const nk = screen.getByRole('table', { name: 'Nhật ký chốt kỳ' })
    expect(nk.textContent).toContain('Mở lại 10/2026')
    expect(nk.textContent).toContain('ghi bù phiếu xuất 09-MX')
  })
})
