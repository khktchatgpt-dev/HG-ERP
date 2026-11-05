import { describe, expect, it } from 'vitest'
import {
  DUYET_KHI_CHUA_XEM,
  choBaoLau,
  lyDoChuaTrinh,
  traLaiNhap,
  chuaXem,
  laDuyetKhiChuaXem,
  reviewMark,
  reviewMarks,
  truongPhongXem,
  vetKyDong,
  vuaDoiCau,
  type VetKy,
} from './po-review'

const v = (action: string, at: string, extra: Partial<VetKy> = {}): VetKy => ({
  action,
  actor_id: 'u1',
  reason: null,
  created_at: `2026-11-05T${at}:00Z`,
  ...extra,
})

describe('reviewMark — dấu "trưởng phòng đã xem" còn hiệu lực', () => {
  it('gửi rồi trưởng phòng xem → có dấu, kèm ghi chú', () => {
    const m = reviewMark([
      v('submitted', '08:00'),
      v('reviewed', '09:15', { actor_id: 'u-hieu', actor_name: 'Đỗ Ngọc Hiếu', reason: ' Giá giữ như 0228 ' }), // prettier-ignore
    ])
    expect(m).toEqual({
      by: 'u-hieu',
      by_name: 'Đỗ Ngọc Hiếu',
      at: '2026-11-05T09:15:00Z',
      note: 'Giá giữ như 0228',
    })
  })

  it('chưa ai xem → null', () => {
    expect(reviewMark([v('submitted', '08:00')])).toBeNull()
    expect(reviewMark([])).toBeNull()
  })

  it('rút về sửa rồi gửi lại → dấu cũ hết hiệu lực', () => {
    expect(
      reviewMark([
        v('submitted', '08:00'),
        v('reviewed', '09:00'),
        v('withdrawn', '09:30'),
        v('submitted', '10:00'),
      ]),
    ).toBeNull()
  })

  it('bị trả lại (trưởng phòng hoặc GĐ) rồi gửi lại → phải xem lại', () => {
    for (const ve of ['returned', 'rejected', 'reopened']) {
      expect(
        reviewMark([
          v('submitted', '08:00'),
          v('reviewed', '09:00'),
          v(ve, '09:30'),
          v('submitted', '10:00'),
        ]),
        ve,
      ).toBeNull()
    }
  })

  it('về nháp mà sổ thiếu dòng gửi lại → vẫn không tính dấu cũ', () => {
    expect(
      reviewMark([
        v('submitted', '08:00'),
        v('reviewed', '09:00'),
        v('withdrawn', '09:30'),
      ]),
    ).toBeNull()
  })

  it('thu hồi chữ ký (đơn quay lại chờ duyệt, nội dung không đổi) → dấu vẫn còn', () => {
    expect(
      reviewMark([
        v('submitted', '08:00'),
        v('reviewed', '09:00'),
        v('approved', '10:00'),
        v('unapproved', '11:00'),
      ]),
    ).not.toBeNull()
  })

  it('xem hai lần (bấm trùng) → lấy lần đầu', () => {
    expect(reviewMark([v('submitted', '08:00'), v('reviewed', '09:00'), v('reviewed', '09:01')])?.at).toBe('2026-11-05T09:00:00Z') // prettier-ignore
  })

  it('sổ không xếp sẵn → tự xếp theo thời gian', () => {
    expect(
      reviewMark([
        v('submitted', '10:00'),
        v('reviewed', '09:00'),
        v('submitted', '08:00'),
      ]),
    ).toBeNull()
  })

  it('đơn trước 0128 (không có dòng gửi) → tính từ đầu sổ', () => {
    expect(reviewMark([v('reviewed', '09:00')])).not.toBeNull()
  })
})

describe('reviewMarks — nhiều đơn một lượt', () => {
  it('chỉ đơn còn dấu mới có trong Map', () => {
    const m = reviewMarks([
      { ...v('submitted', '08:00'), entity_id: 'a' },
      { ...v('reviewed', '09:00'), entity_id: 'a' },
      { ...v('submitted', '08:30'), entity_id: 'b' },
    ])
    expect([...m.keys()]).toEqual(['a'])
  })
})

