// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import { SoPhieuScreen, type PhieuRow } from './SoPhieuScreen'
import type { RoPhieu } from './ro-phieu'

/**
 * TAB PHIẾU XUẤT CÓ BỘ CỘT RIÊNG (28/10/2026 — chủ dự án: "phiếu xuất có PO đâu
 * cần thiết… không biết ở đâu ra, của ai"). Dữ liệu thật: 18 phiếu xuất trên sổ
 * đều do chị Nga ghi hộ 02/10 cho lệnh 06/26-27 - MX — cột Đơn / Lệnh / Đối ứng /
 * Số NCC của bộ cột chung trống trơn, Người lập ẩn khi khung hẹp.
 */
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/warehouse/phieu',
  useSearchParams: () => new URLSearchParams(''),
}))
afterEach(cleanup)

const GHI_HO =
  'Ghi hộ 02/10/2026: vật tư của PO-2026-0038 (PNK-2026-0061) đã đưa vào sản xuất lệnh 06/26-27 - MX trước khi dùng hệ thống'
const row = (
  p: Partial<PhieuRow> & Pick<PhieuRow, 'id' | 'code' | 'kind'>,
): PhieuRow => ({
  doc_date: '2026-10-02',
  counterparty: null,
  reason: null,
  status: 'posted',
  reversal_of_code: null,
  da_bi_dao: false,
  created_by_name: 'Đặng Thị Thanh Nga',
  ma_ly_do: ['X1'],
  supplier_doc_no: null,
  don: null,
  lenh_dong: [],
  dien_giai: null,
  thieu_ncc: false,
  ...p,
})
const PXK = row({
  id: 'x13',
  code: 'PXK-2026-0013',
  kind: 'issue',
  lenh_dong: ['06/26-27 - MX'],
  dien_giai: GHI_HO,
})
const PNK = row({
  id: 'n161',
  code: 'PNK-2026-0161',
  kind: 'receipt',
  ma_ly_do: ['N1'],
  counterparty: 'CÔNG TY TNHH XUẤT NHẬP KHẨU',
  don: { po_id: 'p204', po_code: 'PO-2026-0204', lsx: ['13/26-27 - MX'] },
  created_by_name: 'Quản trị viên',
})

const dung = (ro: RoPhieu, rows: PhieuRow[]) =>
  render(
    <SoPhieuScreen
      rows={rows}
      dem={{ all: 177, receipt: 145, issue: 18, stocktake: 2, thieu_ncc: 105, reversed: 24 }} // prettier-ignore
      total={rows.length}
      trang={1}
      soTrang={1}
      ro={ro}
      lyDo=""
      canEdit
      thieuGanDay={14}
      nguoi=""
      nguoiLap={[]}
      meId="u"
    />,
  )
const cot = () =>
  within(screen.getByRole('table', { name: 'Sổ phiếu kho' }))
    .getAllByRole('columnheader')
    .map((h) => h.textContent)

describe('Sổ phiếu · tab Phiếu xuất', () => {
  it('bỏ Đơn + Số phiếu NCC; Lệnh lấy từ dòng xuất; Diễn giải + Người lập luôn có', () => {
    dung('issue', [PXK])
    expect(cot()).toEqual(['Ngày', 'Số phiếu', 'Lý do', 'Lệnh SX', 'Người nhận', 'Diễn giải', 'Người lập']) // prettier-ignore
    const dong = screen.getByRole('row', { name: /PXK-2026-0013/ })
    expect(within(dong).getByText('06/26-27 - MX')).toBeTruthy()
    expect(within(dong).getByText(GHI_HO)).toBeTruthy()
    expect(within(dong).getByText('Đặng Thị Thanh Nga')).toBeTruthy()
  })

  it('tab khác giữ bộ cột chung; phiếu xuất không nối đơn vẫn hiện lệnh trên dòng', () => {
    dung('all', [PNK, PXK])
    expect(cot()).toEqual(['Ngày', 'Số phiếu', 'Lý do', 'Đơn', 'Lệnh SX', 'Đối ứng', 'Số phiếu NCC', 'Người lập']) // prettier-ignore
    expect(within(screen.getByRole('row', { name: /PNK-2026-0161/ })).getByText('13/26-27 - MX')).toBeTruthy() // prettier-ignore
    expect(within(screen.getByRole('row', { name: /PXK-2026-0013/ })).getByText('06/26-27 - MX')).toBeTruthy() // prettier-ignore
  })
})
