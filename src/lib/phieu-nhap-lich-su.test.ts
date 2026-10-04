import { describe, expect, it } from 'vitest'
import { lichSuPhieuNhap, phieuNhapKhacCuaDon } from './phieu-nhap-lich-su'

const goc = {
  code: 'PNK-2026-0066',
  ghiSo: { at: '2026-10-02T01:54:25Z', actor: 'Đặng Thị Thanh Nga', soDong: 15 },
}
const doc = (o: Partial<Parameters<typeof phieuNhapKhacCuaDon>[1][number]>) => ({
  doc_id: 'x',
  code: 'X',
  kind: 'receipt' as const,
  entered_at: '2026-10-02T02:00:30Z',
  at: '2026-10-02',
  reversal_of: null,
  fix_of: null,
  adjust_of: null,
  reversed_by: null,
  ...o,
})

describe('lichSuPhieuNhap', () => {
  it('phiếu chưa có chuyện gì → đúng một mốc ghi sổ', () => {
    const m = lichSuPhieuNhap({ ...goc, dao: null, cungDon: [], ghiChuDon: [] })
    expect(m).toHaveLength(1)
    expect(m[0]).toMatchObject({ label: 'Ghi sổ PNK-2026-0066', detail: '15 dòng' })
  })

  it('đảo + lập lại: xếp theo giờ, đảo mang lý do', () => {
    const m = lichSuPhieuNhap({
      ...goc,
      dao: {
        code: 'PXK-2026-0029',
        at: '2026-10-02T02:00:25Z',
        actor: 'Nga',
        reason: 'Gỡ 2 dòng bàn Elos',
      },
      cungDon: [doc({ doc_id: 'b', code: 'PNK-2026-0077', fix_of: 'PNK-2026-0066' })],
      ghiChuDon: [],
    })
    expect(m.map((x) => x.label)).toEqual([
      'Ghi sổ PNK-2026-0066',
      'Đảo bằng PXK-2026-0029',
      'Lập lại bằng PNK-2026-0077',
    ])
    expect(m[1]).toMatchObject({ detail: 'Gỡ 2 dòng bàn Elos', tone: 'stop' })
  })

  it('ghi chú vết của đơn: chỉ lấy câu nhắc ĐÚNG mã, bỏ câu đã xoá, không khớp mã dài hơn', () => {
    const m = lichSuPhieuNhap({
      ...goc,
      dao: null,
      cungDon: [],
      ghiChuDon: [
        { id: '1', at: '2026-10-03T01:00:00Z', actor: 'Nga', body: 'Sửa thông tin PNK-2026-0066 — Số phiếu NCC: (trống) → “03-2026 HG/KP”. Lý do: chép từ phiếu giao', deleted: false }, // prettier-ignore
        { id: '2', at: '2026-10-03T02:00:00Z', actor: 'Nga', body: 'Sửa thông tin PNK-2026-00661 — x', deleted: false }, // prettier-ignore
        { id: '3', at: '2026-10-03T03:00:00Z', actor: 'Nga', body: 'Sửa thông tin PNK-2026-0066 — y', deleted: true }, // prettier-ignore
      ],
    })
    expect(m).toHaveLength(2)
    expect(m[1]).toMatchObject({
      label: 'Sửa thông tin PNK-2026-0066',
      detail: 'Số phiếu NCC: (trống) → “03-2026 HG/KP”. Lý do: chép từ phiếu giao',
    })
  })

  it('điều chỉnh có cả phiếu đ/c lẫn ghi chú vết → chỉ một mốc (ghi chú thắng)', () => {
    const m = lichSuPhieuNhap({
      ...goc,
      dao: null,
      cungDon: [doc({ doc_id: 'c', code: 'PXK-2026-0040', kind: 'adjustment', adjust_of: 'PNK-2026-0066' })], // prettier-ignore
      ghiChuDon: [{ id: '9', at: '2026-10-04T01:00:00Z', actor: 'Nga', body: 'Điều chỉnh PNK-2026-0066 bằng PXK-2026-0040 — BAO0687: 150 → 140. Lý do: thùng hỏng', deleted: false }], // prettier-ignore
    })
    expect(m.map((x) => x.label)).toEqual([
      'Ghi sổ PNK-2026-0066',
      'Điều chỉnh PNK-2026-0066 bằng PXK-2026-0040',
    ])
  })

  it('ghi chú gõ tay có nhắc mã phiếu → "Ghi chú trên đơn", giữ nguyên văn', () => {
    const body =
      'Gỡ 2 dòng bàn Elos khỏi PO-2026-0045 — chưa có kích thước. Ghi lại phiếu PNK-2026-0066 cho các dòng còn lại.'
    const m = lichSuPhieuNhap({
      ...goc,
      dao: null,
      cungDon: [],
      ghiChuDon: [
        { id: '5', at: '2026-10-02T02:01:00Z', actor: 'Nga', body, deleted: false },
      ],
    })
    expect(m[1]).toMatchObject({ label: 'Ghi chú trên đơn', detail: body })
  })

  it('phiếu đ/c không có ghi chú vết vẫn thành mốc', () => {
    const m = lichSuPhieuNhap({
      ...goc,
      dao: null,
      cungDon: [doc({ doc_id: 'c', code: 'PNK-2026-0101', kind: 'adjustment', adjust_of: 'PNK-2026-0066' })], // prettier-ignore
      ghiChuDon: [],
    })
    expect(m[1].label).toBe('Điều chỉnh chênh lệch bằng PNK-2026-0101')
  })
})

describe('phieuNhapKhacCuaDon', () => {
  it('chỉ phiếu NHẬP khác của đơn, nói còn hiệu lực hay đã đảo', () => {
    const r = phieuNhapKhacCuaDon('PNK-2026-0066', [
      doc({ doc_id: 'a', code: 'PNK-2026-0066', reversed_by: 'PXK-2026-0029' }),
      doc({ doc_id: 'b', code: 'PNK-2026-0077' }),
      doc({ doc_id: 'c', code: 'PXK-2026-0029', kind: 'reversal' }),
      doc({ doc_id: 'd', code: 'PNK-2026-0038', reversed_by: 'PXK-2026-0010' }),
    ])
    expect(r).toEqual([
      { doc_id: 'b', code: 'PNK-2026-0077', at: '2026-10-02', con_hieu_luc: true },
      { doc_id: 'd', code: 'PNK-2026-0038', at: '2026-10-02', con_hieu_luc: false },
    ])
  })
})
