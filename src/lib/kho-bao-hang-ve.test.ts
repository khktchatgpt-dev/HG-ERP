import { describe, expect, it } from 'vitest'
import {
  baoKhiDoiHen,
  baoKhiXacNhan,
  nguoiNhan,
  tieuDeDoiHen,
  tieuDeXacNhan,
} from './kho-bao-hang-ve'

const H = '2026-10-19'

describe('baoKhiXacNhan — Q4: chỉ lô hẹn trong 3 ngày tới', () => {
  it('hôm nay, +3 ngày, đã quá → báo', () => {
    expect(baoKhiXacNhan('2026-10-19', H)).toBe(true)
    expect(baoKhiXacNhan('2026-10-22', H)).toBe(true)
    expect(baoKhiXacNhan('2026-10-10', H)).toBe(true)
  })
  it('+4 ngày trở đi, hoặc chưa có ngày → không báo', () => {
    expect(baoKhiXacNhan('2026-10-23', H)).toBe(false)
    expect(baoKhiXacNhan(null, H)).toBe(false)
  })
  it('qua tháng vẫn đúng', () => {
    expect(baoKhiXacNhan('2026-11-02', '2026-10-30')).toBe(true)
  })
})

describe('baoKhiDoiHen', () => {
  it('chỉ khi ngày thật sự đổi', () => {
    expect(baoKhiDoiHen('2026-10-19', '2026-10-23')).toBe(true)
    expect(baoKhiDoiHen('2026-10-19', '2026-10-19')).toBe(false)
    expect(baoKhiDoiHen(null, '2026-10-23')).toBe(true)
  })
})

describe('tiêu đề', () => {
  it('xác nhận: hôm nay / sắp tới / đã quá', () => {
    expect(tieuDeXacNhan('PO-2026-0144', 'Phú Khang', '2026-10-21', H)).toBe('PO-2026-0144 · Phú Khang hẹn giao 21/10') // prettier-ignore
    expect(tieuDeXacNhan('PO-2026-0144', 'Phú Khang', H, H)).toBe('PO-2026-0144 · Phú Khang hẹn giao hôm nay') // prettier-ignore
    expect(tieuDeXacNhan('PO-2026-0144', 'Phú Khang', '2026-10-15', H)).toBe('PO-2026-0144 · Phú Khang đã quá hẹn 15/10') // prettier-ignore
  })
  it('dời hẹn: có đợt + lý do / cả đơn', () => {
    expect(tieuDeDoiHen('PO-2026-0126', 'Việt Eco', '2026-10-19', '2026-10-23', 'đợt 2', 'NCC thiếu nhôm')).toBe('PO-2026-0126 (đợt 2) · Việt Eco dời hẹn 19/10 → 23/10 — NCC thiếu nhôm') // prettier-ignore
    expect(tieuDeDoiHen('PO-2026-0126', 'Việt Eco', null, '2026-10-23', null, null)).toBe('PO-2026-0126 · Việt Eco dời hẹn sang 23/10') // prettier-ignore
  })
})

describe('nguoiNhan — Q5: vai Kho trừ người bấm', () => {
  it('bỏ người bấm, khử trùng', () => {
    expect(nguoiNhan([{ id: 'hao' }, { id: 'nu' }, { id: 'nga' }, { id: 'nu' }], 'nga')).toEqual(['hao', 'nu']) // prettier-ignore
  })
})
