// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import type { KdDonLenh, KdLenhTong } from '@/lib/kho-don-theo-lenh'
import { LenhScreen } from './LenhScreen'

/**
 * Trang một lệnh · phụ trách nhóm vật tư (bước 2, 24/11/2026): cột "Kho giữ" và đơn
 * của người Kho khác chữ nhạt — vẫn hiện, vì trang trả lời cho CẢ lệnh.
 */
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/warehouse/nhap/theo-lenh/l1',
}))
afterEach(cleanup)

const LENH = {
  id: 'l1',
  code: '02/26-27 - ROSCO',
  ship_date: '2026-12-20',
  khach: 'ROSCO',
  don: 2,
  du: 0,
  mot_phan: 0,
  chua_ve: 2,
  chua_dat: 0,
  tre: 0,
  sai: 0,
  phieu_cuoi: null,
  ro: { cho: true, tre: false, du: false, all: true },
} as unknown as KdLenhTong
const don = (po: string): KdDonLenh => ({
  key: `l1:${po}`,
  lsx_id: 'l1',
  po_id: po,
  po_code: po,
  status: 'confirmed',
  supplier: 'NCC',
  hen: '2026-11-30',
  tinh: 'chua_ve',
  tre: null,
  dong_du: 0,
  dong_tong: 1,
  chot_thieu: false,
  gop: [],
  lenh_chinh: null,
  phieu: [],
  dong: [],
})
const dung = (giu?: Record<string, { ten: string; khac: boolean }>) =>
  render(
    <LenhScreen
      lenh={LENH}
      rows={[don('PO-2026-0183'), don('PO-2026-0159')]}
      tab="cho"
      today="2026-11-24"
      canEdit
      giu={giu}
    />,
  )

describe('Trang một lệnh · Kho giữ', () => {
  it('có cột Kho giữ; đơn của người khác chữ nhạt (kd-khac), đơn của tôi không', () => {
    dung({
      'PO-2026-0183': { ten: 'Hà Nguyễn Nữ', khac: false },
      'PO-2026-0159': { ten: 'Lê Khắc Hào', khac: true },
    })
    expect(screen.getAllByRole('columnheader').map((h) => h.textContent)).toContain('Kho giữ')
    const dong = (ma: string) => screen.getByRole('link', { name: ma }).closest('tr')!
    expect(dong('PO-2026-0159').className).toContain('kd-khac')
    expect(dong('PO-2026-0183').className).not.toContain('kd-khac')
    expect(dong('PO-2026-0159').textContent).toContain('Lê Khắc Hào')
  })

  it('chưa có người Kho: không có cột', () => {
    dung()
    expect(screen.getAllByRole('columnheader').map((h) => h.textContent)).not.toContain('Kho giữ')
  })
})
