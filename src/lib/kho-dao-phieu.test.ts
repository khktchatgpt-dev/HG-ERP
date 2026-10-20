import { describe, expect, it } from 'vitest'
import { canDao, type TinhTrangPhieu } from './kho-dao-phieu'

const ok: TinhTrangPhieu = {
  kind: 'receipt',
  status: 'posted',
  laPhieuDao: false,
  daBiDaoBoi: null,
  coHangLoai: false,
  soDong: 3,
}

describe('canDao', () => {
  it('phiếu nhập đã áp sổ thì đảo được, kèm cảnh báo về tồn', () => {
    const r = canDao(ok)
    expect(r.duoc).toBe(true)
    if (r.duoc) expect(r.canhBao).toMatch(/còn đủ trong kho/)
  })

  it('phiếu xuất đã áp sổ đảo được và KHÔNG cảnh báo tồn', () => {
    const r = canDao({ ...ok, kind: 'issue' })
    expect(r.duoc).toBe(true)
    if (r.duoc) expect(r.canhBao).toBeNull()
  })

  it('kiểm kê bị chặn và chỉ sang vòng duyệt riêng', () => {
    const r = canDao({ ...ok, kind: 'stocktake' })
    expect(r.duoc).toBe(false)
    if (!r.duoc) expect(r.goBang).toMatch(/vòng duyệt riêng/)
  })

  it('phiếu chờ duyệt bị chặn vì tồn chưa đổi', () => {
    const r = canDao({ ...ok, status: 'pending' })
    expect(r.duoc).toBe(false)
    if (!r.duoc) expect(r.vuong).toMatch(/chưa áp sổ/)
  })

  it('phiếu đã bị từ chối bị chặn', () => {
    const r = canDao({ ...ok, status: 'rejected' })
    expect(r.duoc).toBe(false)
  })

  it('chính nó là phiếu đảo thì không đảo tiếp', () => {
    const r = canDao({ ...ok, laPhieuDao: true })
    expect(r.duoc).toBe(false)
    if (!r.duoc) expect(r.goBang).toMatch(/phiếu nhập \/ phiếu xuất thường/)
  })

  it('đã bị đảo rồi thì nêu đích danh mã phiếu đảo', () => {
    const r = canDao({ ...ok, daBiDaoBoi: 'PXK-2026-0007' })
    expect(r.duoc).toBe(false)
    if (!r.duoc) {
      expect(r.vuong).toContain('PXK-2026-0007')
      expect(r.goBang).toContain('PXK-2026-0007')
    }
  })

  it('có hàng QC loại thì chỉ sang phiếu trả NCC', () => {
    const r = canDao({ ...ok, coHangLoai: true })
    expect(r.duoc).toBe(false)
    if (!r.duoc) expect(r.goBang).toMatch(/X3/)
  })

  it('phiếu rỗng dòng bị chặn', () => {
    const r = canDao({ ...ok, soDong: 0 })
    expect(r.duoc).toBe(false)
  })

  it('chặn CỨNG NHẤT được nói trước: kiểm kê thắng cả "đã bị đảo"', () => {
    const r = canDao({ ...ok, kind: 'stocktake', daBiDaoBoi: 'PNK-2026-0001' })
    expect(r.duoc).toBe(false)
    if (!r.duoc) expect(r.vuong).toMatch(/kiểm kê/i)
  })

  it('mọi nhánh chặn đều nói ĐỦ vướng gì và gỡ thế nào', () => {
    const chan: TinhTrangPhieu[] = [
      { ...ok, kind: 'stocktake' },
      { ...ok, kind: 'transfer' },
      { ...ok, status: 'pending' },
      { ...ok, status: 'rejected' },
      { ...ok, laPhieuDao: true },
      { ...ok, daBiDaoBoi: 'X' },
      { ...ok, coHangLoai: true },
      { ...ok, soDong: 0 },
    ]
    for (const t of chan) {
      const r = canDao(t)
      expect(r.duoc).toBe(false)
      if (!r.duoc) {
        expect(r.vuong.length).toBeGreaterThan(8)
        expect(r.goBang.length).toBeGreaterThan(20)
      }
    }
  })
})