describe('vuaDoiCau — nói thật vì sao không ghi được', () => {
  const gio = (iso: string) => iso.slice(11, 16)
  it('lấy mốc gần nhất làm đơn rời hàng chờ xem, kèm người + giờ', () => {
    expect(
      vuaDoiCau(
        'PO-2026-0236',
        [
          v('submitted', '08:00'),
          v('withdrawn', '09:18', { actor_name: 'Đặng Thị Thanh Nga' }),
        ],
        gio,
      ),
    ).toBe('PO-2026-0236 vừa được Đặng Thị Thanh Nga rút về nháp lúc 09:18')
  })

  it('GĐ duyệt trước → nói duyệt', () => {
    expect(
      vuaDoiCau('PO-1', [v('submitted', '10:45'), v('approved', '11:02', { actor_name: 'Alex' })], gio), // prettier-ignore
    ).toBe('PO-1 vừa được Alex duyệt lúc 11:02')
  })

  it('không có mốc nào → null', () => {
    expect(vuaDoiCau('PO-1', [v('submitted', '08:00')], gio)).toBeNull()
  })
})

describe('laDuyetKhiChuaXem — dấu tường minh trên dòng duyệt', () => {
  it('chỉ dòng approved mang lý do đánh dấu', () => {
    expect(laDuyetKhiChuaXem({ action: 'approved', reason: DUYET_KHI_CHUA_XEM })).toBe(
      true,
    )
    expect(laDuyetKhiChuaXem({ action: 'approved', reason: null })).toBe(false)
    expect(laDuyetKhiChuaXem({ action: 'rejected', reason: DUYET_KHI_CHUA_XEM })).toBe(
      false,
    )
  })
})

describe('truongPhongXem — trưởng phòng trên một đơn chờ ký (B3)', () => {
  const dau = {
    by: 'u-lead',
    by_name: 'Đỗ Ngọc Hiếu',
    at: '2026-11-05T02:15:00Z',
    note: null,
  }
  const ctx = { ten: 'Đỗ Ngọc Hiếu', ids: ['u-lead'], marks: new Map([['po-1', dau]]) }
  const now = Date.parse('2026-11-05T03:30:00Z')

  it('chưa có trưởng phòng → null (không áp: không cột, không khoá)', () => {
    expect(truongPhongXem(null, 'po-1', '2026-11-05T03:00:00Z', now)).toBeNull()
    expect(chuaXem(null)).toBe(false)
  })
  it('đã xem → mang dấu; chưa xem → da_xem null + số phút chờ', () => {
    const a = truongPhongXem(ctx, 'po-1', '2026-11-05T02:00:00Z', now)!
    expect(a.da_xem).toEqual(dau)
    expect(chuaXem(a)).toBe(false)
    const b = truongPhongXem(ctx, 'po-2', '2026-11-05T03:05:00Z', now)!
    expect(b).toEqual({ ten: 'Đỗ Ngọc Hiếu', da_xem: null, cho_phut: 25 })
    expect(chuaXem(b)).toBe(true)
  })
  it('giờ gửi lệch về tương lai (đồng hồ máy) → 0, không âm', () => {
    expect(truongPhongXem(ctx, 'po-2', '2026-11-05T04:00:00Z', now)!.cho_phut).toBe(0)
  })
})

describe('choBaoLau — "chưa xem · 25′"', () => {
  it('phút · giờ · ngày', () => {
    expect(choBaoLau(0)).toBe('0′')
    expect(choBaoLau(25)).toBe('25′')
    expect(choBaoLau(60)).toBe('1 giờ')
    expect(choBaoLau(18 * 60 + 40)).toBe('18 giờ')
    expect(choBaoLau(1440 * 2 + 5)).toBe('2 ngày')
    expect(choBaoLau(-3)).toBe('0′')
  })
})

