// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { SoPhieuDong } from '@/lib/kho-so-phieu'
import { SoPhieuKyScreen } from './SoPhieuKyScreen'

/**
 * Sổ phiếu theo kỳ · lọc "Của tôi" (bước 3 phụ trách nhóm vật tư, 24/11/2026): phiếu
 * thuộc người giữ nhóm vật tư trên dòng; rổ "Thiếu số NCC" đếm phần của người xem.
 */
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/warehouse/phieu-nhap',
}))
afterEach(cleanup)

const p = (id: string, giu: string[], thieu = false): SoPhieuDong => ({
  id,
  code: `PNK-2026-${id}`,
  kind: 'receipt',
  doc_date: '2026-11-21',
  status: 'posted',
  counterparty: 'NCC ' + id,
  team_name: null,
  dien_giai: null,
  dao_cua: null,
  dao_boi: null,
  ma: ['N1'],
  so_dong: 1,
  don: null,
  lenh: [],
  supplier_doc_no: null,
  thieu_ncc: thieu,
  created_by: 'nga',
  created_by_name: 'Đặng Thị Thanh Nga',
  giu,
})
const NGUOI = [
  { id: 'hao', name: 'Lê Khắc Hào', thu_kho: true },
  { id: 'ha', name: 'Hà Nguyễn Nữ', thu_kho: false },
]
const dung = (meId: string, rows = [p('0231', ['ha'], true), p('0230', ['hao'], true), p('0229', ['ha'])]) =>
  render(
    <SoPhieuKyScreen
      loai="receipt"
      ky="2026-11"
      today="2026-11-24"
      data={{ rows, theoThang: { '2026-11': rows.length }, ganNhat: null, nguoiKho: NGUOI }}
      loc={{ q: '', ro: '', lyDo: '', nguoi: '' }}
      canEdit
      meId={meId}
    />,
  )
const seg = () => screen.getByRole('radiogroup', { name: 'Người Kho giữ đơn' })
const ro = () => screen.getByRole('radiogroup', { name: 'Rổ' })

describe('Sổ phiếu · của tôi', () => {
  it('nhân viên mở là "Của tôi": chỉ phiếu của mình, rổ Thiếu số NCC đếm phần mình', () => {
    dung('ha')
    expect(within(seg()).getByRole('radio', { name: /Của tôi/ }).getAttribute('aria-checked')).toBe('true') // prettier-ignore
    expect(screen.getByRole('link', { name: 'PNK-2026-0231' })).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'PNK-2026-0230' })).toBeNull()
    expect(within(ro()).getByRole('radio', { name: /Thiếu số NCC/ }).textContent).toBe('Thiếu số NCC1') // prettier-ignore
    fireEvent.click(within(seg()).getByRole('radio', { name: /Tất cả/ }))
    expect(screen.getByRole('link', { name: 'PNK-2026-0230' })).toBeTruthy()
    expect(within(ro()).getByRole('radio', { name: /Thiếu số NCC/ }).textContent).toBe('Thiếu số NCC2') // prettier-ignore
  })

  it('thủ kho mở là "Tất cả"', () => {
    dung('hao')
    expect(within(seg()).getByRole('radio', { name: /Tất cả/ }).getAttribute('aria-checked')).toBe('true') // prettier-ignore
    expect(screen.getByRole('link', { name: 'PNK-2026-0230' })).toBeTruthy()
  })

  it('lọc theo một người không có phiếu: nói rõ và cho xem tất cả', () => {
    dung('hao', [p('0230', ['hao'])])
    fireEvent.click(within(seg()).getByRole('radio', { name: /Hà Nguyễn Nữ/ }))
    expect(screen.getByText('Hà Nguyễn Nữ không có phiếu nhập nào tháng 11')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Xem cả 1 phiếu' }))
    expect(screen.getByRole('link', { name: 'PNK-2026-0230' })).toBeTruthy()
  })
})