describe('vetKyDong — nhãn lịch sử ký (B4)', () => {
  it('đã xem / trả lại có nhãn trưởng phòng; ghi chú giữ nguyên', () => {
    expect(vetKyDong({ action: 'reviewed', reason: ' Giá giữ như 0228 ' })).toEqual({
      label: 'Trưởng phòng đã xem',
      tone: 'done',
      detail: 'Giá giữ như 0228',
    })
    expect(vetKyDong({ action: 'returned', reason: 'Thiếu khổ 670' }).label).toBe(
      'Trưởng phòng trả lại để sửa',
    )
  })
  it('duyệt khi chưa xem: dấu thành nhãn, phần sau dấu mới là ghi chú', () => {
    expect(vetKyDong({ action: 'approved', reason: DUYET_KHI_CHUA_XEM })).toEqual({
      label: 'Giám đốc duyệt — trưởng phòng chưa xem',
      tone: 'warn',
      detail: null,
    })
    expect(
      vetKyDong({ action: 'approved', reason: `${DUYET_KHI_CHUA_XEM} · gấp, NCC chờ` })
        .detail,
    ).toBe('gấp, NCC chờ')
    expect(vetKyDong({ action: 'approved', reason: null })).toMatchObject({
      label: 'Giám đốc duyệt',
      detail: null,
    })
  })
  it('mốc lạ không mất: bày nguyên mã', () => {
    expect(vetKyDong({ action: 'la', reason: null }).label).toBe('la')
  })
})

describe('traLaiNhap — nháp bị trả lại rời hộp tới khi NV sửa', () => {
  const tra = v('returned', '02:00', {
    actor_name: 'Đỗ Ngọc Hiếu',
    reason: ' Thiếu khổ 670 ',
  })
  it('trả lại, NV chưa sửa → còn hiệu lực, chưa sửa', () => {
    expect(traLaiNhap([v('submitted', '01:00'), tra], '2026-11-05T01:59:00Z')).toEqual({
      at: tra.created_at,
      by_name: 'Đỗ Ngọc Hiếu',
      reason: 'Thiếu khổ 670',
      da_sua: false,
    })
  })
  it('NV lưu nháp sau lúc trả lại → đã sửa (quay lại hộp, có nhãn)', () => {
    expect(traLaiNhap([tra], '2026-11-05T02:05:00Z')?.da_sua).toBe(true)
  })
  it('GĐ trả lại / hạ về nháp cũng tính; tự rút về hay đã gửi lại thì không', () => {
    expect(traLaiNhap([v('rejected', '02:00')], '2026-11-05T01:00:00Z')).not.toBeNull()
    expect(traLaiNhap([v('reopened', '02:00')], '2026-11-05T01:00:00Z')).not.toBeNull()
    expect(traLaiNhap([tra, v('withdrawn', '03:00')], '2026-11-05T01:00:00Z')).toBeNull()
    expect(traLaiNhap([tra, v('submitted', '03:00')], '2026-11-05T01:00:00Z')).toBeNull()
    expect(traLaiNhap([], '2026-11-05T01:00:00Z')).toBeNull()
  })
})

describe('lyDoChuaTrinh — khoá nút trình trên nháp thiếu', () => {
  const ncc = {
    is_active: true,
    can_order: true,
    lock_reason: null,
    is_marketplace: false,
  }
  const du = { so_dong: 3, expected_at: '2026-11-20', production_order_id: 'l1', project_id: null, ncc } // prettier-ignore
  it('đủ → null', () => expect(lyDoChuaTrinh(du)).toBeNull())
  it('thứ tự như hàng rào máy chủ: dòng → NCC → sàn → hạng mục → hẹn giao', () => {
    expect(lyDoChuaTrinh({ ...du, so_dong: 0, expected_at: null })).toBe(
      'Chưa có dòng hàng',
    )
    expect(lyDoChuaTrinh({ ...du, ncc: { ...ncc, can_order: false, lock_reason: 'nợ' } })).toMatch(/khoá đặt hàng — nợ/) // prettier-ignore
    expect(lyDoChuaTrinh({ ...du, production_order_id: null })).toBe('Đơn ngoài lệnh chưa chọn hạng mục') // prettier-ignore
    expect(lyDoChuaTrinh({ ...du, expected_at: null })).toBe('Chưa có hẹn giao')
    expect(lyDoChuaTrinh({ ...du, ncc: { ...ncc, is_marketplace: true }, marketplace_shop: null })).not.toBeNull() // prettier-ignore
  })
})
